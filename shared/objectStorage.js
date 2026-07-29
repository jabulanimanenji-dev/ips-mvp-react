import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_BODY = Buffer.alloc(0);
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OBJECT_KEY_BYTES = 1_024;
const R2_ENDPOINT_HOST_PATTERN = /^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/i;

export class StorageObjectNotFoundError extends Error {
  constructor(key) {
    super(`Stored object not found: ${key}`);
    this.name = 'StorageObjectNotFoundError';
    this.code = 'STORAGE_OBJECT_NOT_FOUND';
  }
}

export class StorageRequestError extends Error {
  constructor(message, status = 0, options = {}) {
    super(message, options);
    this.name = 'StorageRequestError';
    this.code = 'STORAGE_REQUEST_FAILED';
    this.status = status;
  }
}

const sha256Hex = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);
const awsEncode = value => encodeURIComponent(value).replace(/[!'()*]/g, character => (
  `%${character.charCodeAt(0).toString(16).toUpperCase()}`
));

const normaliseObjectKey = value => {
  const raw = String(value || '').replaceAll('\\', '/');
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) {
    throw new Error('Storage object keys must be non-empty and cannot contain control characters.');
  }
  if (raw.startsWith('/') || raw.endsWith('/') || raw.includes('//')) {
    throw new Error('Storage object keys must use canonical relative paths.');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_OBJECT_KEY_BYTES) {
    throw new Error(`Storage object keys cannot exceed ${MAX_OBJECT_KEY_BYTES} bytes.`);
  }
  const segments = raw.split('/');
  if (!segments.length || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('Storage object keys cannot contain relative path segments.');
  }
  return segments.join('/');
};

const normalisePrefix = value => {
  const raw = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  return raw ? normaliseObjectKey(raw) : '';
};

const encodeObjectPath = key => normaliseObjectKey(key).split('/').map(awsEncode).join('/');
const normaliseByteRange = range => {
  if (range === undefined || range === null) return null;
  const start = Number(range.start);
  const end = Number(range.end);
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
  ) {
    throw new StorageRequestError('Invalid storage byte range.', 416);
  }
  return { start, end };
};

class LocalObjectStorage {
  constructor(root) {
    this.provider = 'local';
    this.root = path.resolve(root);
  }

  async initialise() {
    await fs.mkdir(this.root, { recursive: true });
    return this;
  }

  resolve(key) {
    const relativeKey = normaliseObjectKey(key);
    const absolutePath = path.resolve(this.root, ...relativeKey.split('/'));
    const relativePath = path.relative(this.root, absolutePath);
    if (
      !relativePath
      || relativePath === '..'
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
    ) {
      throw new Error('Storage object path escapes the configured local root.');
    }
    return absolutePath;
  }

