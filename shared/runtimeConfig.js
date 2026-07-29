import path from 'node:path';

export const SESSION_SECRET_PLACEHOLDER = 'replace-with-a-unique-random-string-at-least-32-characters-long';
export const ADMIN_ENTRY_PATH_PLACEHOLDER = '/replace-with-your-private-admin-entry-path';

export const isConfiguredMongoUri = value => {
  const uri = String(value || '').trim();
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) return false;

  const remainder = uri.replace(/^mongodb(?:\+srv)?:\/\//i, '');
  const pathIndex = remainder.indexOf('/');
  if (pathIndex <= 0) return false;

  const authority = remainder.slice(0, pathIndex);
  const database = remainder.slice(pathIndex + 1).split('?', 1)[0];
  const atIndex = authority.lastIndexOf('@');
  if (atIndex <= 0 || !database) return false;

  const credentials = authority.slice(0, atIndex);
  const hosts = authority.slice(atIndex + 1);
  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex <= 0 || !hosts) return false;

  const decode = input => {
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  };
  const username = decode(credentials.slice(0, separatorIndex)).trim().toUpperCase();
  const password = decode(credentials.slice(separatorIndex + 1)).trim().toUpperCase();
  const databaseName = decode(database).trim().toUpperCase();
  const hostName = hosts.trim().toUpperCase();
  const placeholders = new Set(['USERNAME', 'PASSWORD', 'CLUSTER', 'DATABASE', 'CHANGE_ME', 'REPLACE_ME']);

  return Boolean(username && password && databaseName && hostName)
    && !placeholders.has(username)
    && !placeholders.has(password)
    && !placeholders.has(databaseName)
    && !placeholders.has(hostName);
};

export const isValidAdminPassword = value => {
  const password = String(value || '');
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
};

export const isValidSessionSecret = (value, adminPassword = '') => {
  const rawSecret = String(value || '');
  const secret = rawSecret.trim();
  const knownPlaceholders = new Set([
    SESSION_SECRET_PLACEHOLDER,
    'local-development-change-me',
    'change-this-session-secret',
    'replace-this-session-secret'
  ].map(placeholder => placeholder.toLowerCase()));
  return rawSecret === secret
    && secret.length >= 32
    && new Set(secret).size >= 8
    && !knownPlaceholders.has(secret.toLowerCase())
    && secret !== String(adminPassword || '').trim();
};

const isConfiguredCredential = (value, minimumLength) => {
  const rawValue = String(value || '');
  const credential = rawValue.trim();
  const normalised = credential.toLowerCase();
  return rawValue === credential
    && credential.length >= minimumLength
    && !normalised.includes('replace')
    && !normalised.includes('change-me')
    && !normalised.includes('access-key')
    && !normalised.includes('secret-key')
    && !/[<>]/.test(credential);
};

export const isValidR2Endpoint = value => {
  const rawEndpoint = String(value || '');
  const endpoint = rawEndpoint.trim();
  if (!endpoint || rawEndpoint !== endpoint) return false;

  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && !parsed.port
      && parsed.pathname === '/'
      && !parsed.search
      && !parsed.hash
      && /^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
};

export const isValidR2BucketName = value => {
  const bucketName = String(value || '');
  return bucketName.length >= 3
    && bucketName.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(bucketName);
};

export const isValidR2Prefix = value => {
  const rawPrefix = String(value || '');
  const prefix = rawPrefix.trim();
  if (!prefix) return rawPrefix === prefix;
  if (
    rawPrefix !== prefix
    || prefix.length > 255
    || prefix.startsWith('/')
    || prefix.endsWith('/')
    || prefix.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(prefix)
  ) {
    return false;
  }
  return prefix
    .split('/')
    .every(segment => /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(segment) && segment !== '.' && segment !== '..');
};

