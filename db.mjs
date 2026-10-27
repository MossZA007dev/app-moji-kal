import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const dbPath = path.join(dataDir, 'moji.db');
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#FF9EB5',
    avatar_face TEXT NOT NULL DEFAULT 'happy',
    calorie_goal INTEGER NOT NULL DEFAULT 2000,
    sugar_goal REAL NOT NULL DEFAULT 25,
    privacy_level TEXT NOT NULL DEFAULT 'full',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    calorie REAL NOT NULL DEFAULT 0,
    sugar REAL NOT NULL DEFAULT 0,
    portion_size TEXT DEFAULT 'normal',
    sweetness_level TEXT DEFAULT 'normal',
    is_private INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    calorie REAL NOT NULL DEFAULT 0,
    sugar REAL NOT NULL DEFAULT 0,
    portion_size TEXT DEFAULT 'normal',
    sweetness_level TEXT DEFAULT 'normal',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    target_days INTEGER NOT NULL DEFAULT 5,
    icon TEXT NOT NULL DEFAULT '🎯',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS challenge_participants (
    challenge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    progress_days INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Group Activities & Social Interactions
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cheers (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    cheer_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Group Verified Dishes Knowledge Cache (Learned from group confirmations)
  CREATE TABLE IF NOT EXISTS verified_dishes (
    name_clean TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    calorie REAL NOT NULL,
    sugar REAL NOT NULL,
    sweetness_level TEXT,
    portion_size TEXT,
    confidence_score INTEGER DEFAULT 1,
    last_verified INTEGER NOT NULL
  );

  -- Daily Goal Achievements Tracker
  CREATE TABLE IF NOT EXISTS daily_goals (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    achieved INTEGER NOT NULL DEFAULT 0,
    score_awarded INTEGER NOT NULL DEFAULT 0,
    goal_type TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Weight Tracking History
  CREATE TABLE IF NOT EXISTS weight_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
  CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date);
`);

// Idempotent column migrations for users table
const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
const neededCols = [
  { name: 'google_id', type: 'TEXT' },
  { name: 'email', type: 'TEXT' },
  { name: 'avatar_image', type: 'TEXT' },
  { name: 'consent_pdpa', type: 'INTEGER DEFAULT 0' },
  { name: 'consent_at', type: 'INTEGER' },
  { name: 'gender', type: 'TEXT DEFAULT "female"' },
  { name: 'age', type: 'INTEGER DEFAULT 25' },
  { name: 'height', type: 'REAL DEFAULT 160' },
  { name: 'weight', type: 'REAL DEFAULT 52' },
  { name: 'activity_level', type: 'TEXT DEFAULT "moderate"' },
  { name: 'avatar_hat', type: 'TEXT DEFAULT "none"' },
  { name: 'avatar_accessory', type: 'TEXT DEFAULT "none"' },
  { name: 'personality', type: 'TEXT DEFAULT "kind"' },
  { name: 'coins', type: 'INTEGER DEFAULT 120' },
  { name: 'goal_type', type: 'TEXT DEFAULT "weight_loss"' },
  { name: 'goal_score', type: 'INTEGER DEFAULT 150' },
  { name: 'target_weight', type: 'REAL' },
  { name: 'carbs_goal', type: 'REAL' },
  { name: 'protein_goal', type: 'REAL' },
  { name: 'fat_goal', type: 'REAL' },
  { name: 'sodium_goal', type: 'REAL DEFAULT 2000' },
  { name: 'water_goal', type: 'INTEGER DEFAULT 8' }
];

for (const col of neededCols) {
  if (!userCols.includes(col.name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
  }
}

// Idempotent column migrations for logs table
const logCols = db.prepare("PRAGMA table_info(logs)").all().map(c => c.name);
const neededLogCols = [
  { name: 'image_url', type: 'TEXT' },
  { name: 'components_json', type: 'TEXT' },
  { name: 'carbs', type: 'REAL' },
  { name: 'protein', type: 'REAL' },
  { name: 'fat', type: 'REAL' },
  { name: 'sodium', type: 'REAL' }
];

for (const col of neededLogCols) {
  if (!logCols.includes(col.name)) {
    db.exec(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type};`);
  }
}

// Seed default users if empty (Prevents FOREIGN KEY constraint error on fresh deploy)
try {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, avatar_hat, personality, coins, goal_type, goal_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    insertUser.run('u1', 'โมจิจัง', '#FF9EB5', 'happy', 1800, 25, 'full', 'crown', 'cheerful', 353, 'weight_loss', 450, now - 86400000 * 3);
    insertUser.run('u2', 'เพื่อนปังปอนด์', '#6FCBB0', 'ok', 2200, 20, 'full', 'none', 'kind', 282, 'sugar_cut', 380, now - 86400000 * 2);
    insertUser.run('u3', 'คุณนัท', '#FFC285', 'worry', 1900, 20, 'summary', 'none', 'kind', 190, 'healthy_balance', 310, now - 86400000 * 1);
  } else {
    // Ensure default users have rich goal presets if empty/default
    try {
      db.prepare("UPDATE users SET goal_type = 'weight_loss', goal_score = 450 WHERE id = 'u1' AND (goal_score IS NULL OR goal_score = 150)").run();
      db.prepare("UPDATE users SET goal_type = 'sugar_cut', goal_score = 380, sugar_goal = 20 WHERE id = 'u2' AND (goal_score IS NULL OR goal_score = 150)").run();
      db.prepare("UPDATE users SET goal_type = 'healthy_balance', goal_score = 310, calorie_goal = 1900, sugar_goal = 20 WHERE id = 'u3' AND (goal_score IS NULL OR goal_score = 150)").run();
    } catch (_) {}
  }
} catch (e) {
  console.warn('Initial users seed warning:', e.message);
}