  async write(key, body) {
    const absolutePath = this.resolve(key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    try {
      await fs.writeFile(absolutePath, body, { flag: 'wx' });
    } catch (error) {
      if (error?.code === 'EEXIST') {
        throw new StorageRequestError('A stored object already exists at the generated key.', 409, { cause: error });
      }
      throw error;
    }
  }

  async read(key, { range } = {}) {
    try {
      const requestedRange = normaliseByteRange(range);
      const body = await fs.readFile(this.resolve(key));
      if (requestedRange && requestedRange.start >= body.length) {
        throw new StorageRequestError('Requested storage byte range is not satisfiable.', 416);
      }
      const selectedBody = requestedRange
        ? body.subarray(requestedRange.start, Math.min(requestedRange.end + 1, body.length))
        : body;
      return {
        body: selectedBody,
        contentType: '',
        etag: '',
        contentLength: selectedBody.length,
        contentRange: requestedRange
          ? `bytes ${requestedRange.start}-${requestedRange.start + selectedBody.length - 1}/${body.length}`
          : '',
        status: requestedRange ? 206 : 200
      };
    } catch (error) {
      if (error?.code === 'ENOENT') throw new StorageObjectNotFoundError(key);
      throw error;
    }
  }

  async remove(key) {
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

class R2ObjectStorage {
  constructor({
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    prefix = '',
    fetchImpl = globalThis.fetch,
    clock = () => new Date(),
    timeoutMs = DEFAULT_TIMEOUT_MS
  }) {
    if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required for R2 storage.');
    if (!String(accessKeyId || '').trim()) throw new Error('R2_ACCESS_KEY_ID is required for R2 storage.');
    if (!String(secretAccessKey || '').trim()) throw new Error('R2_SECRET_ACCESS_KEY is required for R2 storage.');
    if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(String(bucketName || ''))) {
      throw new Error('R2_BUCKET_NAME must be a valid 3-63 character Cloudflare R2 bucket name.');
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      throw new Error('R2_REQUEST_TIMEOUT_MS must be a positive whole number.');
    }
    this.provider = 'r2';
    this.accessKeyId = String(accessKeyId).trim();
    this.secretAccessKey = String(secretAccessKey).trim();
    this.bucketName = String(bucketName);
    this.prefix = normalisePrefix(prefix);
    this.fetchImpl = fetchImpl;
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    const endpointUrl = new URL(endpoint);
    if (
      endpointUrl.protocol !== 'https:'
      || endpointUrl.pathname !== '/'
      || endpointUrl.search
      || endpointUrl.hash
      || endpointUrl.username
      || endpointUrl.password
      || endpointUrl.port
      || !R2_ENDPOINT_HOST_PATTERN.test(endpointUrl.hostname)
    ) {
      throw new Error('R2_ENDPOINT must be an official Cloudflare R2 HTTPS S3 endpoint without a path.');
    }
    this.endpoint = endpointUrl.origin;
    this.host = endpointUrl.host;
  }

  fullKey(key) {
    const objectKey = normaliseObjectKey(key);
    return normaliseObjectKey(this.prefix ? `${this.prefix}/${objectKey}` : objectKey);
  }

  async request(method, key, {
    body = EMPTY_BODY,
    contentType = '',
    metadata = {},
    ifNoneMatch = '',
    range = ''
  } = {}) {
    const requestedContentType = String(contentType || '').trim().replace(/\s+/g, ' ');
    const requestedRange = range ? String(range) : '';
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || EMPTY_BODY);
    const payloadHash = sha256Hex(payload);
    const requestDate = this.clock();
    if (!(requestDate instanceof Date) || Number.isNaN(requestDate.getTime())) {
      throw new Error('The R2 signing clock must return a valid Date.');
    }
    const amzDate = requestDate.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const isBucketRequest = key === null || key === undefined;
    const canonicalUri = isBucketRequest
      ? `/${awsEncode(this.bucketName)}`
      : `/${awsEncode(this.bucketName)}/${encodeObjectPath(this.fullKey(key))}`;
    const metadataHeaders = Object.fromEntries(
      Object.entries(metadata)
        .filter(([name, value]) => /^[a-z0-9-]+$/i.test(name) && value !== undefined && value !== null)
        .map(([name, value]) => [`x-amz-meta-${name.toLowerCase()}`, String(value).trim().replace(/\s+/g, ' ')])
    );
    const headersToSign = {
      host: this.host,
      ...(requestedContentType ? { 'content-type': requestedContentType } : {}),
      ...(ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {}),
      ...(requestedRange ? { range: requestedRange } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...metadataHeaders
    };
    const signedHeaderNames = Object.keys(headersToSign).sort();
    const canonicalHeaders = `${signedHeaderNames.map(name => `${name}:${headersToSign[name]}`).join('\n')}\n`;
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');
    const dateKey = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, 'auto');
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign, 'hex');
    const headers = {
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {}),
      ...(requestedRange ? { Range: requestedRange } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...metadataHeaders,
      ...(requestedContentType ? { 'Content-Type': requestedContentType } : {})
    };
    let response;
    try {
      response = await this.fetchImpl(`${this.endpoint}${canonicalUri}`, {
        method,
        headers,
        ...(method === 'PUT' ? { body: payload } : {}),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new StorageRequestError(
        timedOut
          ? `R2 ${method} request timed out before receiving a response.`
          : `R2 ${method} request failed before receiving a response.`,
        0,
        { cause: error }
      );
    }

    if (response.status === 404 && !isBucketRequest) {
      throw new StorageObjectNotFoundError(key);
    }
    if (!response.ok) {
      let detail = '';
      try {
        detail = String(await response.text()).replace(/\s+/g, ' ').trim().slice(0, 500);
      } catch {
        // The HTTP status remains enough to map the failure without masking it.
      }
      if (this.accessKeyId) detail = detail.replaceAll(this.accessKeyId, '[redacted]');
      if (this.secretAccessKey) detail = detail.replaceAll(this.secretAccessKey, '[redacted]');
      throw new StorageRequestError(
        `R2 ${method} request failed with status ${response.status}${detail ? `: ${detail}` : '.'}`,
        response.status
      );
    }
    return response;
  }

  async initialise() {
    await this.request('HEAD', null);
    return this;
  }

  async write(key, body, { contentType = 'application/octet-stream', metadata = {} } = {}) {
    await this.request('PUT', key, { body, contentType, metadata, ifNoneMatch: '*' });
  }

  async read(key, { range } = {}) {
    const requestedRange = normaliseByteRange(range);
    const response = await this.request('GET', key, {
      range: requestedRange ? `bytes=${requestedRange.start}-${requestedRange.end}` : ''
    });
    if (requestedRange && response.status !== 206) {
      throw new StorageRequestError(
        `R2 ranged GET request returned unexpected status ${response.status}.`,
        response.status
      );
    }
    let body;
    try {
      body = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new StorageRequestError(
        'R2 GET response body could not be read.',
        response.status,
        { cause: error }
      );
    }
    const contentLengthHeader = response.headers.get('content-length');
    const hasDeclaredLength = typeof contentLengthHeader === 'string' && contentLengthHeader.trim() !== '';
    const declaredLength = hasDeclaredLength ? Number(contentLengthHeader) : Number.NaN;
    const contentLength = Number.isSafeInteger(declaredLength) && declaredLength >= 0
      ? declaredLength
      : body.length;
    if (Number.isSafeInteger(declaredLength) && declaredLength >= 0 && declaredLength !== body.length) {
      throw new StorageRequestError('R2 returned an invalid Content-Length header.', response.status);
    }
    const contentRange = response.headers.get('content-range') || '';
    if (requestedRange) {
      const rangeMatch = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(contentRange);
      const actualStart = Number(rangeMatch?.[1]);
      const actualEnd = Number(rangeMatch?.[2]);
      if (
        !rangeMatch
        || actualStart !== requestedRange.start
        || actualEnd < actualStart
        || actualEnd > requestedRange.end
        || body.length !== actualEnd - actualStart + 1
      ) {
        throw new StorageRequestError('R2 returned an invalid ranged GET response.', response.status);
      }
    }
    return {
      body,
      contentType: response.headers.get('content-type') || '',
      etag: response.headers.get('etag') || '',
      contentLength,
      contentRange,
      status: response.status
    };
  }

  async remove(key) {
    try {
      await this.request('DELETE', key);
    } catch (error) {
      if (!(error instanceof StorageObjectNotFoundError)) throw error;
    }
  }
}

export const createObjectStorage = async ({
  environment = process.env,
  defaultLocalRoot,
  fetchImpl = globalThis.fetch,
  clock
} = {}) => {
  const provider = String(environment.STORAGE_PROVIDER || 'local').trim().toLowerCase();
  if (provider === 'r2') {
    const configuredTimeout = String(environment.R2_REQUEST_TIMEOUT_MS || '').trim();
    const storage = new R2ObjectStorage({
      endpoint: String(environment.R2_ENDPOINT || '').trim(),
      accessKeyId: String(environment.R2_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: String(environment.R2_SECRET_ACCESS_KEY || '').trim(),
      bucketName: String(environment.R2_BUCKET_NAME || '').trim(),
      prefix: environment.R2_PREFIX,
      fetchImpl,
      clock,
      timeoutMs: configuredTimeout ? Number(configuredTimeout) : DEFAULT_TIMEOUT_MS
    });
    return storage.initialise();
  }
  if (provider !== 'local') throw new Error(`Unsupported storage provider: ${provider}`);
  const configuredLocalRoot = String(environment.UPLOADS_DIR || defaultLocalRoot || '').trim();
  if (!configuredLocalRoot) {
    throw new Error('UPLOADS_DIR or defaultLocalRoot is required for local storage.');
  }
  const localRoot = path.resolve(configuredLocalRoot);
  return new LocalObjectStorage(localRoot).initialise();
};
