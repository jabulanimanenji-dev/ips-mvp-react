import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database error:', err));

// ─── IN-MEMORY STORAGE (persists while server runs) ───
// In production, these would be MongoDB collections
const storage = {
  writers: [],
  admins: [],
  clients: []
};

// Initialize from localStorage-like data if needed
// (We'll sync with frontend localStorage for now)

// ─── ADMIN LOGIN API ───
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = 'admin@ipsglobal.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email === adminEmail && password === adminPassword) {
    res.json({ success: true, token: 'admin-token-12345', role: 'superadmin' });
  } else {
    // Check additional admins
    const extraAdmin = storage.admins.find(a => a.email === email && a.password === password);
    if (extraAdmin) {
      res.json({ success: true, token: `admin-token-${extraAdmin.id}`, role: extraAdmin.role });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  }
});

// ─── WRITER LOGIN API ───
app.post('/api/writer/login', (req, res) => {
  const { email, password } = req.body;
  const writer = storage.writers.find(w => w.email === email && w.password === password && w.status === 'Active');
  
  if (writer) {
    res.json({ success: true, token: `writer-token-${writer.writer_id}`, writer });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials or account inactive' });
  }
});

// ─── CLIENT CRUD APIs ───
app.get('/api/clients', (req, res) => {
  res.json({ success: true, clients: storage.clients });
});

app.post('/api/clients', (req, res) => {
  const newClient = { ...req.body, client_id: `CID-${String(storage.clients.length + 1).padStart(3, '0')}` };
  storage.clients.push(newClient);
  res.json({ success: true, client: newClient });
});

app.delete('/api/clients/:id', (req, res) => {
  storage.clients = storage.clients.filter(c => c.client_id !== req.params.id);
  res.json({ success: true });
});

// ─── WRITER CRUD APIs ───
app.get('/api/writers', (req, res) => {
  res.json({ success: true, writers: storage.writers });
});

app.post('/api/writers', (req, res) => {
  const newWriter = {
    ...req.body,
    writer_id: `WID-${String(storage.writers.length + 1).padStart(3, '0')}`,
    status: 'Active',
    created_at: new Date().toISOString()
  };
  storage.writers.push(newWriter);
  res.json({ success: true, writer: newWriter });
});

app.delete('/api/writers/:id', (req, res) => {
  storage.writers = storage.writers.filter(w => w.writer_id !== req.params.id);
  res.json({ success: true });
});

app.patch('/api/writers/:id/status', (req, res) => {
  const writer = storage.writers.find(w => w.writer_id === req.params.id);
  if (writer) {
    writer.status = req.body.status;
    res.json({ success: true, writer });
  } else {
    res.status(404).json({ success: false, message: 'Writer not found' });
  }
});

// ─── ADMIN CRUD APIs ───
app.get('/api/admins', (req, res) => {
  res.json({ success: true, admins: storage.admins });
});

app.post('/api/admins', (req, res) => {
  const newAdmin = {
    ...req.body,
    id: `ADM-${String(storage.admins.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString()
  };
  storage.admins.push(newAdmin);
  res.json({ success: true, admin: newAdmin });
});

app.delete('/api/admins/:id', (req, res) => {
  storage.admins = storage.admins.filter(a => a.id !== req.params.id);
  res.json({ success: true });
});

// ─── SYNC API (for frontend localStorage backup) ───
app.post('/api/sync', (req, res) => {
  const { writers, clients, admins } = req.body;
  if (writers) storage.writers = writers;
  if (clients) storage.clients = clients;
  if (admins) storage.admins = admins;
  res.json({ success: true, data: storage });
});

const PORT = process.env.PORT || 8080;

// Serve static files from the Vite build output (dist folder)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 IPS production server running on http://localhost:${PORT}`);
});