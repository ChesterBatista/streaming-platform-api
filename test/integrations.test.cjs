const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createServer } = require('node:http');
const { HttpService } = require('@nestjs/axios');
const axios = require('axios');
const { of, throwError } = require('rxjs');
const { prismaMock, returns, implementsFn, args, statusError } = require('./helpers.cjs');
const { MediaMetadataService } = require('../src/media-metadata/media-metadata.service');
const { UploadsService } = require('../src/uploads/uploads.service');

describe('Real HttpService against an isolated local metadata provider', () => {
  let server, service;
  before(async () => {
    server = createServer((req, res) => {
      if (req.url === '/media/timeout') return; // Intentionally no response; client must time out.
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = req.url === '/media/missing' ? 404 : req.url === '/media/failure' ? 500 : 200;
      res.end(JSON.stringify({ title: 'Local mock movie', type: 'MOVIE', durationMinutes: 2 }));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/media/`;
    service = new MediaMetadataService(new HttpService(axios.create({
      timeout: 1000, maxRedirects: 0, maxContentLength: 1024 * 1024,
      responseType: 'json', transitional: { silentJSONParsing: false }, proxy: false,
    })), { get: () => baseUrl });
  });
  after(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  it('consumes metadata through real HTTP', async () => {
    const result = await service.findOne('movie');
    assert.equal(result.title, 'Local mock movie');
    assert.equal(result.externalId, 'movie');
    assert.equal(result.durationMinutes, 2);
  });
  for (const [id, status] of [['missing', 404], ['failure', 502], ['timeout', 504]]) {
    it(`real provider ${id} maps to ${status}`, async () => {
      await assert.rejects(service.findOne(id), statusError(status));
    });
  }
});

describe('External metadata without network', () => {
  const config = { get: () => 'https://metadata.invalid/' };
  it('returns validated metadata and encodes the external ID', async () => {
    const service = new MediaMetadataService({ get: (url) => {
      assert.equal(url, 'https://metadata.invalid/a%2Fb');
      return of({ data: { title: ' Test ', type: 'MOVIE', durationMinutes: 2, ignored: 'external field' } });
    } }, config);
    const result = await service.findOne('a/b');
    assert.equal(result.title, 'Test');
    assert.equal(result.externalId, 'a/b');
    assert.equal(result.ignored, undefined);
  });
  for (const [name, error, status] of [
    ['timeout', { isAxiosError: true, code: 'ECONNABORTED' }, 504],
    ['missing metadata', { isAxiosError: true, response: { status: 404 } }, 404],
    ['upstream failure', new Error('Synthetic unavailable upstream'), 502],
  ]) {
    it(`${name} produces controlled ${status}`, async () => {
      const service = new MediaMetadataService({ get: () => throwError(() => error) }, config);
      await assert.rejects(service.findOne('test'), statusError(status));
    });
  }
  it('invalid upstream body returns 502', async () => {
    const service = new MediaMetadataService({ get: () => of({ data: { title: 42 } }) }, config);
    await assert.rejects(service.findOne('test'), statusError(502));
  });
  it('missing configuration returns 503', async () => {
    const service = new MediaMetadataService({ get: () => assert.fail('Must not call upstream') }, { get: () => undefined });
    await assert.rejects(service.findOne('test'), statusError(503));
  });
});

describe('Thumbnail service with filesystem writes mocked', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=', 'base64');
  const file = () => ({ originalname: 'test.png', mimetype: 'image/png', buffer: png, size: png.length });
  it('valid PNG is linked to the content without touching uploads', async (t) => {
    const mkdir = t.mock.method(fs, 'mkdir', async () => undefined);
    const write = t.mock.method(fs, 'writeFile', async () => undefined);
    const db = prismaMock();
    returns(db.content.findUnique, { id: 10 });
    implementsFn(db.content.update, async ({ data }) => ({ id: 10, ...data }));
    const result = await new UploadsService(db, {}).uploadThumbnail(10, file());
    assert.match(result.thumbnailUrl, /^\/uploads\/thumbnails\/[0-9a-f-]+\.png$/);
    assert.equal(mkdir.mock.callCount(), 1);
    assert.equal(write.mock.callCount(), 1);
    assert.deepEqual(write.mock.calls[0].arguments[1], png);
    assert.equal(args(db.content.update).where.id, 10);
  });
  for (const [name, input] of [
    ['missing file', undefined],
    ['oversized file', { ...file(), buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }],
    ['incompatible extension', { ...file(), originalname: 'test.exe' }],
    ['forged MIME/signature', { ...file(), buffer: Buffer.from('This is not an image') }],
  ]) {
    it(`${name} returns 400 before storage or database access`, async (t) => {
      const mkdir = t.mock.method(fs, 'mkdir', async () => assert.fail('Must not create directories'));
      const write = t.mock.method(fs, 'writeFile', async () => assert.fail('Must not write files'));
      const db = prismaMock();
      await assert.rejects(new UploadsService(db, {}).uploadThumbnail(10, input), statusError(400));
      assert.equal(db.content.findUnique.mock.callCount(), 0);
      assert.equal(mkdir.mock.callCount(), 0);
      assert.equal(write.mock.callCount(), 0);
    });
  }
});
