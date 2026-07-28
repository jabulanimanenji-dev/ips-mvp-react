import dotenv from 'dotenv';
dotenv.config();

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });

const app = express();
app.use(helmet());
app.use(express.json({ limit: '35mb' }));

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'local-development-change-me';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be set to a unique value of at least 32 characters in production.');
}
const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};
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
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token || cookieToken;
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

// Connect to MongoDB without preventing the frontend from launching.
const mongoUri = process.env.MONGODB_URI?.trim();
const hasMongoPlaceholder = !mongoUri
  || ['USERNAME', 'PASSWORD', 'CLUSTER', 'DATABASE'].some(value => mongoUri.includes(value));

if (!hasMongoPlaceholder) {
  mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database connection failed:', err.message));
} else {
  console.warn('⚠️ MONGODB_URI is missing or still contains placeholders. The website will launch, but database APIs are unavailable.');
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ========== CLIENT APIs ==========

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    const count = await Client.countDocuments();
    const newId = `CID-${String(count + 1).padStart(3, '0')}`;
    const client = new Client({ ...req.body, password: hashPassword(req.body.password), client_id: newId });
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
    if (!session || (session.role !== 'admin' && !(session.role === 'client' && session.id === req.params.id))) return res.status(403).json({ success: false, error: 'You cannot update this client.' });
    const updates = { ...req.body };
    if (updates.password) updates.password = hashPassword(updates.password);
    const client = await Client.findOneAndUpdate(
      { client_id: req.params.id },
      updates,
      { returnDocument: 'after' }
    ).select('-password');
    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    if (!session || session.role !== 'client') return res.status(403).json({ success: false, error: 'Client access required.' });
    const count = await Order.countDocuments();
    const newId = `ORD-${String(count + 1).padStart(4, '0')}`;
    const order = new Order({ ...req.body, client_id: session.id, order_id: newId });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can delete orders.' });
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
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get orders by client
app.get('/api/orders/client/:clientId', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || (session.role !== 'admin' && !(session.role === 'client' && session.id === req.params.clientId))) return res.status(403).json({ success: false, error: 'You cannot view these orders.' });
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
    if (!session || (session.role !== 'admin' && !(session.role === 'writer' && session.id === req.params.writerId))) return res.status(403).json({ success: false, error: 'You cannot view these assignments.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const writers = await Writer.find().select('-password');
    res.json({ success: true, writers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/writers', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    await Writer.findOneAndDelete({ writer_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/writers/:id/status', async (req, res) => {
  try {
    const writer = await Writer.findOneAndUpdate(
      { writer_id: req.params.id },
      { status: req.body.status },
      { returnDocument: 'after' }
    );
    res.json({ success: true, writer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/writers/:id', async (req, res) => {
  try {
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
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedUpdates.includes(key))
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

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@ipsglobal.com').trim().toLowerCase();
    
    if (email === adminEmail && password === process.env.ADMIN_PASSWORD) {
      const token = signSession({ id: email, role: 'admin' });
      setSessionCookie(res, token);
      res.json({ success: true, token, role: 'superadmin' });
      return;
    }
    
    const admin = await Admin.findOne({ email });
    if (admin && verifyPassword(password, admin.password)) {
      if (!admin.password.startsWith('scrypt$')) {
        admin.password = hashPassword(password);
        await admin.save();
      }
      const token = signSession({ id: admin.id, role: 'admin' });
      setSessionCookie(res, token);
      res.json({ success: true, token, role: admin.role });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const admins = await Admin.find();
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    const count = await Admin.countDocuments();
    const newId = `ADM-${String(count + 1).padStart(3, '0')}`;
    const admin = new Admin({ ...req.body, password: hashPassword(req.body.password), id: newId });
    await admin.save();
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
    await Admin.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== COLLABORATION, FILES, MESSAGES, NOTIFICATIONS ==========

const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.png', '.jpg', '.jpeg']);
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
    if (!data || !Number.isFinite(Number(size)) || Number(size) > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File is empty or exceeds the 25 MB limit.' });
    }
    const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Invalid file data.' });
    }
    const storedName = `${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(uploadsDir, storedName), buffer);
    const defaultVisibility = uploader_role === 'client'
      ? 'admin_client'
      : uploader_role === 'writer'
        ? 'admin_writer'
        : ['admin', 'admin_client', 'admin_writer', 'all'].includes(visibility) ? visibility : 'admin';
    const state = uploader_role === 'admin' ? 'released' : 'pending';
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const file = await PlatformFile.create({
      order_id: req.params.id, milestone_stage, original_name: path.basename(name),
      stored_name: storedName, mime_type: mime_type || 'application/octet-stream',
      size: buffer.length, category, description, uploader_id, uploader_role,
      visibility: defaultVisibility, state, checksum, version_group: crypto.randomUUID(),
      released_by: state === 'released' ? session.id : '',
      released_at: state === 'released' ? new Date() : null
    });
    await recordAudit({
      order_id: req.params.id, actor_id: uploader_id, actor_role: uploader_role,
      action: 'file_uploaded', details: { file_id: file.id, name: file.original_name, state: file.state }
    });
    res.json({ success: true, file });
  } catch (err) {
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
    file.download_count += 1;
    await file.save();
    res.download(path.join(uploadsDir, file.stored_name), file.original_name);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/files/:id', async (req, res) => {
  try {
    const session = requireSession(req, res);
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can review files.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can change direct-contact access.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can review expenses.' });
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
    if (!session || session.role !== 'client') return res.status(403).json({ success: false, error: 'A client session is required.' });
    const count = await ServiceRequest.countDocuments();
    const requestId = `SRV-${String(count + 1).padStart(5, '0')}`;
    const request = await ServiceRequest.create({
      ...req.body, client_id: session.id,
      request_id: requestId,
      status_history: [{
        status: 'New Request',
        actor_id: req.body.client_id,
        actor_role: 'client',
        reason: 'Request submitted'
      }]
    });
    await recordAudit({
      order_id: requestId, actor_id: req.body.client_id, actor_role: 'client',
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can delete services.' });
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
    const attachmentInput = Array.isArray(req.body.attachments) ? req.body.attachments.slice(0, 3) : [];
    if (!body && !attachmentInput.length) return res.status(400).json({ success: false, error: 'Write a message or attach a file.' });
    const attachments = [];
    for (const item of attachmentInput) {
      const extension = path.extname(item.name || '').toLowerCase();
      if (!allowedExtensions.has(extension)) return res.status(400).json({ success: false, error: `File type ${extension || 'unknown'} is not allowed.` });
      const buffer = Buffer.from(String(item.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Each attachment must be 10 MB or smaller.' });
      const stored_name = `${crypto.randomUUID()}${extension}`;
      await fs.writeFile(path.join(uploadsDir, stored_name), buffer);
      attachments.push({ original_name: path.basename(item.name), stored_name, mime_type: item.mime_type || 'application/octet-stream', size: buffer.length });
    }
    const message = await DirectMessage.create({
      conversation_id: conversation.conversation_id, sender_id: session.id, sender_role: session.role,
      body, attachments, reply_to: req.body.reply_to || null, read_by: [session.id]
    });
    conversation.last_message_at = message.createdAt;
    conversation.last_message_preview = body.slice(0, 180) || `${attachments.length} attachment(s)`;
    conversation.status = 'open';
    await conversation.save();
    res.status(201).json({ success: true, message });
  } catch (err) {
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
    res.download(path.join(uploadsDir, attachment.stored_name), attachment.original_name);
  } catch (err) {
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
    if (!session || !['admin', 'writer'].includes(session.role)) return res.status(403).json({ success: false, error: 'Action Center access required.' });
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
    if (!session || !['admin', 'writer'].includes(session.role)) return res.status(403).json({ success: false, error: 'Action Center access required.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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
    if (!session || session.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });
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

const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