// Seed default challenges if empty
try {
  const chalCount = db.prepare('SELECT COUNT(*) as c FROM challenges').get().c;
  if (chalCount === 0) {
    const insertChal = db.prepare(`
      INSERT INTO challenges (id, title, description, type, target_days, icon, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertChal.run('c1', 'งดน้ำหวาน 3 วันติด', 'เลือกเครื่องดื่มหวาน 0% หรือดื่มน้ำเปล่าแทนน้ำหวานต่อเนื่อง 3 วัน', 'no_sugar_drink', 3, '🧋', Date.now());
    insertChal.run('c2', 'น้ำตาลไม่เกินเป้า 5 วัน', 'คุมระดับน้ำตาลสะสมต่อวันให้อยู่ในเป้าหมายต่อเนื่อง 5 วัน', 'under_goal_streak', 5, '🎯', Date.now());
    insertChal.run('c3', 'ดื่มน้ำเปล่า 7 วันสม่ำเสมอ', 'ดื่มน้ำเปล่าอย่างน้อยวันละ 1-2 แก้วเพื่อช่วยระบบเผาผลาญ', 'water_daily', 7, '💧', Date.now());
  }
} catch (e) {
  console.warn('Initial challenges seed warning:', e.message);
}

// Seed sample activities if empty
try {
  const actCount = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;
  if (actCount === 0) {
    const insertAct = db.prepare(`
      INSERT INTO activities (id, user_id, type, text, coins, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    insertAct.run('act_1', 'u1', 'meal', 'บันทึกมื้ออาหาร "สุกี้น้ำอกไก่" (+5 🪙)', 5, now - 1800000);
    insertAct.run('act_2', 'u2', 'water', 'ดื่มน้ำเปล่าชื่นใจ 💧 (+2 🪙)', 2, now - 3600000);
    insertAct.run('act_3', 'u3', 'challenge', 'เข้าร่วมชาเลนจ์ "งดน้ำหวาน 3 วันติด" 🎯 (+15 🪙)', 15, now - 7200000);
    insertAct.run('act_4', 'u1', 'streak', 'รักษาสถิติบันทึกต่อเนื่อง 3 วันติด! 🔥 (+10 🪙)', 10, now - 10800000);
  }
} catch (e) {
  console.warn('Initial activities seed warning:', e.message);
}

export function getAllUsers() {
  const stmt = db.prepare("SELECT id, nickname, avatar_color, avatar_face, avatar_hat, avatar_image, personality, COALESCE(coins, 120) as coins, COALESCE(goal_score, 150) as goal_score, COALESCE(goal_type, 'weight_loss') as goal_type, calorie_goal, sugar_goal, privacy_level, consent_pdpa, created_at FROM users ORDER BY created_at ASC");
  return stmt.all();
}

export function getUser(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

export function getUserByGoogleId(googleId) {
  const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
  return stmt.get(googleId);
}

export function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

export function createUser({ id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, google_id, email, avatar_image, consent_pdpa, goal_type, goal_score, personality, avatar_hat, avatar_accessory }) {
  const newId = id || `u_${Date.now()}`;
  const stmt = db.prepare(`
    INSERT INTO users (id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, google_id, email, avatar_image, consent_pdpa, consent_at, avatar_hat, avatar_accessory, personality, goal_type, goal_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    newId,
    nickname || 'โมจิใหม่',
    avatar_color || '#FF9EB5',
    avatar_face || 'happy',
    Math.max(1200, Number(calorie_goal) || 2000),
    Math.max(10, Math.min(60, Number(sugar_goal) || 25)),
    privacy_level || 'full',
    google_id || null,
    email || null,
    avatar_image || null,
    consent_pdpa ? 1 : 0,
    consent_pdpa ? Date.now() : null,
    avatar_hat || 'none',
    avatar_accessory || 'none',
    personality || 'cheerful',
    goal_type || 'weight_loss',
    goal_score !== undefined ? Number(goal_score) : 150,
    Date.now()
  );
  return getUser(newId);
}

export function findOrCreateGoogleUser({ google_id, email, name, picture }) {
  let user = getUserByGoogleId(google_id);
  if (!user && email) {
    user = getUserByEmail(email);
    if (user) {
      db.prepare('UPDATE users SET google_id = ?, avatar_image = COALESCE(avatar_image, ?) WHERE id = ?').run(google_id, picture, user.id);
      return getUser(user.id);
    }
  }

  if (user) return user;

  const colors = ['#FF9EB5', '#6FCBB0', '#FFB05C', '#A78BFA', '#D4A373'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  return createUser({
    nickname: name || 'Google User',
    avatar_color: randomColor,
    avatar_face: 'happy',
    google_id,
    email,
    avatar_image: picture,
    calorie_goal: 2000,
    sugar_goal: 25,
    privacy_level: 'full',
    consent_pdpa: 1
  });
}

export function updateUser(id, data) {
  const current = getUser(id);
  if (!current) return null;

  const nickname = data.nickname ?? current.nickname;
  const avatar_color = data.avatar_color ?? current.avatar_color;
  const avatar_face = data.avatar_face ?? current.avatar_face;
  const avatar_hat = data.avatar_hat ?? current.avatar_hat;
  const avatar_accessory = data.avatar_accessory ?? current.avatar_accessory ?? 'none';
  const personality = data.personality ?? current.personality;
  const calorie_goal = Math.max(1200, Number(data.calorie_goal ?? current.calorie_goal));
  const sugar_goal = Math.max(10, Math.min(60, Number(data.sugar_goal ?? current.sugar_goal)));
  const privacy_level = data.privacy_level ?? current.privacy_level;
  const gender = data.gender ?? current.gender;
  const age = Number(data.age ?? current.age);
  const height = Number(data.height ?? current.height);
  const weight = Number(data.weight ?? current.weight);
  const target_weight = data.target_weight !== undefined ? (data.target_weight !== null && data.target_weight !== '' ? Number(data.target_weight) : null) : current.target_weight;
  const activity_level = data.activity_level ?? current.activity_level;
  const consent_pdpa = data.consent_pdpa !== undefined ? (data.consent_pdpa ? 1 : 0) : current.consent_pdpa;
  const goal_type = data.goal_type ?? current.goal_type ?? 'weight_loss';
  const goal_score = data.goal_score !== undefined ? Number(data.goal_score) : (current.goal_score ?? 150);
  const carbs_goal = data.carbs_goal !== undefined ? (data.carbs_goal !== null && data.carbs_goal !== '' ? Number(data.carbs_goal) : null) : current.carbs_goal;
  const protein_goal = data.protein_goal !== undefined ? (data.protein_goal !== null && data.protein_goal !== '' ? Number(data.protein_goal) : null) : current.protein_goal;
  const fat_goal = data.fat_goal !== undefined ? (data.fat_goal !== null && data.fat_goal !== '' ? Number(data.fat_goal) : null) : current.fat_goal;
  const sodium_goal = data.sodium_goal !== undefined ? (data.sodium_goal !== null && data.sodium_goal !== '' ? Number(data.sodium_goal) : 2000) : (current.sodium_goal ?? 2000);
  const water_goal = data.water_goal !== undefined ? (data.water_goal !== null && data.water_goal !== '' ? Number(data.water_goal) : 8) : (current.water_goal ?? 8);

  const stmt = db.prepare(`
    UPDATE users
    SET nickname = ?, avatar_color = ?, avatar_face = ?, avatar_hat = ?, avatar_accessory = ?, personality = ?,
        calorie_goal = ?, sugar_goal = ?, privacy_level = ?,
        gender = ?, age = ?, height = ?, weight = ?, target_weight = ?, activity_level = ?,
        consent_pdpa = ?, consent_at = CASE WHEN ? = 1 AND consent_at IS NULL THEN ? ELSE consent_at END,
        goal_type = ?, goal_score = ?,
        carbs_goal = ?, protein_goal = ?, fat_goal = ?, sodium_goal = ?, water_goal = ?
    WHERE id = ?
  `);

  stmt.run(
    nickname, avatar_color, avatar_face, avatar_hat, avatar_accessory, personality,
    calorie_goal, sugar_goal, privacy_level,
    gender, age, height, weight, target_weight, activity_level,
    consent_pdpa, consent_pdpa, Date.now(),
    goal_type, goal_score,
    carbs_goal, protein_goal, fat_goal, sodium_goal, water_goal,
    id
  );
  return getUser(id);
}

export function deleteUserAndData(userId) {
  db.prepare('DELETE FROM logs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM weight_logs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM ai_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM challenge_participants WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
  return db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// Weight Tracking Functions
export function addWeightLog({ userId, date, weight, note = '' }) {
  const numWeight = Math.round(Number(weight) * 10) / 10;
  const logDate = date || new Date().toISOString().slice(0, 10);
  
  // Check if log already exists for this date
  const existing = db.prepare('SELECT * FROM weight_logs WHERE user_id = ? AND date = ?').get(userId, logDate);
  const id = existing ? existing.id : (`wlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  if (existing) {
    db.prepare('UPDATE weight_logs SET weight = ?, note = ?, created_at = ? WHERE id = ?').run(numWeight, note, Date.now(), id);
  } else {
    db.prepare('INSERT INTO weight_logs (id, user_id, date, weight, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, logDate, numWeight, note, Date.now());
  }

  // Update current user's weight to this value
  db.prepare('UPDATE users SET weight = ? WHERE id = ?').run(numWeight, userId);

  return { id, user_id: userId, date: logDate, weight: numWeight, note, created_at: Date.now() };
}

export function getWeightLogs(userId, limit = 60) {
  return db.prepare('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY date ASC LIMIT ?').all(userId, limit);
}

export function deleteWeightLog(id, userId) {
  return db.prepare('DELETE FROM weight_logs WHERE id = ? AND user_id = ?').run(id, userId);
}

// AI Rate Limiting
export function getAiQuota(userId, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const stmt = db.prepare('SELECT call_count FROM ai_usage WHERE user_id = ? AND date = ?');
  const row = stmt.get(userId, date);
  return row ? row.call_count : 0;
}

export function checkAndIncrementAiQuota(userId, limit = 15) {
  const date = new Date().toISOString().slice(0, 10);
  const currentCount = getAiQuota(userId, date);

  if (currentCount >= limit) {
    return { allowed: false, current: currentCount, limit };
  }

  const id = `ai_${userId}_${date}`;
  const stmt = db.prepare(`
    INSERT INTO ai_usage (id, user_id, date, call_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET call_count = call_count + 1
  `);
  stmt.run(id, userId, date);

  return { allowed: true, current: currentCount + 1, limit };
}

// Convenience helper for internal calls
export function getLogs(userId, date) {
  return getLogsSecure(userId, userId, date);
}

// Privacy-Enforced Secure Log Fetching
export function getLogsSecure(targetUserId, requesterId, date) {
  const targetUser = getUser(targetUserId);
  if (!targetUser) return [];

  // If requester is owner, always return all logs
  if (requesterId === targetUserId) {
    if (date) {
      return db.prepare('SELECT * FROM logs WHERE user_id = ? AND date = ? ORDER BY created_at DESC').all(targetUserId, date);
    }
    return db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC').all(targetUserId);
  }

  // Requester is a different person: strictly respect privacy setting
  if (targetUser.privacy_level === 'summary' || targetUser.privacy_level === 'private') {
    return []; // Completely blocked from seeing individual meal names, calories, or photos!
  }

  // If targetUser set 'full', mask any meal marked is_private = 1
  const rawLogs = date
    ? db.prepare('SELECT id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components_json, created_at FROM logs WHERE user_id = ? AND date = ? ORDER BY created_at DESC').all(targetUserId, date)
    : db.prepare('SELECT id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components_json, created_at FROM logs WHERE user_id = ? ORDER BY created_at DESC').all(targetUserId);

  return rawLogs.map(l => {
    if (l.is_private) {
      return {
        id: l.id,
        user_id: l.user_id,
        date: l.date,
        name: '🔒 เมนูส่วนตัว',
        calorie: l.calorie,
        sugar: l.sugar,
        carbs: 0,
        protein: 0,
        fat: 0,
        sodium: 0,
        portion_size: l.portion_size,
        sweetness_level: l.sweetness_level,
        is_private: 1,
        created_at: l.created_at
      };
    }
    return l;
  });
}

export function addLog({ userId, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components, components_json }) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const compStr = typeof components_json === 'string'
    ? components_json
    : (Array.isArray(components) || (typeof components === 'object' && components !== null))
    ? JSON.stringify(components)
    : (Array.isArray(components_json) ? JSON.stringify(components_json) : null);

  const stmt = db.prepare(`
    INSERT INTO logs (id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    userId,
    targetDate,
    name,
    Math.max(0, Number(calorie) || 0),
    Math.max(0, Number(sugar) || 0),
    carbs !== undefined && carbs !== null ? Number(carbs) : null,
    protein !== undefined && protein !== null ? Number(protein) : null,
    fat !== undefined && fat !== null ? Number(fat) : null,
    sodium !== undefined && sodium !== null ? Number(sodium) : null,
    portion_size || 'normal',
    sweetness_level || 'normal',
    is_private ? 1 : 0,
    image_url || null,
    compStr,
    Date.now()
  );

  // Learn into Group Verified Knowledge Cache if valid name and values
  recordVerifiedDish({
    name,
    calorie: Math.max(0, Number(calorie) || 0),
    sugar: Math.max(0, Number(sugar) || 0),
    sweetness_level,
    portion_size
  });

  // Award 5 coins and log activity (Coins & Activity Dashboard)
  const actText = is_private ? 'บันทึกมื้ออาหาร 🔒 (+5 🪙)' : `บันทึกมื้ออาหาร "${name}" (+5 🪙)`;
  recordActivity(userId, 'meal', actText, 5);

  // Sync daily goal score
  try {
    syncDailyGoalScore(userId, targetDate);
  } catch (err) {
    console.error('Goal sync error on addLog:', err);
  }

  return db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
}

export function deleteLog(id, userId) {
  const log = db.prepare('SELECT * FROM logs WHERE id = ? AND user_id = ?').get(id, userId);
  if (!log) return null;
  db.prepare('DELETE FROM logs WHERE id = ? AND user_id = ?').run(id, userId);
  try {
    syncDailyGoalScore(userId, log.date);
  } catch (err) {
    console.error('Goal sync error on deleteLog:', err);
  }
  return log; // Return deleted log data for Undo functionality
}

export function restoreDeletedLog(log) {
  if (!log || !log.id) return null;
  const stmt = db.prepare(`
    INSERT INTO logs (id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    log.id,
    log.user_id,
    log.date,
    log.name,
    log.calorie,
    log.sugar,
    log.carbs !== undefined && log.carbs !== null ? Number(log.carbs) : null,
    log.protein !== undefined && log.protein !== null ? Number(log.protein) : null,
    log.fat !== undefined && log.fat !== null ? Number(log.fat) : null,
    log.sodium !== undefined && log.sodium !== null ? Number(log.sodium) : null,
    log.portion_size || 'normal',
    log.sweetness_level || 'normal',
    log.is_private ? 1 : 0,
    log.image_url || null,
    log.components_json || null,
    log.created_at || Date.now()
  );
  try {
    syncDailyGoalScore(log.user_id, log.date);
  } catch (err) {
    console.error('Goal sync error on restoreDeletedLog:', err);
  }
  return log;
}

// Group Verified Knowledge Cache (Point 3)
export function recordVerifiedDish({ name, calorie, sugar, sweetness_level, portion_size }) {
  if (!name || name.trim().length < 2) return;
  const clean = name.trim().toLowerCase();
  const stmt = db.prepare(`
    INSERT INTO verified_dishes (name_clean, display_name, calorie, sugar, sweetness_level, portion_size, confidence_score, last_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(name_clean) DO UPDATE SET
      calorie = (calorie + excluded.calorie) / 2,
      sugar = (sugar + excluded.sugar) / 2,
      confidence_score = confidence_score + 1,
      last_verified = excluded.last_verified
  `);
  stmt.run(clean, name.trim(), calorie, sugar, sweetness_level || 'normal', portion_size || 'normal', Date.now());
}

export function lookupVerifiedDish(query) {
  if (!query) return null;
  const clean = query.trim().toLowerCase();
  const direct = db.prepare('SELECT * FROM verified_dishes WHERE name_clean = ?').get(clean);
  if (direct) return direct;

  // Substring match
  const stmt = db.prepare("SELECT * FROM verified_dishes WHERE ? LIKE ('%' || name_clean || '%') ORDER BY confidence_score DESC LIMIT 1");
  return stmt.get(clean);
}

// Automatic Weekly Backup System (Point 2)
export function runAutoBackup() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(backupsDir, `backup_${todayStr}.json`);

  // Only backup once per week
  try {
    const existing = fs.readdirSync(backupsDir);
    const hasRecent = existing.some(f => {
      const parts = f.match(/backup_(\d{4}-\d{2}-\d{2})\.json/);
      if (parts) {
        const diffDays = (new Date(todayStr) - new Date(parts[1])) / (1000 * 3600 * 24);
        return diffDays < 7;
      }
      return false;
    });

    if (!hasRecent) {
      const dump = {
        exported_at: new Date().toISOString(),
        users: db.prepare('SELECT id, nickname, calorie_goal, sugar_goal, privacy_level, created_at FROM users').all(),
        logs: db.prepare('SELECT * FROM logs').all(),
        favorites: db.prepare('SELECT * FROM favorites').all(),
        verified_dishes: db.prepare('SELECT * FROM verified_dishes').all()
      };
      fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf-8');
      console.log(`[Backup] Automated weekly backup saved to ${backupFile}`);
    }
  } catch (err) {
    console.error('[Backup Error]:', err);
  }
}

// Run backup check on initialization
runAutoBackup();

// Streak Calculation
export function calculateUserStreak(userId) {
  const stmt = db.prepare('SELECT DISTINCT date FROM logs WHERE user_id = ? ORDER BY date DESC');
  const rows = stmt.all(userId);
  if (!rows.length) return { current: 0, best: 0 };

  const dates = rows.map(r => r.date);
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  let streak = 0;
  let checkDate = new Date();

  if (!dates.includes(today)) {
    if (!dates.includes(yesterday)) {
      return { current: 0, best: dates.length };
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const ds = checkDate.toISOString().slice(0, 10);
    if (dates.includes(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { current: streak, best: Math.max(streak, dates.length) };
}

// Favorites
export function getFavorites(userId) {
  const stmt = db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId);
}

export function addFavorite({ userId, name, calorie, sugar, portion_size, sweetness_level }) {
  const id = `fav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const stmt = db.prepare(`
    INSERT INTO favorites (id, user_id, name, calorie, sugar, portion_size, sweetness_level, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    userId,
    name,
    Math.max(0, Number(calorie) || 0),
    Math.max(0, Number(sugar) || 0),
    portion_size || 'normal',
    sweetness_level || 'normal',
    Date.now()
  );
  return db.prepare('SELECT * FROM favorites WHERE id = ?').get(id);
}

export function deleteFavorite(id, userId) {
  const stmt = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');
  return stmt.run(id, userId);
}

// Challenges
export function getChallenges(userId) {
  const allChal = db.prepare('SELECT * FROM challenges ORDER BY created_at ASC').all();
  const userParts = db.prepare('SELECT * FROM challenge_participants WHERE user_id = ?').all(userId);

  return allChal.map(c => {
    const part = userParts.find(p => p.challenge_id === c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      target_days: c.target_days,
      icon: c.icon,
      is_joined: Boolean(part),
      progress_days: part ? part.progress_days : 0,
      is_completed: part ? Boolean(part.is_completed) : false
    };
  });
}

export function joinChallenge(challengeId, userId) {
  const stmt = db.prepare(`
    INSERT INTO challenge_participants (challenge_id, user_id, progress_days, is_completed, joined_at)
    VALUES (?, ?, 1, 0, ?)
    ON CONFLICT(challenge_id, user_id) DO UPDATE SET joined_at = joined_at
  `);
  stmt.run(challengeId, userId, Date.now());
  const chal = db.prepare('SELECT title FROM challenges WHERE id = ?').get(challengeId);
  recordActivity(userId, 'challenge', `เข้าร่วมชาเลนจ์ "${chal?.title || 'ใหม่'}" 🎯 (+15 🪙)`, 15);
  return getChallenges(userId);
}

export function leaveChallenge(challengeId, userId) {
  const stmt = db.prepare('DELETE FROM challenge_participants WHERE challenge_id = ? AND user_id = ?');
  stmt.run(challengeId, userId);
  return getChallenges(userId);
}

// Monthly Calendar Log Aggregation
export function getMonthlyCalendar(userId, yearMonthStr) {
  const ym = yearMonthStr || new Date().toISOString().slice(0, 7);
  const user = getUser(userId);
  const goalSugar = user ? user.sugar_goal : 25;
  const goalCal = user ? user.calorie_goal : 2000;

  const stmt = db.prepare(`
    SELECT date, SUM(calorie) as total_cal, SUM(sugar) as total_sugar, COUNT(*) as meal_count
    FROM logs
    WHERE user_id = ? AND date LIKE ?
    GROUP BY date
    ORDER BY date ASC
  `);
  const rows = stmt.all(userId, `${ym}%`);

  const daysMap = {};
  for (const r of rows) {
    const isOverSugar = r.total_sugar > goalSugar;
    const isNearSugar = r.total_sugar >= goalSugar * 0.85;
    daysMap[r.date] = {
      date: r.date,
      total_cal: Math.round(r.total_cal),
      total_sugar: Math.round(r.total_sugar * 10) / 10,
      meal_count: r.meal_count,
      status: isOverSugar ? 'alert' : isNearSugar ? 'warn' : 'ok'
    };
  }

  return { ym, goalSugar, goalCal, days: daysMap };
}

// Chat Messages
export function getChatMessages(userId, limit = 30) {
  const stmt = db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?');
  return stmt.all(userId, limit);
}

export function saveChatMessage({ userId, role, content }) {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const stmt = db.prepare('INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, userId, role, content, Date.now());
  return { id, role, content };
}

// ----------------------------------------------------
// Personalized Goal Achievement & Score System
// ----------------------------------------------------

export function evaluateUserGoalToday(user, targetDate) {
  const date = targetDate || new Date().toISOString().slice(0, 10);
  const logs = db.prepare('SELECT calorie, sugar FROM logs WHERE user_id = ? AND date = ?').all(user.id, date);
  const mealCount = logs.length;
  const totalCal = logs.reduce((sum, l) => sum + (Number(l.calorie) || 0), 0);
  const totalSugar = logs.reduce((sum, l) => sum + (Number(l.sugar) || 0), 0);

  const goalType = user.goal_type || 'weight_loss';
  const calGoal = Number(user.calorie_goal) || 2000;
  const sugGoal = Number(user.sugar_goal) || 25;

  let achieved = false;
  let statusText = '';
  let goalLabel = '';
  let badgeIcon = '🎯';
  let targetVal = 0;
  let currentVal = 0;
  let unit = '';
  let progressPercent = 0;

  switch (goalType) {
    case 'sugar_cut':
      badgeIcon = '🧋';
      goalLabel = `ลดน้ำตาล (< ${sugGoal}g/วัน)`;
      targetVal = sugGoal;
      currentVal = Math.round(totalSugar * 10) / 10;
      unit = 'g';
      progressPercent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
      if (mealCount === 0) {
        statusText = 'ยังไม่เริ่มบันทึก';
      } else if (totalSugar <= sugGoal) {
        achieved = true;
        const left = Math.max(0, Math.round((sugGoal - totalSugar) * 10) / 10);
        statusText = `คุมหวานเป๊ะ! (${currentVal}/${targetVal}g เหลืออีก ${left}g)`;
      } else {
        const over = Math.round((totalSugar - sugGoal) * 10) / 10;
        statusText = `เกินเป้าน้ำตาล +${over}g`;
      }
      break;

    case 'healthy_balance':
      badgeIcon = '🥗';
      goalLabel = `สมดุล (< ${calGoal} kcal, < ${sugGoal}g)`;
      targetVal = calGoal;
      currentVal = Math.round(totalCal);
      unit = 'kcal';
      progressPercent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
      if (mealCount === 0) {
        statusText = 'ยังไม่เริ่มบันทึก';
      } else if (totalCal <= calGoal && totalSugar <= sugGoal) {
        achieved = true;
        statusText = `สมดุลเป๊ะทั้งแคล & น้ำตาล! 🎉`;
      } else if (totalCal > calGoal && totalSugar > sugGoal) {
        statusText = `เกินทั้งแคลและน้ำตาล`;
      } else if (totalCal > calGoal) {
        statusText = `เกินเป้าแคล +${Math.round(totalCal - calGoal)} kcal`;
      } else {
        statusText = `เกินเป้าน้ำตาล +${Math.round((totalSugar - sugGoal) * 10) / 10}g`;
      }
      break;

    case 'muscle_gain':
      badgeIcon = '💪';
      goalLabel = `สร้างกล้าม (≥ ${calGoal} kcal, < ${sugGoal}g)`;
      targetVal = calGoal;
      currentVal = Math.round(totalCal);
      unit = 'kcal';
      progressPercent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
      if (mealCount === 0) {
        statusText = 'ยังไม่เริ่มบันทึก';
      } else if (totalCal >= calGoal && totalSugar <= sugGoal) {
        achieved = true;
        statusText = `กินถึงเป้าพลังงานลีน! 💪`;
      } else if (totalCal < calGoal) {
        statusText = `ขาดพลังงานอีก ${Math.round(calGoal - totalCal)} kcal`;
      } else {
        statusText = `น้ำตาลเกินเกณฑ์`;
      }
      break;

    case 'weight_loss':
    default:
      badgeIcon = '🏃‍♂️';
      goalLabel = `ลดน้ำหนัก (< ${calGoal} kcal/วัน)`;
      targetVal = calGoal;
      currentVal = Math.round(totalCal);
      unit = 'kcal';
      progressPercent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
      if (mealCount === 0) {
        statusText = 'ยังไม่เริ่มบันทึก';
      } else if (totalCal <= calGoal) {
        achieved = true;
        const left = calGoal - Math.round(totalCal);
        statusText = `คุมแคลสำเร็จ! (${currentVal}/${targetVal} เหลือ ${left} kcal)`;
      } else {
        const over = Math.round(totalCal - calGoal);
        statusText = `เกินเป้าแคล +${over} kcal`;
      }
      break;
  }

  return {
    achieved,
    meal_count: mealCount,
    goal_type: goalType,
    goal_label: goalLabel,
    badge_icon: badgeIcon,
    target_val: targetVal,
    current_val: currentVal,
    unit,
    progress_percent: progressPercent,
    status_text: statusText,
    total_cal: Math.round(totalCal),
    total_sugar: Math.round(totalSugar * 10) / 10
  };
}

export function syncDailyGoalScore(userId, targetDate) {
  const user = getUser(userId);
  if (!user) return;
  const date = targetDate || new Date().toISOString().slice(0, 10);
  const evalResult = evaluateUserGoalToday(user, date);

  const existing = db.prepare('SELECT * FROM daily_goals WHERE user_id = ? AND date = ?').get(userId, date);

  if (evalResult.achieved) {
    if (!existing || existing.achieved === 0) {
      // Award 50 points and 10 coins
      const bonusPoints = 50;
      const bonusCoins = 10;
      db.prepare('UPDATE users SET goal_score = COALESCE(goal_score, 150) + ?, coins = COALESCE(coins, 120) + ? WHERE id = ?')
        .run(bonusPoints, bonusCoins, userId);

      db.prepare(`
        INSERT INTO daily_goals (user_id, date, achieved, score_awarded, goal_type, updated_at)
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET achieved = 1, score_awarded = ?, goal_type = ?, updated_at = ?
      `).run(userId, date, bonusPoints, evalResult.goal_type, Date.now(), bonusPoints, evalResult.goal_type, Date.now());

      recordActivity(userId, 'goal', `🎯 พิชิตเป้าหมาย "${evalResult.goal_label}" สำเร็จวันนี้! (+${bonusPoints} คะแนนวินัย, +${bonusCoins} 🪙)`, 0);
    }
  } else {
    // If it was previously marked achieved, but now exceeded
    if (existing && existing.achieved === 1) {
      const revoked = existing.score_awarded || 50;
      db.prepare('UPDATE users SET goal_score = MAX(0, COALESCE(goal_score, 150) - ?) WHERE id = ?').run(revoked, userId);
      db.prepare('UPDATE daily_goals SET achieved = 0, score_awarded = 0, updated_at = ? WHERE user_id = ? AND date = ?').run(Date.now(), userId, date);
    }
  }

  return evalResult;
}

export function getGroupFeed(date, currentUserId) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const users = getAllUsers();

  const userLogsStmt = db.prepare('SELECT * FROM logs WHERE date = ? ORDER BY created_at DESC');
  const allLogsForDate = userLogsStmt.all(targetDate);

  return users.map(user => {
    const userLogs = allLogsForDate.filter(l => l.user_id === user.id);
    const totalCal = userLogs.reduce((acc, l) => acc + l.calorie, 0);
    const totalSugar = userLogs.reduce((acc, l) => acc + l.sugar, 0);
    const isMe = user.id === currentUserId;
    const streak = calculateUserStreak(user.id);
    const todayGoal = evaluateUserGoalToday(user, targetDate);

    let visibleMeals = [];
    if (isMe || user.privacy_level === 'full') {
      visibleMeals = userLogs.map(l => ({
        id: l.id,
        name: (!isMe && l.is_private) ? '🔒 เมนูส่วนตัว' : l.name,
        calorie: l.calorie,
        sugar: l.sugar,
        created_at: l.created_at,
        is_private: l.is_private,
        image_url: (!isMe && l.is_private) ? null : l.image_url,
        components_json: (!isMe && l.is_private) ? null : l.components_json
      }));
    } else if (user.privacy_level === 'summary') {
      visibleMeals = [];
    } else if (user.privacy_level === 'private' && !isMe) {
      return null;
    }

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar_color: user.avatar_color,
        avatar_face: user.avatar_face,
        avatar_hat: user.avatar_hat,
        personality: user.personality,
        avatar_image: user.avatar_image,
        calorie_goal: user.calorie_goal,
        sugar_goal: user.sugar_goal,
        goal_type: user.goal_type || 'weight_loss',
        goal_score: user.goal_score ?? 150,
        privacy_level: user.privacy_level,
        is_me: isMe,
        streak: streak.current
      },
      stats: {
        calorie: Math.round(totalCal * 10) / 10,
        sugar: Math.round(totalSugar * 10) / 10,
        meal_count: userLogs.length,
        calorie_percent: Math.round((totalCal / user.calorie_goal) * 100),
        sugar_percent: Math.round((totalSugar / user.sugar_goal) * 100),
      },
      today_goal: todayGoal,
      meals: visibleMeals
    };
  }).filter(Boolean);
}

export function exportUserCsv(userId) {
  const user = getUser(userId);
  if (!user) return '';
  const stmt = db.prepare('SELECT date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, created_at FROM logs WHERE user_id = ? ORDER BY date DESC, created_at DESC');
  const rows = stmt.all(userId);

  const headers = ['วันที่', 'ชื่อเมนู', 'แคลอรี (kcal)', 'น้ำตาล (g)', 'คาร์บ (g)', 'โปรตีน (g)', 'ไขมัน (g)', 'โซเดียม (mg)', 'ขนาด', 'ระดับความหวาน', 'เวลาบันทึก'];
  const csvLines = [headers.join(',')];

  for (const r of rows) {
    const time = new Date(r.created_at).toLocaleTimeString('th-TH');
    csvLines.push([
      `"${r.date}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      r.calorie,
      r.sugar,
      r.carbs || 0,
      r.protein || 0,
      r.fat || 0,
      r.sodium || 0,
      `"${r.portion_size}"`,
      `"${r.sweetness_level}"`,
      `"${time}"`
    ].join(','));
  }

  return '\uFEFF' + csvLines.join('\n');
}

// ----------------------------------------------------
// Social Dashboard, Coins, Leaderboard & Member Details
// ----------------------------------------------------

export function addCoins(userId, amount) {
  db.prepare('UPDATE users SET coins = MAX(0, COALESCE(coins, 120) + ?) WHERE id = ?').run(amount, userId);
  return getUser(userId);
}

export function recordActivity(userId, type, text, coins = 0) {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stmt = db.prepare(`
    INSERT INTO activities (id, user_id, type, text, coins, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, type, text, coins, Date.now());
  if (coins > 0) {
    addCoins(userId, coins);
  }
  return { id, userId, type, text, coins, created_at: Date.now() };
}

export function getRecentActivities(limit = 20) {
  const stmt = db.prepare(`
    SELECT a.id, a.user_id, a.type, a.text, a.coins, a.created_at,
           u.nickname, u.avatar_color, u.avatar_face, u.avatar_hat, u.avatar_image, u.privacy_level
    FROM activities a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getLeaderboard(sortBy = 'goal') {
  const isCoins = sortBy === 'coins';
  const orderCol = isCoins ? 'coins DESC' : 'COALESCE(goal_score, 150) DESC, coins DESC';
  const users = db.prepare(`
    SELECT id, nickname, avatar_color, avatar_face, avatar_hat, avatar_image, personality,
           COALESCE(coins, 120) as coins,
           COALESCE(goal_score, 150) as goal_score,
           COALESCE(goal_type, 'weight_loss') as goal_type,
           calorie_goal, sugar_goal, privacy_level, created_at
    FROM users
    ORDER BY ${orderCol}
  `).all();

  const todayDate = new Date().toISOString().slice(0, 10);
  return users.map((u, idx) => {
    const streak = calculateUserStreak(u.id);
    const mealsToday = db.prepare('SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date = ?').get(u.id, todayDate)?.c || 0;
    const todayGoal = evaluateUserGoalToday(u, todayDate);
    return {
      rank: idx + 1,
      ...u,
      streak: streak.current,
      mealsToday,
      todayGoal
    };
  });
}

export function getMemberDetail(targetUserId, requesterId) {
  const user = getUser(targetUserId);
  if (!user) return null;

  const streak = calculateUserStreak(targetUserId);
  const todayDate = new Date().toISOString().slice(0, 10);
  const logs = getLogsSecure(targetUserId, requesterId, todayDate);
  const totalMeals = db.prepare('SELECT COUNT(*) as c FROM logs WHERE user_id = ?').get(targetUserId)?.c || 0;
  const cheersReceived = db.prepare('SELECT COUNT(*) as c FROM cheers WHERE to_user_id = ?').get(targetUserId)?.c || 0;
  const todayGoal = evaluateUserGoalToday(user, todayDate);

  const goalTypeNames = {
    weight_loss: 'ลดน้ำหนัก',
    sugar_cut: 'ลดน้ำตาล',
    healthy_balance: 'สมดุลสุขภาพ',
    muscle_gain: 'สร้างกล้ามเนื้อ'
  };

  const badges = [
    { id: 'b_join', title: 'สมาชิกแก๊งโมจิ 🍡', desc: 'ร่วมเดินทางสร้างนิสัยสุขภาพดี', unlocked: true },
    { id: 'b_goal', title: `เป้าหมาย: ${goalTypeNames[user.goal_type] || 'ลดน้ำหนัก'} 🎯`, desc: todayGoal.goal_label, unlocked: true },
    { id: 'b_score', title: 'วินัยยอดเยี่ยม 🌟', desc: 'สะสมคะแนนวินัยเป้าหมาย 300 คะแนนขึ้นไป', unlocked: (user.goal_score || 0) >= 300 },
    { id: 'b_coins', title: 'เศรษฐีคอยน์ 🪙', desc: 'สะสมโมจิคอยน์ครบ 150 เหรียญ', unlocked: (user.coins || 0) >= 150 },
    { id: 'b_streak3', title: 'ไฟแรง 3 วันติด 🔥', desc: 'บันทึกต่อเนื่องไม่ขาดตอน 3 วัน', unlocked: streak.current >= 3 },
    { id: 'b_streak7', title: 'แชมป์ความสม่ำเสมอ 🏆', desc: 'บันทึกต่อเนื่อง 7 วันขึ้นไป', unlocked: streak.current >= 7 },
    { id: 'b_meals5', title: 'นักชิมตัวจริง 🍱', desc: 'บันทึกมื้ออาหารสะสม 5 มื้อขึ้นไป', unlocked: totalMeals >= 5 },
    { id: 'b_cheered', title: 'ขวัญใจเพื่อนๆ 💖', desc: 'ได้รับกำลังใจจากเพื่อนสะสม', unlocked: cheersReceived >= 1 }
  ];

  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_color: user.avatar_color,
      avatar_face: user.avatar_face,
      avatar_hat: user.avatar_hat,
      avatar_image: user.avatar_image,
      personality: user.personality,
      coins: user.coins || 120,
      goal_score: user.goal_score || 150,
      goal_type: user.goal_type || 'weight_loss',
      calorie_goal: user.calorie_goal,
      sugar_goal: user.sugar_goal,
      privacy_level: user.privacy_level,
      created_at: user.created_at,
      is_me: targetUserId === requesterId
    },
    todayGoal,
    stats: {
      streak: streak.current,
      bestStreak: streak.best,
      totalMeals,
      cheersReceived
    },
    badges,
    todayMeals: logs
  };
}

export function sendCheer(fromUserId, toUserId, cheerType = 'heart') {
  const fromUser = getUser(fromUserId);
  const toUser = getUser(toUserId);
  if (!fromUser || !toUser) return null;

  const cheerLabels = {
    heart: '💖 ส่งหัวใจ',
    hi5: '✋ แปะมือไฮไฟฟ์',
    mochi: '🍡 ส่งขนมโมจิ',
    fire: '🔥 ส่งพลังไฟสู้ๆ',
    clap: '👏 ปรบมือรัวๆ'
  };
  const label = cheerLabels[cheerType] || '💖 ส่งกำลังใจ';

  const id = `cheer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO cheers (id, from_user_id, to_user_id, cheer_type, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id, fromUserId, toUserId, cheerType, Date.now()
  );

  recordActivity(fromUserId, 'cheer', `ส่งกำลังใจ "${label}" ให้ ${toUser.nickname} (+2 🪙)`, 2);
  addCoins(toUserId, 3); // recipient gets +3 coins!

  return {
    success: true,
    fromNickname: fromUser.nickname,
    toNickname: toUser.nickname,
    cheerType,
    label
  };
}
