import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createObjectStorage,
  StorageObjectNotFoundError,
  StorageRequestError
} from '../shared/objectStorage.js';

const localRoot = await mkdtemp(path.join(tmpdir(), 'ips-object-storage-'));
try {
  const localStorage = await createObjectStorage({
    environment: {
      STORAGE_PROVIDER: 'local',
      UPLOADS_DIR: localRoot
    },
    defaultLocalRoot: localRoot
  });
  const localBody = Buffer.from('local-storage-round-trip');

  assert.equal(localStorage.provider, 'local');
  await localStorage.write('work-files/example.txt', localBody);
  const localObject = await localStorage.read('work-files/example.txt');
  assert.deepEqual(localObject.body, localBody);
  assert.equal(localObject.status, 200);
  assert.equal(localObject.contentLength, localBody.length);
  await assert.rejects(
    localStorage.write('work-files/example.txt', Buffer.from('must-not-overwrite')),
    error => error instanceof StorageRequestError && error.status === 409
  );

  const localRange = await localStorage.read('work-files/example.txt', {
    range: { start: 6, end: 12 }
  });
  assert.equal(localRange.body.toString(), 'storage');
  assert.equal(localRange.status, 206);
  assert.equal(localRange.contentRange, `bytes 6-12/${localBody.length}`);

  await assert.rejects(
    localStorage.read('work-files/example.txt', { range: { start: -1, end: 2 } }),
    /range/i
  );
  await assert.rejects(
    localStorage.write('../outside.txt', Buffer.from('blocked')),
    /relative path/i
  );

  await localStorage.remove('work-files/example.txt');
  await localStorage.remove('work-files/example.txt');
  await assert.rejects(
    localStorage.read('work-files/example.txt'),
    error => error instanceof StorageObjectNotFoundError
  );
} finally {
  await rm(localRoot, { recursive: true, force: true });
}

const r2Endpoint = 'https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com';
const r2BucketName = 'ips-production-files';
const r2Objects = new Map();
const r2Requests = [];
const decodePath = url => new URL(url).pathname
  .split('/')
  .filter(Boolean)
  .map(segment => decodeURIComponent(segment));

const fakeR2Fetch = async (url, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const [bucketName, ...keyParts] = decodePath(url);
  const key = keyParts.join('/');
  r2Requests.push({ method, url, headers, key });
  assert.equal(bucketName, r2BucketName);

  if (method === 'HEAD' && !key) return new Response(null, { status: 200 });
  if (method === 'PUT') {
    if (headers.get('if-none-match') === '*' && r2Objects.has(key)) {
      return new Response('Object already exists.', { status: 412 });
    }
    r2Objects.set(key, {
      body: Buffer.from(options.body),
      contentType: headers.get('content-type') || 'application/octet-stream'
    });
    return new Response(null, { status: 200, headers: { ETag: '"stored-etag"' } });
  }
  if (method === 'GET') {
    const stored = r2Objects.get(key);
    if (!stored) return new Response('Not found.', { status: 404 });
    const rangeHeader = headers.get('range');
    let body = stored.body;
    let status = 200;
    let contentRange = '';
    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader);
      assert.ok(match, `Unexpected Range header: ${rangeHeader}`);
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), stored.body.length - 1);
      body = stored.body.subarray(start, end + 1);
      status = 206;
      contentRange = `bytes ${start}-${end}/${stored.body.length}`;
    }
    return new Response(body, {
      status,
      headers: {
        'Content-Type': stored.contentType,
        'Content-Length': String(body.length),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
        ETag: '"stored-etag"'
      }
    });
  }
  if (method === 'DELETE') {
    r2Objects.delete(key);
    return new Response(null, { status: 204 });
  }
  return new Response('Unsupported request.', { status: 405 });
};

const r2Environment = {
  STORAGE_PROVIDER: 'r2',
  R2_ENDPOINT: r2Endpoint,
  R2_BUCKET_NAME: r2BucketName,
  R2_ACCESS_KEY_ID: '0123456789abcdef0123456789abcdef',
  R2_SECRET_ACCESS_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  R2_PREFIX: 'production',
  R2_REQUEST_TIMEOUT_MS: '5000'
};
const r2Storage = await createObjectStorage({
  environment: r2Environment,
  defaultLocalRoot: localRoot,
  fetchImpl: fakeR2Fetch,
  clock: () => new Date('2026-07-29T12:00:00.000Z')
});
const r2Body = Buffer.from('cloudflare-r2-round-trip');
const r2Key = 'media/hero image.png';
const fullR2Key = `production/${r2Key}`;

assert.equal(r2Storage.provider, 'r2');
assert.equal(r2Requests[0].method, 'HEAD');
await r2Storage.write(r2Key, r2Body, {
  contentType: 'image/png',
  metadata: { sha256: crypto.createHash('sha256').update(r2Body).digest('hex'), scope: 'media' }
});
assert.deepEqual(r2Objects.get(fullR2Key).body, r2Body);

const putRequest = r2Requests.find(request => request.method === 'PUT');
assert.ok(putRequest.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256 Credential='));
assert.match(putRequest.headers.get('authorization'), /SignedHeaders=[^,]*content-type/);
assert.equal(putRequest.headers.get('if-none-match'), '*');
assert.equal(putRequest.headers.get('content-type'), 'image/png');
assert.equal(
  putRequest.headers.get('x-amz-content-sha256'),
  crypto.createHash('sha256').update(r2Body).digest('hex')
);
assert.equal(putRequest.headers.get('x-amz-meta-scope'), 'media');

await assert.rejects(
  r2Storage.write(r2Key, r2Body),
  error => error instanceof StorageRequestError && error.status === 412
);

const r2Object = await r2Storage.read(r2Key);
assert.deepEqual(r2Object.body, r2Body);
assert.equal(r2Object.status, 200);
assert.equal(r2Object.contentLength, r2Body.length);

const r2Range = await r2Storage.read(r2Key, { range: { start: 11, end: 12 } });
assert.equal(r2Range.body.toString(), 'r2');
assert.equal(r2Range.status, 206);
assert.equal(r2Range.contentRange, `bytes 11-12/${r2Body.length}`);
assert.equal(
  r2Requests.filter(request => request.method === 'GET').at(-1).headers.get('range'),
  'bytes=11-12'
);
assert.match(
  r2Requests.filter(request => request.method === 'GET').at(-1).headers.get('authorization'),
  /SignedHeaders=[^,]*range/
);
await assert.rejects(
  r2Storage.read(r2Key, { range: { start: 3, end: 2 } }),
  /range/i
);

await r2Storage.remove(r2Key);
await r2Storage.remove(r2Key);
await assert.rejects(
  r2Storage.read(r2Key),
  error => error instanceof StorageObjectNotFoundError
);

await assert.rejects(
  createObjectStorage({
    environment: r2Environment,
    defaultLocalRoot: localRoot,
    fetchImpl: async () => {
      throw new Error('simulated network failure');
    }
  }),
  error => error instanceof StorageRequestError
);

await assert.rejects(
  createObjectStorage({
    environment: { STORAGE_PROVIDER: 'unsupported' },
    defaultLocalRoot: localRoot
  }),
  /Unsupported storage provider/
);

console.log('Local and mocked Cloudflare R2 object storage verification passed.');
