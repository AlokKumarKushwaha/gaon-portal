// Hamara Gaon Portal - Backend Server
// Chalane ke liye: npm install, phir npm start

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ===== PRADHAN (ADMIN) LOGIN =====
// Ye password badal dein apni marzi se — isse hi Pradhan login karenge.
const ADMIN_PASSWORD = 'jagdishpur2026';

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Sirf Pradhan hi ye dekh sakte hain' });
  }
  next();
}

app.use(cors());
app.use(express.json({ limit: '15mb' })); // photos base64 me aati hain, isliye limit badi rakhi hai

// sw.js aur index.html ko kabhi bhi browser cache na kare — taaki jab bhi aap
// in files me edit karke save karein, refresh karte hi turant naya version dikhe.
app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path === '/' || req.path === '/index.html') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_DB = {
  samasya: [],
  suchna: [],
  jaankari: {
    history: "Yahan gaon ka itihaas likhein — gaon kab basa, kya khaasiyat hai, kaunse tyohar manaye jaate hain.",
    population: "Jansankhya yahan darj karein.",
    contacts: [
      { who: 'Pradhan / Sarpanch', num: '—' },
      { who: 'Doctor / Swasthya Kendra', num: '—' },
      { who: 'Police Station', num: '100' },
      { who: 'Bijli Vibhag', num: '—' },
      { who: 'School', num: '—' }
    ]
  },
  yojana: [
    {
      id: 'y1',
      name: 'PM Awas Yojana',
      desc: 'Gareeb parivaron ke liye pakka ghar banane ke liye sarkari sahayata.',
      apply: 'Gram Panchayat ya CSC center me sampark karein.'
    },
    {
      id: 'y2',
      name: 'Ration Card',
      desc: 'Sasti dar par anaaj paane ke liye ration card banwayein.',
      apply: 'Block ke khadya vibhag karyalay me aavedan karein.'
    }
  ]
};

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}
function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ================= SAMASYA (Problem reports) ================= */
// Sirf Pradhan (admin) hi complaints ki list dekh sakte hain
app.get('/api/samasya', requireAdmin, (req, res) => {
  res.json(readDB().samasya);
});

// Koi bhi gaon wala samasya darj kar sakta hai — login ki zarurat nahi
app.post('/api/samasya', (req, res) => {
  const { category, desc, name, photo } = req.body;
  if (!category || !desc) return res.status(400).json({ error: 'category aur desc zaruri hai' });
  const db = readDB();
  const item = {
    id: uid(),
    category,
    desc,
    name: name || '',
    photo: photo || null,
    status: 'nayi',
    date: Date.now()
  };
  db.samasya.push(item);
  writeDB(db);
  res.json({ ok: true }); // list wapas nahi bhejte, taaki aam aadmi ko doosron ki complaint na dikhe
});

// Sirf Pradhan status badal sakte hain
app.patch('/api/samasya/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const item = db.samasya.find(s => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'nahi mila' });
  if (req.body.status) item.status = req.body.status;
  writeDB(db);
  res.json(item);
});

// Sirf Pradhan delete kar sakte hain
app.delete('/api/samasya/:id', requireAdmin, (req, res) => {
  const db = readDB();
  db.samasya = db.samasya.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

/* ================= SUCHNA (Announcements) ================= */
app.get('/api/suchna', (req, res) => {
  res.json(readDB().suchna);
});

app.post('/api/suchna', (req, res) => {
  const { title, text, name } = req.body;
  if (!title || !text) return res.status(400).json({ error: 'title aur text zaruri hai' });
  const db = readDB();
  const item = { id: uid(), title, text, name: name || '', date: Date.now() };
  db.suchna.push(item);
  writeDB(db);
  res.json(item);
});

// Sirf Pradhan edit kar sakte hain
app.put('/api/suchna/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const item = db.suchna.find(s => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'nahi mila' });
  if (req.body.title) item.title = req.body.title;
  if (req.body.text) item.text = req.body.text;
  writeDB(db);
  res.json(item);
});

// Sirf Pradhan delete kar sakte hain
app.delete('/api/suchna/:id', requireAdmin, (req, res) => {
  const db = readDB();
  db.suchna = db.suchna.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

/* ================= JAANKARI (Village info) ================= */
app.get('/api/jaankari', (req, res) => {
  res.json(readDB().jaankari);
});

app.put('/api/jaankari', (req, res) => {
  const db = readDB();
  db.jaankari = { ...db.jaankari, ...req.body };
  writeDB(db);
  res.json(db.jaankari);
});

/* ================= YOJANA (Govt schemes) ================= */
app.get('/api/yojana', (req, res) => {
  res.json(readDB().yojana);
});

app.post('/api/yojana', (req, res) => {
  const { name, desc, apply } = req.body;
  if (!name || !desc) return res.status(400).json({ error: 'name aur desc zaruri hai' });
  const db = readDB();
  const item = { id: uid(), name, desc, apply: apply || 'Panchayat karyalay me sampark karein.' };
  db.yojana.push(item);
  writeDB(db);
  res.json(item);
});

app.delete('/api/yojana/:id', (req, res) => {
  const db = readDB();
  db.yojana = db.yojana.filter(y => y.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

/* ================= PRADHAN LOGIN ================= */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Galat password' });
  }
});

app.listen(PORT, () => {
  ensureDB();
  console.log(`✅ Hamara Gaon Portal chal raha hai: http://localhost:${PORT}`);
});
