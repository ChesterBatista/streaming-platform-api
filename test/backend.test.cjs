const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const bcrypt = require('bcrypt');
const { prismaMock, returns, implementsFn, args, prismaError } = require('./helpers.cjs');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { PrismaService } = require('../src/prisma/prisma.service');
const { JwtStrategy } = require('../src/auth/strategies/jwt.strategy');
const { ApiKeyGuard } = require('../src/common/guards/api-key.guard');
const { SubscriptionAccessService } = require('../src/subscriptions/subscription-access.service');
const features = [
  ['users', 'Users'], ['plans', 'Plans'], ['categories', 'Categories'], ['contents', 'Contents'],
  ['subscriptions', 'Subscriptions'], ['watch-history', 'WatchHistory'], ['ratings', 'Ratings'],
  ['auth', 'Auth'], ['uploads', 'Uploads'],
].map(([path, name]) => ({
  service: require(`../src/${path}/${path}.service`)[`${name}Service`],
  controller: require(`../src/${path}/${path}.controller`)[`${name}Controller`],
}));

describe('HTTP: real controllers, services, JWT, RBAC and validation; mocked Prisma', () => {
  let app, baseUrl, db, tokens;
  const apiKey = randomBytes(32).toString('hex');
  const jwtSecret = randomBytes(48).toString('hex');
  const jwt = new JwtService({ secret: jwtSecret });
  const users = [
    { id: 1, role: 'ADMIN', status: 'ACTIVE' },
    { id: 2, role: 'CONTENT_MANAGER', status: 'ACTIVE' },
    { id: 3, role: 'SUBSCRIBER', status: 'ACTIVE' },
    { id: 4, role: 'SUBSCRIBER', status: 'ACTIVE' },
    { id: 5, role: 'SUBSCRIBER', status: 'INACTIVE' },
  ];

  before(async () => {
    // Deliberately do not import AppModule/PrismaModule or load .env.
    const proxy = new Proxy({}, { get: (_, key) => db[key] });
    class TestModule {}
    Module({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: features.map((f) => f.controller),
      providers: [
        ...features.map((f) => f.service), SubscriptionAccessService, JwtStrategy,
        { provide: PrismaService, useValue: proxy },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: jwtSecret, API_KEY: apiKey }) },
        { provide: APP_GUARD, useClass: ApiKeyGuard },
      ],
    })(TestModule);
    db = prismaMock();
    app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    tokens = Object.fromEntries(users.map((u) => [u.role === 'SUBSCRIBER' && u.id !== 3 ? u.id : u.role,
      jwt.sign({ sub: u.id }, { expiresIn: '5m' })]));
  });
  after(async () => { if (app) await app.close(); });
  beforeEach(() => {
    db = prismaMock();
    implementsFn(db.user.findUnique, async ({ where }) => users.find((u) => u.id === where.id) ?? null);
  });

  async function request(method, path, role = 'ADMIN', body, extraHeaders = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'x-api-key': apiKey, ...(role && { Authorization: `Bearer ${tokens[role]}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }), ...extraHeaders },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  }
  async function expectStatus(status, ...input) {
    const result = await request(...input);
    assert.equal(result.status, status, JSON.stringify(result.body));
    if (status >= 400) assert.equal(result.body.statusCode, status);
    return result.body;
  }
  function accessibleContent() {
    returns(db.content.findFirst, { id: 10, status: 'PUBLISHED', durationMinutes: 2 });
  }

  describe('Login and multipart upload through HTTP', () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=', 'base64');
    it('login verifies bcrypt and issues a valid JWT without returning the password', async () => {
      const password = randomBytes(18).toString('hex');
      returns(db.user.findUnique, { ...users[0], email: 'test@example.com', password: await bcrypt.hash(password, 12) });
      const result = await expectStatus(200, 'POST', '/auth/login', null, { email: 'test@example.com', password });
      assert.equal(jwt.verify(result.accessToken).sub, 1);
      assert.equal(Object.hasOwn(result.user, 'password'), false);
      await expectStatus(401, 'POST', '/auth/login', null, { email: 'test@example.com', password: 'wrong-password' });
    });
    for (const [label, bytes, field, role, status] of [
      ['valid PNG', png, 'file', 'ADMIN', 201],
      ['missing file', null, 'file', 'ADMIN', 400],
      ['forged PNG', Buffer.from('not a PNG'), 'file', 'ADMIN', 400],
      ['oversized PNG', Buffer.alloc(5 * 1024 * 1024 + 1), 'file', 'ADMIN', 400],
      ['wrong multipart field', png, 'other', 'ADMIN', 400],
      ['subscriber upload', png, 'file', 'SUBSCRIBER', 403],
    ]) {
      it(`${label} returns ${status}; storage is isolated`, async (t) => {
        t.mock.method(fs, 'mkdir', async () => undefined);
        const write = t.mock.method(fs, 'writeFile', async () => undefined);
        returns(db.content.findUnique, { id: 10 });
        implementsFn(db.content.update, async ({ data }) => ({ id: 10, ...data }));
        const body = new FormData();
        if (bytes) body.append(field, new Blob([bytes], { type: 'image/png' }), 'test.png');
        const response = await fetch(`${baseUrl}/contents/10/thumbnail`, {
          method: 'POST', body,
          headers: { 'x-api-key': apiKey, Authorization: `Bearer ${tokens[role]}` },
          signal: AbortSignal.timeout(5000),
        });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        assert.equal(write.mock.callCount(), status === 201 ? 1 : 0);
        if (status === 201) assert.match(result.thumbnailUrl, /^\/uploads\/thumbnails\/[0-9a-f-]+\.png$/);
        else assert.equal(db.content.update.mock.callCount(), 0);
      });
    }
  });

  describe('Authentication and administrative permissions', () => {
    it('missing JWT returns 401', () => expectStatus(401, 'GET', '/users', null));
    it('invalid JWT returns 401', () => expectStatus(401, 'GET', '/users', 'ADMIN', undefined,
      { Authorization: 'Bearer invalid-test-token' }));
    it('expired JWT returns 401', () => expectStatus(401, 'GET', '/users', 'ADMIN', undefined,
      { Authorization: `Bearer ${jwt.sign({ sub: 1 }, { expiresIn: -1 })}` }));
    it('inactive identity returns 401', () => expectStatus(401, 'GET', '/contents', 5));
    it('JWT subject outside PostgreSQL Int range returns 401 before querying the user', async () => {
      await expectStatus(401, 'GET', '/users/me', 'ADMIN', undefined,
        { Authorization: `Bearer ${jwt.sign({ sub: 2147483648 }, { expiresIn: '5m' })}` });
      assert.equal(db.user.findUnique.mock.callCount(), 0);
    });
    it('missing API key returns 401', () => expectStatus(401, 'GET', '/users', 'ADMIN', undefined,
      { 'x-api-key': '' }));
    it('JWT role claim cannot promote a subscriber', () => expectStatus(403, 'GET', '/users', 'ADMIN', undefined,
      { Authorization: `Bearer ${jwt.sign({ sub: 3, role: 'ADMIN' }, { expiresIn: '5m' })}` }));

    const adminRoutes = [
      ['GET', '/users'], ['GET', '/subscriptions'], ['GET', '/subscriptions/1'],
      ['POST', '/subscriptions', { userId: 3, planId: 1 }],
      ['PATCH', '/subscriptions/1/status', { status: 'CANCELLED' }],
      ['POST', '/plans', { name: 'Test', price: 10 }],
      ['PATCH', '/plans/1', { name: 'Test' }],
      ['PATCH', '/plans/1/status', { status: 'INACTIVE' }],
    ];
    for (const role of ['SUBSCRIBER', 'CONTENT_MANAGER']) {
      for (const [method, path, body] of adminRoutes) {
        it(`${role} cannot ${method} ${path}`, () => expectStatus(403, method, path, role, body));
      }
    }
    for (const [path, model] of [['users', 'user'], ['subscriptions', 'subscription']]) {
      it(`ADMIN can list ${path}`, async () => {
        returns(db[model].count, 0);
        assert.deepEqual(await expectStatus(200, 'GET', `/${path}`), {
          data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      });
    }
    it('ADMIN can create a plan', async () => {
      returns(db.plan.findUnique, null);
      implementsFn(db.plan.create, async ({ data }) => ({ id: 1, ...data }));
      const result = await expectStatus(201, 'POST', '/plans', 'ADMIN', { name: 'Test', price: 10 });
      assert.equal(result.name, 'Test');
    });
    describe('Plans and Users: input validation regressions', () => {
      it('POST /plans rejects a null name with 400', () =>
        expectStatus(400, 'POST', '/plans', 'ADMIN', {
          name: null,
          price: 10,
        }));

      it('POST /plans rejects a name longer than 100 characters with 400', () =>
        expectStatus(400, 'POST', '/plans', 'ADMIN', {
          name: 'A'.repeat(101),
          price: 10,
        }));

      it('POST /plans rejects a price above Decimal(10,2) with 400', () =>
        expectStatus(400, 'POST', '/plans', 'ADMIN', {
          name: 'Plano de teste',
          price: 100000000,
        }));

      it('PATCH /plans rejects a null name with 400', () =>
        expectStatus(400, 'PATCH', '/plans/1', 'ADMIN', {
          name: null,
        }));

      it('PATCH /plans rejects a null price with 400', () =>
        expectStatus(400, 'PATCH', '/plans/1', 'ADMIN', {
          price: null,
        }));

      it('PATCH /plans rejects a price above Decimal(10,2) with 400', () =>
        expectStatus(400, 'PATCH', '/plans/1', 'ADMIN', {
          price: 100000000,
        }));

      for (const invalidId of ['0', '-1', '2147483648']) {
        for (const method of ['GET', 'PATCH']) {
          it(`${method} /categories/${invalidId} returns 400 without querying categories`, async () => {
            await expectStatus(400, method, `/categories/${invalidId}`, 'ADMIN',
              method === 'PATCH' ? { name: 'Categoria' } : undefined);
            assert.equal(db.category.findUnique.mock.callCount(), 0);
          });
        }
        it(`GET /plans/${invalidId} returns 400`, () =>
          expectStatus(400, 'GET', `/plans/${invalidId}`));

        it(`PATCH /plans/${invalidId} returns 400`, () =>
          expectStatus(400, 'PATCH', `/plans/${invalidId}`, 'ADMIN', {
            price: 29.9,
          }));

        it(`PATCH /plans/${invalidId}/status returns 400`, () =>
          expectStatus(
            400,
            'PATCH',
            `/plans/${invalidId}/status`,
            'ADMIN',
            { status: 'INACTIVE' },
          ));
      }

      it('POST /users rejects a whitespace-only name with 400', () =>
        expectStatus(400, 'POST', '/users', null, {
          name: '   ',
          email: 'teste.validacao@example.com',
          password: 'SenhaTeste@123',
        }));
    });
      describe('Plans and Users: Prisma error regressions', () => {
      it('POST /users maps Prisma P2002 to 409', async () => {
        returns(db.user.findUnique, null);
        implementsFn(db.user.create, async () => {
          throw prismaError('P2002');
        });

        await expectStatus(409, 'POST', '/users', null, {
          name: 'Usuário de Teste',
          email: 'conflito@example.com',
          password: 'SenhaTeste@123',
        });
      });

      it('POST /plans maps Prisma P2002 to 409', async () => {
        returns(db.plan.findUnique, null);
        implementsFn(db.plan.create, async () => {
          throw prismaError('P2002');
        });

        await expectStatus(409, 'POST', '/plans', 'ADMIN', {
          name: 'Plano de Teste',
          price: 29.9,
        });
      });

      it('PATCH /plans maps Prisma P2002 to 409', async () => {
        returns(db.plan.findUnique, {
          id: 1,
          name: 'Plano Original',
        });

        implementsFn(db.plan.update, async () => {
          throw prismaError('P2002');
        });

        await expectStatus(409, 'PATCH', '/plans/1', 'ADMIN', {
          price: 39.9,
        });
      });

      it('PATCH /plans maps Prisma P2025 to 404', async () => {
        returns(db.plan.findUnique, {
          id: 1,
          name: 'Plano Original',
        });

        implementsFn(db.plan.update, async () => {
          throw prismaError('P2025');
        });

        await expectStatus(404, 'PATCH', '/plans/1', 'ADMIN', {
          price: 39.9,
        });
      });

      it('PATCH /plans/:id/status maps Prisma P2025 to 404', async () => {
        returns(db.plan.findUnique, {
          id: 1,
          name: 'Plano Original',
        });

        implementsFn(db.plan.update, async () => {
          throw prismaError('P2025');
        });

        await expectStatus(
          404,
          'PATCH',
          '/plans/1/status',
          'ADMIN',
          { status: 'INACTIVE' },
        );
      });

      it('POST /plans does not disguise an unknown error as 409', async () => {
        returns(db.plan.findUnique, null);

        implementsFn(db.plan.create, async () => {
          throw new Error('Synthetic unexpected database failure');
        });

        const result = await request('POST', '/plans', 'ADMIN', {
          name: 'Plano de Teste',
          price: 29.9,
        });

        assert.equal(result.status, 500);
      });
    });
    for (const role of ['SUBSCRIBER', 'CONTENT_MANAGER']) {
      it(`${role} retains permitted plan reads`, async () => {
        returns(db.plan.count, 0);
        await expectStatus(200, 'GET', '/plans', role);
      });
    }
  });

  describe('Contents and plan links', () => {
    it('creation delegates to the DRAFT schema default and rejects status injection', async () => {
      implementsFn(db.content.create, async ({ data }) => {
        assert.equal(data.status, undefined);
        return { id: 10, status: 'DRAFT', ...data };
      });
      const body = { title: ' Test movie ', type: 'MOVIE' };
      const result = await expectStatus(201, 'POST', '/contents', 'CONTENT_MANAGER', body);
      assert.equal(result.status, 'DRAFT');
      assert.equal(result.title, 'Test movie');
      await expectStatus(400, 'POST', '/contents', 'ADMIN', { ...body, status: 'PUBLISHED' });
      assert.equal(db.content.create.mock.callCount(), 1);
    });
    it('subscriber cannot create content', () => expectStatus(403, 'POST', '/contents', 'SUBSCRIBER',
      { title: 'Test', type: 'MOVIE' }));
    it('publication without a linked plan returns 409 without writing', async () => {
      returns(db.content.findUnique, { id: 10, status: 'DRAFT' });
      returns(db.planContent.count, 0);
      await expectStatus(409, 'PATCH', '/contents/10/status', 'ADMIN', { status: 'PUBLISHED' });
      assert.equal(db.content.update.mock.callCount(), 0);
    });
    it('complete DRAFT -> PUBLISHED -> ARCHIVED -> DRAFT flow', async () => {
      let content = { id: 10, status: 'DRAFT' };
      implementsFn(db.content.findUnique, async () => ({ ...content }));
      implementsFn(db.content.update, async ({ data }) => (content = { ...content, ...data }));
      returns(db.planContent.count, 1);
      for (const status of ['PUBLISHED', 'ARCHIVED', 'DRAFT']) {
        assert.equal((await expectStatus(200, 'PATCH', '/contents/10/status', 'ADMIN', { status })).status, status);
      }
    });
    for (const [from, to] of [['DRAFT', 'DRAFT'], ['PUBLISHED', 'DRAFT'], ['ARCHIVED', 'PUBLISHED']]) {
      it(`${from} -> ${to} returns 409`, async () => {
        returns(db.content.findUnique, { id: 10, status: from });
        await expectStatus(409, 'PATCH', '/contents/10/status', 'ADMIN', { status: to });
        assert.equal(db.content.update.mock.callCount(), 0);
      });
    }
    it('missing content returns 404 on read and status update', async () => {
      returns(db.content.findFirst, null);
      returns(db.content.findUnique, null);
      await expectStatus(404, 'GET', '/contents/999');
      await expectStatus(404, 'PATCH', '/contents/999/status', 'ADMIN', { status: 'PUBLISHED' });
    });
    it('duplicate plan link maps P2002 to 409', async () => {
      returns(db.content.findUnique, { id: 10, status: 'DRAFT' });
      returns(db.plan.findUnique, { id: 1 });
      implementsFn(db.planContent.create, async () => { throw prismaError('P2002'); });
      await expectStatus(409, 'POST', '/contents/10/plans/1');
      assert.deepEqual(args(db.planContent.create), { data: { contentId: 10, planId: 1 } });
    });
    for (const count of [1, 2]) {
      it(`published content with ${count} plan(s): removal ${count === 1 ? 'blocked' : 'allowed'}`, async () => {
        returns(db.content.findUnique, { id: 10, status: 'PUBLISHED' });
        returns(db.plan.findUnique, { id: 1 });
        returns(db.planContent.findUnique, { planId: 1, contentId: 10 });
        returns(db.planContent.count, count);
        returns(db.planContent.delete, {});
        await expectStatus(count === 1 ? 409 : 204, 'DELETE', '/contents/10/plans/1');
        assert.equal(db.planContent.delete.mock.callCount(), count === 1 ? 0 : 1);
      });
    }
  });

  describe('Subscription access', () => {
    it('published content without eligible subscription returns 403', async () => {
      implementsFn(db.content.findFirst, async ({ where }) => where.plans ? null : { id: 10 });
      await expectStatus(403, 'GET', '/contents/10', 'SUBSCRIBER');
      assert.equal(args(db.content.findFirst).where.status, 'PUBLISHED');
    });
    it('catalog without eligible subscription returns 403', async () => {
      returns(db.subscription.findFirst, null);
      await expectStatus(403, 'GET', '/contents', 'SUBSCRIBER');
      assert.equal(db.content.count.mock.callCount(), 0);
    });
    it('eligible published content can be read', async () => {
      accessibleContent();
      assert.equal((await expectStatus(200, 'GET', '/contents/10', 'SUBSCRIBER')).id, 10);
      const where = args(db.content.findFirst).where;
      assert.equal(where.status, 'PUBLISHED');
      assert.equal(where.plans.some.plan.subscriptions.some.userId, 3);
    });
    for (const status of ['DRAFT', 'ARCHIVED']) {
      it(`${status} stays hidden from subscriber`, async () => {
        implementsFn(db.content.findFirst, async ({ where }) => {
          assert.equal(where.status, 'PUBLISHED');
          return where.status === status ? { id: 10, status } : null;
        });
        await expectStatus(404, 'GET', '/contents/10', 'SUBSCRIBER');
      });
    }
  });

  describe('Subscriptions', () => {
    function activeReferences() { returns(db.plan.findUnique, { id: 1, status: 'ACTIVE' }); }
    it('ADMIN creates an ACTIVE subscription using active references', async () => {
      activeReferences();
      returns(db.subscription.findFirst, null);
      implementsFn(db.subscription.create, async ({ data }) => ({ id: 20, ...data }));
      const result = await expectStatus(201, 'POST', '/subscriptions', 'ADMIN', { userId: 3, planId: 1 });
      assert.equal(result.status, 'ACTIVE');
      assert.equal(result.userId, 3);
      assert.equal(result.planId, 1);
      assert.equal(result.expiresAt, null);
      assert.ok(Number.isFinite(Date.parse(result.startsAt)));
    });
    for (const status of ['ACTIVE', 'INACTIVE']) {
      it(`duplicate non-ended ${status} subscription returns 409`, async () => {
        activeReferences();
        implementsFn(db.subscription.findFirst, async ({ where }) => {
          assert.deepEqual(where.status.in, ['ACTIVE', 'INACTIVE']);
          assert.equal(where.userId, 3);
          assert.equal(where.planId, 1);
          assert.deepEqual(where.OR[0], { expiresAt: null });
          assert.ok(where.OR[1].expiresAt.gt instanceof Date);
          return { id: 20, status };
        });
        await expectStatus(409, 'POST', '/subscriptions', 'ADMIN', { userId: 3, planId: 1 });
        assert.equal(db.subscription.create.mock.callCount(), 0);
      });
    }
    for (const [from, to] of [['CANCELLED', 'ACTIVE'], ['EXPIRED', 'ACTIVE'], ['ACTIVE', 'ACTIVE']]) {
      it(`${from} -> ${to} returns 409`, async () => {
        returns(db.subscription.findUnique, { id: 20, status: from, expiresAt: null });
        await expectStatus(409, 'PATCH', '/subscriptions/20/status', 'ADMIN', { status: to });
        assert.equal(db.subscription.update.mock.callCount(), 0);
      });
    }
  });

  describe('Watch history and ratings', () => {
    for (const progressSeconds of [0, 60, 120]) {
      it(`accepts progress ${progressSeconds} within two minute duration`, async () => {
        accessibleContent();
        implementsFn(db.watchHistory.upsert, async ({ create }) => ({ id: 30, ...create }));
        const result = await expectStatus(200, 'PUT', '/watch-history/10', 'SUBSCRIBER', { progressSeconds, completed: false });
        assert.equal(result.progressSeconds, progressSeconds);
        assert.equal(result.userId, 3);
      });
    }
    it('progress greater than duration * 60 returns 400 without writing', async () => {
      accessibleContent();
      await expectStatus(400, 'PUT', '/watch-history/10', 'SUBSCRIBER', { progressSeconds: 121, completed: false });
      assert.equal(db.watchHistory.upsert.mock.callCount(), 0);
    });
    for (const score of [1, 2, 3, 4, 5]) {
      it(`accepts rating ${score}`, async () => {
        accessibleContent();
        implementsFn(db.rating.upsert, async ({ create }) => ({ id: 40, ...create }));
        assert.equal((await expectStatus(200, 'PUT', '/ratings/10', 'SUBSCRIBER', { score })).score, score);
      });
    }
    for (const score of [0, 6, -1, 2.5, '3', null]) {
      it(`rejects rating ${JSON.stringify(score)} with 400`, async () => {
        await expectStatus(400, 'PUT', '/ratings/10', 'SUBSCRIBER', { score });
        assert.equal(db.rating.upsert.mock.callCount(), 0);
      });
    }
    for (const [path, model, first, second] of [
      ['watch-history', 'watchHistory', { progressSeconds: 10, completed: false }, { progressSeconds: 120, completed: true }],
      ['ratings', 'rating', { score: 1, comment: 'Before' }, { score: 5 }],
    ]) {
      it(`${path} uses the same compound key on repeated PUT`, async () => {
        accessibleContent();
        const rows = new Map();
        implementsFn(db[model].upsert, async ({ where, create, update }) => {
          assert.deepEqual(where, { userId_contentId: { userId: 3, contentId: 10 } });
          assert.equal(create.userId, 3);
          assert.equal(create.contentId, 10);
          const key = JSON.stringify(where.userId_contentId);
          const row = rows.has(key) ? { ...rows.get(key), ...update } : { id: 50, ...create };
          rows.set(key, row);
          return row;
        });
        const a = await expectStatus(200, 'PUT', `/${path}/10`, 'SUBSCRIBER', first);
        const b = await expectStatus(200, 'PUT', `/${path}/10`, 'SUBSCRIBER', second);
        assert.equal(a.id, b.id);
        assert.equal(rows.size, 1);
        for (const [key, value] of Object.entries(second)) assert.equal(b[key], value);
        if (model === 'rating') assert.equal(b.comment, null);
        assert.equal(db[model].upsert.mock.callCount(), 2);
      });
      it(`${path} cannot write for another user through body/query`, async () => {
        await expectStatus(400, 'PUT', `/${path}/10`, 'SUBSCRIBER', { ...first, userId: 4 });
        await expectStatus(400, 'PUT', `/${path}/10?userId=4`, 'SUBSCRIBER', first);
        assert.equal(db[model].upsert.mock.callCount(), 0);
      });
      it(`${path} cannot read another subscriber's record`, async () => {
        implementsFn(db[model].findUnique, async ({ where }) =>
          where.userId_contentId.userId === 3 ? { id: 50, userId: 3, contentId: 10, ...first } : null);
        await expectStatus(404, 'GET', `/${path}/me/10`, 4);
        assert.deepEqual(args(db[model].findUnique).where, { userId_contentId: { userId: 4, contentId: 10 } });
      });
      it(`${path} cannot write inaccessible content`, async () => {
        implementsFn(db.content.findFirst, async ({ where }) => where.plans ? null : { id: 10 });
        await expectStatus(403, 'PUT', `/${path}/10`, 'SUBSCRIBER', first);
        assert.equal(db[model].upsert.mock.callCount(), 0);
      });
    }
  });

  describe('Pagination', () => {
    it('defaults to page=1/limit=10 and passes the correct range', async () => {
      returns(db.plan.count, 12);
      returns(db.plan.findMany, [{ id: 1 }]);
      const result = await expectStatus(200, 'GET', '/plans');
      assert.deepEqual(result.meta, { page: 1, limit: 10, total: 12, totalPages: 2 });
      assert.equal(args(db.plan.findMany).skip, 0);
      assert.equal(args(db.plan.findMany).take, 10);
    });
    it('transforms valid page/limit strings and calculates the offset', async () => {
      returns(db.plan.count, 12);
      returns(db.plan.findMany, [{ id: 11 }, { id: 12 }]);
      const result = await expectStatus(200, 'GET', '/plans?page=2&limit=10');
      assert.deepEqual(result.meta, { page: 2, limit: 10, total: 12, totalPages: 2 });
      assert.equal(args(db.plan.findMany).skip, 10);
      assert.equal(result.data.length, 2);
    });
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=',
      'limit=0', 'limit=-1', 'limit=1.5', 'limit=abc', 'limit=101', 'page=9007199254740992']) {
      it(`${query} returns 400`, async () => {
        await expectStatus(400, 'GET', `/plans?${query}`);
        assert.equal(db.plan.count.mock.callCount(), 0);
      });
    }
    it('accepts limit=100', async () => {
      returns(db.plan.count, 0);
      assert.equal((await expectStatus(200, 'GET', '/plans?limit=100')).meta.limit, 100);
    });
    it('page beyond the end is empty with consistent metadata and no unnecessary query', async () => {
      returns(db.plan.count, 12);
      assert.deepEqual(await expectStatus(200, 'GET', '/plans?page=3'), {
        data: [], meta: { page: 3, limit: 10, total: 12, totalPages: 2 },
      });
      assert.equal(db.plan.findMany.mock.callCount(), 0);
    });
  });
});
