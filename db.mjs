import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const dbPath = path.join(dataDir, 'moji.db');
const db = new DatabaseSync(dbPath);
export { db };

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

  -- Social Feed Reactions (Likes & Cheer Comments like Instagram)
  CREATE TABLE IF NOT EXISTS post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL DEFAULT 'heart',
    comment_text TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id);

  -- Gamified Quest Claims (Daily, Weekly, Main Tasks)
  CREATE TABLE IF NOT EXISTS quest_claims (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    period_key TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    UNIQUE(user_id, quest_id, period_key)
  );
  CREATE INDEX IF NOT EXISTS idx_quest_claims_user ON quest_claims(user_id);

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

  -- In-App & Push Notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT DEFAULT '🔔',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action TEXT,
    action_label TEXT,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
  CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications(user_id, created_at DESC);

  -- Prank Cards & Mischief System
  CREATE TABLE IF NOT EXISTS pranks (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    card_name TEXT NOT NULL,
    card_icon TEXT NOT NULL,
    card_effect TEXT NOT NULL,
    prank_note TEXT,
    extra_data TEXT,
    is_active INTEGER DEFAULT 1,
    is_cleared INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pranks_to_user ON pranks(to_user_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_pranks_created_at ON pranks(created_at DESC);
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
  { name: 'water_goal', type: 'INTEGER DEFAULT 8' },
  { name: 'water_bottle_ml', type: 'INTEGER DEFAULT 500' },
  { name: 'water_bottle_name', type: 'TEXT DEFAULT "ขวดน้ำพกพา 500 ml"' },
  { name: 'water_bottle_icon', type: 'TEXT DEFAULT "bottle_500"' },
  { name: 'water_daily_target_ml', type: 'INTEGER DEFAULT 2000' },
  { name: 'water_bottle_setup', type: 'INTEGER DEFAULT 0' },
  { name: 'unlocked_items', type: 'TEXT DEFAULT "[]"' },
  { name: 'role', type: 'TEXT DEFAULT "user"' },
  { name: 'is_dev', type: 'INTEGER DEFAULT 0' },
  { name: 'pin', type: 'TEXT' }
];

for (const col of neededCols) {
  if (!userCols.includes(col.name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
  }
}

// Ensure primary user or developers have role = 'dev' and is_dev = 1
try {
  db.exec(`
    UPDATE users 
    SET role = 'dev', is_dev = 1 
    WHERE id = 'u1' 
       OR nickname = 'มอส' 
       OR email LIKE '%moss%' 
       OR nickname LIKE '%dev%';
  `);
} catch (_) {}

// Idempotent column migrations for logs table
const logCols = db.prepare("PRAGMA table_info(logs)").all().map(c => c.name);
const neededLogCols = [
  { name: 'image_url', type: 'TEXT' },
  { name: 'components_json', type: 'TEXT' },
  { name: 'carbs', type: 'REAL' },
  { name: 'protein', type: 'REAL' },
  { name: 'fat', type: 'REAL' },
  { name: 'sodium', type: 'REAL' },
  { name: 'water_ml', type: 'INTEGER' }
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
      INSERT INTO users (id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, avatar_hat, personality, coins, goal_type, goal_score, role, is_dev, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    insertUser.run('u1', 'มอส', '#FF9EB5', 'happy', 2000, 25, 'full', 'none', 'kind', 120, 'weight_loss', 150, 'dev', 1, now);
  }
  // Clean up legacy demo users so the app is 100% clean for real production use
  db.prepare("DELETE FROM users WHERE id IN ('u2', 'u3', 'u_1793104988179')").run();
  db.prepare("DELETE FROM activities WHERE user_id IN ('u2', 'u3', 'u_1793104988179')").run();
  db.prepare("DELETE FROM logs WHERE user_id IN ('u2', 'u3', 'u_1793104988179')").run();
  db.prepare("DELETE FROM daily_goals WHERE user_id IN ('u2', 'u3', 'u_1793104988179')").run();
  try { db.prepare("DELETE FROM weight_logs WHERE user_id IN ('u2', 'u3', 'u_1793104988179')").run(); } catch (_) {}
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

export function clearAllDemoData() {
  db.prepare('DELETE FROM logs').run();
  db.prepare('DELETE FROM weight_logs').run();
  db.prepare('DELETE FROM chat_messages').run();
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM cheers').run();
  db.prepare('DELETE FROM daily_goals').run();
  db.prepare('DELETE FROM favorites').run();
  db.prepare('DELETE FROM challenge_participants').run();
  db.prepare('DELETE FROM verified_dishes').run();
  db.prepare('DELETE FROM ai_usage').run();

  // Reset primary user stats to clean initial production state while preserving personal health profile
  const existingU1 = db.prepare("SELECT * FROM users WHERE id = 'u1' OR nickname = 'มอส'").get();
  if (existingU1) {
    db.prepare(`
      UPDATE users 
      SET nickname = 'มอส',
          coins = 120, 
          goal_score = 150, 
          avatar_hat = 'none', 
          avatar_accessory = 'none', 
          unlocked_items = '[]',
          role = 'dev',
          is_dev = 1
      WHERE id = ?
    `).run(existingU1.id);
  } else {
    const now = Date.now();
    db.prepare(`
      INSERT INTO users (id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, avatar_hat, personality, coins, goal_type, goal_score, role, is_dev, created_at)
      VALUES ('u1', 'มอส', '#FF9EB5', 'happy', 2000, 25, 'full', 'none', 'kind', 120, 'weight_loss', 150, 'dev', 1, ?)
    `).run(now);
  }

  // Delete only legacy demo users and test accounts (preserve real friend accounts)
  db.prepare("DELETE FROM users WHERE id IN ('u2', 'u3', 'u_1793104988179') OR nickname IN ('ต้นกล้า', 'แพรว', 'กานต์', 'โมจิจัง')").run();

  return { success: true, message: 'ล้างข้อมูลทดสอบทั้งหมดเรียบร้อยแล้ว' };
}

export function getAllUsers() {
  const stmt = db.prepare("SELECT * FROM users ORDER BY created_at ASC");
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

export function createUser({ 
  id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level, 
  google_id, email, avatar_image, consent_pdpa, goal_type, goal_score, personality, 
  avatar_hat, avatar_accessory, role, is_dev, pin,
  gender, age, height, weight, target_weight, activity_level,
  carbs_goal, protein_goal, fat_goal, sodium_goal, water_goal,
  water_bottle_ml, water_bottle_name, water_bottle_icon, water_daily_target_ml, water_bottle_setup
}) {
  const newId = id || `u_${Date.now()}`;
  const isDevUserVal = (role === 'dev' || is_dev === 1 || nickname === 'มอส' || (nickname && nickname.toLowerCase().includes('dev')) || (email && email.toLowerCase().includes('moss'))) ? 1 : 0;
  const roleVal = isDevUserVal ? 'dev' : (role || 'user');
  const pinVal = pin ? String(pin).trim() : null;

  const numWeight = weight !== undefined ? (Number(weight) || 60) : 60;
  const numHeight = height !== undefined ? (Number(height) || 165) : 165;
  const numAge = age !== undefined ? (Number(age) || 25) : 25;
  const genderVal = gender || 'female';

  const stmt = db.prepare(`
    INSERT INTO users (
      id, nickname, avatar_color, avatar_face, calorie_goal, sugar_goal, privacy_level,
      google_id, email, avatar_image, consent_pdpa, consent_at, avatar_hat, avatar_accessory, personality,
      goal_type, goal_score, role, is_dev, pin,
      gender, age, height, weight, target_weight, activity_level,
      carbs_goal, protein_goal, fat_goal, sodium_goal, water_goal,
      water_bottle_ml, water_bottle_name, water_bottle_icon, water_daily_target_ml, water_bottle_setup,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newId,
    nickname || 'โมจิใหม่',
    avatar_color || '#FF9EB5',
    avatar_face || 'happy',
    Math.max(1000, Number(calorie_goal) || 1800),
    Math.max(5, Math.min(80, Number(sugar_goal) || 25)),
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
    roleVal,
    isDevUserVal,
    pinVal,
    genderVal,
    numAge,
    numHeight,
    numWeight,
    target_weight !== undefined ? Number(target_weight) : null,
    activity_level || 'light',
    carbs_goal !== undefined ? Number(carbs_goal) : 180,
    protein_goal !== undefined ? Number(protein_goal) : 75,
    fat_goal !== undefined ? Number(fat_goal) : 45,
    sodium_goal !== undefined ? Number(sodium_goal) : 2000,
    water_goal !== undefined ? Number(water_goal) : 8,
    water_bottle_ml !== undefined ? Number(water_bottle_ml) : 500,
    water_bottle_name || 'ขวดน้ำพกพา 500 ml',
    water_bottle_icon || 'bottle_500',
    water_daily_target_ml !== undefined ? Number(water_daily_target_ml) : 2000,
    water_bottle_setup ? 1 : 0,
    Date.now()
  );

  // Automatically record initial weight log if provided
  if (numWeight > 0) {
    try {
      addWeightLog({ userId: newId, date: new Date().toISOString().slice(0, 10), weight: numWeight, note: 'น้ำหนักเริ่มต้นตอนเข้าแก๊ง 🍡' });
    } catch (_) {}
  }

  return getUser(newId);
}

export function isDevUser(userId) {
  if (!userId) return false;
  const user = getUser(userId);
  if (!user) return false;
  return user.role === 'dev' || 
         user.is_dev === 1 || 
         user.id === 'u1' || 
         user.nickname === 'มอส' || 
         (user.nickname && user.nickname.toLowerCase().includes('dev')) ||
         (user.email && user.email.toLowerCase().includes('moss'));
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
  const water_bottle_ml = data.water_bottle_ml !== undefined ? (Number(data.water_bottle_ml) || 500) : (current.water_bottle_ml ?? 500);
  const water_bottle_name = data.water_bottle_name !== undefined ? data.water_bottle_name : (current.water_bottle_name ?? 'ขวดน้ำพกพา 500 ml');
  const water_bottle_icon = data.water_bottle_icon !== undefined ? data.water_bottle_icon : (current.water_bottle_icon ?? 'bottle_500');
  const water_daily_target_ml = data.water_daily_target_ml !== undefined ? (Number(data.water_daily_target_ml) || 2000) : (current.water_daily_target_ml ?? 2000);
  const water_bottle_setup = data.water_bottle_setup !== undefined ? (data.water_bottle_setup ? 1 : 0) : (current.water_bottle_setup ?? 0);
  const coins = data.coins !== undefined ? Number(data.coins) : (current.coins ?? 120);
  const unlocked_items = data.unlocked_items !== undefined ? (typeof data.unlocked_items === 'string' ? data.unlocked_items : JSON.stringify(data.unlocked_items)) : (current.unlocked_items ?? '[]');
  const role = data.role !== undefined ? data.role : (current.role ?? 'user');
  const is_dev = data.is_dev !== undefined ? (data.is_dev ? 1 : 0) : (current.is_dev ?? (role === 'dev' ? 1 : 0));
  const avatar_image = data.avatar_image !== undefined ? (data.avatar_image || null) : current.avatar_image;
  const pin = data.pin !== undefined ? (data.pin ? String(data.pin).trim() : null) : (current.pin ?? null);

  const stmt = db.prepare(`
    UPDATE users
    SET nickname = ?, avatar_color = ?, avatar_face = ?, avatar_hat = ?, avatar_accessory = ?, personality = ?, avatar_image = ?,
        calorie_goal = ?, sugar_goal = ?, privacy_level = ?,
        gender = ?, age = ?, height = ?, weight = ?, target_weight = ?, activity_level = ?,
        consent_pdpa = ?, consent_at = CASE WHEN ? = 1 AND consent_at IS NULL THEN ? ELSE consent_at END,
        goal_type = ?, goal_score = ?, coins = ?, unlocked_items = ?,
        carbs_goal = ?, protein_goal = ?, fat_goal = ?, sodium_goal = ?, water_goal = ?,
        water_bottle_ml = ?, water_bottle_name = ?, water_bottle_icon = ?, water_daily_target_ml = ?, water_bottle_setup = ?,
        role = ?, is_dev = ?, pin = ?
    WHERE id = ?
  `);

  stmt.run(
    nickname, avatar_color, avatar_face, avatar_hat, avatar_accessory, personality, avatar_image,
    calorie_goal, sugar_goal, privacy_level,
    gender, age, height, weight, target_weight, activity_level,
    consent_pdpa, consent_pdpa, Date.now(),
    goal_type, goal_score, coins, unlocked_items,
    carbs_goal, protein_goal, fat_goal, sodium_goal, water_goal,
    water_bottle_ml, water_bottle_name, water_bottle_icon, water_daily_target_ml, water_bottle_setup,
    role, is_dev, pin,
    id
  );
  return getUser(id);
}

export function buyShopItem(userId, itemKey, price, itemName) {
  const user = getUser(userId);
  if (!user) return { success: false, error: 'User not found' };
  const userCoins = Number(user.coins) || 0;
  if (userCoins < price) {
    return { success: false, error: `เหรียญไม่พอ (ต้องการ ${price} 🪙 แต่มี ${userCoins} 🪙)` };
  }

  let unlocked = [];
  try {
    unlocked = JSON.parse(user.unlocked_items || '[]');
  } catch (_) {
    unlocked = [];
  }

  if (!unlocked.includes(itemKey)) {
    unlocked.push(itemKey);
  }

  const newCoins = Math.max(0, userCoins - price);
  db.prepare('UPDATE users SET coins = ?, unlocked_items = ? WHERE id = ?').run(
    newCoins,
    JSON.stringify(unlocked),
    userId
  );

  recordActivity(userId, 'shop', `ปลดล็อคแฟชั่น [${itemName || itemKey}] ในร้านค้า (-${price} 🪙) ✨`, -price);

  return { success: true, user: getUser(userId), unlocked };
}

export function claimMissionItem(userId, itemKey, itemName) {
  const user = getUser(userId);
  if (!user) return { success: false, error: 'User not found' };

  let unlocked = [];
  try {
    unlocked = JSON.parse(user.unlocked_items || '[]');
  } catch (_) {
    unlocked = [];
  }

  if (!unlocked.includes(itemKey)) {
    unlocked.push(itemKey);
  }

  db.prepare('UPDATE users SET unlocked_items = ? WHERE id = ?').run(
    JSON.stringify(unlocked),
    userId
  );

  recordActivity(userId, 'shop', `สำเร็จภารกิจและปลดล็อคแฟชั่น [${itemName || itemKey}] ฟรี! 🎯🎉`, 0);

  return { success: true, user: getUser(userId), unlocked };
}

// -------------------------------------------------------------
// Prank Cards & Mischief Shop System (ระบบการ์ดแกล้งเพื่อน 🃏😈)
// -------------------------------------------------------------

export const PRANK_CARDS = [
  {
    id: 'steal_score',
    name: 'การ์ดดูดแต้มวินัย 🧲',
    icon: '🧲',
    price: 25,
    tag: 'ยอดนิยม 🔥',
    gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)',
    shortDesc: 'ดูดแต้มเพื่อน -15 pt มาเป็นของเรา +10 pt',
    fullDesc: 'แกล้งเพื่อนที่คะแนนนำหน้า! ดูดคะแนนวินัย (Goal Score) ของเพื่อนลดลง 15 แต้ม และโอนมาเพิ่มให้เราทันที 10 แต้ม 😈',
    effectType: 'score',
    scorePenalty: 15,
    scoreBonus: 10,
    durationHours: 0,
    needsTarget: true
  },
  {
    id: 'extra_quest',
    name: 'การ์ดการบ้านงอก 📜',
    icon: '📜',
    price: 20,
    tag: 'ท้าทาย ⚡',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
    shortDesc: 'ส่งภารกิจพิเศษฉุกเฉินให้เพื่อน 1 อย่าง',
    fullDesc: 'ยัดเยียดภารกิจพิเศษฉุกเฉินให้เพื่อนทำภายในวันนี้! (เช่น ดื่มน้ำเพิ่ม หรือถ่ายรูปมื้อสุขภาพ) ถ้าเพื่อนทำไม่สำเร็จโดนหัก 10 pt',
    effectType: 'quest',
    durationHours: 24,
    needsTarget: true
  },
  {
    id: 'water_force',
    name: 'การ์ดแก้วน้ำบังคับ 💧',
    icon: '💧',
    price: 15,
    tag: 'รักสุขภาพ 🫧',
    gradient: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
    shortDesc: 'สั่งเพื่อนดื่มน้ำเพิ่ม +500 ml วันนี้',
    fullDesc: 'แกล้งเพื่อนสายไม่ชอบจิบน้ำ! บังคับเพิ่มเป้าหมายน้ำดื่มของเพื่อน +500 ml วันนี้ พร้อมแจ้งเตือนเตือนดื่มน้ำรัวๆ',
    effectType: 'water',
    waterAddedMl: 500,
    durationHours: 24,
    needsTarget: true
  },
  {
    id: 'clown_curse',
    name: 'การ์ดสาปหน้ามึนตึ้บ 🤡',
    icon: '🤡',
    price: 18,
    tag: 'กวนประสาท 🤣',
    gradient: 'linear-gradient(135deg, #EC4899, #F43F5E)',
    shortDesc: 'สาปหน้าโมจิเพื่อนเป็นหน้ามึนงง 24 ชม.',
    fullDesc: 'เสกคาถาสาปให้ใบหน้าน้องโมจิของเพื่อนเปลี่ยนเป็นหน้า Dizzy / มึนงง ตลอด 24 ชม. ทั้งในฟีดและหน้าโปรไฟล์!',
    effectType: 'face_curse',
    faceType: 'dizzy',
    durationHours: 24,
    needsTarget: true
  },
  {
    id: 'sugar_lock',
    name: 'การ์ดล็อกโควตาน้ำตาล 📉',
    icon: '📉',
    price: 25,
    tag: 'ดัดนิสัย 🍬',
    gradient: 'linear-gradient(135deg, #10B981, #0D9488)',
    shortDesc: 'บีบโควตาน้ำตาลเพื่อนลดลง 5g วันนี้',
    fullDesc: 'บีบเพดานน้ำตาลของเพื่อนให้ลดลง 5g สำหรับวันนี้! ใครชอบกินชานมหรือของหวานโดนการ์ดนี้รับรองว่าต้องคุมเข้ม!',
    effectType: 'sugar_limit',
    sugarReduction: 5,
    durationHours: 24,
    needsTarget: true
  },
  {
    id: 'shield',
    name: 'การ์ดโล่สะท้อนมหาเวทย์ 🛡️',
    icon: '🛡️',
    price: 30,
    tag: 'ไอเทมป้องกัน 🔮',
    gradient: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
    shortDesc: 'สะท้อนการ์ดแกล้งกลับไปหาผู้ส่ง 100%',
    fullDesc: 'ซื้อติดตัวไว้ป้องกัน! หากมีใครคิดจะแกล้งเรา โล่จะทำงานอัตโนมัติ สะท้อนเอฟเฟกต์การแกล้งกลับไปหาเพื่อนคนนั้นทันที!',
    effectType: 'defense',
    durationHours: 48,
    needsTarget: false
  }
];

export function getUserActivePranks(userId) {
  if (!userId) return [];
  const now = Date.now();
  try {
    return db.prepare(`
      SELECT p.*, u.nickname as sender_nickname, u.avatar_image as sender_avatar_image, u.avatar_color as sender_avatar_color, u.avatar_face as sender_avatar_face
      FROM pranks p
      JOIN users u ON p.from_user_id = u.id
      WHERE p.to_user_id = ? AND p.is_active = 1 AND p.expires_at > ?
      ORDER BY p.created_at DESC
    `).all(userId, now);
  } catch (_) {
    return [];
  }
}

export function getRecentGangPranks(limit = 20) {
  try {
    return db.prepare(`
      SELECT p.*, 
             u1.nickname as from_nickname, u1.avatar_color as from_color, u1.avatar_face as from_face,
             u2.nickname as to_nickname, u2.avatar_color as to_color, u2.avatar_face as to_face
      FROM pranks p
      JOIN users u1 ON p.from_user_id = u1.id
      JOIN users u2 ON p.to_user_id = u2.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (_) {
    return [];
  }
}

export function usePrankCard(fromUserId, toUserId, cardId, prankNote = '') {
  const fromUser = getUser(fromUserId);
  if (!fromUser) return { success: false, error: 'User not found' };

  const card = PRANK_CARDS.find(c => c.id === cardId);
  if (!card) return { success: false, error: 'ไม่พบการ์ดแกล้งนี้' };

  const targetId = card.id === 'shield' ? fromUserId : toUserId;
  const toUser = getUser(targetId);
  if (!toUser) return { success: false, error: 'ไม่พบผู้เล่นเป้าหมาย' };

  if (card.needsTarget && fromUserId === toUserId) {
    return { success: false, error: 'ไม่สามารถแกล้งตัวเองได้นะ!' };
  }

  const userCoins = Number(fromUser.coins) || 0;
  if (userCoins < card.price) {
    return { success: false, error: `เหรียญไม่พอ (ต้องการ ${card.price} 🪙 แต่มี ${userCoins} 🪙)` };
  }

  // Deduct coins from sender
  addCoins(fromUserId, -card.price);

  const now = Date.now();
  const expiresAt = now + (card.durationHours > 0 ? card.durationHours * 3600 * 1000 : 86400000);

  // If buying shield for self
  if (card.id === 'shield') {
    const prankId = `prank_${now}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      db.prepare("UPDATE pranks SET is_active = 0 WHERE to_user_id = ? AND card_id = 'shield'").run(fromUserId);
      db.prepare(`
        INSERT INTO pranks (id, from_user_id, to_user_id, card_id, card_name, card_icon, card_effect, prank_note, extra_data, is_active, is_cleared, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
      `).run(prankId, fromUserId, fromUserId, 'shield', card.name, card.icon, 'โล่สะท้อนมหาเวทย์พร้อมปกป้อง 1 ครั้ง', prankNote || 'เปิดใช้งานโล่สะท้อน', JSON.stringify({}), now, expiresAt);
    } catch (_) {}

    recordActivity(fromUserId, 'shop', `🛡️ เปิดใช้งาน [${card.name}] ป้องกันการโดนแกล้ง (-${card.price} 🪙) ✨`, -card.price);

    return {
      success: true,
      card,
      reflected: false,
      message: `เปิดใช้งาน ${card.name} เรียบร้อยแล้ว! พร้อมสะท้อนการ์ดแกล้ง 1 ครั้ง 🛡️`,
      user: getUser(fromUserId)
    };
  }

  // Check if target has an active shield!
  const activeShield = db.prepare(`
    SELECT * FROM pranks 
    WHERE to_user_id = ? AND card_id = 'shield' AND is_active = 1 AND expires_at > ?
  `).get(toUserId, now);

  if (activeShield) {
    // Break target's shield!
    db.prepare('UPDATE pranks SET is_active = 0, is_cleared = 1 WHERE id = ?').run(activeShield.id);

    // Reflect prank back to sender!
    const reflectPrankId = `prank_${now}_${Math.random().toString(36).slice(2, 6)}`;
    let reflectEffect = '';

    if (card.id === 'steal_score') {
      db.prepare('UPDATE users SET goal_score = MAX(0, COALESCE(goal_score, 150) - ?) WHERE id = ?').run(card.scorePenalty, fromUserId);
      db.prepare('UPDATE users SET goal_score = COALESCE(goal_score, 150) + ? WHERE id = ?').run(card.scoreBonus, toUserId);
      reflectEffect = `โดนสะท้อนกลับ! ${fromUser.nickname} โดนหัก ${card.scorePenalty} pt และ ${toUser.nickname} ได้รับ +${card.scoreBonus} pt แทน!`;
    } else {
      reflectEffect = `โดนโล่สะท้อนมหาเวทย์ของ ${toUser.nickname} สะท้อนผลเอฟเฟกต์ [${card.name}] กลับใส่ตัวเองเต็มๆ!`;
    }

    db.prepare(`
      INSERT INTO pranks (id, from_user_id, to_user_id, card_id, card_name, card_icon, card_effect, prank_note, extra_data, is_active, is_cleared, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).run(reflectPrankId, toUserId, fromUserId, card.id, card.name, card.icon, reflectEffect, `โล่สะท้อนจาก ${toUser.nickname}`, JSON.stringify({ reflected: true }), now, expiresAt);

    // Feed Broadcast
    recordActivity(fromUserId, 'prank', `💥 พลิกล็อค! ${toUser.nickname} กางโล่สะท้อนมหาเวทย์ 🛡️ สะท้อน [${card.name}] ใส่ ${fromUser.nickname} เต็มๆ! 🤣`, 0);

    // Notifications
    createNotification({
      userId: toUserId,
      type: 'social',
      icon: '🛡️',
      title: 'โล่สะท้อนของคุณทำงาน!',
      body: `${fromUser.nickname} พยายามใช้ ${card.name} แต่ถูกโล่ของคุณสะท้อนกลับใส่เขาเรียบร้อย!`,
      action: 'openGang',
      actionLabel: 'ดูก๊วน'
    });

    createNotification({
      userId: fromUserId,
      type: 'social',
      icon: '💥',
      title: 'การแกล้งโดนสะท้อนกลับ!',
      body: `${toUser.nickname} มีโล่สะท้อนมหาเวทย์! ผลของ ${card.name} จึงสะท้อนกลับใส่คุณเอง 😱`,
      action: 'openGang',
      actionLabel: 'ดูก๊วน'
    });

    return {
      success: true,
      reflected: true,
      card,
      message: `💥 โอ๊ะ! ${toUser.nickname} มีโล่สะท้อนมหาเวทย์! การ์ดถูกสะท้อนกลับใส่คุณเต็มๆ!`,
      user: getUser(fromUserId)
    };
  }

  // Normal prank execution (Target has no shield)
  const prankId = `prank_${now}_${Math.random().toString(36).slice(2, 6)}`;
  let effectMsg = '';
  let extraJson = {};

  if (card.id === 'steal_score') {
    db.prepare('UPDATE users SET goal_score = MAX(0, COALESCE(goal_score, 150) - ?) WHERE id = ?').run(card.scorePenalty, toUserId);
    db.prepare('UPDATE users SET goal_score = COALESCE(goal_score, 150) + ? WHERE id = ?').run(card.scoreBonus, fromUserId);
    effectMsg = `ดูดแต้มวินัยจาก ${toUser.nickname} -${card.scorePenalty} pt และมอบให้ ${fromUser.nickname} +${card.scoreBonus} pt 😈`;
    extraJson = { score_deducted: card.scorePenalty, score_bonus: card.scoreBonus };
  } else if (card.id === 'extra_quest') {
    const questPool = [
      { title: 'ดื่มน้ำเพิ่ม 1 แก้วใหญ่ 💧', desc: 'ดื่มน้ำเปล่า 1 แก้วและบันทึกลงในแอปเพื่อลบล้างคำสาป', task_type: 'water', target: 1 },
      { title: 'กินผลไม้หรือผัก 1 มื้อ 🥗', desc: 'บันทึกมื้ออาหารที่มีผักหรือผลไม้เพื่อสุขภาพดี', task_type: 'meal', target: 1 },
      { title: 'ถ่ายรูปมื้ออาหารจริง 📸', desc: 'ถ่ายรูปมื้ออาหารด้วยกล้อง AI 1 รูป', task_type: 'photo', target: 1 }
    ];
    const pickedQuest = questPool[Math.floor(Math.random() * questPool.length)];
    effectMsg = `ส่งภารกิจพิเศษ "${pickedQuest.title}" ให้ ${toUser.nickname} ต้องทำให้เสร็จวันนี้! 📜`;
    extraJson = { ...pickedQuest };
  } else if (card.id === 'water_force') {
    effectMsg = `สั่งให้ ${toUser.nickname} ดื่มน้ำเพิ่ม +500 ml วันนี้เพื่อสุขภาพและความสดชื่น 💧`;
    extraJson = { water_added: 500 };
  } else if (card.id === 'clown_curse') {
    effectMsg = `สาปให้หน้าน้องโมจิของ ${toUser.nickname} กลายเป็นหน้าตัวตลก/มึนตึ้บ เป็นเวลา 24 ชม. 🤡`;
    extraJson = { face: 'dizzy' };
  } else if (card.id === 'sugar_lock') {
    effectMsg = `บีบโควตาน้ำตาลของ ${toUser.nickname} ลดลง 5g วันนี้! ห้ามกินหวานนะ 📉`;
    extraJson = { sugar_reduction: 5 };
  }

  db.prepare(`
    INSERT INTO pranks (id, from_user_id, to_user_id, card_id, card_name, card_icon, card_effect, prank_note, extra_data, is_active, is_cleared, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).run(prankId, fromUserId, toUserId, card.id, card.name, card.icon, effectMsg, prankNote || '', JSON.stringify(extraJson), now, expiresAt);

  // Broadcast to Social Feed
  const feedNote = prankNote ? ` "${prankNote}"` : '';
  recordActivity(fromUserId, 'prank', `🃏 ${fromUser.nickname} ใช้ [${card.name}] ใส่ ${toUser.nickname}!${feedNote} (${effectMsg})`, 0);

  // Notify Target User
  createNotification({
    userId: toUserId,
    type: 'social',
    icon: card.icon,
    title: `คุณโดน ${fromUser.nickname} แกล้งด้วย ${card.name}! 😈`,
    body: `${prankNote ? `"${prankNote}" · ` : ''}${effectMsg}`,
    action: 'openGang',
    actionLabel: 'ดูฟีดแก๊ง'
  });

  return {
    success: true,
    reflected: false,
    card,
    targetNickname: toUser.nickname,
    effectMsg,
    message: `ใช้ ${card.name} แกล้ง ${toUser.nickname} สำเร็จ! (-${card.price} 🪙) 😈`,
    user: getUser(fromUserId)
  };
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

export function addLog({ userId, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components, components_json, water_ml }) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const compStr = typeof components_json === 'string'
    ? components_json
    : (Array.isArray(components) || (typeof components === 'object' && components !== null))
    ? JSON.stringify(components)
    : (Array.isArray(components_json) ? JSON.stringify(components_json) : null);

  const stmt = db.prepare(`
    INSERT INTO logs (id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, components_json, water_ml, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    water_ml !== undefined && water_ml !== null ? Number(water_ml) : null,
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

export function deleteWaterLog(id, userId) {
  const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
  if (!log) return { success: false, error: 'ไม่พบรายการดื่มน้ำนี้' };

  const user = getUser(userId);
  const isDev = user?.role === 'dev' || user?.is_dev === 1;
  if (log.user_id !== userId && !isDev) {
    return { success: false, error: 'ไม่มีสิทธิ์ลบรายการนี้' };
  }

  db.prepare('DELETE FROM logs WHERE id = ?').run(id);

  // Clean up matching activity (within +-15 seconds of log creation)
  if (log.created_at) {
    try {
      const act = db.prepare(`
        SELECT id FROM activities
        WHERE user_id = ? AND type = 'water'
          AND created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC LIMIT 1
      `).get(log.user_id, log.created_at - 15000, log.created_at + 15000);
      if (act) {
        db.prepare('DELETE FROM activities WHERE id = ?').run(act.id);
      }
    } catch (_) {}
  }

  // Deduct 2 coins safely
  try {
    db.prepare('UPDATE users SET coins = MAX(0, COALESCE(coins, 0) - 2) WHERE id = ?').run(log.user_id);
  } catch (_) {}

  try {
    syncDailyGoalScore(log.user_id, log.date);
  } catch (_) {}

  return { success: true, removedId: id, log };
}

export function resetWaterLogs(userId, date) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const logs = db.prepare(`
    SELECT id, created_at FROM logs
    WHERE user_id = ? AND date = ? AND (water_ml > 0 OR name LIKE '%น้ำ%')
  `).all(userId, targetDate);

  if (!logs.length) {
    return { success: true, count: 0, message: 'ไม่มีประวัติดื่มน้ำวันนี้' };
  }

  const ids = logs.map(l => l.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM logs WHERE id IN (${placeholders})`).run(...ids);

  // Clean up activities for that date
  const dayStart = new Date(`${targetDate}T00:00:00`).getTime() || 0;
  const dayEnd = dayStart + 86400000;
  try {
    db.prepare(`
      DELETE FROM activities
      WHERE user_id = ? AND type = 'water'
        AND created_at >= ? AND created_at <= ?
    `).run(userId, dayStart, dayEnd);
  } catch (_) {}

  // Deduct coins (2 per drink, capped at 0)
  const coinsToRemove = logs.length * 2;
  try {
    db.prepare('UPDATE users SET coins = MAX(0, COALESCE(coins, 0) - ?) WHERE id = ?').run(coinsToRemove, userId);
  } catch (_) {}

  try {
    syncDailyGoalScore(userId, targetDate);
  } catch (_) {}

  return {
    success: true,
    count: logs.length,
    message: `ลบประวัติดื่มน้ำทั้งหมด ${logs.length} รายการเรียบร้อยแล้ว 💧`
  };
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

// -------------------------------------------------------------
// Gaming Quest Engine: Daily, Weekly, Main Tasks
// -------------------------------------------------------------
export function getUserQuests(userId) {
  const user = getUser(userId);
  if (!user) return { daily: [], weekly: [], main: [] };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // ISO Week calculation (Monday as start of week)
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

  // Start date of current week (Monday)
  const monday = new Date(now);
  const currentDay = monday.getDay();
  const diff = monday.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  monday.setDate(diff);
  const weekStartStr = monday.toISOString().slice(0, 10);

  // Today's Real-time Stats
  const todayMeals = db.prepare("SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date = ? AND (water_ml IS NULL OR name NOT LIKE '%น้ำเปล่า%')").get(userId, todayStr)?.c || 0;
  const todayWater = db.prepare("SELECT SUM(COALESCE(water_ml, 500)) as s FROM logs WHERE user_id = ? AND date = ? AND (water_ml IS NOT NULL OR name LIKE '%น้ำเปล่า%')").get(userId, todayStr)?.s || 0;
  const todaySugarRow = db.prepare('SELECT SUM(sugar) as s FROM logs WHERE user_id = ? AND date = ?').get(userId, todayStr);
  const todaySugar = todaySugarRow?.s || 0;
  const todaySugarOk = todayMeals > 0 && todaySugar <= (user.sugar_goal || 25);
  const todayPhotos = db.prepare('SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date = ? AND image_url IS NOT NULL').get(userId, todayStr)?.c || 0;
  
  const todayStartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todaySocial = db.prepare('SELECT COUNT(*) as c FROM post_reactions WHERE user_id = ? AND created_at >= ?').get(userId, todayStartTs)?.c || 0;

  // Weekly Stats
  const streakInfo = calculateUserStreak(userId);
  const weeklyMeals = db.prepare("SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date >= ? AND (water_ml IS NULL OR name NOT LIKE '%น้ำเปล่า%')").get(userId, weekStartStr)?.c || 0;
  const weeklyWater = db.prepare("SELECT SUM(COALESCE(water_ml, 500)) as s FROM logs WHERE user_id = ? AND date >= ? AND (water_ml IS NOT NULL OR name LIKE '%น้ำเปล่า%')").get(userId, weekStartStr)?.s || 0;
  const weeklyGoals = db.prepare('SELECT COUNT(*) as c FROM daily_goals WHERE user_id = ? AND date >= ? AND achieved = 1').get(userId, weekStartStr)?.c || 0;

  // Main / All-Time Stats
  const totalMeals = db.prepare("SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND (water_ml IS NULL OR name NOT LIKE '%น้ำเปล่า%')").get(userId)?.c || 0;
  const totalWeightLogs = db.prepare('SELECT COUNT(*) as c FROM weight_logs WHERE user_id = ?').get(userId)?.c || 0;
  
  // Leaderboard rank
  const leaderboard = getLeaderboard('goal');
  const myRank = (leaderboard.findIndex(u => u.id === userId) + 1) || 999;
  const myGoalScore = Number(user.goal_score) || 150;

  // Fetch claimed quests for this user
  const claims = db.prepare('SELECT quest_id, period_key FROM quest_claims WHERE user_id = ?').all(userId);
  const isClaimed = (questId, periodKey) => claims.some(c => c.quest_id === questId && c.period_key === periodKey);

  // 1. DAILY TASKS (ภารกิจรายวัน - ทำง่าย ได้เหรียญพอดีๆ รีเซ็ตทุกวัน)
  const dailyTasks = [
    {
      id: 'daily_meals_2',
      category: 'daily',
      periodKey: todayStr,
      icon: '🍱',
      title: 'นักกินมีระเบียบ (2 มื้อ)',
      desc: 'บันทึกอาหารอย่างน้อย 2 มื้อในวันนี้',
      progress: Math.min(2, todayMeals),
      target: 2,
      unit: 'มื้อ',
      rewardCoins: 5,
      rewardScore: 15,
      isCompleted: todayMeals >= 2,
      isClaimed: isClaimed('daily_meals_2', todayStr),
      actionType: 'meal'
    },
    {
      id: 'daily_water_1000',
      category: 'daily',
      periodKey: todayStr,
      icon: '💧',
      title: 'จิบน้ำสดชื่น (1,000 ml)',
      desc: 'ดื่มน้ำให้ได้ 1,000 ml วันนี้ เพื่อระบบเผาผลาญ',
      progress: Math.min(1000, todayWater),
      target: 1000,
      unit: 'ml',
      rewardCoins: 5,
      rewardScore: 15,
      isCompleted: todayWater >= 1000,
      isClaimed: isClaimed('daily_water_1000', todayStr),
      actionType: 'water'
    },
    {
      id: 'daily_sugar_control',
      category: 'daily',
      periodKey: todayStr,
      icon: '🍬',
      title: 'คุมหวานชนะใจตน',
      desc: `น้ำตาลวันนี้ไม่เกินเป้าหมาย (≤ ${user.sugar_goal || 25}g)`,
      progress: todaySugarOk ? 1 : 0,
      target: 1,
      unit: 'ครั้ง',
      rewardCoins: 10,
      rewardScore: 25,
      isCompleted: todaySugarOk,
      isClaimed: isClaimed('daily_sugar_control', todayStr),
      actionType: 'meal'
    },
    {
      id: 'daily_photo_post',
      category: 'daily',
      periodKey: todayStr,
      icon: '📸',
      title: 'ช่างภาพอาหารตัวยง',
      desc: 'บันทึกอาหารพร้อมถ่ายรูปจานอาหาร 1 มื้อ',
      progress: Math.min(1, todayPhotos),
      target: 1,
      unit: 'มื้อ',
      rewardCoins: 5,
      rewardScore: 15,
      isCompleted: todayPhotos >= 1,
      isClaimed: isClaimed('daily_photo_post', todayStr),
      actionType: 'photo'
    },
    {
      id: 'daily_social_cheer',
      category: 'daily',
      periodKey: todayStr,
      icon: '💖',
      title: 'มิตรภาพแก๊งโมจิ',
      desc: 'กดถูกใจ ❤️ หรือส่งเสียงเชียร์ให้เพื่อนในฟีด',
      progress: Math.min(1, todaySocial),
      target: 1,
      unit: 'ครั้ง',
      rewardCoins: 5,
      rewardScore: 10,
      isCompleted: todaySocial >= 1,
      isClaimed: isClaimed('daily_social_cheer', todayStr),
      actionType: 'feed'
    }
  ];

  // 2. WEEKLY TASKS (ภารกิจประจำสัปดาห์ - สะสมต่อเนื่อง ได้เหรียญเยอะขึ้น)
  const weeklyTasks = [
    {
      id: 'weekly_streak_3',
      category: 'weekly',
      periodKey: weekKey,
      icon: '🔥',
      title: 'สตรีคไฟแรง 3 วันติด',
      desc: 'บันทึกอาหารต่อเนื่องอย่างน้อย 3 วัน',
      progress: Math.min(3, streakInfo.current),
      target: 3,
      unit: 'วัน',
      rewardCoins: 35,
      rewardScore: 80,
      isCompleted: streakInfo.current >= 3,
      isClaimed: isClaimed('weekly_streak_3', weekKey),
      actionType: 'streak'
    },
    {
      id: 'weekly_meals_8',
      category: 'weekly',
      periodKey: weekKey,
      icon: '🍱',
      title: 'สัปดาห์แห่งวินัย (8 มื้อ)',
      desc: 'บันทึกอาหารสะสมในสัปดาห์นี้ครบ 8 มื้อ',
      progress: Math.min(8, weeklyMeals),
      target: 8,
      unit: 'มื้อ',
      rewardCoins: 40,
      rewardScore: 100,
      isCompleted: weeklyMeals >= 8,
      isClaimed: isClaimed('weekly_meals_8', weekKey),
      actionType: 'meal'
    },
    {
      id: 'weekly_water_5000',
      category: 'weekly',
      periodKey: weekKey,
      icon: '💧',
      title: 'ราชาแห่งการดื่มน้ำ (5,000 ml)',
      desc: 'ดื่มน้ำสะสมในสัปดาห์นี้ให้ได้ 5,000 ml',
      progress: Math.min(5000, weeklyWater),
      target: 5000,
      unit: 'ml',
      rewardCoins: 35,
      rewardScore: 90,
      isCompleted: weeklyWater >= 5000,
      isClaimed: isClaimed('weekly_water_5000', weekKey),
      actionType: 'water'
    },
    {
      id: 'weekly_goal_3',
      category: 'weekly',
      periodKey: weekKey,
      icon: '🎯',
      title: 'พิชิตเป้าหมายแก๊ง 3 วัน',
      desc: 'ทำตามเป้าหมายสุขภาพสำเร็จ 3 วันในสัปดาห์นี้',
      progress: Math.min(3, weeklyGoals),
      target: 3,
      unit: 'วัน',
      rewardCoins: 50,
      rewardScore: 120,
      isCompleted: weeklyGoals >= 3,
      isClaimed: isClaimed('weekly_goal_3', weekKey),
      actionType: 'goal'
    }
  ];

  // 3. MAIN TASKS (ภารกิจหลักระดับตำนาน - ได้เหรียญเยอะสะใจ)
  const mainTasks = [
    {
      id: 'main_streak_7',
      category: 'main',
      periodKey: 'main',
      icon: '🏆',
      title: 'แชมป์ความสม่ำเสมอ 7 วันติด',
      desc: 'พิชิตสตรีคยาวนาน 7 วันไม่ขาดตอน (ระดับมือโปร)',
      progress: Math.min(7, streakInfo.best),
      target: 7,
      unit: 'วัน',
      rewardCoins: 100,
      rewardScore: 250,
      isCompleted: streakInfo.best >= 7,
      isClaimed: isClaimed('main_streak_7', 'main'),
      actionType: 'streak'
    },
    {
      id: 'main_meals_25',
      category: 'main',
      periodKey: 'main',
      icon: '🍱',
      title: 'นักชิมระดับตำนาน (25 มื้อ)',
      desc: 'สะสมการบันทึกอาหารรวมทั้งหมด 25 มื้อ',
      progress: Math.min(25, totalMeals),
      target: 25,
      unit: 'มื้อ',
      rewardCoins: 120,
      rewardScore: 300,
      isCompleted: totalMeals >= 25,
      isClaimed: isClaimed('main_meals_25', 'main'),
      actionType: 'meal'
    },
    {
      id: 'main_weight_update',
      category: 'main',
      periodKey: 'main',
      icon: '⚖️',
      title: 'ผู้ติดตามสรีระอย่างใกล้ชิด',
      desc: 'บันทึกชั่งน้ำหนักอัปเดตสถิติสม่ำเสมออย่างน้อย 2 ครั้ง',
      progress: Math.min(2, totalWeightLogs),
      target: 2,
      unit: 'ครั้ง',
      rewardCoins: 80,
      rewardScore: 200,
      isCompleted: totalWeightLogs >= 2,
      isClaimed: isClaimed('main_weight_update', 'main'),
      actionType: 'weight'
    },
    {
      id: 'main_top3_gang',
      category: 'main',
      periodKey: 'main',
      icon: '🥇',
      title: 'ก้าวสู่อันดับ Top 3 ของแก๊ง',
      desc: 'ขึ้นแท่นลีดเดอร์บอร์ดอันดับ 1-3 ของแก๊งโมจิ',
      progress: myRank <= 3 ? 1 : 0,
      target: 1,
      unit: 'อันดับ',
      rewardCoins: 150,
      rewardScore: 400,
      isCompleted: myRank <= 3,
      isClaimed: isClaimed('main_top3_gang', 'main'),
      actionType: 'rank'
    },
    {
      id: 'main_goal_score_500',
      category: 'main',
      periodKey: 'main',
      icon: '👑',
      title: 'ปรมาจารย์แห่งวินัย (500 pt)',
      desc: 'สะสมคะแนนวินัยเป้าหมายครบ 500 คะแนน',
      progress: Math.min(500, myGoalScore),
      target: 500,
      unit: 'pt',
      rewardCoins: 200,
      rewardScore: 500,
      isCompleted: myGoalScore >= 500,
      isClaimed: isClaimed('main_goal_score_500', 'main'),
      actionType: 'goal'
    }
  ];

  // Inject active Prank Quests sent by friends!
  try {
    const activePrankQuests = db.prepare(`
      SELECT p.*, u.nickname as sender_nickname
      FROM pranks p
      JOIN users u ON p.from_user_id = u.id
      WHERE p.to_user_id = ? AND p.card_id = 'extra_quest' AND p.is_active = 1 AND p.expires_at > ?
      ORDER BY p.created_at DESC
    `).all(userId, Date.now());

    for (const pq of activePrankQuests) {
      let extra = {};
      try { extra = JSON.parse(pq.extra_data || '{}'); } catch (_) {}
      const questId = `prank_quest_${pq.id}`;
      let curProg = 0;
      const reqTarget = extra.target || 1;
      if (extra.task_type === 'water') {
        curProg = todayWater >= 1000 ? 1 : 0;
      } else if (extra.task_type === 'photo') {
        curProg = todayPhotos >= 1 ? 1 : 0;
      } else {
        curProg = todayMeals >= 1 ? 1 : 0;
      }
      const isDone = curProg >= reqTarget;
      const isClaimedPrank = isClaimed(questId, todayStr) || pq.is_cleared === 1;

      dailyTasks.unshift({
        id: questId,
        category: 'daily',
        periodKey: todayStr,
        icon: '📜',
        title: `😈 โดน ${pq.sender_nickname} แกล้ง: ${extra.title || 'ภารกิจพิเศษ'}`,
        desc: extra.desc || 'รีบทำภารกิจให้สำเร็จเพื่อลบล้างคำสาปแกล้งจากเพื่อน!',
        progress: curProg,
        target: reqTarget,
        unit: extra.unit || 'ครั้ง',
        rewardCoins: 20,
        rewardScore: 25,
        isCompleted: isDone,
        isClaimed: isClaimedPrank,
        isPrank: true,
        prankId: pq.id,
        actionType: extra.task_type || 'meal'
      });
    }
  } catch (_) {}

  return { daily: dailyTasks, weekly: weeklyTasks, main: mainTasks };
}

export function claimQuest(userId, questId) {
  const quests = getUserQuests(userId);
  const all = [...quests.daily, ...quests.weekly, ...quests.main];
  const target = all.find(q => q.id === questId);

  if (!target) return { success: false, error: 'ไม่พบภารกิจนี้' };
  if (!target.isCompleted) return { success: false, error: 'ภารกิจนี้ยังไม่สำเร็จ' };
  if (target.isClaimed) return { success: false, error: 'คุณรับรางวัลภารกิจนี้ไปแล้ว' };

  const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`
    INSERT INTO quest_claims (id, user_id, quest_id, period_key, claimed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(claimId, userId, target.id, target.periodKey, Date.now());

  // Award coins and goal score
  addCoins(userId, target.rewardCoins);
  db.prepare('UPDATE users SET goal_score = COALESCE(goal_score, 150) + ? WHERE id = ?')
    .run(target.rewardScore, userId);

  // If this was a prank quest, mark the prank as cleared!
  if (target.isPrank && target.prankId) {
    try {
      db.prepare('UPDATE pranks SET is_active = 0, is_cleared = 1 WHERE id = ?').run(target.prankId);
    } catch (_) {}
  }

  // Broadcast celebration to Gang Social Feed
  recordActivity(userId, 'goal', `🎉 พิชิตภารกิจ [${target.title}] สำเร็จ! (+${target.rewardScore} pt, +${target.rewardCoins} 🪙) 🏆`, 0);

  return {
    success: true,
    quest: target,
    rewardCoins: target.rewardCoins,
    rewardScore: target.rewardScore,
    user: getUser(userId)
  };
}

// -------------------------------------------------------------
// Gang Co-op Challenge (ภารกิจรวมพลังแก๊ง / Boss Raid)
// -------------------------------------------------------------
export function getGangCoopStatus(userId = null) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

  const monday = new Date(now);
  const currentDay = monday.getDay();
  const diff = monday.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  monday.setDate(diff);
  const weekStartStr = monday.toISOString().slice(0, 10);
  const weekStartTs = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();

  const coopPool = [
    {
      id: 'coop_water',
      title: 'รวมพลังดับกระหายแก๊งโมจิ 💧',
      desc: 'ช่วยกันดื่มน้ำสะสมของแก๊งให้ครบ 20,000 ml ในสัปดาห์นี้',
      icon: '🌊',
      target: 20000,
      unit: 'ml',
      rewardCoins: 60,
      rewardScore: 150,
      metric: 'water'
    },
    {
      id: 'coop_meals',
      title: 'สัปดาห์นักชิมเพื่อสุขภาพ 🍱',
      desc: 'ช่วยกันบันทึกมื้ออาหารของแก๊งให้ครบ 35 มื้อในสัปดาห์นี้',
      icon: '🥗',
      target: 35,
      unit: 'มื้อ',
      rewardCoins: 60,
      rewardScore: 150,
      metric: 'meals'
    },
    {
      id: 'coop_social',
      title: 'แก๊งมิตรภาพสายฟิต 💖',
      desc: 'ช่วยกันกดหัวใจและส่งคอมเมนต์ให้เพื่อนในแก๊งรวม 25 ครั้ง',
      icon: '🎉',
      target: 25,
      unit: 'ครั้ง',
      rewardCoins: 60,
      rewardScore: 150,
      metric: 'social'
    }
  ];

  const currentCoop = { ...coopPool[weekNo % coopPool.length] };
  currentCoop.periodKey = `${currentCoop.id}_${weekKey}`;

  let totalProgress = 0;
  let userContribution = 0;
  const memberContributions = [];

  const allUsers = getAllUsers();
  for (const u of allUsers) {
    let uVal = 0;
    if (currentCoop.metric === 'water') {
      uVal = db.prepare("SELECT SUM(COALESCE(water_ml, 500)) as s FROM logs WHERE user_id = ? AND date >= ? AND (water_ml IS NOT NULL OR name LIKE '%น้ำเปล่า%')").get(u.id, weekStartStr)?.s || 0;
    } else if (currentCoop.metric === 'meals') {
      uVal = db.prepare("SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date >= ? AND (water_ml IS NULL OR name NOT LIKE '%น้ำเปล่า%')").get(u.id, weekStartStr)?.c || 0;
    } else if (currentCoop.metric === 'social') {
      uVal = db.prepare("SELECT COUNT(*) as c FROM post_reactions WHERE user_id = ? AND created_at >= ?").get(u.id, weekStartTs)?.c || 0;
    }
    totalProgress += uVal;
    if (userId && u.id === userId) {
      userContribution = uVal;
    }
    if (uVal > 0) {
      memberContributions.push({
        id: u.id,
        nickname: u.nickname,
        avatar_image: u.avatar_image,
        avatar_face: u.avatar_face,
        avatar_color: u.avatar_color,
        avatar_hat: u.avatar_hat,
        val: uVal
      });
    }
  }

  memberContributions.sort((a, b) => b.val - a.val);

  const isCompleted = totalProgress >= currentCoop.target;
  let isClaimed = false;
  if (userId) {
    const claim = db.prepare('SELECT id FROM quest_claims WHERE user_id = ? AND quest_id = ? AND period_key = ?').get(userId, currentCoop.id, currentCoop.periodKey);
    isClaimed = !!claim;
  }

  return {
    ...currentCoop,
    progress: totalProgress,
    userContribution,
    isCompleted,
    isClaimed,
    contributors: memberContributions.slice(0, 6)
  };
}

export function claimGangCoopReward(userId) {
  const coop = getGangCoopStatus(userId);
  if (!coop.isCompleted) return { success: false, error: 'ภารกิจรวมพลังแก๊งยังไม่สำเร็จ' };
  if (coop.isClaimed) return { success: false, error: 'คุณรับรางวัลภารกิจนี้ไปแล้ว' };

  const claimId = `coop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`
    INSERT INTO quest_claims (id, user_id, quest_id, period_key, claimed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(claimId, userId, coop.id, coop.periodKey, Date.now());

  addCoins(userId, coop.rewardCoins);
  db.prepare('UPDATE users SET goal_score = COALESCE(goal_score, 150) + ? WHERE id = ?').run(coop.rewardScore, userId);

  recordActivity(userId, 'goal', `🎉 แก๊งร่วมใจพิชิต [${coop.title}] สำเร็จ! รับรางวัลใหญ่ (+${coop.rewardCoins} 🪙, +${coop.rewardScore} pt) ยกแก๊ง! 🤝✨`, 0);

  return {
    success: true,
    rewardCoins: coop.rewardCoins,
    rewardScore: coop.rewardScore,
    user: getUser(userId)
  };
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

export function clearChatMessages(userId) {
  const stmt = db.prepare('DELETE FROM chat_messages WHERE user_id = ?');
  stmt.run(userId);
  return { success: true };
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

  const isMe = targetUserId === requesterId;
  const streak = calculateUserStreak(targetUserId);
  const todayDate = new Date().toISOString().slice(0, 10);
  const logs = getLogsSecure(targetUserId, requesterId, todayDate);
  const totalMeals = db.prepare('SELECT COUNT(*) as c FROM logs WHERE user_id = ?').get(targetUserId)?.c || 0;
  const cheersReceived = db.prepare('SELECT COUNT(*) as c FROM cheers WHERE to_user_id = ?').get(targetUserId)?.c || 0;
  const todayGoal = evaluateUserGoalToday(user, todayDate);

  // All meal posts for Instagram-style 3x3 Photo Grid & timeline
  const rawAllLogs = getLogsSecure(targetUserId, requesterId); // returns all logs
  const mealLogs = rawAllLogs.filter(l => !l.water_ml && !l.name.includes('น้ำเปล่า'));
  const allMeals = attachReactionsToPosts(mealLogs, requesterId);

  // 24-hour stories
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const stories = allMeals
    .filter(m => (m.created_at >= since24h || m.date >= todayDate) && (!m.is_private || isMe))
    .sort((a, b) => a.created_at - b.created_at);

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
      water_daily_target_ml: user.water_daily_target_ml || 2000,
      privacy_level: user.privacy_level,
      created_at: user.created_at,
      is_me: isMe
    },
    todayGoal,
    stats: {
      streak: streak.current,
      bestStreak: streak.best,
      totalMeals,
      totalPosts: allMeals.length,
      cheersReceived
    },
    badges,
    todayMeals: logs,
    stories,
    has_stories: stories.length > 0,
    allMeals
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

  // In-app Notification for recipient
  if (toUserId !== fromUserId) {
    createNotification({
      userId: toUserId,
      type: 'social',
      icon: '✨',
      title: `${fromUser.nickname} ส่งกำลังใจให้คุณ!`,
      body: `ส่งกำลังใจ "${label}" พร้อมมอบ +3 🪙 ให้คุณในก๊วนเพื่อน`,
      action: 'openFeed',
      actionLabel: 'ดูก๊วนเพื่อน'
    });
  }

  return {
    success: true,
    fromNickname: fromUser.nickname,
    toNickname: toUser.nickname,
    cheerType,
    label
  };
}

// -----------------------------------------------------------------------------
// In-App & Push Notifications System
// -----------------------------------------------------------------------------

export function createNotification({ userId, type = 'system', icon = '🔔', title, body = '', action = null, actionLabel = null }) {
  if (!userId || !title) return null;
  const user = getUser(userId);
  if (!user) return null;
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, icon, title, body, action, action_label, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, type, icon, title, body, action, actionLabel, createdAt);

  return {
    id,
    user_id: userId,
    type,
    icon,
    title,
    body,
    action,
    action_label: actionLabel,
    is_read: 0,
    created_at: createdAt
  };
}

export function getUserNotifications(userId, limit = 50) {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as c FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).get(userId)?.c || 0;

  return { notifications, unreadCount };
}

export function markNotificationRead(id, userId) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  return { success: true };
}

export function markAllNotificationsRead(userId) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  return { success: true };
}

export function deleteNotification(id, userId) {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(id, userId);
  return { success: true };
}

export function getPostAuthorId(postId) {
  if (!postId) return null;
  const logAuthor = db.prepare('SELECT user_id FROM logs WHERE id = ?').get(postId);
  if (logAuthor) return logAuthor.user_id;
  const actAuthor = db.prepare('SELECT user_id FROM activities WHERE id = ?').get(postId);
  if (actAuthor) return actAuthor.user_id;
  return null;
}

export function deletePostComment(commentId, userId) {
  const comment = db.prepare('SELECT * FROM post_reactions WHERE id = ?').get(commentId);
  if (!comment) return { success: false, error: 'ไม่พบคอมเมนต์นี้' };

  const user = getUser(userId);
  const isDev = user?.role === 'dev' || user?.is_dev === 1;

  let isAllowed = comment.user_id === userId || isDev;
  if (!isAllowed) {
    const authorId = getPostAuthorId(comment.post_id);
    if (authorId && authorId === userId) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return { success: false, error: 'ไม่มีสิทธิ์ลบคอมเมนต์นี้' };
  }

  db.prepare('DELETE FROM post_reactions WHERE id = ?').run(commentId);
  return { success: true, removedId: commentId, postId: comment.post_id };
}

// -----------------------------------------------------------------------------
// Instagram-Style Social Feed (Feed IG: Posts, Stories, Likes & Reactions)
// -----------------------------------------------------------------------------

export function togglePostReaction(postId, userId, reactionType = 'heart', commentText = '') {
  const user = getUser(userId);
  if (!user) return { success: false, error: 'User not found' };

  if (commentText && commentText.trim()) {
    const text = commentText.trim();
    const commentId = `comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO post_reactions (id, post_id, user_id, reaction_type, comment_text, created_at)
      VALUES (?, ?, ?, 'comment', ?, ?)
    `).run(commentId, postId, userId, text, Date.now());

    // Reward user for cheering
    addCoins(userId, 1);

    // Notify post author
    const authorId = getPostAuthorId(postId);
    if (authorId && authorId !== userId) {
      createNotification({
        userId: authorId,
        type: 'social',
        icon: '💬',
        title: `${user.nickname} แสดงความคิดเห็นบนโพสต์ของคุณ`,
        body: text,
        action: `openPost:${postId}`,
        actionLabel: 'ดูโพสต์'
      });
    }

    // Mention notifications: @nickname
    const mentions = text.match(/@([a-zA-Z0-9_\u0E00-\u0E7F]+)/g);
    if (mentions) {
      for (const m of mentions) {
        const nick = m.slice(1);
        const mentionedUser = db.prepare('SELECT id, nickname FROM users WHERE nickname = ? COLLATE NOCASE').get(nick);
        if (mentionedUser && mentionedUser.id !== userId && mentionedUser.id !== authorId) {
          createNotification({
            userId: mentionedUser.id,
            type: 'social',
            icon: '🏷️',
            title: `${user.nickname} แท็กคุณในความคิดเห็น`,
            body: text,
            action: `openPost:${postId}`,
            actionLabel: 'ดูความคิดเห็น'
          });
        }
      }
    }

    return { success: true, type: 'comment', commentId, commentText: text, userNickname: user.nickname };
  }

  // Heart Reaction (Toggle Like)
  const existing = db.prepare(`
    SELECT id FROM post_reactions WHERE post_id = ? AND user_id = ? AND reaction_type = 'heart'
  `).get(postId, userId);

  if (existing) {
    db.prepare('DELETE FROM post_reactions WHERE id = ?').run(existing.id);
    return { success: true, liked: false };
  } else {
    const reactId = `react_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO post_reactions (id, post_id, user_id, reaction_type, created_at)
      VALUES (?, ?, ?, 'heart', ?)
    `).run(reactId, postId, userId, Date.now());

    // Give coins
    addCoins(userId, 1);

    // Try finding post author to reward them +1 coin and notify
    const authorId = getPostAuthorId(postId);
    if (authorId && authorId !== userId) {
      addCoins(authorId, 1);
      createNotification({
        userId: authorId,
        type: 'social',
        icon: '💖',
        title: `${user.nickname} ถูกใจโพสต์ของคุณ`,
        body: 'ส่งกำลังใจและความรักให้คุณนะ!',
        action: `openPost:${postId}`,
        actionLabel: 'ดูโพสต์'
      });
    }

    return { success: true, liked: true };
  }
}

export function getSocialFeedPosts(limit = 40, currentUserId = '') {
  // 1. Fetch recent meals from logs (Exclude water logs completely so they never show as food)
  const mealRows = db.prepare(`
    SELECT l.id, l.user_id, l.date, l.name, l.calorie, l.sugar, l.carbs, l.protein, l.fat, l.sodium,
           l.portion_size, l.sweetness_level, l.is_private, l.image_url, l.water_ml, l.created_at,
           u.nickname, u.avatar_color, u.avatar_face, u.avatar_hat, u.avatar_image, u.privacy_level,
           u.calorie_goal, u.sugar_goal, u.goal_type, u.goal_score
    FROM logs l
    JOIN users u ON l.user_id = u.id
    WHERE (l.is_private = 0 OR l.user_id = ?)
      AND (u.privacy_level = 'full' OR l.user_id = ?)
      AND (l.water_ml IS NULL OR l.water_ml = 0)
      AND l.name NOT LIKE '%ดื่มน้ำ%'
      AND l.name NOT LIKE '%น้ำเปล่า%'
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(currentUserId, currentUserId, limit);

  // Pre-calculate user daily calorie and sugar totals for the dates
  const userDateTotals = {};
  for (const m of mealRows) {
    const k = `${m.user_id}_${m.date}`;
    if (!userDateTotals[k]) {
      const sumRow = db.prepare('SELECT SUM(calorie) as cal, SUM(sugar) as sug FROM logs WHERE user_id = ? AND date = ?').get(m.user_id, m.date);
      userDateTotals[k] = {
        total_cal: Math.round(sumRow?.cal || 0),
        total_sugar: Math.round((sumRow?.sug || 0) * 10) / 10
      };
    }
  }

  // 2. Fetch recent activities (water, goal, challenge, shop, streak)
  const actRows = db.prepare(`
    SELECT a.id, a.user_id, a.type, a.text, a.coins, a.created_at,
           u.nickname, u.avatar_color, u.avatar_face, u.avatar_hat, u.avatar_image, u.privacy_level
    FROM activities a
    JOIN users u ON a.user_id = u.id
    WHERE a.type != 'meal'
      AND (u.privacy_level = 'full' OR a.user_id = ? OR a.type = 'prank')
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(currentUserId, limit);

  // Map into unified post format
  const mealPosts = mealRows.map(m => {
    const dayTotal = userDateTotals[`${m.user_id}_${m.date}`] || { total_cal: m.calorie, total_sugar: m.sugar };
    return {
      id: m.id,
      type: 'meal',
      user_id: m.user_id,
      nickname: m.nickname,
      avatar_image: m.avatar_image,
      avatar_color: m.avatar_color,
      avatar_face: m.avatar_face,
      avatar_hat: m.avatar_hat,
      dish_name: m.name,
      calorie: m.calorie,
      sugar: m.sugar,
      carbs: m.carbs,
      protein: m.protein,
      fat: m.fat,
      sodium: m.sodium,
      image_url: m.image_url,
      portion_size: m.portion_size,
      sweetness_level: m.sweetness_level,
      date: m.date,
      created_at: m.created_at,
      calorie_goal: m.calorie_goal || 1850,
      sugar_goal: m.sugar_goal || 25,
      goal_type: m.goal_type || 'weight_loss',
      day_total_cal: dayTotal.total_cal,
      day_total_sugar: dayTotal.total_sugar,
      is_me: m.user_id === currentUserId
    };
  });

  const actPosts = actRows.map(a => ({
    id: a.id,
    type: a.type, // 'water', 'goal', 'challenge', 'shop', etc.
    user_id: a.user_id,
    nickname: a.nickname,
    avatar_image: a.avatar_image,
    avatar_color: a.avatar_color,
    avatar_face: a.avatar_face,
    avatar_hat: a.avatar_hat,
    text: a.text,
    coins: a.coins,
    created_at: a.created_at,
    is_me: a.user_id === currentUserId
  }));

  // Combine and sort by created_at DESC
  const allPosts = [...mealPosts, ...actPosts]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);

  return attachReactionsToPosts(allPosts, currentUserId);
}

export function attachReactionsToPosts(posts = [], currentUserId = '') {
  if (!posts || posts.length === 0) return [];

  // Batch query reactions
  const postIds = posts.map(p => p.id);
  const placeholders = postIds.map(() => '?').join(',');
  const reactions = db.prepare(`
    SELECT r.id, r.post_id, r.user_id, r.reaction_type, r.comment_text, r.created_at,
           u.nickname, u.avatar_image, u.avatar_color, u.avatar_face
    FROM post_reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.post_id IN (${placeholders})
    ORDER BY r.created_at ASC
  `).all(...postIds);

  const reactionMap = {};
  for (const r of reactions) {
    if (!reactionMap[r.post_id]) {
      reactionMap[r.post_id] = {
        likes_count: 0,
        liked_by_me: false,
        likers: [],
        comments: []
      };
    }
    if (r.reaction_type === 'heart') {
      reactionMap[r.post_id].likes_count += 1;
      reactionMap[r.post_id].likers.push(r.nickname);
      if (r.user_id === currentUserId) {
        reactionMap[r.post_id].liked_by_me = true;
      }
    } else if (r.reaction_type === 'comment' && r.comment_text) {
      reactionMap[r.post_id].comments.push({
        id: r.id,
        user_id: r.user_id,
        nickname: r.nickname,
        avatar_image: r.avatar_image,
        text: r.comment_text,
        created_at: r.created_at
      });
    }
  }

  return posts.map(p => ({
    ...p,
    reactions: reactionMap[p.id] || { likes_count: 0, liked_by_me: false, likers: [], comments: [] }
  }));
}

export function getGangStories(currentUserId = '') {
  const users = getAllUsers();
  const todayDate = new Date().toISOString().slice(0, 10);
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  return users.map(u => {
    const isMe = u.id === currentUserId;
    const streak = calculateUserStreak(u.id);
    const todayGoal = evaluateUserGoalToday(u, todayDate);
    
    // Count today's meals and water
    const meals = db.prepare('SELECT COUNT(*) as c FROM logs WHERE user_id = ? AND date = ?').get(u.id, todayDate)?.c || 0;
    const waterSum = db.prepare("SELECT SUM(COALESCE(water_ml, 500)) as s FROM logs WHERE user_id = ? AND date = ? AND (water_ml IS NOT NULL OR name LIKE '%น้ำเปล่า%')").get(u.id, todayDate)?.s || 0;

    // Fetch user's active 24-hour stories (meals/drinks posted within 24 hours)
    let userStories = [];
    if (isMe || (u.privacy_level !== 'summary' && u.privacy_level !== 'private')) {
      const rawStories = db.prepare(`
        SELECT id, user_id, date, name, calorie, sugar, carbs, protein, fat, sodium, portion_size, sweetness_level, is_private, image_url, created_at
        FROM logs
        WHERE user_id = ? 
          AND (created_at >= ? OR date >= ?)
          ${isMe ? '' : 'AND is_private = 0'}
          AND (water_ml IS NULL OR name NOT LIKE '%น้ำเปล่า%')
        ORDER BY created_at ASC
      `).all(u.id, since24h, todayDate);

      const mappedStories = rawStories.map(s => ({
        ...s,
        nickname: u.nickname,
        avatar_image: u.avatar_image,
        avatar_color: u.avatar_color,
        avatar_face: u.avatar_face,
        avatar_hat: u.avatar_hat,
        is_me: isMe
      }));
      userStories = attachReactionsToPosts(mappedStories, currentUserId);
    }

    return {
      id: u.id,
      nickname: u.nickname,
      avatar_image: u.avatar_image,
      avatar_color: u.avatar_color,
      avatar_face: u.avatar_face,
      avatar_hat: u.avatar_hat,
      is_me: isMe,
      streak: streak.current,
      today_meals: meals,
      today_water_ml: waterSum,
      goal_achieved: !!todayGoal?.achieved,
      goal_label: todayGoal?.goal_label || '',
      has_stories: userStories.length > 0,
      story_count: userStories.length,
      stories: userStories
    };
  });
}
