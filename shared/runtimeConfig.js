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

export const productionConfigurationErrors = (environment = process.env) => {
  if (environment.NODE_ENV !== 'production') return [];

  const errors = [];
  const adminEmail = String(environment.ADMIN_EMAIL || '').trim();
  const adminEntryPath = String(environment.VITE_ADMIN_ENTRY_PATH || '').trim();
  const sessionSecret = String(environment.SESSION_SECRET || '');
  const uploadsDir = String(environment.UPLOADS_DIR || '').trim();

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

  const isRender = String(environment.RENDER || '').toLowerCase() === 'true';
  if (isRender) {
    const normalisedUploadsDir = path.posix.normalize(uploadsDir);
    if (
      !path.posix.isAbsolute(uploadsDir)
      || (normalisedUploadsDir !== '/var/data' && !normalisedUploadsDir.startsWith('/var/data/'))
    ) {
      errors.push('UPLOADS_DIR must be /var/data or a directory beneath /var/data on Render.');
    }
  } else if (!uploadsDir || !path.isAbsolute(uploadsDir)) {
    errors.push('UPLOADS_DIR must be an absolute path to persistent storage.');
  }

  return errors;
};

export const assertProductionConfiguration = (environment = process.env) => {
  const errors = productionConfigurationErrors(environment);
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`);
  }
};
