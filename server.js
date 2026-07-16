import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Import MongoDB models
import Client from './models/Client.js';
import Order from './models/Order.js';
import Writer from './models/Writer.js';
import Admin from './models/Admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database error:', err));

// ========== CLIENT APIs ==========

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json({ success: true, clients });
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
    res.json({ success: true, client });
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
      { new: true }
    );
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
      res.json({ success: true, client });
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
      { new: true }
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
    const writers = await Writer.find();
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
    res.json({ success: true, writer });
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
      { new: true }
    );
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
      res.json({ success: true, writer });
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

// ========== STATIC FILES ==========

const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});