import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Import MongoDB models
import Client from './models/Client.js';
import Order from './models/Order.js';
import Writer from './models/Writer.js';
import Admin from './models/Admin.js';
import AdminRole from './models/AdminRole.js';
import PlatformFile from './models/PlatformFile.js';
import Message from './models/Message.js';
import AuditLog from './models/AuditLog.js';
import Notification from './models/Notification.js';
import ServiceRequest from './models/ServiceRequest.js';
import WorkDecision from './models/WorkDecision.js';
import WorkExpense from './models/WorkExpense.js';
import QuoteVersion from './models/QuoteVersion.js';
import ConversationState from './models/ConversationState.js';
import ActionState from './models/ActionState.js';
import DirectConversation from './models/DirectConversation.js';
import DirectMessage from './models/DirectMessage.js';
import PlatformConfig from './models/PlatformConfig.js';
import ConfigRevision from './models/ConfigRevision.js';
import MediaAsset from './models/MediaAsset.js';
import SupportTicket from './models/SupportTicket.js';
import { DEFAULT_PLATFORM_CONFIG, clonePlatformConfig, normalisePlatformConfig } from './shared/platformConfig.js';
import {
  ADMIN_PERMISSION_CATALOG,
  BUILT_IN_ADMIN_ROLES,
  hasAdminPermission,
  permissionForAdminRequest,
  rolePermissions
} from './shared/adminPermissions.js';
import {
  assertProductionConfiguration,
  isConfiguredMongoUri,
  isValidAdminPassword
} from './shared/runtimeConfig.js';
import {
  createObjectStorage,
  StorageObjectNotFoundError,
  StorageRequestError
} from './shared/objectStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
assertProductionConfiguration(process.env);

const objectStorage = await createObjectStorage({
  environment: process.env,
  defaultLocalRoot: path.join(__dirname, 'uploads')
});
const storageKey = (scope, storedName) => {
  const safeName = String(storedName || '');
  if (
    !safeName
    || safeName !== path.basename(safeName)
    || safeName.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(safeName)
  ) {
    throw new Error('Invalid stored object name.');
  }
  if (objectStorage.provider === 'local') {
    return scope === 'media' ? `media/${safeName}` : safeName;
  }
  return `${scope}/${safeName}`;
};

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '35mb' }));

const sessionSecret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'local-development-change-me';
const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};
const validAdminPassword = isValidAdminPassword;
const verifyPassword = (password, stored) => {
  if (!stored?.startsWith('scrypt$')) return String(password) === String(stored);
  const [, salt, expected] = stored.split('$');
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};
const setSessionCookie = (res, token) => {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ips_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
};
const signSession = payload => {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
};
const readSession = req => {
  try {
    const cookieToken = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('ips_session='))?.slice(12);
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || cookieToken;
    if (!token) return null;
    const [body, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};
const requireSession = (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ success: false, error: 'A valid signed-in session is required.' });
    return null;
  }
  return session;
};

// Production waits for MongoDB before accepting traffic. Development can still
// launch without a database so the interface and verification tools remain usable.
const mongoUri = process.env.MONGODB_URI?.trim();
const hasConfiguredMongo = isConfiguredMongoUri(mongoUri);

if (hasConfiguredMongo) {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('Database connected.');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    if (isProduction) {
      throw new Error(`Production startup aborted because MongoDB could not be reached: ${error.message}`);
    }
  }
} else {
  console.warn('MONGODB_URI is missing or contains placeholders. Database APIs are unavailable in this development session.');
}

const resolveAdminAccess = async session => {
  if (session?.root_admin) {
    return {
      adminId: session.id,
      name: 'Primary Super Admin',
      email: session.id,
      role: 'superadmin',
      permissions: ['*'],
      isSuperAdmin: true,
      isRoot: true,
      mustChangePassword: false
    };
  }
  const admin = await Admin.findOne({ id: session?.id }).lean();
  if (!admin || (admin.status || 'Active') !== 'Active') return null;
  if (Number(session?.session_version || 1) !== Number(admin.session_version || 1)) return null;
  const customRole = admin.custom_role_id
    ? await AdminRole.findOne({ role_id: admin.custom_role_id }).lean()
    : null;
  const permissions = customRole
    ? rolePermissions('custom', customRole.permissions)
    : rolePermissions(admin.role, admin.permissions);
  return {
    adminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    customRoleId: admin.custom_role_id || '',
    customRoleName: customRole?.name || '',
    permissions,
    isSuperAdmin: admin.role === 'superadmin' || permissions.includes('*'),
    isRoot: false,
    mustChangePassword: Boolean(admin.must_change_password)
  };
};

app.use(async (req, res, next) => {
  try {
    const session = readSession(req);
    if (!session) return next();
    if (session.role !== 'admin') return next();
    const requiredPermission = permissionForAdminRequest(req.method, req.path);
    const isAccessRefresh = req.path === '/api/admin/me';
    if (!requiredPermission && !isAccessRefresh) return next();
    const access = await resolveAdminAccess(session);
    if (!access) return res.status(401).json({ success: false, error: 'This administrator session is no longer active.' });
    if (requiredPermission && !hasAdminPermission(access, requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `Administrator permission required: ${requiredPermission}`,
        permission: requiredPermission
      });
    }
    req.adminAccess = access;
    next();
  } catch (error) {
    res.status(503).json({ success: false, error: `Administrator access could not be verified: ${error.message}` });
  }
});

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const ready = !isProduction || databaseConnected;
  res.status(ready ? 200 : 503).json({
    success: ready,
    server: 'online',
    database: databaseConnected ? 'connected' : 'disconnected',
    storage: objectStorage.provider,
    ready
  });
});