export const productionConfigurationErrors = (environment = process.env) => {
  if (environment.NODE_ENV !== 'production') return [];

  const errors = [];
  const adminEmail = String(environment.ADMIN_EMAIL || '').trim();
  const adminEntryPath = String(environment.VITE_ADMIN_ENTRY_PATH || '').trim();
  const sessionSecret = String(environment.SESSION_SECRET || '');
  const storageProvider = String(environment.STORAGE_PROVIDER || '').trim().toLowerCase();
  const rawUploadsDir = String(environment.UPLOADS_DIR || '');
  const uploadsDir = rawUploadsDir.trim();

  if (!isConfiguredMongoUri(environment.MONGODB_URI)) {
    errors.push('MONGODB_URI must be a complete mongodb:// or mongodb+srv:// connection string without placeholders.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    errors.push('ADMIN_EMAIL must be a valid email address.');
  }
  if (!isValidAdminPassword(environment.ADMIN_PASSWORD)) {
    errors.push('ADMIN_PASSWORD must contain at least 10 characters, one letter, and one number.');
  }
  if (!isValidSessionSecret(sessionSecret, environment.ADMIN_PASSWORD)) {
    errors.push('SESSION_SECRET must be a unique random value of at least 32 characters and must differ from ADMIN_PASSWORD.');
  }
  if (
    !/^\/[A-Za-z0-9/_-]+$/.test(adminEntryPath)
    || adminEntryPath === '/'
    || adminEntryPath === '/ips-mission-control'
    || adminEntryPath === ADMIN_ENTRY_PATH_PLACEHOLDER
  ) {
    errors.push('VITE_ADMIN_ENTRY_PATH must be a custom path beginning with / and containing only letters, numbers, /, _ or -.');
  }

  if (!['local', 'r2'].includes(storageProvider)) {
    errors.push('STORAGE_PROVIDER must be either local or r2.');
  } else if (storageProvider === 'r2') {
    if (!isValidR2Endpoint(environment.R2_ENDPOINT)) {
      errors.push('R2_ENDPOINT must be the HTTPS origin for this Cloudflare R2 account, without a path, query, or fragment.');
    }
    if (!isValidR2BucketName(environment.R2_BUCKET_NAME)) {
      errors.push('R2_BUCKET_NAME must contain 3-63 lowercase letters, numbers, or hyphens, and cannot begin or end with a hyphen.');
    }
    if (!isConfiguredCredential(environment.R2_ACCESS_KEY_ID, 16)) {
      errors.push('R2_ACCESS_KEY_ID must be a non-placeholder R2 access key.');
    }
    if (!isConfiguredCredential(environment.R2_SECRET_ACCESS_KEY, 32)) {
      errors.push('R2_SECRET_ACCESS_KEY must be a non-placeholder R2 secret access key.');
    }
    if (!isValidR2Prefix(environment.R2_PREFIX)) {
      errors.push('R2_PREFIX must be empty or a safe object-key prefix without relative path segments.');
    }
    if (environment.R2_REQUEST_TIMEOUT_MS !== undefined && environment.R2_REQUEST_TIMEOUT_MS !== '') {
      const timeoutMs = Number(environment.R2_REQUEST_TIMEOUT_MS);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) {
        errors.push('R2_REQUEST_TIMEOUT_MS must be an integer between 1000 and 300000.');
      }
    }
  } else {
    const isRender = String(environment.RENDER || '').toLowerCase() === 'true';
    if (isRender) {
      const normalisedUploadsDir = path.posix.normalize(uploadsDir);
      if (
        rawUploadsDir !== uploadsDir
        || !path.posix.isAbsolute(uploadsDir)
        || (normalisedUploadsDir !== '/var/data' && !normalisedUploadsDir.startsWith('/var/data/'))
      ) {
        errors.push('UPLOADS_DIR must be /var/data or a directory beneath /var/data on Render when STORAGE_PROVIDER=local.');
      }
    } else if (rawUploadsDir !== uploadsDir || !uploadsDir || !path.isAbsolute(uploadsDir)) {
      errors.push('UPLOADS_DIR must be an absolute path when STORAGE_PROVIDER=local.');
    }
  }

  return errors;
};

export const assertProductionConfiguration = (environment = process.env) => {
  const errors = productionConfigurationErrors(environment);
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`);
  }
};
