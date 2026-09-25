const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { prismaMock, returns, implementsFn, args, statusError, prismaError } = require('./helpers.cjs');
const { SubscriptionAccessService } = require('../src/subscriptions/subscription-access.service');
const { SubscriptionsService } = require('../src/subscriptions/subscriptions.service');
const { withPersonalTransaction } = require('../src/common/utils/personal-resource');

const now = new Date('2030-06-15T12:00:00.000Z');
const subscriber = { id: 3, role: 'SUBSCRIBER', status: 'ACTIVE' };
// Explicit contract: all conditions must reach Prisma, including the plan relation.
const eligible = {
  userId: 3, status: 'ACTIVE', startsAt: { lte: now },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  plan: { status: 'ACTIVE' }, user: { status: 'ACTIVE' },
};

describe('Subscription access query contracts', () => {
  it('requires publication, associated plan, ACTIVE subscription, active user/plan and strict validity boundaries', () => {
    const access = new SubscriptionAccessService(prismaMock());
    assert.deepEqual(access.contentWhere(subscriber, now), {
      status: 'PUBLISHED', plans: { some: { plan: { subscriptions: { some: eligible } } } },
    });
  });
  it('catalog authorization uses the same eligibility conditions', async () => {
    const db = prismaMock();
    returns(db.subscription.findFirst, { id: 1 });
    await new SubscriptionAccessService(db).assertCanList(subscriber, now);
    assert.deepEqual(args(db.subscription.findFirst), { where: eligible, select: { id: true } });
  });
  for (const role of ['ADMIN', 'CONTENT_MANAGER']) {
    it(`${role} can inspect unpublished content without a subscription`, async () => {
      const db = prismaMock();
      const access = new SubscriptionAccessService(db);
      assert.deepEqual(access.contentWhere({ ...subscriber, role }, now), {});
      await access.assertCanList({ ...subscriber, role }, now);
      assert.equal(db.subscription.findFirst.mock.callCount(), 0);
    });
  }
});

describe('Schema contracts (read-only, no database)', () => {
  const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const model = (name) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  it('Content status defaults to DRAFT in the actual schema', () => {
    assert.match(model('Content'), /status\s+ContentStatus\s+@default\(DRAFT\)/);
  });
  for (const name of ['WatchHistory', 'Rating']) {
    it(`${name} enforces a unique user/content pair`, () => {
      assert.match(model(name), /@@unique\(\[userId,\s*contentId\]\)/);
    });
  }
});

describe('Deterministic subscription dates and state transitions', () => {
  function fixture(t, subscription = {}) {
    t.mock.timers.enable({ apis: ['Date'], now });
    const db = prismaMock();
    returns(db.user.findUnique, { id: 3, status: 'ACTIVE' });
    returns(db.plan.findUnique, { id: 1, status: 'ACTIVE' });
    returns(db.subscription.findFirst, null);
    returns(db.subscription.findUnique, {
      id: 20, userId: 3, planId: 1, status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 1000), expiresAt: null, ...subscription,
    });
    implementsFn(db.subscription.create, async ({ data }) => ({ id: 20, ...data }));
    implementsFn(db.subscription.update, async ({ data }) => ({ id: 20, ...data }));
    return { db, service: new SubscriptionsService(db) };
  }
  it('creates a subscription with a future expiration and server start time', async (t) => {
    const { db, service } = fixture(t);
    const expiresAt = new Date(now.getTime() + 1000);
    const result = await service.create({ userId: 3, planId: 1, expiresAt: expiresAt.toISOString() });
    assert.deepEqual(result.startsAt, now);
    assert.deepEqual(result.expiresAt, expiresAt);
    assert.deepEqual(args(db.subscription.findFirst).where.OR, [{ expiresAt: null }, { expiresAt: { gt: now } }]);
  });
  for (const delta of [-1, 0]) {
    it(`expiration at now ${delta}ms returns 400`, async (t) => {
      const { db, service } = fixture(t);
      await assert.rejects(service.create({ userId: 3, planId: 1,
        expiresAt: new Date(now.getTime() + delta).toISOString() }), statusError(400));
      assert.equal(db.subscription.create.mock.callCount(), 0);
    });
  }
  it('cannot mark an unexpired subscription EXPIRED', async (t) => {
    const { service } = fixture(t);
    await assert.rejects(service.updateStatus(20, { status: 'EXPIRED' }), statusError(409));
  });
  it('expiration boundary allows EXPIRED', async (t) => {
    const { service } = fixture(t, { expiresAt: now });
    assert.equal((await service.updateStatus(20, { status: 'EXPIRED' })).status, 'EXPIRED');
  });
  it('cannot reactivate an expired subscription', async (t) => {
    const { service } = fixture(t, { status: 'INACTIVE', expiresAt: now });
    await assert.rejects(service.updateStatus(20, { status: 'ACTIVE' }), statusError(409));
  });
  it('cannot reactivate before startsAt', async (t) => {
    const { service } = fixture(t, { status: 'INACTIVE', startsAt: new Date(now.getTime() + 1) });
    await assert.rejects(service.updateStatus(20, { status: 'ACTIVE' }), statusError(409));
  });
  it('supports ACTIVE -> INACTIVE -> ACTIVE -> CANCELLED', async (t) => {
    const { db, service } = fixture(t);
    let row = { id: 20, userId: 3, planId: 1, status: 'ACTIVE', startsAt: now, expiresAt: null };
    implementsFn(db.subscription.findUnique, async () => row);
    implementsFn(db.subscription.update, async ({ data }) => (row = { ...row, ...data }));
    for (const status of ['INACTIVE', 'ACTIVE', 'CANCELLED']) {
      assert.equal((await service.updateStatus(20, { status })).status, status);
    }
    assert.equal(args(db.subscription.findFirst).where.id.not, 20);
  });
});

describe('Personal upsert transaction retries', () => {
  for (const code of ['P2002', 'P2034']) {
    it(`retries ${code} and succeeds without creating a second operation`, async () => {
      const db = prismaMock();
      let attempts = 0;
      const result = await withPersonalTransaction(db, async () => {
        if (++attempts === 1) throw prismaError(code);
        return { id: 1 };
      });
      assert.deepEqual(result, { id: 1 });
      assert.equal(attempts, 2);
    });
  }
  it('persistent serialization conflict stops after three attempts with 409', async () => {
    const db = prismaMock();
    await assert.rejects(withPersonalTransaction(db, async () => { throw prismaError('P2034'); }), statusError(409));
    assert.equal(db.$transaction.mock.callCount(), 3);
  });
});