// ========== CLIENT APIs ==========

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const [clients, orderTotals] = await Promise.all([
      Client.find().select('-password').sort({ createdAt: -1 }).lean(),
      Order.aggregate([
        {
          $group: {
            _id: '$client_id',
            total_orders: { $sum: 1 },
            total_spent: { $sum: '$total_fee_usd' }
          }
        }
      ])
    ]);
    const totalsByClient = new Map(
      orderTotals.map(total => [total._id, total])
    );
    const clientsWithTotals = clients.map(client => ({
      ...client,
      total_orders: totalsByClient.get(client.client_id)?.total_orders || 0,
      total_spent: totalsByClient.get(client.client_id)?.total_spent || 0
    }));
    res.json({ success: true, clients: clientsWithTotals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create client
app.post('/api/clients', async (req, res) => {
  try {
    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (fullName.length < 2 || !email.includes('@') || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Name, valid email, and a password of at least 8 characters are required.' });
    }
    const count = await Client.countDocuments();
    const newId = `CID-${String(count + 1).padStart(3, '0')}`;
    const client = new Client({
      client_id: newId,
      full_name: fullName,
      email,
      password: hashPassword(password),
      phone: String(req.body?.phone || '').trim(),
      country: String(req.body?.country || '').trim()
    });
    await client.save();
    const safeClient = client.toObject();
    delete safeClient.password;
    const token = signSession({ id: client.client_id, role: 'client' });
    setSessionCookie(res, token);
    res.json({ success: true, client: safeClient, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update client
app.patch('/api/clients/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' && !(session.role === 'client' && session.id === req.params.id)) return res.status(403).json({ success: false, error: 'You cannot update this client.' });
    const clientFields = ['full_name', 'phone', 'country', 'password'];
    const adminFields = [...clientFields, 'email', 'status', 'notes'];
    const allowedFields = session.role === 'admin' ? adminFields : clientFields;
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key))
    );
    if (updates.password) updates.password = hashPassword(updates.password);
    const client = await Client.findOneAndUpdate(
      { client_id: req.params.id },
      updates,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');
    if (!client) return res.status(404).json({ success: false, error: 'Client not found.' });
    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    await Client.findOneAndDelete({ client_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Client login
app.post('/api/client/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const client = await Client.findOne({ email });
    if (client && verifyPassword(password, client.password)) {
      if (!client.password.startsWith('scrypt$')) {
        client.password = hashPassword(password);
        await client.save();
      }
      const safeClient = client.toObject();
      delete safeClient.password;
      const token = signSession({ id: client.client_id, role: 'client' });
      setSessionCookie(res, token);
      res.json({ success: true, client: safeClient, token });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ORDER APIs ==========

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'client') return res.status(403).json({ success: false, error: 'Client access required.' });
    const client = await Client.findOne({ client_id: session.id }).select('-password');
    if (!client) return res.status(404).json({ success: false, error: 'Client account not found.' });
    const count = await Order.countDocuments();
    const newId = `ORD-${String(count + 1).padStart(4, '0')}`;
    const order = new Order({
      ...req.body,
      client_id: session.id,
      client_name: client.full_name,
      client_email: client.email,
      order_id: newId
    });
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update order
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const existing = await Order.findOne({ order_id: req.params.id });
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found.' });
    if (!canAccessWork(session, { record: existing, kind: 'academic' })) return res.status(403).json({ success: false, error: 'You do not have access to update this order.' });
    if (req.body.status && !canTransitionAcademic(existing.status, req.body.status, session.role)) {
      return res.status(409).json({ success: false, error: `Status cannot move from "${existing.status}" to "${req.body.status}" for this role.` });
    }
    const updates = { ...req.body };
    if (session.role === 'writer') {
      const allowed = ['status', 'progress', 'milestones', 'writer_notes'];
      Object.keys(updates).forEach(key => { if (!allowed.includes(key)) delete updates[key]; });
    } else if (session.role === 'client') {
      const allowed = ['status', 'client_approved'];
      Object.keys(updates).forEach(key => { if (!allowed.includes(key)) delete updates[key]; });
    }
    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      updates,
      { returnDocument: 'after' }
    );
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can delete orders.' });
    await Order.findOneAndDelete({ order_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get one order by MongoDB ID or public order ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const query = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { order_id: req.params.id };
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (!canAccessWork(session, { record: order, kind: 'academic' })) {
      return res.status(403).json({ success: false, error: 'You do not have access to this order.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get orders by client
app.get('/api/orders/client/:clientId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' && !(session.role === 'client' && session.id === req.params.clientId)) return res.status(403).json({ success: false, error: 'You cannot view these orders.' });
    const orders = await Order.find({ client_id: req.params.clientId });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get orders by writer
app.get('/api/orders/writer/:writerId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' && !(session.role === 'writer' && session.id === req.params.writerId)) return res.status(403).json({ success: false, error: 'You cannot view these assignments.' });
    const orders = await Order.find({ writer_id: req.params.writerId });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== WRITER APIs ==========

app.get('/api/writers', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const writers = await Writer.find().select('-password');
    res.json({ success: true, writers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/writers', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const count = await Writer.countDocuments();
    const newId = `WID-${String(count + 1).padStart(3, '0')}`;
    const writer = new Writer({ ...req.body, password: hashPassword(req.body.password), writer_id: newId });
    await writer.save();
    const safeWriter = writer.toObject();
    delete safeWriter.password;
    res.json({ success: true, writer: safeWriter });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/writers/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    await Writer.findOneAndDelete({ writer_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/writers/:id/status', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const writer = await Writer.findOneAndUpdate(
      { writer_id: req.params.id },
      { status: req.body.status },
      { returnDocument: 'after' }
    ).select('-password');
    if (!writer) return res.status(404).json({ success: false, error: 'Writer not found.' });
    res.json({ success: true, writer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/writers/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' && !(session.role === 'writer' && session.id === req.params.id)) {
      return res.status(403).json({ success: false, error: 'You cannot update this provider.' });
    }
    const allowedUpdates = [
      'full_name',
      'email',
      'password',
      'primary_expertise',
      'secondary_expertise',
      'academic_level',
      'rate_per_page_usd',
      'availability',
      'status'
    ];
    const providerUpdates = ['full_name', 'password', 'primary_expertise', 'secondary_expertise', 'academic_level', 'availability'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => (session.role === 'admin' ? allowedUpdates : providerUpdates).includes(key))
    );
    if (updates.password) updates.password = hashPassword(updates.password);
    const writer = await Writer.findOneAndUpdate(
      { writer_id: req.params.id },
      updates,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');
    if (!writer) {
      return res.status(404).json({ success: false, error: 'Writer not found' });
    }
    res.json({ success: true, writer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Writer login
app.post('/api/writer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const writer = await Writer.findOne({ email, status: 'Active' });
    if (writer && verifyPassword(password, writer.password)) {
      if (!writer.password.startsWith('scrypt$')) {
        writer.password = hashPassword(password);
        await writer.save();
      }
      const safeWriter = writer.toObject();
      delete safeWriter.password;
      const token = signSession({ id: writer.writer_id, role: 'writer' });
      setSessionCookie(res, token);
      res.json({ success: true, writer: safeWriter, token });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ADMIN APIs ==========

const adminLoginAttempts = new Map();
const adminLoginWindowMs = 15 * 60 * 1000;
const adminLoginMaxAttempts = 5;
const adminLoginKey = req => `${String(req.body?.email || '').trim().toLowerCase()}|${req.ip || req.socket?.remoteAddress || 'unknown'}`;
const adminLoginThrottle = (req, res) => {
  const key = adminLoginKey(req);
  const now = Date.now();
  const previous = adminLoginAttempts.get(key);
  if (!previous || now - previous.firstAttempt > adminLoginWindowMs) {
    adminLoginAttempts.delete(key);
    return { key, blocked: false };
  }
  if (previous.count >= adminLoginMaxAttempts) {
    const waitSeconds = Math.max(1, Math.ceil((adminLoginWindowMs - (now - previous.firstAttempt)) / 1000));
    res.setHeader('Retry-After', String(waitSeconds));
    res.status(429).json({ success: false, error: 'Too many administrator sign-in attempts. Try again later.' });
    return { key, blocked: true };
  }
  return { key, blocked: false };
};
const recordAdminLoginFailure = key => {
  const now = Date.now();
  const previous = adminLoginAttempts.get(key);
  adminLoginAttempts.set(key, !previous || now - previous.firstAttempt > adminLoginWindowMs
    ? { count: 1, firstAttempt: now }
    : { ...previous, count: previous.count + 1 });
};

app.post('/api/admin/login', async (req, res) => {
  try {
    const throttle = adminLoginThrottle(req, res);
    if (throttle.blocked) return;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@ipsglobal.com').trim().toLowerCase();
    
    if (email === adminEmail && password === process.env.ADMIN_PASSWORD) {
      const token = signSession({
        id: email,
        role: 'admin',
        admin_role: 'superadmin',
        root_admin: true,
        session_version: 1
      });
      setSessionCookie(res, token);
      adminLoginAttempts.delete(throttle.key);
      AuditLog.create({
        order_id: 'ADMIN-ACCESS',
        actor_id: email,
        actor_role: 'superadmin',
        action: 'administrator_login_succeeded',
        details: { root: true }
      }).catch(() => {});
      res.json({
        success: true,
        token,
        role: 'superadmin',
        admin: {
          id: email,
          email,
          name: 'Primary Super Admin',
          role: 'superadmin',
          permissions: ['*'],
          isSuperAdmin: true,
          isRoot: true,
          mustChangePassword: false
        }
      });
      return;
    }
    
    const admin = await Admin.findOne({ email });
    if (admin && (admin.status || 'Active') === 'Active' && verifyPassword(password, admin.password)) {
      if (!admin.password.startsWith('scrypt$')) {
        admin.password = hashPassword(password);
      }
      const customRole = admin.custom_role_id
        ? await AdminRole.findOne({ role_id: admin.custom_role_id })
        : null;
      const permissions = customRole
        ? rolePermissions('custom', customRole.permissions)
        : rolePermissions(admin.role, admin.permissions);
      admin.last_login_at = new Date();
      await admin.save();
      const token = signSession({
        id: admin.id,
        role: 'admin',
        admin_role: admin.role,
        session_version: admin.session_version || 1
      });
      setSessionCookie(res, token);
      adminLoginAttempts.delete(throttle.key);
      AuditLog.create({
        order_id: 'ADMIN-ACCESS',
        actor_id: admin.id,
        actor_role: 'admin',
        action: 'administrator_login_succeeded',
        details: { role: admin.role }
      }).catch(() => {});
      res.json({
        success: true,
        token,
        role: admin.role,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          customRoleId: admin.custom_role_id || '',
          customRoleName: customRole?.name || '',
          permissions,
          isSuperAdmin: admin.role === 'superadmin' || permissions.includes('*'),
          isRoot: false,
          mustChangePassword: Boolean(admin.must_change_password)
        }
      });
    } else {
      recordAdminLoginFailure(throttle.key);
      await AuditLog.create({
        order_id: 'ADMIN-ACCESS',
        actor_id: email || 'unknown',
        actor_role: 'anonymous',
        action: 'administrator_login_failed',
        details: { ip: req.ip || '', attempt_count: adminLoginAttempts.get(throttle.key)?.count || 1 }
      }).catch(() => {});
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/me', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    res.json({ success: true, admin: req.adminAccess });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/change-password', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (req.adminAccess.isRoot) {
      return res.status(409).json({ success: false, error: 'Change the root Super Admin password in the protected deployment environment.' });
    }
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!validAdminPassword(newPassword)) {
      return res.status(400).json({ success: false, error: 'The new password must contain at least 10 characters, one letter, and one number.' });
    }
    const admin = await Admin.findOne({ id: req.adminAccess.adminId });
    if (!admin || !verifyPassword(currentPassword, admin.password)) {
      return res.status(401).json({ success: false, error: 'The current password is incorrect.' });
    }
    if (verifyPassword(newPassword, admin.password)) {
      return res.status(400).json({ success: false, error: 'Choose a password different from the current password.' });
    }
    admin.password = hashPassword(newPassword);
    admin.must_change_password = false;
    admin.last_password_reset_at = new Date();
    admin.session_version = Number(admin.session_version || 1) + 1;
    await admin.save();
    const token = signSession({
      id: admin.id,
      role: 'admin',
      admin_role: admin.role,
      session_version: admin.session_version
    });
    setSessionCookie(res, token);
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: admin.id,
      actor_role: 'admin',
      action: 'administrator_password_changed',
      details: { administrator_id: admin.id }
    });
    const access = await resolveAdminAccess({ id: admin.id, session_version: admin.session_version });
    res.json({ success: true, token, admin: access });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const logs = await AuditLog.find({
      $or: [
        { order_id: { $in: ['ADMIN-ACCESS', 'PLATFORM-CONFIG', 'MEDIA-LIBRARY'] } },
        { actor_role: { $in: ['admin', 'superadmin'] } }
      ]
    }).sort({ createdAt: -1 }).limit(150).lean();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      rootAdmin: {
        id: String(process.env.ADMIN_EMAIL || 'admin@ipsglobal.com').trim().toLowerCase(),
        name: 'Primary Super Admin',
        email: String(process.env.ADMIN_EMAIL || 'admin@ipsglobal.com').trim().toLowerCase(),
        role: 'superadmin',
        status: 'Active',
        isRoot: true
      },
      admins
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const temporaryPassword = String(req.body?.password || '');
    if (name.length < 2 || !email.includes('@') || !validAdminPassword(temporaryPassword)) {
      return res.status(400).json({ success: false, error: 'Name, valid email, and a temporary password of at least 10 characters with a letter and number are required.' });
    }
    const role = BUILT_IN_ADMIN_ROLES[req.body?.role] && req.body.role !== 'superadmin' ? req.body.role : 'moderator';
    const customRoleId = String(req.body?.custom_role_id || '');
    const customRole = customRoleId ? await AdminRole.findOne({ role_id: customRoleId }).lean() : null;
    if (customRoleId && !customRole) {
      return res.status(400).json({ success: false, error: 'The selected custom role does not exist.' });
    }
    const newId = `ADM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const admin = new Admin({
      id: newId,
      name,
      email,
      password: hashPassword(temporaryPassword),
      role,
      custom_role_id: customRoleId,
      permissions: customRole ? rolePermissions('custom', customRole.permissions) : rolePermissions(role, req.body?.permissions),
      status: 'Active',
      must_change_password: true,
      session_version: 1,
      created_by: req.adminAccess.adminId,
      last_password_reset_at: new Date()
    });
    await admin.save();
    const safeAdmin = admin.toObject();
    delete safeAdmin.password;
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: 'administrator_created',
      details: { admin_id: admin.id, role: admin.role, custom_role_id: admin.custom_role_id }
    });
    res.json({ success: true, admin: safeAdmin });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admins/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    if (req.adminAccess.adminId === req.params.id && (req.body?.status || req.body?.role)) {
      return res.status(409).json({ success: false, error: 'Use another Super Admin to change your own authority or status.' });
    }
    const admin = await Admin.findOne({ id: req.params.id });
    if (!admin) return res.status(404).json({ success: false, error: 'Administrator not found.' });
    if (req.body?.role && (!BUILT_IN_ADMIN_ROLES[req.body.role] || req.body.role === 'superadmin')) {
      return res.status(400).json({ success: false, error: 'Choose a valid delegated administrator role. The immutable root account is the only Super Admin.' });
    }
    if (req.body?.custom_role_id) {
      const customRole = await AdminRole.findOne({ role_id: String(req.body.custom_role_id) }).lean();
      if (!customRole) return res.status(400).json({ success: false, error: 'The selected custom role does not exist.' });
    }
    const allowed = ['name', 'email', 'role', 'custom_role_id', 'permissions', 'status', 'suspended_reason', 'must_change_password'];
    for (const [key, value] of Object.entries(req.body || {})) {
      if (allowed.includes(key)) admin[key] = value;
    }
    if (req.body?.temporary_password) {
      if (!validAdminPassword(req.body.temporary_password)) {
        return res.status(400).json({ success: false, error: 'Temporary password must contain at least 10 characters, one letter, and one number.' });
      }
      admin.password = hashPassword(req.body.temporary_password);
      admin.must_change_password = true;
      admin.last_password_reset_at = new Date();
    }
    const assignedCustomRole = admin.custom_role_id
      ? await AdminRole.findOne({ role_id: admin.custom_role_id }).lean()
      : null;
    if (admin.custom_role_id && !assignedCustomRole) {
      return res.status(400).json({ success: false, error: 'The selected custom role does not exist.' });
    }
    admin.permissions = assignedCustomRole
      ? rolePermissions('custom', assignedCustomRole.permissions)
      : rolePermissions(admin.role);
    admin.session_version = Number(admin.session_version || 1) + 1;
    await admin.save();
    const safeAdmin = admin.toObject();
    delete safeAdmin.password;
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: req.body?.temporary_password ? 'administrator_password_reset' : 'administrator_updated',
      details: {
        admin_id: admin.id,
        role: admin.role,
        status: admin.status,
        permissions: admin.permissions,
        reason: String(req.body?.reason || req.body?.suspended_reason || '').slice(0, 500)
      }
    });
    res.json({ success: true, admin: safeAdmin, sessionsRevoked: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    if (req.adminAccess.adminId === req.params.id) return res.status(409).json({ success: false, error: 'You cannot delete your own administrator account.' });
    const removed = await Admin.findOneAndDelete({ id: req.params.id });
    if (!removed) return res.status(404).json({ success: false, error: 'Administrator not found.' });
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: 'administrator_deleted',
      details: { admin_id: removed.id, role: removed.role }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/permissions', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
  res.json({ success: true, permissions: ADMIN_PERMISSION_CATALOG, builtInRoles: BUILT_IN_ADMIN_ROLES });
});

app.get('/api/admin-roles', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const roles = await AdminRole.find().sort({ name: 1 }).lean();
    res.json({ success: true, roles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin-roles', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const name = String(req.body?.name || '').trim();
    if (name.length < 3) return res.status(400).json({ success: false, error: 'Role name must be at least 3 characters.' });
    const role = await AdminRole.create({
      role_id: `ROLE-${Date.now().toString(36).toUpperCase()}`,
      name,
      description: String(req.body?.description || '').trim(),
      permissions: rolePermissions('custom', req.body?.permissions),
      created_by: req.adminAccess.adminId,
      updated_by: req.adminAccess.adminId
    });
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: 'custom_admin_role_created',
      details: { role_id: role.role_id, permissions: role.permissions }
    });
    res.status(201).json({ success: true, role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin-roles/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const updates = {
      ...(req.body?.name !== undefined ? { name: String(req.body.name).trim() } : {}),
      ...(req.body?.description !== undefined ? { description: String(req.body.description).trim() } : {}),
      ...(req.body?.permissions !== undefined ? { permissions: rolePermissions('custom', req.body.permissions) } : {}),
      updated_by: req.adminAccess.adminId
    };
    const role = await AdminRole.findOneAndUpdate({ role_id: req.params.id }, updates, { returnDocument: 'after', runValidators: true });
    if (!role) return res.status(404).json({ success: false, error: 'Custom role not found.' });
    await Admin.updateMany({ custom_role_id: role.role_id }, { $inc: { session_version: 1 } });
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: 'custom_admin_role_updated',
      details: { role_id: role.role_id, permissions: role.permissions }
    });
    res.json({ success: true, role, sessionsRevoked: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin-roles/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!req.adminAccess?.isSuperAdmin) return res.status(403).json({ success: false, error: 'Super Admin access required.' });
    const assigned = await Admin.countDocuments({ custom_role_id: req.params.id, status: { $ne: 'Archived' } });
    if (assigned) return res.status(409).json({ success: false, error: 'Reassign administrators before deleting this role.' });
    const role = await AdminRole.findOneAndDelete({ role_id: req.params.id });
    if (!role) return res.status(404).json({ success: false, error: 'Custom role not found.' });
    await AuditLog.create({
      order_id: 'ADMIN-ACCESS',
      actor_id: req.adminAccess.adminId,
      actor_role: 'superadmin',
      action: 'custom_admin_role_deleted',
      details: { role_id: role.role_id, name: role.name }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== PHASE 9: DATA CONSOLIDATION, SUPPORT, ANALYTICS ==========

const requireAdminSession = (req, res) => {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required.' });
    return null;
  }
  return session;
};

const milestoneValue = (order, milestone) => {
  const explicit = Number(milestone?.amount);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const count = Math.max(order?.milestones?.length || 1, 1);
  return Number(order?.total_fee_usd || 0) / count;
};

const phase9Analytics = async () => {
  const [orders, services, clients, writers, admins, tickets] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).lean(),
    ServiceRequest.find().sort({ createdAt: -1 }).lean(),
    Client.find().select('-password').sort({ createdAt: -1 }).lean(),
    Writer.find().select('-password').sort({ createdAt: -1 }).lean(),
    Admin.find().select('-password').sort({ createdAt: -1 }).lean(),
    SupportTicket.find().sort({ last_activity_at: -1 }).lean()
  ]);

  const paidAcademic = orders.reduce((total, order) => total + (order.milestones || [])
    .filter(milestone => milestone.paid)
    .reduce((sum, milestone) => sum + milestoneValue(order, milestone), 0), 0);
  const outstandingAcademic = orders.reduce((total, order) => total + (order.milestones || [])
    .filter(milestone => !milestone.paid && String(milestone.status).toLowerCase() !== 'cancelled')
    .reduce((sum, milestone) => sum + milestoneValue(order, milestone), 0), 0);
  const acceptedServiceValue = services
    .filter(service => service.quote?.accepted)
    .reduce((total, service) => total + Number(service.quote?.total || 0), 0);
  const inactiveStatuses = new Set(['Completed', 'Cancelled', 'Closed']);
  const activeOrders = orders.filter(order => !inactiveStatuses.has(order.status)).length;
  const activeServices = services.filter(service => !inactiveStatuses.has(service.status)).length;
  const newSignups30d = clients.filter(client => {
    const registered = new Date(client.createdAt || client.registration_date);
    return Number.isFinite(registered.getTime()) && Date.now() - registered.getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const openTickets = tickets.filter(ticket => !['Resolved', 'Closed'].includes(ticket.status)).length;
  const clientCountries = new Map(clients.map(client => [client.client_id, client.country || 'Unknown']));

  const serviceMap = new Map();
  const addServiceStat = (key, type, value = 0) => {
    const label = String(key || 'Uncategorised');
    const current = serviceMap.get(`${type}:${label}`) || { service: label, type, count: 0, value: 0 };
    current.count += 1;
    current.value += Number(value || 0);
    serviceMap.set(`${type}:${label}`, current);
  };
  orders.forEach(order => addServiceStat(order.service_type, 'academic', order.total_fee_usd));
  services.forEach(service => addServiceStat(service.category || service.family, service.family, service.quote?.total));

  const countryMap = new Map();
  const addCountryStat = (clientId, value = 0) => {
    const country = clientCountries.get(clientId) || 'Unknown';
    const current = countryMap.get(country) || { country, count: 0, value: 0 };
    current.count += 1;
    current.value += Number(value || 0);
    countryMap.set(country, current);
  };
  orders.forEach(order => addCountryStat(order.client_id, order.total_fee_usd));
  services.forEach(service => addCountryStat(service.client_id, service.quote?.total));

  const outstandingAcademicOrders = orders.map(order => {
    const outstanding = (order.milestones || [])
      .filter(milestone => !milestone.paid && String(milestone.status).toLowerCase() !== 'cancelled')
      .reduce((sum, milestone) => sum + milestoneValue(order, milestone), 0);
    return {
      order_id: order.order_id,
      client_name: order.client_name,
      service_type: order.service_type,
      outstanding
    };
  }).filter(item => item.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  const attention = orders.filter(order => {
    const deadline = new Date(order.deadline);
    const days = Number.isFinite(deadline.getTime()) ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : 9999;
    return ['New', 'Disputed'].includes(order.status)
      || (days >= 0 && days <= 7 && !inactiveStatuses.has(order.status));
  }).slice(0, 10).map(order => ({
    order_id: order.order_id,
    client_name: order.client_name,
    service_type: order.service_type,
    deadline: order.deadline,
    status: order.status
  }));

  const recentActivity = [
    ...orders.slice(0, 20).map(order => ({
      id: order.order_id,
      kind: 'academic',
      text: `Academic order ${order.order_id}: ${order.service_type}`,
      status: order.status,
      date: order.updatedAt || order.createdAt,
      target: `/admin/orders/${order.order_id}`
    })),
    ...services.slice(0, 20).map(service => ({
      id: service.request_id,
      kind: service.family,
      text: `Service request ${service.request_id}: ${service.title}`,
      status: service.status,
      date: service.updatedAt || service.createdAt,
      target: `/admin/services/${service.request_id}`
    })),
    ...tickets.slice(0, 20).map(ticket => ({
      id: ticket.ticket_id,
      kind: 'support',
      text: `Support ticket ${ticket.ticket_id}: ${ticket.subject}`,
      status: ticket.status,
      date: ticket.last_activity_at || ticket.updatedAt || ticket.createdAt,
      target: `/admin/support?ticket=${ticket.ticket_id}`
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  return {
    counts: {
      clients: clients.length,
      providers: writers.length,
      admins: admins.length,
      academicOrders: orders.length,
      serviceRequests: services.length,
      supportTickets: tickets.length,
      openTickets,
      activeWork: activeOrders + activeServices,
      newSignups30d
    },
    finance: {
      paidAcademic,
      outstandingAcademic,
      acceptedServiceValue,
      trackedValue: paidAcademic + outstandingAcademic + acceptedServiceValue,
      currency: 'USD',
      collectionStatus: 'tracking_only'
    },
    byService: [...serviceMap.values()].sort((a, b) => b.value - a.value),
    byCountry: [...countryMap.values()].sort((a, b) => b.count - a.count),
    outstandingAcademicOrders,
    attention,
    recentActivity
  };
};

app.get('/api/admin/analytics', async (req, res) => {
  try {
    if (!requireAdminSession(req, res)) return;
    res.json({ success: true, analytics: await phase9Analytics(), source: 'MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/data-summary', async (req, res) => {
  try {
    if (!requireAdminSession(req, res)) return;
    const [
      clients, providers, admins, academicOrders, serviceRequests, files,
      workMessages, directConversations, directMessages, supportTickets, audits
    ] = await Promise.all([
      Client.countDocuments(),
      Writer.countDocuments(),
      Admin.countDocuments(),
      Order.countDocuments(),
      ServiceRequest.countDocuments(),
      PlatformFile.countDocuments(),
      Message.countDocuments(),
      DirectConversation.countDocuments(),
      DirectMessage.countDocuments(),
      SupportTicket.countDocuments(),
      AuditLog.countDocuments()
    ]);
    res.json({
      success: true,
      source: 'MongoDB',
      mode: 'server_authoritative',
      collections: {
        clients, providers, admins, academicOrders, serviceRequests, files,
        workMessages, directConversations, directMessages, supportTickets, audits
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/export', async (req, res) => {
  try {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const [
      clients, providers, admins, academicOrders, serviceRequests,
      fileMetadata, supportTickets, config, audit
    ] = await Promise.all([
      Client.find().select('-password').lean(),
      Writer.find().select('-password').lean(),
      Admin.find().select('-password').lean(),
      Order.find().lean(),
      ServiceRequest.find().lean(),
      PlatformFile.find().select('-stored_name').lean(),
      SupportTicket.find().lean(),
      PlatformConfig.findOne({ key: platformConfigKey }).select('-draft').lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(5000).lean()
    ]);
    await AuditLog.create({
      order_id: 'PLATFORM-DATA',
      actor_id: session.id,
      actor_role: 'admin',
      action: 'database_export_created',
      details: { format: 'json', exportedAt: new Date().toISOString() }
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ips-database-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify({
      schema: 'ips-phase9-export-v1',
      source: 'MongoDB',
      exported_at: new Date().toISOString(),
      data: {
        clients, providers, admins, academicOrders, serviceRequests,
        fileMetadata, supportTickets, platformConfig: config?.published || null, audit
      }
    }, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/support-tickets', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!['admin', 'client'].includes(session.role)) {
      return res.status(403).json({ success: false, error: 'Support tickets are available to clients and administrators.' });
    }
    const scope = session.role === 'admin' ? {} : { client_id: session.id };
    if (req.query.status) scope.status = req.query.status;
    const tickets = await SupportTicket.find(scope).sort({ last_activity_at: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/support-tickets', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'client') return res.status(403).json({ success: false, error: 'Client access required.' });
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.message || '').trim();
    if (subject.length < 4 || subject.length > 180 || body.length < 10 || body.length > 5000) {
      return res.status(400).json({ success: false, error: 'Add a clear subject and a message between 10 and 5,000 characters.' });
    }
    const client = await Client.findOne({ client_id: session.id }).select('-password');
    if (!client) return res.status(404).json({ success: false, error: 'Client account not found.' });
    const ticketId = `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const ticket = await SupportTicket.create({
      ticket_id: ticketId,
      client_id: client.client_id,
      client_name: client.full_name,
      client_email: client.email,
      subject,
      category: req.body?.category,
      priority: req.body?.priority,
      messages: [{ sender_id: session.id, sender_role: 'client', body }],
      last_activity_at: new Date()
    });
    await AuditLog.create({
      order_id: ticketId,
      actor_id: session.id,
      actor_role: 'client',
      action: 'support_ticket_created',
      details: { category: ticket.category, priority: ticket.priority }
    });
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/support-tickets/:id/messages', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!['admin', 'client'].includes(session.role)) return res.status(403).json({ success: false, error: 'Support access required.' });
    const ticket = await SupportTicket.findOne({ ticket_id: req.params.id });
    if (!ticket) return res.status(404).json({ success: false, error: 'Support ticket not found.' });
    if (session.role === 'client' && ticket.client_id !== session.id) {
      return res.status(403).json({ success: false, error: 'You cannot access this support ticket.' });
    }
    if (ticket.status === 'Closed') return res.status(409).json({ success: false, error: 'This ticket is closed.' });
    const body = String(req.body?.message || '').trim();
    if (body.length < 1 || body.length > 5000) return res.status(400).json({ success: false, error: 'Message must be between 1 and 5,000 characters.' });
    ticket.messages.push({ sender_id: session.id, sender_role: session.role, body });
    ticket.last_activity_at = new Date();
    if (session.role === 'client' && ['Waiting for Client', 'Resolved'].includes(ticket.status)) ticket.status = 'In Progress';
    if (session.role === 'admin' && ['Open', 'In Progress'].includes(ticket.status)) ticket.status = 'Waiting for Client';
    await ticket.save();
    await AuditLog.create({
      order_id: ticket.ticket_id,
      actor_id: session.id,
      actor_role: session.role,
      action: 'support_ticket_message_sent',
      details: { status: ticket.status }
    });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/support-tickets/:id', async (req, res) => {
  try {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const allowed = ['status', 'priority', 'assigned_admin', 'resolution_note'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    updates.last_activity_at = new Date();
    const ticket = await SupportTicket.findOneAndUpdate(
      { ticket_id: req.params.id },
      updates,
      { returnDocument: 'after', runValidators: true }
    );
    if (!ticket) return res.status(404).json({ success: false, error: 'Support ticket not found.' });
    await AuditLog.create({
      order_id: ticket.ticket_id,
      actor_id: session.id,
      actor_role: 'admin',
      action: 'support_ticket_updated',
      details: updates
    });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== COLLABORATION, FILES, MESSAGES, NOTIFICATIONS ==========

const allowedFileTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.txt', 'text/plain'],
  ['.zip', 'application/zip'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
]);
const allowedExtensions = new Set(allowedFileTypes.keys());
const normaliseUploadName = (value, fallback = 'upload') => {
  const basename = path.basename(String(value || fallback).replaceAll('\\', '/'));
  const cleaned = basename.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
  return cleaned || fallback;
};
const decodeBase64File = (value, maxBytes) => {
  const encoded = String(value || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (
    !encoded
    || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    return null;
  }
  const buffer = Buffer.from(encoded, 'base64');
  const canonical = buffer.toString('base64').replace(/=+$/, '');
  if (!buffer.length || buffer.length > maxBytes || canonical !== encoded.replace(/=+$/, '')) return null;
  return buffer;
};
const matchesFileSignature = (buffer, extension) => {
  const hex = buffer.subarray(0, 16).toString('hex');
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.png') return hex.startsWith('89504e470d0a1a0a');
  if (extension === '.jpg' || extension === '.jpeg') return hex.startsWith('ffd8ff');
  if (['.docx', '.xlsx', '.pptx', '.zip'].includes(extension)) {
    return ['504b0304', '504b0506', '504b0708'].some(signature => hex.startsWith(signature));
  }
  if (['.doc', '.xls', '.ppt'].includes(extension)) return hex.startsWith('d0cf11e0a1b11ae1');
  if (extension === '.txt') return !buffer.includes(0);
  return false;
};
const respondWithStorageError = (res, error, notFoundMessage = 'Stored file not found.') => {
  if (error instanceof StorageObjectNotFoundError) {
    res.status(404).json({ success: false, error: notFoundMessage });
    return true;
  }
  if (error instanceof StorageRequestError) {
    console.error('Object storage request failed:', error.message);
    res.status(502).json({ success: false, error: 'Object storage is temporarily unavailable.' });
    return true;
  }
  return false;
};
const parseByteRange = (value, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value || '').trim());
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size < 1) return null;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || requestedEnd < start
    || start >= size
  ) {
    return null;
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
};
const visibleToRole = {
  admin: ['admin', 'admin_writer', 'admin_client', 'all'],
  writer: ['admin_writer', 'all'],
  client: ['admin_client', 'all']
};

const recordAudit = (entry) => AuditLog.create(entry).catch(error => console.error('Audit log failed:', error.message));
const findWork = async id => {
  const order = await Order.findOne({ order_id: id });
  if (order) return { record: order, kind: 'academic' };
  const service = await ServiceRequest.findOne({ request_id: id });
  return service ? { record: service, kind: 'service' } : null;
};
const canAccessWork = (session, work) => session.role === 'admin'
  || (session.role === 'client' && work.record.client_id === session.id)
  || (session.role === 'writer' && (work.record.writer_id === session.id || work.record.provider_id === session.id));
const serviceTransitions = {
  'New Request': ['Under Review', 'Clarification Required', 'Cancelled'],
  'Under Review': ['Clarification Required', 'Quoted', 'Cancelled', 'On Hold'],
  'Clarification Required': ['Under Review', 'Quoted', 'Cancelled'],
  'Quoted': ['Quote Accepted', 'Under Review', 'Cancelled'],
  'Quote Accepted': ['Awaiting Assignment', 'Assigned', 'Cancelled'],
  'Awaiting Assignment': ['Assigned', 'On Hold', 'Cancelled'],
  'Assigned': ['Scheduled', 'In Progress', 'On Hold', 'Cancelled'],
  'Scheduled': ['In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['Waiting for Client', 'Submitted for Review', 'On Hold', 'Disputed'],
  'Waiting for Client': ['In Progress', 'Submitted for Review', 'On Hold'],
  'Submitted for Review': ['Correction Required', 'Ready for Client'],
  'Correction Required': ['In Progress', 'Submitted for Review'],
  'Ready for Client': ['Completed', 'Correction Required', 'Disputed'],
  'On Hold': ['Under Review', 'Assigned', 'In Progress', 'Cancelled'],
  'Disputed': ['In Progress', 'Completed', 'Cancelled'],
  'Completed': [],
  'Cancelled': []
};
const canTransitionService = (from, to, role) => {
  if (from === to) return true;
  if (role === 'admin') return (serviceTransitions[from] || []).includes(to);
  if (role === 'writer') return ['Assigned','Scheduled','In Progress','Waiting for Client','Submitted for Review'].includes(to)
    && (serviceTransitions[from] || []).includes(to);
  return (from === 'Quoted' && ['Quote Accepted','Under Review'].includes(to))
    || (from === 'Ready for Client' && ['Completed','Correction Required','Disputed'].includes(to));
};
const academicTransitions = {
  'New': ['Pending', 'Awaiting Assignment', 'Cancelled'],
  'Pending': ['Assigned', 'Cancelled', 'On Hold'],
  'Awaiting Assignment': ['Assigned', 'On Hold', 'Cancelled'],
  'Assigned': ['Accepted by Writer', 'In Progress', 'On Hold', 'Cancelled'],
  'Accepted by Writer': ['In Progress', 'On Hold'],
  'In Progress': ['Submitted for Admin Review', 'On Hold'],
  'Submitted for Admin Review': ['Revision Required', 'Approved for Client'],
  'Revision Required': ['In Progress', 'Submitted for Admin Review'],
  'Approved for Client': ['Delivered', 'Client Revision Requested'],
  'Delivered': ['Completed', 'Client Revision Requested'],
  'Client Revision Requested': ['In Progress', 'Submitted for Admin Review'],
  'On Hold': ['Assigned', 'In Progress', 'Cancelled'],
  'Completed': [],
  'Cancelled': []
};
const canTransitionAcademic = (from, to, role) => {
  if (from === to) return true;
  if (!(academicTransitions[from] || []).includes(to)) return false;
  if (role === 'admin') return true;
  if (role === 'writer') return ['Accepted by Writer','In Progress','Submitted for Admin Review'].includes(to);
  return ['Completed','Client Revision Requested'].includes(to);
};

app.get('/api/orders/:id/workspace', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.id);
    if (!work) return res.status(404).json({ success: false, error: 'Job workspace not found.' });
    if (!canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this workspace.' });
    const role = session.role;
    const direct = Boolean(work.record.direct_contact_enabled);
    const channels = role === 'admin'
      ? ['client_admin', 'writer_admin', 'admin_internal', 'announcement', ...(direct ? ['client_provider'] : [])]
      : role === 'writer'
        ? ['writer_admin', 'announcement', ...(direct ? ['client_provider'] : [])]
        : ['client_admin', 'announcement', ...(direct ? ['client_provider'] : [])];
    const releasedFileScope = {
      visibility: { $in: visibleToRole[role] || [] },
      state: 'released',
      ...(role === 'writer' ? { $or: [{ uploader_role: { $ne: 'client' } }, { reviewed_by: { $nin: ['', null] } }] } : {})
    };
    const fileScope = role === 'admin'
      ? { order_id: req.params.id, state: { $ne: 'archived' } }
      : {
          order_id: req.params.id,
          state: { $ne: 'archived' },
          $or: [
            { uploader_id: session.id, uploader_role: role },
            releasedFileScope
          ]
        };
    const [files, messages, audit, expenses] = await Promise.all([
      PlatformFile.find(fileScope).sort({ createdAt: -1 }),
      Message.find({
        order_id: req.params.id,
        channel: { $in: channels }
      }).sort({ createdAt: 1 }),
      role === 'admin'
        ? AuditLog.find({ order_id: req.params.id }).sort({ createdAt: -1 }).limit(100)
        : [],
      WorkExpense.find({
        work_id: req.params.id,
        ...(role === 'client' ? { client_visible: true } : {})
      }).sort({ createdAt: -1 })
    ]);
    res.json({ success: true, files, messages, audit, expenses, direct_contact_enabled: direct, work_kind: work.kind });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/files', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.id);
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to upload files here.' });
    const {
      name, mime_type, size, data, category = 'Other', description = '',
      visibility, milestone_stage = null
    } = req.body;
    const uploader_id = session.id;
    const uploader_role = session.role;
    const extension = path.extname(name || '').toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({ success: false, error: 'This file type is not allowed.' });
    }
    const declaredSize = Number(size);
    if (!data || !Number.isFinite(declaredSize) || declaredSize > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File is empty or exceeds the 25 MB limit.' });
    }
    const buffer = decodeBase64File(data, 25 * 1024 * 1024);
    if (!buffer || buffer.length !== declaredSize || !matchesFileSignature(buffer, extension)) {
      return res.status(400).json({ success: false, error: 'Invalid file data.' });
    }
    const storedName = `${crypto.randomUUID()}${extension}`;
    const objectKey = storageKey('work-files', storedName);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    await objectStorage.write(objectKey, buffer, {
      contentType: allowedFileTypes.get(extension),
      metadata: { sha256: checksum, scope: 'work-file' }
    });
    const defaultVisibility = uploader_role === 'client'
      ? 'admin_client'
      : uploader_role === 'writer'
        ? 'admin_writer'
        : ['admin', 'admin_client', 'admin_writer', 'all'].includes(visibility) ? visibility : 'admin';
    const state = uploader_role === 'admin' ? 'released' : 'pending';
    let file;
    try {
      file = await PlatformFile.create({
        order_id: req.params.id,
        milestone_stage,
        original_name: normaliseUploadName(name, `upload${extension}`),
        stored_name: storedName,
        mime_type: allowedFileTypes.get(extension),
        size: buffer.length,
        category,
        description,
        uploader_id,
        uploader_role,
        visibility: defaultVisibility,
        state,
        checksum,
        version_group: crypto.randomUUID(),
        released_by: state === 'released' ? session.id : '',
        released_at: state === 'released' ? new Date() : null
      });
    } catch (error) {
      await objectStorage.remove(objectKey).catch(cleanupError => {
        console.error('Failed to remove an uncommitted work-file object:', cleanupError.message);
      });
      throw error;
    }
    await recordAudit({
      order_id: req.params.id, actor_id: uploader_id, actor_role: uploader_role,
      action: 'file_uploaded', details: { file_id: file.id, name: file.original_name, state: file.state }
    });
    res.json({ success: true, file });
  } catch (err) {
    if (respondWithStorageError(res, err)) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/files/:id/download', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const role = session.role;
    const file = await PlatformFile.findById(req.params.id);
    const work = file ? await findWork(file.order_id) : null;
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this file.' });
    if (!file || file.state === 'archived') {
      return res.status(404).json({ success: false, error: 'File not available.' });
    }
    const ownsFile = file.uploader_id === session.id && file.uploader_role === role;
    const legacyClientUploadBlockedFromProvider = role === 'writer' && file.uploader_role === 'client' && !file.reviewed_by;
    const isReleasedToRole = file.state === 'released'
      && (visibleToRole[role] || []).includes(file.visibility)
      && !legacyClientUploadBlockedFromProvider;
    if (role !== 'admin' && !ownsFile && !isReleasedToRole) {
      return res.status(403).json({ success: false, error: 'This file has not been released to you.' });
    }
    const storedObject = await objectStorage.read(storageKey('work-files', file.stored_name));
    file.download_count += 1;
    await file.save();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', storedObject.body.length);
    res.attachment(file.original_name);
    res.type(file.mime_type || storedObject.contentType || 'application/octet-stream');
    res.send(storedObject.body);
  } catch (err) {
    if (respondWithStorageError(res, err, 'File content is not available.')) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/files/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can review files.' });
    const allowed = ['state', 'visibility', 'description', 'category', 'review_reason'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.state && !['pending', 'approved', 'released', 'rejected', 'archived'].includes(updates.state)) return res.status(400).json({ success: false, error: 'Invalid file state.' });
    if (updates.visibility && !['admin', 'admin_writer', 'admin_client', 'all'].includes(updates.visibility)) return res.status(400).json({ success: false, error: 'Invalid file audience.' });
    if (['rejected', 'archived'].includes(updates.state) && !updates.review_reason?.trim()) return res.status(400).json({ success: false, error: 'A reason is required for this action.' });
    const now = new Date();
    if (updates.state && ['approved', 'rejected', 'released'].includes(updates.state)) {
      updates.reviewed_by = session.id;
      updates.reviewed_at = now;
    }
    if (updates.state === 'released') {
      updates.released_by = session.id;
      updates.released_at = now;
    }
    if (updates.state === 'archived') {
      updates.archived_by = session.id;
      updates.archived_at = now;
    }
    const file = await PlatformFile.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after', runValidators: true });
    if (!file) return res.status(404).json({ success: false, error: 'File not found.' });
    await recordAudit({
      order_id: file.order_id, actor_id: session.id,
      actor_role: 'admin', action: 'file_updated', details: updates
    });
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/messages', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const { channel, body } = req.body;
    const sender_id = session.id;
    const sender_role = session.role;
    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Message is required.' });
    const work = await findWork(req.params.id);
    if (!work) return res.status(404).json({ success: false, error: 'Job not found.' });
    if (!canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this conversation.' });
    const normalizedRole = sender_role === 'provider' ? 'writer' : sender_role;
    const allowedChannels = {
      client: ['client_admin'],
      writer: ['writer_admin'],
      admin: ['client_admin', 'writer_admin', 'admin_internal', 'announcement']
    };
    if (channel === 'client_provider') {
      if (!work.record.direct_contact_enabled) {
        return res.status(403).json({ success: false, error: 'Direct client-provider contact has not been enabled by an administrator.' });
      }
      if (!['client', 'writer', 'admin'].includes(normalizedRole)) {
        return res.status(403).json({ success: false, error: 'Invalid direct-message sender.' });
      }
    } else if (!(allowedChannels[normalizedRole] || []).includes(channel)) {
      return res.status(403).json({ success: false, error: 'This messaging channel is not available to your role.' });
    }
    const message = await Message.create({
      order_id: req.params.id, sender_id, sender_role: normalizedRole, channel, body: body.trim()
    });
    await recordAudit({
      order_id: req.params.id, actor_id: sender_id, actor_role: sender_role,
      action: 'message_sent', details: { channel }
    });
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/orders/:id/progress', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const existing = await Order.findOne({ order_id: req.params.id });
    if (!existing || !canAccessWork(session, { record: existing, kind: 'academic' })) return res.status(403).json({ success: false, error: 'You do not have access to update this order.' });
    const { progress, status, milestones, actor_id, actor_role, reason = '' } = req.body;
    const updates = {};
    if (Number.isFinite(Number(progress))) updates.progress = Math.max(0, Math.min(100, Number(progress)));
    if (Array.isArray(milestones)) updates.milestones = milestones;
    if (status) {
      if (!canTransitionAcademic(existing.status, status, session.role)) {
        return res.status(409).json({ success: false, error: `Status cannot move from "${existing.status}" to "${status}" for this role.` });
      }
      updates.status = status;
      updates.$push = { status_history: { status, actor_id: session.id, actor_role: session.role, reason } };
    }
    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id }, updates, { returnDocument: 'after', runValidators: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    await recordAudit({
      order_id: req.params.id, actor_id: session.id, actor_role: session.role,
      action: 'progress_updated', details: { progress: order.progress, status: order.status }
    });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/revisions', async (req, res) => {
  try {
    const { actor_id, actor_role, reason } = req.body;
    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      {
        status: 'Client Revision Requested',
        $inc: { revision_count: 1 },
        $push: { status_history: { status: 'Client Revision Requested', actor_id, actor_role, reason } }
      },
      { returnDocument: 'after' }
    );
    await recordAudit({
      order_id: req.params.id, actor_id, actor_role,
      action: 'revision_requested', details: { reason }
    });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications/:role/:id', async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient_role: req.params.role, recipient_id: req.params.id
    }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== PROFESSIONAL SERVICES & ODD JOBS ==========

app.get('/api/services', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const query = {};
    if (session.role === 'client') query.client_id = session.id;
    else if (session.role === 'writer') query.provider_id = session.id;
    else {
      if (req.query.client_id) query.client_id = req.query.client_id;
      if (req.query.provider_id) query.provider_id = req.query.provider_id;
    }
    if (req.query.family) query.family = req.query.family;
    const requests = await ServiceRequest.find(query).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'ips_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ success: true });
});

app.patch('/api/work/:id/contact-policy', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can change direct-contact access.' });
    const enabled = Boolean(req.body.enabled);
    const order = await Order.findOneAndUpdate({ order_id: req.params.id }, { direct_contact_enabled: enabled }, { returnDocument: 'after' });
    const service = order ? null : await ServiceRequest.findOneAndUpdate({ request_id: req.params.id }, { direct_contact_enabled: enabled }, { returnDocument: 'after' });
    const work = order || service;
    if (!work) return res.status(404).json({ success: false, error: 'Job not found.' });
    await recordAudit({ order_id: req.params.id, actor_id: session.id, actor_role: 'admin', action: enabled ? 'direct_contact_enabled' : 'direct_contact_disabled', details: {} });
    res.json({ success: true, direct_contact_enabled: enabled });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/work/:id/expenses', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.id);
    if (!work) return res.status(404).json({ success: false, error: 'Job not found.' });
    if (!canAccessWork(session, work) || !['writer', 'admin'].includes(session.role)) return res.status(403).json({ success: false, error: 'Only the assigned provider or admin can submit expenses.' });
    const { category, merchant, description, amount, currency, expense_date, receipt_file_id, pre_approved } = req.body;
    if (!category || !description?.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !expense_date) {
      return res.status(400).json({ success: false, error: 'Category, explanation, valid amount, date and submitter are required.' });
    }
    const expense = await WorkExpense.create({
      work_id: req.params.id, work_kind: work.kind, category, merchant,
      description: description.trim(), amount: Number(amount), currency: currency || 'USD',
      expense_date, receipt_file_id: receipt_file_id || null,
      submitted_by_id: session.id, submitted_by_role: session.role, pre_approved: Boolean(pre_approved)
    });
    await recordAudit({ order_id: req.params.id, actor_id: session.id, actor_role: session.role, action: 'expense_submitted', details: { expense_id: expense._id, amount: expense.amount } });
    res.status(201).json({ success: true, expense });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/work/:id/expenses/:expenseId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can review expenses.' });
    const allowed = ['status', 'approved_amount', 'admin_reason', 'client_visible'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    updates.reviewed_by = session.id;
    updates.reviewed_at = new Date();
    const expense = await WorkExpense.findOneAndUpdate({ _id: req.params.expenseId, work_id: req.params.id }, updates, { returnDocument: 'after', runValidators: true });
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found.' });
    await recordAudit({ order_id: req.params.id, actor_id: updates.reviewed_by, actor_role: 'admin', action: 'expense_reviewed', details: { expense_id: expense._id, status: expense.status, approved_amount: expense.approved_amount } });
    res.json({ success: true, expense });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== SHARED JOB DECISIONS: QUOTES, CLARIFICATIONS & REVISIONS ==========

app.get('/api/work/:workId/decisions', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.workId);
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to these decisions.' });
    const decisions = await WorkDecision.find({ work_id: req.params.workId }).sort({ createdAt: -1 });
    res.json({ success: true, decisions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/work/:workId/decisions', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.workId);
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
    const { work_kind, type, subject, details, requested_changes, priority, assigned_to_role, quote_snapshot } = req.body;
    if (!work_kind || !type || !subject?.trim() || !details?.trim() || !assigned_to_role) {
      return res.status(400).json({ success: false, error: 'Type, subject, explanation, creator and recipient are required.' });
    }
    const sessionRole = session.role === 'writer' ? 'provider' : session.role;
    if (sessionRole !== 'admin' && assigned_to_role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Clients and providers must route formal requests through admin.' });
    }
    const decision = await WorkDecision.create({
      work_id: req.params.workId, work_kind, type,
      subject: subject.trim(), details: details.trim(),
      requested_changes: Array.isArray(requested_changes) ? requested_changes.filter(Boolean) : [],
      priority, created_by_id: session.id, created_by_role: sessionRole, assigned_to_role, quote_snapshot
    });
    await recordAudit({
      order_id: req.params.workId, actor_id: session.id, actor_role: sessionRole,
      action: `${type}_opened`, details: { decision_id: decision._id, subject: decision.subject }
    });
    await Notification.create({
      recipient_id: assigned_to_role === 'admin' ? 'admin' : req.params.workId,
      recipient_role: assigned_to_role === 'provider' ? 'writer' : assigned_to_role,
      order_id: req.params.workId, type, message: `${subject}: ${details.slice(0, 180)}`
    }).catch(() => {});
    res.status(201).json({ success: true, decision });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/work/:workId/decisions/:decisionId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.workId);
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
    const decision = await WorkDecision.findOne({ _id: req.params.decisionId, work_id: req.params.workId });
    if (!decision) return res.status(404).json({ success: false, error: 'Decision item not found.' });
    if (req.body.response !== undefined) {
      if (!String(req.body.response).trim()) return res.status(400).json({ success: false, error: 'A written response is required.' });
      decision.response = String(req.body.response).trim();
      decision.responded_by_id = session.id;
      decision.responded_by_role = session.role === 'writer' ? 'provider' : session.role;
      decision.responded_at = new Date();
      decision.status = 'answered';
    }
    if (['resolved', 'declined'].includes(req.body.status)) {
      decision.status = req.body.status;
      decision.resolved_by_id = session.id;
      decision.resolved_at = new Date();
    }
    await decision.save();
    await recordAudit({
      order_id: req.params.workId, actor_id: session.id,
      actor_role: session.role, action: `decision_${decision.status}`,
      details: { decision_id: decision._id, type: decision.type }
    });
    res.json({ success: true, decision });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const request = await ServiceRequest.findOne({ request_id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Service request not found.' });
    const work = { record: request, kind: 'service' };
    if (!canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this service.' });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'client') return res.status(403).json({ success: false, error: 'A client session is required.' });
    const client = await Client.findOne({ client_id: session.id }).select('-password');
    if (!client) return res.status(404).json({ success: false, error: 'Client account not found.' });
    const count = await ServiceRequest.countDocuments();
    const requestId = `SRV-${String(count + 1).padStart(5, '0')}`;
    const request = await ServiceRequest.create({
      ...req.body,
      client_id: session.id,
      client_name: client.full_name,
      client_email: client.email,
      request_id: requestId,
      status_history: [{
        status: 'New Request',
        actor_id: session.id,
        actor_role: 'client',
        reason: 'Request submitted'
      }]
    });
    await recordAudit({
      order_id: requestId, actor_id: session.id, actor_role: 'client',
      action: 'service_request_created', details: { family: request.family, category: request.category }
    });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/services/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const existing = await ServiceRequest.findOne({ request_id: req.params.id });
    if (!existing) return res.status(404).json({ success: false, error: 'Service request not found.' });
    if (!canAccessWork(session, { record: existing, kind: 'service' })) return res.status(403).json({ success: false, error: 'You do not have access to update this service.' });
    if (session.role === 'client' && req.body.quote?.accepted) {
      if (existing.quote?.expires_at && new Date(existing.quote.expires_at) < new Date()) {
        return res.status(409).json({ success: false, error: 'This quote has expired. Request a new quote from admin.' });
      }
      if (!existing.quote?.total) return res.status(409).json({ success: false, error: 'There is no valid quote to accept.' });
      req.body.quote = {
        ...existing.quote.toObject(), accepted: true,
        accepted_by: session.id, accepted_at: new Date()
      };
      await QuoteVersion.findOneAndUpdate(
        { work_id: existing.request_id, version: existing.quote.version || 1 },
        { accepted: true, accepted_by: session.id, accepted_at: new Date() }
      );
    }
    if (session.role === 'admin' && req.body.quote) {
      const latest = await QuoteVersion.findOne({ work_id: existing.request_id }).sort({ version: -1 });
      const version = (latest?.version || 0) + 1;
      if (latest) {
        latest.superseded_at = new Date();
        await latest.save();
      }
      const quoteData = { ...req.body.quote, version, accepted: false, accepted_by: '', accepted_at: null };
      req.body.quote = quoteData;
      await QuoteVersion.create({
        work_id: existing.request_id, work_kind: 'service', version,
        labor: Number(quoteData.labor || 0), service_fee: Number(quoteData.service_fee || 0),
        expenses: Number(quoteData.expenses || 0), total: Number(quoteData.total || 0),
        currency: quoteData.currency || 'USD', notes: quoteData.notes || 'Quote issued',
        expires_at: quoteData.expires_at || null, issued_by: session.id
      });
    }
    if (req.body.status && !canTransitionService(existing.status, req.body.status, session.role)) {
      return res.status(409).json({ success: false, error: `Status cannot move from "${existing.status}" to "${req.body.status}" for this role.` });
    }
    const updates = { ...req.body };
    delete updates.request_id;
    if (updates.status) {
      updates.$push = {
        status_history: {
          status: updates.status,
          actor_id: session.id,
          actor_role: session.role,
          reason: req.body.reason || ''
        }
      };
    }
    if (session.role === 'client') {
      const clientAllowed = ['status', 'quote'];
      Object.keys(updates).forEach(key => { if (!clientAllowed.includes(key) && key !== '$push') delete updates[key]; });
    } else if (session.role === 'writer') {
      const providerAllowed = ['status', 'progress', 'provider_notes'];
      Object.keys(updates).forEach(key => { if (!providerAllowed.includes(key) && key !== '$push') delete updates[key]; });
    }
    delete updates.actor_id;
    delete updates.actor_role;
    delete updates.reason;
    const request = await ServiceRequest.findOneAndUpdate(
      { request_id: req.params.id }, updates,
      { returnDocument: 'after', runValidators: true }
    );
    if (!request) return res.status(404).json({ success: false, error: 'Service request not found.' });
    await recordAudit({
      order_id: request.request_id,
      actor_id: session.id,
      actor_role: session.role,
      action: 'service_request_updated',
      details: { status: request.status, progress: request.progress }
    });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can delete services.' });
    await ServiceRequest.findOneAndDelete({ request_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/work/:id/quotes', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const work = await findWork(req.params.id);
    if (!work || !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to quote history.' });
    const quotes = await QuoteVersion.find({ work_id: req.params.id }).sort({ version: -1 });
    res.json({ success: true, quotes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== DIRECT MESSAGING PLATFORM ==========

const canUseDirectConversation = (session, conversation) => session.role === 'admin'
  || conversation.participants.some(participant => participant.role === session.role && participant.id === session.id);

app.get('/api/messaging/directory', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role === 'admin') {
      const [clients, providers, orders, services] = await Promise.all([
        Client.find().select('client_id full_name email').lean(),
        Writer.find({ status: 'Active' }).select('writer_id full_name email').lean(),
        Order.find({ status: activeAcademicStatuses }).select('order_id topic_title client_id client_name writer_id writer_name direct_contact_enabled').lean(),
        ServiceRequest.find({ status: activeServiceStatuses }).select('request_id title client_id client_name provider_id provider_name direct_contact_enabled').lean()
      ]);
      return res.json({ success: true, clients, providers, jobs: [
        ...orders.map(item => ({ work_id: item.order_id, work_kind: 'academic', title: item.topic_title, ...item })),
        ...services.map(item => ({ work_id: item.request_id, work_kind: 'service', title: item.title, ...item }))
      ] });
    }
    const jobs = session.role === 'client'
      ? [...await Order.find({ client_id: session.id }).lean(), ...await ServiceRequest.find({ client_id: session.id }).lean()]
      : [...await Order.find({ writer_id: session.id }).lean(), ...await ServiceRequest.find({ provider_id: session.id }).lean()];
    res.json({ success: true, clients: [], providers: [], jobs: jobs.map(item => ({
      work_id: item.order_id || item.request_id, work_kind: item.order_id ? 'academic' : 'service',
      title: item.topic_title || item.title, direct_contact_enabled: item.direct_contact_enabled
    })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const query = session.role === 'admin' ? {} : { participants: { $elemMatch: { role: session.role, id: session.id, archived: false } } };
    const conversations = await DirectConversation.find(query).sort({ last_message_at: -1, updatedAt: -1 }).lean();
    const ids = conversations.map(item => item.conversation_id);
    const unread = await DirectMessage.find({ conversation_id: { $in: ids }, sender_id: { $ne: session.id }, read_by: { $ne: session.id }, deleted_at: null }).select('conversation_id').lean();
    const counts = unread.reduce((map, item) => map.set(item.conversation_id, (map.get(item.conversation_id) || 0) + 1), new Map());
    res.json({ success: true, conversations: conversations.map(item => ({ ...item, unread_count: counts.get(item.conversation_id) || 0 })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const { subject, target_role, target_id, target_name = '', work_id = '', type: requestedType = '' } = req.body;
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'A conversation subject is required.' });
    let type = requestedType;
    let participants = [];
    if (type === 'client_provider') {
      if (!work_id) return res.status(400).json({ success: false, error: 'Direct client-provider conversations must be linked to a job.' });
      const work = await findWork(work_id);
      if (!work || !work.record.direct_contact_enabled) return res.status(403).json({ success: false, error: 'Admin has not enabled client-provider contact for this job.' });
      if (session.role !== 'admin' && !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
      const record = work.record;
      const providerId = work.kind === 'academic' ? record.writer_id : record.provider_id;
      const providerName = work.kind === 'academic' ? record.writer_name : record.provider_name;
      if (!providerId) return res.status(409).json({ success: false, error: 'This job has no assigned provider.' });
      participants = [
        { role: 'client', id: record.client_id, name: record.client_name },
        { role: 'writer', id: providerId, name: providerName }
      ];
    } else if (session.role === 'admin') {
      if (!['client', 'writer'].includes(target_role) || !target_id) return res.status(400).json({ success: false, error: 'Choose a client or provider.' });
      type = target_role === 'client' ? 'client_admin' : 'writer_admin';
      participants = [{ role: 'admin', id: session.id, name: 'Admin' }, { role: target_role, id: target_id, name: target_name }];
    } else {
      type = session.role === 'client' ? 'client_admin' : 'writer_admin';
      const profile = session.role === 'client' ? await Client.findOne({ client_id: session.id }) : await Writer.findOne({ writer_id: session.id });
      participants = [{ role: session.role, id: session.id, name: profile?.full_name || session.id }, { role: 'admin', id: 'admin', name: 'IPS Admin' }];
    }
    const work = work_id ? await findWork(work_id) : null;
    if (work_id && !work) return res.status(404).json({ success: false, error: 'Linked job not found.' });
    if (work && session.role !== 'admin' && !canAccessWork(session, work)) return res.status(403).json({ success: false, error: 'You cannot link this job.' });
    const conversation = await DirectConversation.create({
      conversation_id: `CONV-${crypto.randomUUID()}`, subject: subject.trim(), type, participants,
      work_id, work_kind: work?.kind || '', created_by_id: session.id, created_by_role: session.role
    });
    await recordAudit({ order_id: work_id, actor_id: session.id, actor_role: session.role, action: 'direct_conversation_created', details: { conversation_id: conversation.conversation_id, type } });
    res.status(201).json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const conversation = await DirectConversation.findOne({ conversation_id: req.params.id });
    if (!conversation || !canUseDirectConversation(session, conversation)) return res.status(403).json({ success: false, error: 'Conversation access denied.' });
    const messages = await DirectMessage.find({ conversation_id: req.params.id, deleted_at: null }).sort({ createdAt: 1 }).lean();
    await DirectMessage.updateMany({ conversation_id: req.params.id, read_by: { $ne: session.id } }, { $addToSet: { read_by: session.id } });
    res.json({ success: true, conversation, messages, viewer_id: session.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const conversation = await DirectConversation.findOne({ conversation_id: req.params.id });
    if (!conversation || !canUseDirectConversation(session, conversation)) return res.status(403).json({ success: false, error: 'Conversation access denied.' });
    if (conversation.status === 'closed') return res.status(409).json({ success: false, error: 'This conversation is closed.' });
    if (conversation.type === 'client_provider') {
      const work = await findWork(conversation.work_id);
      if (!work?.record.direct_contact_enabled) return res.status(403).json({ success: false, error: 'Direct client-provider contact is disabled.' });
    }
    const body = String(req.body.body || '').trim();
    const attachmentInput = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    if (attachmentInput.length > 3) {
      return res.status(400).json({ success: false, error: 'Attach no more than 3 files to one message.' });
    }
    if (!body && !attachmentInput.length) return res.status(400).json({ success: false, error: 'Write a message or attach a file.' });
    const preparedAttachments = [];
    let totalAttachmentBytes = 0;
    for (const item of attachmentInput) {
      const extension = path.extname(item.name || '').toLowerCase();
      if (!allowedExtensions.has(extension)) return res.status(400).json({ success: false, error: `File type ${extension || 'unknown'} is not allowed.` });
      const buffer = decodeBase64File(item.data, 10 * 1024 * 1024);
      if (!buffer || !matchesFileSignature(buffer, extension)) {
        return res.status(400).json({ success: false, error: `Attachment ${path.basename(String(item.name || 'file'))} has invalid file data.` });
      }
      if (Number.isFinite(Number(item.size)) && Number(item.size) !== buffer.length) {
        return res.status(400).json({ success: false, error: `Attachment ${path.basename(String(item.name || 'file'))} has an invalid size.` });
      }
      totalAttachmentBytes += buffer.length;
      if (totalAttachmentBytes > 20 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Attachments must total 20 MB or less per message.' });
      }
      const storedName = `${crypto.randomUUID()}${extension}`;
      preparedAttachments.push({
        buffer,
        objectKey: storageKey('message-attachments', storedName),
        record: {
          original_name: normaliseUploadName(item.name, `attachment${extension}`),
          stored_name: storedName,
          mime_type: allowedFileTypes.get(extension),
          size: buffer.length
        }
      });
    }
    const writtenObjectKeys = [];
    let message = null;
    try {
      for (const attachment of preparedAttachments) {
        const checksum = crypto.createHash('sha256').update(attachment.buffer).digest('hex');
        await objectStorage.write(attachment.objectKey, attachment.buffer, {
          contentType: attachment.record.mime_type,
          metadata: { sha256: checksum, scope: 'message-attachment' }
        });
        writtenObjectKeys.push(attachment.objectKey);
      }
      message = await DirectMessage.create({
        conversation_id: conversation.conversation_id,
        sender_id: session.id,
        sender_role: session.role,
        body,
        attachments: preparedAttachments.map(attachment => attachment.record),
        reply_to: req.body.reply_to || null,
        read_by: [session.id]
      });
      conversation.last_message_at = message.createdAt;
      conversation.last_message_preview = body.slice(0, 180) || `${preparedAttachments.length} attachment(s)`;
      conversation.status = 'open';
      await conversation.save();
    } catch (error) {
      if (message?._id) {
        await DirectMessage.deleteOne({ _id: message._id }).catch(cleanupError => {
          console.error('Failed to remove an uncommitted direct message:', cleanupError.message);
        });
      }
      await Promise.all(writtenObjectKeys.map(objectKey => objectStorage.remove(objectKey).catch(cleanupError => {
        console.error('Failed to remove an uncommitted message attachment:', cleanupError.message);
      })));
      throw error;
    }
    res.status(201).json({ success: true, message });
  } catch (err) {
    if (respondWithStorageError(res, err)) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversation-files/:conversationId/:messageId/:index', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const conversation = await DirectConversation.findOne({ conversation_id: req.params.conversationId });
    if (!conversation || !canUseDirectConversation(session, conversation)) return res.status(403).json({ success: false, error: 'File access denied.' });
    const message = await DirectMessage.findById(req.params.messageId);
    const attachment = message?.attachments?.[Number(req.params.index)];
    if (!message || message.conversation_id !== conversation.conversation_id || !attachment) return res.status(404).json({ success: false, error: 'Attachment not found.' });
    const storedObject = await objectStorage.read(storageKey('message-attachments', attachment.stored_name));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', storedObject.body.length);
    res.attachment(attachment.original_name);
    res.type(attachment.mime_type || storedObject.contentType || 'application/octet-stream');
    res.send(storedObject.body);
  } catch (err) {
    if (respondWithStorageError(res, err, 'Attachment content is not available.')) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/conversations/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const conversation = await DirectConversation.findOne({ conversation_id: req.params.id });
    if (!conversation || !canUseDirectConversation(session, conversation)) return res.status(403).json({ success: false, error: 'Conversation access denied.' });
    if (session.role === 'admin') {
      if (['open', 'resolved', 'closed'].includes(req.body.status)) conversation.status = req.body.status;
      if (['normal', 'important', 'urgent'].includes(req.body.priority)) conversation.priority = req.body.priority;
    }
    const participant = conversation.participants.find(item => item.role === session.role && (session.role === 'admin' || item.id === session.id));
    if (participant) {
      if (typeof req.body.archived === 'boolean') participant.archived = req.body.archived;
      if (typeof req.body.muted === 'boolean') participant.muted = req.body.muted;
    }
    await conversation.save();
    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== UNIFIED ACTION CENTER ==========

const activeAcademicStatuses = { $nin: ['Completed', 'Cancelled'] };
const activeServiceStatuses = { $nin: ['Completed', 'Cancelled', 'Closed'] };
const actionPriority = value => value === 'urgent' || value === 'critical' ? 'urgent' : value === 'important' || value === 'priority' ? 'high' : 'normal';
const actionDueState = due => {
  if (!due) return {};
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return {};
  const hours = Math.round((date.getTime() - Date.now()) / 3600000);
  return { due_at: date, overdue: hours < 0, overdue_hours: hours < 0 ? Math.abs(hours) : 0 };
};

app.get('/api/actions', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!['admin', 'writer'].includes(session.role)) return res.status(403).json({ success: false, error: 'Action Center access required.' });
    const isAdmin = session.role === 'admin';
    const orderQuery = isAdmin ? {} : { writer_id: session.id };
    const serviceQuery = isAdmin ? {} : { provider_id: session.id };
    const [orders, services, files, decisions, expenses, messages, savedStates] = await Promise.all([
      Order.find(orderQuery).lean(),
      ServiceRequest.find(serviceQuery).lean(),
      PlatformFile.find(isAdmin
        ? { state: { $in: ['pending', 'approved'] } }
        : { uploader_role: 'writer', uploader_id: session.id, state: 'rejected' }).lean(),
      WorkDecision.find(isAdmin
        ? { assigned_to_role: 'admin', status: { $in: ['open', 'answered'] } }
        : { assigned_to_role: { $in: ['writer', 'provider'] }, status: { $in: ['open', 'answered'] } }).lean(),
      WorkExpense.find(isAdmin
        ? { status: 'submitted' }
        : { submitted_by_id: session.id, submitted_by_role: { $in: ['writer', 'provider'] }, status: 'more_info_required' }).lean(),
      Message.find(isAdmin
        ? { channel: { $in: ['client_admin', 'writer_admin'] } }
        : { channel: 'writer_admin' }).sort({ createdAt: -1 }).lean(),
      ActionState.find(isAdmin ? { owner_role: 'admin' } : { owner_role: 'writer', owner_id: session.id }).lean()
    ]);
    const directConversations = await DirectConversation.find(isAdmin
      ? { status: 'open' }
      : { status: 'open', participants: { $elemMatch: { role: 'writer', id: session.id, archived: false } } }).lean();
    const directIds = directConversations.map(item => item.conversation_id);
    const directMessages = await DirectMessage.find({ conversation_id: { $in: directIds }, deleted_at: null }).sort({ createdAt: -1 }).lean();
    const workMap = new Map();
    orders.forEach(item => workMap.set(item.order_id, {
      id: item.order_id, mongo_id: item._id, kind: 'academic', title: item.topic_title || item.subject || item.order_id,
      category: item.service_type, client: item.client_name, provider: item.writer_name, provider_id: item.writer_id,
      status: item.status, due: item.deadline
    }));
    services.forEach(item => workMap.set(item.request_id, {
      id: item.request_id, mongo_id: item._id, kind: 'service', title: item.title || item.request_id,
      category: item.category, client: item.client_name, provider: item.provider_name, provider_id: item.provider_id,
      status: item.status, due: item.deadline, urgency: item.urgency
    }));
    const states = new Map(savedStates.map(item => [item.action_key, item]));
    const items = [];
    const add = (source, id, workId, title, reason, options = {}) => {
      const work = workMap.get(workId) || { id: workId, kind: options.work_kind || 'academic', title: workId };
      const key = `${session.role}:${session.id}:${source}:${id}`;
      const saved = states.get(key);
      items.push({
        key, source, source_id: String(id), work_id: workId, work,
        title, reason, category: options.category || source, created_at: options.created_at,
        priority: saved?.priority || options.priority || 'normal',
        status: saved?.status || 'open', assigned_to: saved?.assigned_to || '',
        snoozed_until: saved?.snoozed_until, resolution_note: saved?.resolution_note || '',
        ...actionDueState(options.due || work.due)
      });
    };
    files.forEach(file => add('file', file._id, file.order_id,
      isAdmin ? `${file.state === 'approved' ? 'Release' : 'Review'} ${file.original_name}` : `File rejected: ${file.original_name}`,
      isAdmin ? `Choose the audience and ${file.state === 'approved' ? 'release' : 'review'} this ${file.category} file.` : file.review_reason || 'Admin requires a corrected file.',
      { category: 'files', created_at: file.createdAt, priority: file.category === 'Final Delivery' || file.category === 'Completion Evidence' ? 'high' : 'normal' }));
    decisions.filter(item => isAdmin || workMap.has(item.work_id)).forEach(item => add('decision', item._id, item.work_id,
      `${item.type.replaceAll('_', ' ')}: ${item.subject}`, item.details,
      { category: 'decisions', created_at: item.createdAt, priority: actionPriority(item.priority) }));
    expenses.forEach(item => add('expense', item._id, item.work_id,
      isAdmin ? `Review ${item.currency} ${item.amount} expense` : 'Expense needs more information',
      isAdmin ? item.description : item.admin_reason || 'Administrator requested additional details.',
      { category: 'expenses', created_at: item.createdAt, priority: 'high' }));
    if (isAdmin) {
      orders.filter(item => !item.writer_id && !['Completed', 'Cancelled'].includes(item.status)).forEach(item =>
        add('assignment', item._id, item.order_id, 'Assign an academic job', `${item.client_name} is waiting for a provider.`, { category: 'assignments', created_at: item.createdAt, priority: 'high' }));
      services.filter(item => !item.provider_id && !['Completed', 'Cancelled', 'Closed'].includes(item.status)).forEach(item =>
        add('assignment', item._id, item.request_id, 'Assign a service job', `${item.client_name} is waiting for a provider.`, { category: 'assignments', created_at: item.createdAt, priority: actionPriority(item.urgency) }));
    } else {
      orders.filter(item => ['Assigned', 'Pending'].includes(item.status)).forEach(item =>
        add('acceptance', item._id, item.order_id, 'Accept new academic assignment', item.topic_title || item.requirements || 'Review the assignment details.', { category: 'assignments', created_at: item.updatedAt, priority: 'high' }));
      services.filter(item => ['Assigned', 'Awaiting Provider Acceptance'].includes(item.status)).forEach(item =>
        add('acceptance', item._id, item.request_id, 'Accept new service assignment', item.description, { category: 'assignments', created_at: item.updatedAt, priority: actionPriority(item.urgency) }));
    }
    const latestThreads = new Map();
    messages.forEach(message => {
      if (!isAdmin && !workMap.has(message.order_id)) return;
      const key = `${message.order_id}:${message.channel}`;
      if (!latestThreads.has(key)) latestThreads.set(key, message);
    });
    latestThreads.forEach(message => {
      const needsReply = isAdmin ? message.sender_role !== 'admin' : message.sender_role === 'admin';
      if (needsReply) add('message', message._id, message.order_id, 'Message needs a reply', message.body,
        { category: 'messages', created_at: message.createdAt, priority: 'high' });
    });
    const directMap = new Map(directConversations.map(item => [item.conversation_id, item]));
    const latestDirect = new Map();
    directMessages.forEach(message => { if (!latestDirect.has(message.conversation_id)) latestDirect.set(message.conversation_id, message); });
    latestDirect.forEach(message => {
      const conversation = directMap.get(message.conversation_id);
      const needsReply = isAdmin ? message.sender_role !== 'admin' : message.sender_role === 'admin';
      if (needsReply) add('direct_message', message._id, conversation.work_id || conversation.conversation_id,
        `Direct message: ${conversation.subject}`, message.body || 'A secure attachment needs review.',
        { category: 'messages', created_at: message.createdAt, priority: actionPriority(conversation.priority), work_kind: conversation.work_kind });
    });
    [...orders, ...services].forEach(record => {
      const workId = record.order_id || record.request_id;
      const inactive = ['Completed', 'Cancelled', 'Closed'].includes(record.status);
      const due = record.deadline;
      if (!inactive && due && new Date(due).getTime() < Date.now()) add('overdue', record._id, workId,
        'Job is overdue', `${record.status} work has passed its deadline.`, { category: 'deadlines', due, priority: 'urgent' });
    });
    if (req.query.history === 'true') {
      const generatedKeys = new Set(items.map(item => item.key));
      savedStates.filter(state => ['resolved', 'dismissed'].includes(state.status) && state.snapshot && !generatedKeys.has(state.action_key)).forEach(state => {
        items.push({
          ...state.snapshot, key: state.action_key, status: state.status,
          priority: state.priority, assigned_to: state.assigned_to,
          resolution_note: state.resolution_note, resolved_at: state.resolved_at
        });
      });
    }
    const visible = items.filter(item => {
      const finished = item.status === 'resolved' || item.status === 'dismissed';
      const snoozed = item.snoozed_until && new Date(item.snoozed_until).getTime() > Date.now();
      if (req.query.history === 'true') return finished;
      if (req.query.snoozed === 'true') return !finished && snoozed;
      return !finished && !snoozed;
    });
    const summary = {
      total: visible.length,
      urgent: visible.filter(item => item.priority === 'urgent').length,
      overdue: visible.filter(item => item.overdue).length,
      in_progress: visible.filter(item => item.status === 'in_progress').length
    };
    res.json({ success: true, actions: visible.sort((a, b) => Number(b.overdue) - Number(a.overdue) || ['urgent','high','normal','low'].indexOf(a.priority) - ['urgent','high','normal','low'].indexOf(b.priority) || new Date(a.created_at || 0) - new Date(b.created_at || 0)), summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/actions/:actionKey', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (!['admin', 'writer'].includes(session.role)) return res.status(403).json({ success: false, error: 'Action Center access required.' });
    const allowed = ['status', 'priority', 'assigned_to', 'snoozed_until', 'resolution_note', 'snapshot'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (['resolved', 'dismissed'].includes(updates.status) && !updates.resolution_note?.trim()) return res.status(400).json({ success: false, error: 'A resolution or dismissal reason is required.' });
    updates.last_action_by = session.id;
    if (updates.status === 'resolved') updates.resolved_at = new Date();
    const owner = session.role === 'admin' ? { owner_role: 'admin', owner_id: '' } : { owner_role: 'writer', owner_id: session.id };
    const state = await ActionState.findOneAndUpdate(
      { action_key: req.params.actionKey, ...owner },
      { $set: updates, $setOnInsert: { action_key: req.params.actionKey, ...owner } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    await recordAudit({ order_id: req.body.work_id || '', actor_id: session.id, actor_role: session.role, action: 'action_center_updated', details: { action_key: req.params.actionKey, ...updates } });
    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ADMIN UNIFIED INBOX ==========

app.get('/api/admin/inbox', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const messages = await Message.find().sort({ createdAt: -1 }).lean();
    const workIds = [...new Set(messages.map(item => item.order_id))];
    const [orders, services, states, decisions, files, expenses] = await Promise.all([
      Order.find({ order_id: { $in: workIds } }).lean(),
      ServiceRequest.find({ request_id: { $in: workIds } }).lean(),
      ConversationState.find({ work_id: { $in: workIds } }).lean(),
      WorkDecision.find({ work_id: { $in: workIds }, status: { $in: ['open', 'answered'] } }).lean(),
      PlatformFile.find({ order_id: { $in: workIds }, state: { $ne: 'archived' } }).select('order_id').lean(),
      WorkExpense.find({ work_id: { $in: workIds }, status: { $in: ['submitted', 'more_info_required'] } }).select('work_id').lean()
    ]);
    const workMap = new Map();
    orders.forEach(order => workMap.set(order.order_id, {
      kind: 'academic', mongo_id: order._id, title: order.topic_title, category: order.service_type,
      status: order.status, deadline: order.deadline, client_id: order.client_id,
      client_name: order.client_name, provider_id: order.writer_id, provider_name: order.writer_name
    }));
    services.forEach(job => workMap.set(job.request_id, {
      kind: 'service', mongo_id: job._id, title: job.title, category: job.category,
      family: job.family, status: job.status, deadline: job.deadline, client_id: job.client_id,
      client_name: job.client_name, provider_id: job.provider_id, provider_name: job.provider_name,
      direct_contact_enabled: job.direct_contact_enabled
    }));
    const stateMap = new Map(states.map(item => [`${item.work_id}:${item.channel}`, item]));
    const decisionCounts = decisions.reduce((map, item) => map.set(item.work_id, (map.get(item.work_id) || 0) + 1), new Map());
    const fileCounts = files.reduce((map, item) => map.set(item.order_id, (map.get(item.order_id) || 0) + 1), new Map());
    const expenseCounts = expenses.reduce((map, item) => map.set(item.work_id, (map.get(item.work_id) || 0) + 1), new Map());
    const grouped = new Map();
    messages.forEach(message => {
      const key = `${message.order_id}:${message.channel}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(message);
    });
    const conversations = [...grouped.entries()].map(([key, thread]) => {
      const latest = thread[0];
      const work = workMap.get(latest.order_id) || { kind: 'unknown', title: latest.order_id, category: 'Unknown job' };
      const state = stateMap.get(key) || {};
      return {
        key, work_id: latest.order_id, channel: latest.channel, ...work,
        latest_message: latest.body, latest_sender_role: latest.sender_role,
        latest_at: latest.createdAt, message_count: thread.length,
        unread_count: thread.filter(item => !item.read_by?.includes(session.id)).length,
        open_decisions: decisionCounts.get(latest.order_id) || 0,
        file_count: fileCounts.get(latest.order_id) || 0,
        pending_expenses: expenseCounts.get(latest.order_id) || 0,
        assigned_admin: state.assigned_admin || '', priority: state.priority || 'normal',
        conversation_status: state.status || 'open', tags: state.tags || [],
        follow_up_at: state.follow_up_at, escalated: state.escalated || false
      };
    });
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/inbox/:workId/:channel', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const work = await findWork(req.params.workId);
    if (!work) return res.status(404).json({ success: false, error: 'Related job not found.' });
    const [messages, state, decisions, files, expenses] = await Promise.all([
      Message.find({ order_id: req.params.workId, channel: req.params.channel }).sort({ createdAt: 1 }),
      ConversationState.findOne({ work_id: req.params.workId, channel: req.params.channel }),
      WorkDecision.find({ work_id: req.params.workId }).sort({ createdAt: -1 }).limit(20),
      PlatformFile.find({ order_id: req.params.workId, state: { $ne: 'archived' } }).sort({ createdAt: -1 }).limit(20),
      WorkExpense.find({ work_id: req.params.workId }).sort({ createdAt: -1 }).limit(20)
    ]);
    await Message.updateMany(
      { order_id: req.params.workId, channel: req.params.channel, read_by: { $ne: session.id } },
      { $addToSet: { read_by: session.id } }
    );
    const record = work.record.toObject();
    res.json({ success: true, messages, state, decisions, files, expenses, work: { ...record, work_kind: work.kind } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/inbox/:workId/:channel', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const allowed = ['assigned_admin','priority','status','tags','follow_up_at','snoozed_until','escalated','escalation_reason','resolution_reason'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const state = await ConversationState.findOneAndUpdate(
      { work_id: req.params.workId, channel: req.params.channel },
      { $set: updates, $setOnInsert: { work_id: req.params.workId, channel: req.params.channel } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    await recordAudit({ order_id: req.params.workId, actor_id: session.id, actor_role: 'admin', action: 'conversation_updated', details: updates });
    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== STATIC FILES ==========

// ========== PHASE 12: PLATFORM CONFIGURATION & VISUAL BUILDER ==========

const platformConfigKey = 'platform';
const defaultPlatformConfig = () => normalisePlatformConfig(clonePlatformConfig(DEFAULT_PLATFORM_CONFIG));
const databaseIsReady = () => mongoose.connection.readyState === 1;

const getOrCreatePlatformConfig = async () => {
  let platform = await PlatformConfig.findOne({ key: platformConfigKey });
  if (platform) return platform;
  const defaults = defaultPlatformConfig();
  try {
    platform = await PlatformConfig.create({
      key: platformConfigKey,
      draft: defaults,
      published: defaults,
      draftVersion: 1,
      publishedVersion: 1,
      publishedAt: new Date()
    });
    await ConfigRevision.create({
      key: platformConfigKey,
      version: 1,
      config: defaults,
      publishedBy: 'system',
      note: 'Initial platform configuration'
    });
    return platform;
  } catch (error) {
    if (error?.code === 11000) return PlatformConfig.findOne({ key: platformConfigKey });
    throw error;
  }
};

const allowedMediaTypes = {
  'image/jpeg': { extension: '.jpg', mediaType: 'image' },
  'image/png': { extension: '.png', mediaType: 'image' },
  'image/webp': { extension: '.webp', mediaType: 'image' },
  'image/gif': { extension: '.gif', mediaType: 'image' },
  'video/mp4': { extension: '.mp4', mediaType: 'video' },
  'video/webm': { extension: '.webm', mediaType: 'video' }
};
const matchesMediaSignature = (buffer, mimeType) => {
  const hex = buffer.subarray(0, 16).toString('hex');
  if (mimeType === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (mimeType === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (mimeType === 'image/gif') return buffer.subarray(0, 6).toString('ascii').startsWith('GIF8');
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'video/mp4') return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mimeType === 'video/webm') return hex.startsWith('1a45dfa3');
  return false;
};

app.get('/api/media/:assetId', async (req, res) => {
  try {
    const asset = await MediaAsset.findOne({ asset_id: req.params.assetId }).lean();
    if (!asset) return res.status(404).json({ success: false, error: 'Media asset not found.' });
    const requestedRange = req.headers.range;
    const range = requestedRange ? parseByteRange(requestedRange, Number(asset.size)) : null;
    if (requestedRange && !range) {
      res.setHeader('Content-Range', `bytes */${asset.size}`);
      return res.status(416).end();
    }
    const storedObject = await objectStorage.read(storageKey('media', asset.stored_name), { range });
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', storedObject.body.length);
    if (range) {
      res.setHeader('Content-Range', storedObject.contentRange || `bytes ${range.start}-${range.end}/${asset.size}`);
      res.status(206);
    }
    res.type(asset.mime_type);
    res.send(storedObject.body);
  } catch (err) {
    if (respondWithStorageError(res, err, 'Media content is not available.')) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/media', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const assets = await MediaAsset.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/media', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const mimeType = String(req.body?.mimeType || '').toLowerCase();
    const mediaSpec = allowedMediaTypes[mimeType];
    if (!mediaSpec) return res.status(415).json({ success: false, error: 'Use JPG, PNG, WEBP, GIF, MP4, or WEBM media.' });
    const encoded = String(req.body?.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!encoded || !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) {
      return res.status(400).json({ success: false, error: 'A valid base64 media payload is required.' });
    }
    const buffer = Buffer.from(encoded, 'base64');
    const maxBytes = mediaSpec.mediaType === 'video' ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!buffer.length || buffer.length > maxBytes) {
      return res.status(413).json({ success: false, error: `${mediaSpec.mediaType === 'video' ? 'Videos' : 'Images'} must be smaller than ${maxBytes / 1024 / 1024} MB.` });
    }
    if (!matchesMediaSignature(buffer, mimeType)) {
      return res.status(415).json({ success: false, error: 'The file contents do not match the declared media type.' });
    }
    const assetId = `MEDIA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const storedName = `${assetId}${mediaSpec.extension}`;
    const objectKey = storageKey('media', storedName);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    await objectStorage.write(objectKey, buffer, {
      contentType: mimeType,
      metadata: { sha256: checksum, scope: 'cms-media' }
    });
    let asset;
    try {
      asset = await MediaAsset.create({
        asset_id: assetId,
        original_name: normaliseUploadName(req.body?.name, `upload${mediaSpec.extension}`),
        stored_name: storedName,
        mime_type: mimeType,
        media_type: mediaSpec.mediaType,
        size: buffer.length,
        alt_text: String(req.body?.altText || '').slice(0, 220),
        caption: String(req.body?.caption || '').slice(0, 500),
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map(tag => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [],
        uploaded_by: req.adminAccess?.adminId || session.id
      });
    } catch (error) {
      await objectStorage.remove(objectKey).catch(cleanupError => {
        console.error('Failed to remove an uncommitted media object:', cleanupError.message);
      });
      throw error;
    }
    await recordAudit({
      order_id: 'MEDIA-LIBRARY',
      actor_id: req.adminAccess?.adminId || session.id,
      actor_role: 'admin',
      action: 'visual_media_uploaded',
      details: { asset_id: asset.asset_id, mime_type: asset.mime_type, size: asset.size }
    });
    res.status(201).json({ success: true, asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/media/:assetId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const updates = {
      ...(req.body?.altText !== undefined ? { alt_text: String(req.body.altText).slice(0, 220) } : {}),
      ...(req.body?.caption !== undefined ? { caption: String(req.body.caption).slice(0, 500) } : {}),
      ...(req.body?.tags !== undefined ? {
        tags: Array.isArray(req.body.tags)
          ? req.body.tags.map(tag => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 12)
          : []
      } : {})
    };
    const asset = await MediaAsset.findOneAndUpdate(
      { asset_id: req.params.assetId },
      updates,
      { returnDocument: 'after', runValidators: true }
    );
    if (!asset) return res.status(404).json({ success: false, error: 'Media asset not found.' });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/media/:assetId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin' || !req.adminAccess) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const [asset, platform] = await Promise.all([
      MediaAsset.findOne({ asset_id: req.params.assetId }),
      PlatformConfig.findOne({ key: platformConfigKey }).lean()
    ]);
    if (!asset) return res.status(404).json({ success: false, error: 'Media asset not found.' });
    const configText = JSON.stringify({ draft: platform?.draft, published: platform?.published });
    if (configText.includes(asset.asset_id)) {
      return res.status(409).json({ success: false, error: 'This media is used by a draft or published page. Remove it from the builder first.' });
    }
    const objectKey = storageKey('media', asset.stored_name);
    const storedObject = await objectStorage.read(objectKey);
    await objectStorage.remove(objectKey);
    try {
      await MediaAsset.deleteOne({ _id: asset._id });
    } catch (error) {
      await objectStorage.write(objectKey, storedObject.body, {
        contentType: asset.mime_type,
        metadata: {
          sha256: crypto.createHash('sha256').update(storedObject.body).digest('hex'),
          scope: 'cms-media'
        }
      }).catch(restoreError => {
        console.error('Failed to restore media after database deletion error:', restoreError.message);
      });
      throw error;
    }
    await recordAudit({
      order_id: 'MEDIA-LIBRARY',
      actor_id: req.adminAccess?.adminId || session.id,
      actor_role: 'admin',
      action: 'visual_media_deleted',
      details: { asset_id: asset.asset_id, original_name: asset.original_name }
    });
    res.json({ success: true });
  } catch (err) {
    if (respondWithStorageError(res, err, 'Media content is not available.')) return;
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/platform-config', async (req, res) => {
  try {
    if (!databaseIsReady()) {
      return res.json({
        success: true,
        config: defaultPlatformConfig(),
        version: 1,
        publishedAt: null,
        fallback: true
      });
    }
    const platform = await getOrCreatePlatformConfig();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      success: true,
      config: normalisePlatformConfig(platform.published),
      version: platform.publishedVersion,
      publishedAt: platform.publishedAt
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/platform-config', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (!databaseIsReady()) return res.status(503).json({ success: false, error: 'The database must be connected to use the visual builder.' });
    const [platform, revisions] = await Promise.all([
      getOrCreatePlatformConfig(),
      ConfigRevision.find({ key: platformConfigKey }).select('-config').sort({ version: -1 }).limit(30).lean()
    ]);
    res.json({
      success: true,
      draft: normalisePlatformConfig(platform.draft),
      published: normalisePlatformConfig(platform.published),
      draftVersion: platform.draftVersion,
      publishedVersion: platform.publishedVersion,
      draftUpdatedBy: platform.draftUpdatedBy,
      publishedBy: platform.publishedBy,
      publishedAt: platform.publishedAt,
      revisions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/platform-config/draft', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (!databaseIsReady()) return res.status(503).json({ success: false, error: 'The database must be connected to save a draft.' });
    const config = normalisePlatformConfig(req.body?.config);
    const platform = await getOrCreatePlatformConfig();
    if (req.body?.expectedVersion != null && Number(req.body.expectedVersion) !== platform.draftVersion) {
      return res.status(409).json({ success: false, error: 'This draft was changed by another administrator. Reload the builder before saving.' });
    }
    platform.draft = config;
    platform.draftVersion += 1;
    platform.draftUpdatedBy = session.id || session.email || 'admin';
    await platform.save();
    await recordAudit({
      order_id: 'PLATFORM-CONFIG',
      actor_id: session.id || session.email || 'admin',
      actor_role: 'admin',
      action: 'platform_config_draft_saved',
      details: { draftVersion: platform.draftVersion }
    });
    res.json({ success: true, draft: config, draftVersion: platform.draftVersion });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/platform-config/publish', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (!databaseIsReady()) return res.status(503).json({ success: false, error: 'The database must be connected to publish.' });
    const platform = await getOrCreatePlatformConfig();
    if (req.body?.expectedVersion != null && Number(req.body.expectedVersion) !== platform.draftVersion) {
      return res.status(409).json({ success: false, error: 'This draft was changed by another administrator. Reload the builder before publishing.' });
    }
    const config = normalisePlatformConfig(req.body?.config || platform.draft);
    const nextVersion = platform.publishedVersion + 1;
    const actor = session.id || session.email || 'admin';
    const note = String(req.body?.note || '').slice(0, 240);
    platform.draft = config;
    platform.published = config;
    platform.draftVersion += 1;
    platform.publishedVersion = nextVersion;
    platform.draftUpdatedBy = actor;
    platform.publishedBy = actor;
    platform.publishedAt = new Date();
    await platform.save();
    await ConfigRevision.create({
      key: platformConfigKey,
      version: nextVersion,
      config,
      publishedBy: actor,
      note
    });
    await recordAudit({
      order_id: 'PLATFORM-CONFIG',
      actor_id: actor,
      actor_role: 'admin',
      action: 'platform_config_published',
      details: { version: nextVersion, note }
    });
    res.json({
      success: true,
      config,
      publishedVersion: nextVersion,
      publishedAt: platform.publishedAt
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/platform-config/reset-draft', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (!databaseIsReady()) return res.status(503).json({ success: false, error: 'The database must be connected to reset a draft.' });
    const platform = await getOrCreatePlatformConfig();
    const useDefaults = req.body?.source === 'defaults';
    platform.draft = useDefaults ? defaultPlatformConfig() : normalisePlatformConfig(platform.published);
    platform.draftVersion += 1;
    platform.draftUpdatedBy = session.id || session.email || 'admin';
    await platform.save();
    await recordAudit({
      order_id: 'PLATFORM-CONFIG',
      actor_id: session.id || session.email || 'admin',
      actor_role: 'admin',
      action: 'platform_config_draft_reset',
      details: { source: useDefaults ? 'defaults' : 'published' }
    });
    res.json({ success: true, draft: platform.draft, draftVersion: platform.draftVersion });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/platform-config/rollback/:version', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    if (!databaseIsReady()) return res.status(503).json({ success: false, error: 'The database must be connected to roll back.' });
    const requestedVersion = Number(req.params.version);
    const revision = await ConfigRevision.findOne({ key: platformConfigKey, version: requestedVersion });
    if (!revision) return res.status(404).json({ success: false, error: 'That configuration version does not exist.' });
    const platform = await getOrCreatePlatformConfig();
    const config = normalisePlatformConfig(revision.config);
    const nextVersion = platform.publishedVersion + 1;
    const actor = session.id || session.email || 'admin';
    platform.draft = config;
    platform.published = config;
    platform.draftVersion += 1;
    platform.publishedVersion = nextVersion;
    platform.draftUpdatedBy = actor;
    platform.publishedBy = actor;
    platform.publishedAt = new Date();
    await platform.save();
    await ConfigRevision.create({
      key: platformConfigKey,
      version: nextVersion,
      config,
      publishedBy: actor,
      note: `Rollback to version ${requestedVersion}`
    });
    await recordAudit({
      order_id: 'PLATFORM-CONFIG',
      actor_id: actor,
      actor_role: 'admin',
      action: 'platform_config_rolled_back',
      details: { fromVersion: requestedVersion, newVersion: nextVersion }
    });
    res.json({ success: true, config, publishedVersion: nextVersion, publishedAt: platform.publishedAt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = Number(process.env.PORT || 8080);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
if (isProduction) {
  try {
    await fs.access(indexFile);
  } catch {
    throw new Error('Production frontend build is missing. Run npm run build before npm start.');
  }
}

app.use(express.static(distDir));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexFile);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

let shuttingDown = false;
const shutDown = signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing the HTTP server and database connection.`);

  const forcedExit = setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 25000);
  forcedExit.unref();

  server.close(async () => {
    let exitCode = 0;
    try {
      await mongoose.disconnect();
    } catch (error) {
      exitCode = 1;
      console.error('Database shutdown failed:', error.message);
    } finally {
      clearTimeout(forcedExit);
      process.exit(exitCode);
    }
  });
};

process.once('SIGTERM', () => shutDown('SIGTERM'));
process.once('SIGINT', () => shutDown('SIGINT'));

export { app, server };
