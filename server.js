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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });

const app = express();
app.use(helmet());
app.use(express.json({ limit: '35mb' }));

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
    const client = new Client({ ...req.body, client_id: newId });
    await client.save();
    const safeClient = client.toObject();
    delete safeClient.password;
    res.json({ success: true, client: safeClient });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update client
app.patch('/api/clients/:id', async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { client_id: req.params.id },
      req.body,
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
    const client = await Client.findOne({ email, password });
    if (client) {
      const safeClient = client.toObject();
      delete safeClient.password;
      res.json({ success: true, client: safeClient });
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
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const count = await Order.countDocuments();
    const newId = `ORD-${String(count + 1).padStart(4, '0')}`;
    const order = new Order({ ...req.body, order_id: newId });
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update order
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      req.body,
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
    await Order.findOneAndDelete({ order_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get one order by MongoDB ID or public order ID
app.get('/api/orders/:id', async (req, res) => {
  try {
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
    const orders = await Order.find({ client_id: req.params.clientId });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get orders by writer
app.get('/api/orders/writer/:writerId', async (req, res) => {
  try {
    const orders = await Order.find({ writer_id: req.params.writerId });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== WRITER APIs ==========

app.get('/api/writers', async (req, res) => {
  try {
    const writers = await Writer.find().select('-password');
    res.json({ success: true, writers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/writers', async (req, res) => {
  try {
    const count = await Writer.countDocuments();
    const newId = `WID-${String(count + 1).padStart(3, '0')}`;
    const writer = new Writer({ ...req.body, writer_id: newId });
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
    const writer = await Writer.findOne({ email, password, status: 'Active' });
    if (writer) {
      const safeWriter = writer.toObject();
      delete safeWriter.password;
      res.json({ success: true, writer: safeWriter });
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
    const adminEmail = 'admin@ipsglobal.com';
    
    if (email === adminEmail && password === process.env.ADMIN_PASSWORD) {
      res.json({ success: true, token: 'admin-token', role: 'superadmin' });
      return;
    }
    
    const admin = await Admin.findOne({ email, password });
    if (admin) {
      res.json({ success: true, token: `admin-token-${admin.id}`, role: admin.role });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const admins = await Admin.find();
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    const newId = `ADM-${String(count + 1).padStart(3, '0')}`;
    const admin = new Admin({ ...req.body, id: newId });
    await admin.save();
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
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

app.get('/api/orders/:id/workspace', async (req, res) => {
  try {
    const role = req.query.role || 'client';
    const [files, messages, audit] = await Promise.all([
      PlatformFile.find({
        order_id: req.params.id,
        visibility: { $in: visibleToRole[role] || [] },
        state: { $ne: 'archived' }
      }).sort({ createdAt: -1 }),
      Message.find({
        order_id: req.params.id,
        channel: role === 'admin'
          ? { $in: ['client_admin', 'writer_admin', 'admin_internal'] }
          : role === 'writer' ? 'writer_admin' : 'client_admin'
      }).sort({ createdAt: 1 }),
      role === 'admin'
        ? AuditLog.find({ order_id: req.params.id }).sort({ createdAt: -1 }).limit(100)
        : []
    ]);
    res.json({ success: true, files, messages, audit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/files', async (req, res) => {
  try {
    const {
      name, mime_type, size, data, category = 'Other', description = '',
      uploader_id, uploader_role, visibility, milestone_stage = null
    } = req.body;
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
    const defaultVisibility = uploader_role === 'client' ? 'admin_writer' : uploader_role === 'writer' ? 'admin_writer' : 'all';
    const state = uploader_role === 'writer' ? 'pending' : uploader_role === 'client' ? 'released' : 'released';
    const file = await PlatformFile.create({
      order_id: req.params.id, milestone_stage, original_name: path.basename(name),
      stored_name: storedName, mime_type: mime_type || 'application/octet-stream',
      size: buffer.length, category, description, uploader_id, uploader_role,
      visibility: visibility || defaultVisibility, state,
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
    const role = req.query.role || 'client';
    const file = await PlatformFile.findById(req.params.id);
    if (!file || !(visibleToRole[role] || []).includes(file.visibility) || file.state === 'archived') {
      return res.status(404).json({ success: false, error: 'File not available.' });
    }
    if (role === 'client' && file.state !== 'released') {
      return res.status(403).json({ success: false, error: 'File has not been released.' });
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
    const allowed = ['state', 'visibility', 'description', 'category'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.state === 'released') updates.released_at = new Date();
    const file = await PlatformFile.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' });
    if (!file) return res.status(404).json({ success: false, error: 'File not found.' });
    await recordAudit({
      order_id: file.order_id, actor_id: req.body.actor_id || 'admin',
      actor_role: 'admin', action: 'file_updated', details: updates
    });
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/messages', async (req, res) => {
  try {
    const { sender_id, sender_role, channel, body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Message is required.' });
    const message = await Message.create({
      order_id: req.params.id, sender_id, sender_role, channel, body: body.trim()
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
    const { progress, status, milestones, actor_id, actor_role, reason = '' } = req.body;
    const updates = {};
    if (Number.isFinite(Number(progress))) updates.progress = Math.max(0, Math.min(100, Number(progress)));
    if (Array.isArray(milestones)) updates.milestones = milestones;
    if (status) {
      updates.status = status;
      updates.$push = { status_history: { status, actor_id, actor_role, reason } };
    }
    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id }, updates, { returnDocument: 'after', runValidators: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    await recordAudit({
      order_id: req.params.id, actor_id, actor_role,
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

// ========== STATIC FILES ==========

const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
