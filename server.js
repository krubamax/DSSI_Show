const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ─── Config ───────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dssi1';
const PORT = process.env.PORT || 3000;

// ─── In-memory storage ────────────────────────────────────────────────────────
let queue = [];
let display = [];
let banned = [];
let settings = {
  eventName: 'DSSI',
  subtitle: 'ส่งรูป ส่งใจ ขึ้นจอเลย',
  autoAdvance: true,
  advanceInterval: 10,
  requireApproval: true,
  requirePhoto: false,
  theme: 'pink',
};

// ─── Uploads directory ────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, uuidv4() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ─── WebSocket broadcast ──────────────────────────────────────────────────────
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ─── Admin auth middleware ────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Routes: Public ───────────────────────────────────────────────────────────

// Submit warp
app.post('/api/submit', upload.single('photo'), (req, res) => {
  try {
    const { name, table, message, ig, facebook, borderColor } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'กรุณาใส่ชื่อ' });
    if (settings.requirePhoto && !req.file) {
      return res.status(400).json({ error: 'กรุณาแนบรูปก่อนส่ง' });
    }

    const item = {
      id: uuidv4(),
      name: name.trim(),
      table: (table || '').trim(),
      message: (message || '').trim().slice(0, 280),
      ig: (ig || '').trim().replace(/^@/, ''),
      facebook: (facebook || '').trim().replace(/^@/, ''),
      borderColor: borderColor || '#FF1493',
      photo: req.file ? `/uploads/${req.file.filename}` : null,
      likes: 0,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    if (settings.requireApproval) {
      queue.push(item);
      broadcast('new_submission', { item, queueCount: queue.length });
      res.json({ success: true, id: item.id, status: 'pending' });
    } else {
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
      display.push(item);
      broadcast('approved', { item, displayCount: display.length, queueCount: queue.length });
      res.json({ success: true, id: item.id, status: 'approved' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like
app.post('/api/like/:id', (req, res) => {
  const item = display.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.likes++;
  broadcast('liked', { id: item.id, likes: item.likes });
  res.json({ success: true, likes: item.likes });
});

// Public display items (for display screen)
app.get('/api/display', (req, res) => res.json(display));

// Settings (public read)
app.get('/api/settings', (req, res) => res.json(settings));

// Stats (public)
app.get('/api/stats', (req, res) => {
  res.json({
    queue: queue.length,
    display: display.length,
    banned: banned.length,
    totalLikes: display.reduce((s, i) => s + i.likes, 0),
  });
});

// ─── Routes: Admin ────────────────────────────────────────────────────────────

// Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ success: true, token: ADMIN_PASSWORD });
  else res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
});

// Get queue
app.get('/api/queue', adminAuth, (req, res) => res.json(queue));

// Get banned
app.get('/api/banned', adminAuth, (req, res) => res.json(banned));

// Approve single
app.post('/api/approve/:id', adminAuth, (req, res) => {
  const idx = queue.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [item] = queue.splice(idx, 1);
  item.status = 'approved';
  item.approvedAt = new Date().toISOString();
  display.push(item);
  broadcast('approved', { item, displayCount: display.length, queueCount: queue.length });
  res.json({ success: true });
});

// Approve all
app.post('/api/approve-all', adminAuth, (req, res) => {
  const items = [];
  while (queue.length) {
    const item = queue.shift();
    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    display.push(item);
    items.push(item);
  }
  broadcast('approved_all', { items, displayCount: display.length, queueCount: 0 });
  res.json({ success: true, count: items.length });
});

// Reject
app.post('/api/reject/:id', adminAuth, (req, res) => {
  const idx = queue.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [item] = queue.splice(idx, 1);
  item.status = 'rejected';
  banned.push(item);
  if (req.file && item.photo) {
    const filepath = path.join(__dirname, item.photo);
    fs.unlink(filepath, () => { });
  }
  broadcast('rejected', { id: item.id, queueCount: queue.length });
  res.json({ success: true });
});

// Remove from display
app.delete('/api/display/:id', adminAuth, (req, res) => {
  const idx = display.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [item] = display.splice(idx, 1);
  broadcast('removed', { id: item.id, displayCount: display.length });
  res.json({ success: true });
});

// Clear display
app.post('/api/clear', adminAuth, (req, res) => {
  display = [];
  broadcast('cleared', {});
  res.json({ success: true });
});

// Update settings
app.put('/api/settings', adminAuth, (req, res) => {
  settings = { ...settings, ...req.body };
  broadcast('settings_updated', settings);
  res.json(settings);
});

// QR Code
app.get('/api/qrcode', async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = `http://${host}/warp`;
  try {
    const qr = await QRCode.toDataURL(url, {
      color: { dark: '#000000', light: '#ffffff' },
      width: 300,
      margin: 1,
    });
    res.json({ url, qr });
  } catch (e) {
    res.status(500).json({ error: 'QR error' });
  }
});

// ─── Redirect / → /warp ───────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/warp'));
app.get('/warp', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'warp.html'))
);
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html'))
);
app.get('/display', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'display.html'))
);
app.get('/wall', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'wall.html'))
);

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 WARP CLUB Server started!`);
  console.log(`   User form : http://localhost:${PORT}/warp`);
  console.log(`   Admin     : http://localhost:${PORT}/admin`);
  console.log(`   Display   : http://localhost:${PORT}/display`);
  console.log(`   Wall      : http://localhost:${PORT}/wall`);
  console.log(`   Admin pw  : ${ADMIN_PASSWORD}\n`);
});
