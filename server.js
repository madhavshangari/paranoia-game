const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ── JSON File Database ──────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data.json');

function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    // Corrupted file, reset
  }
  return { submissions: [], nextId: 1 };
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Initialize DB file if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
  writeDB({ submissions: [], nextId: 1 });
}

// ── God Credentials ─────────────────────────────────────────────────────────
const GOD_ID = 'rudragod';
const GOD_PASSWORD = 'rishikimkc';

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  }
}));

// Auth middleware for god-only routes
function requireGod(req, res, next) {
  if (req.session && req.session.isGod) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. You are not God.' });
}

// ── Player Routes ───────────────────────────────────────────────────────────

// Submit chits (no auth required)
app.post('/api/submit', (req, res) => {
  const { full_name, room_number, object, place } = req.body;

  if (!full_name || !room_number || !object || !place) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDB();

  // Check for duplicate name
  const existing = db.submissions.find(
    s => s.full_name.toLowerCase() === full_name.trim().toLowerCase()
  );
  if (existing) {
    return res.status(409).json({ error: 'You have already submitted your chits.' });
  }

  db.submissions.push({
    id: db.nextId++,
    full_name: full_name.trim(),
    room_number: room_number.trim(),
    object: object.trim(),
    place: place.trim(),
    submitted_at: new Date().toISOString()
  });

  writeDB(db);

  res.json({ success: true, message: 'Your chits have been received. God sees all.' });
});

// ── God Auth Routes ─────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { login_id, password } = req.body;

  if (login_id === GOD_ID && password === GOD_PASSWORD) {
    req.session.isGod = true;
    return res.json({ success: true, message: 'Welcome, God.' });
  }

  return res.status(401).json({ error: 'Invalid credentials. You are not God.' });
});

app.post('/api/logout', requireGod, (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'God has left.' });
});

app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isGod) });
});

// ── God Data Routes ─────────────────────────────────────────────────────────

app.get('/api/submissions', requireGod, (req, res) => {
  const db = readDB();
  const sorted = db.submissions.sort(
    (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
  );
  res.json({ submissions: sorted, total: sorted.length });
});

app.delete('/api/submissions/:id', requireGod, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();

  const index = db.submissions.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  db.submissions.splice(index, 1);
  writeDB(db);

  res.json({ success: true, message: 'Submission deleted.' });
});

app.delete('/api/submissions', requireGod, (req, res) => {
  writeDB({ submissions: [], nextId: 1, game: null });
  res.json({ success: true, message: 'All submissions cleared.' });
});

// ── Game Loop & Shuffle Routes ──────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.post('/api/game/shuffle', requireGod, (req, res) => {
  const db = readDB();
  const subs = db.submissions || [];

  if (subs.length < 3) {
    return res.status(400).json({
      error: `Need at least 3 players to form a Paranoia loop (current: ${subs.length}).`
    });
  }

  // 1. Shuffle players to build a single directed Hamiltonian cycle
  const shuffledPlayers = shuffleArray(subs);
  const n = shuffledPlayers.length;

  // 2. Shuffle objects and places
  let shuffledObjects = shuffleArray(subs.map(s => s.object));
  let shuffledPlaces = shuffleArray(subs.map(s => s.place));

  // Avoid giving players their own object or place when possible
  for (let i = 0; i < n; i++) {
    if (shuffledObjects[i].toLowerCase() === shuffledPlayers[i].object.toLowerCase()) {
      const next = (i + 1) % n;
      [shuffledObjects[i], shuffledObjects[next]] = [shuffledObjects[next], shuffledObjects[i]];
    }
    if (shuffledPlaces[i].toLowerCase() === shuffledPlayers[i].place.toLowerCase()) {
      const next = (i + 1) % n;
      [shuffledPlaces[i], shuffledPlaces[next]] = [shuffledPlaces[next], shuffledPlaces[i]];
    }
  }

  // 3. Build assignments (Player i targets Player (i+1) % n)
  const assignments = shuffledPlayers.map((hunter, i) => {
    const target = shuffledPlayers[(i + 1) % n];
    const weapon = shuffledObjects[i];
    const location = shuffledPlaces[i];

    const dmText = `🔪 *PARANOIA: TOP SECRET ASSIGNMENT* 👁️\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *Your Target:* ${target.full_name} (${target.room_number})\n` +
      `📦 *Murder Weapon:* ${weapon}\n` +
      `📍 *Crime Scene:* ${location}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💀 *HOW TO KILL:*\n` +
      `1. Lure your target to *${location}*.\n` +
      `2. Make them hold the *${weapon}* for 1 full second.\n` +
      `3. They must take it willingly (no force).\n` +
      `4. DM God immediately with: who, when, and where.\n\n` +
      `⚠️ Never reveal your target or that you are playing. Trust no one.`;

    return {
      order: i + 1,
      hunter_name: hunter.full_name,
      hunter_room: hunter.room_number,
      target_name: target.full_name,
      target_room: target.room_number,
      object: weapon,
      place: location,
      dm_text: dmText
    };
  });

  db.game = {
    assignments,
    created_at: new Date().toISOString(),
    player_count: n
  };

  writeDB(db);

  res.json({
    success: true,
    message: `Game successfully randomized into a single ${n}-player loop!`,
    game: db.game
  });
});

app.get('/api/game/assignments', requireGod, (req, res) => {
  const db = readDB();
  res.json({ game: db.game || null });
});

app.post('/api/game/reset', requireGod, (req, res) => {
  const db = readDB();
  db.game = null;
  writeDB(db);
  res.json({ success: true, message: 'Game assignments cleared.' });
});

// ── Page Routes ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/god', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🔪 PARANOIA is live at http://localhost:${PORT}`);
  console.log(`  👁  God's portal:       http://localhost:${PORT}/god\n`);
});
