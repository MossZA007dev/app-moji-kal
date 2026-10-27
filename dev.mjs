import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.mjs';
import { analyzeFoodWithGemini, chatWithMochi, getSettings, saveSettings } from './gemini.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// SSE clients for live reload
const clients = new Set();

const liveReloadScript = `
<script>
(() => {
  const es = new EventSource('/__livereload');
  es.onmessage = (e) => {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
})();
</script>
`;

fs.watch(__dirname, { recursive: false }, (eventType, filename) => {
  if (!filename || filename.startsWith('.') || filename.includes('data') || filename.includes('node_modules')) return;
  for (const res of clients) {
    try {
      res.write('data: reload\n\n');
    } catch (_) {}
  }
});

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch (_) {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      // 1. Google Auth
      if (pathname === '/api/auth/google' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        let googleProfile = null;

        if (body.credential) {
          const payload = decodeJwtPayload(body.credential);
          if (payload && payload.sub) {
            googleProfile = {
              google_id: payload.sub,
              email: payload.email,
              name: payload.name || payload.given_name || 'Google User',
              picture: payload.picture
            };
          }
        } else if (body.devProfile) {
          googleProfile = {
            google_id: `g_dev_${body.devProfile.email || Date.now()}`,
            email: body.devProfile.email || `user_${Date.now()}@gmail.com`,
            name: body.devProfile.name || 'ผู้ใช้ Google',
            picture: body.devProfile.picture || null
          };
        }

        if (!googleProfile) {
          return sendJson(res, 400, { error: 'Invalid Google credential' });
        }

        const user = db.findOrCreateGoogleUser(googleProfile);
        return sendJson(res, 200, { success: true, user });
      }

      // 2. PDPA Consent
      if (pathname === '/api/auth/consent' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.userId) return sendJson(res, 400, { error: 'userId is required' });
        const updated = db.updateUser(body.userId, { consent_pdpa: 1 });
        return sendJson(res, 200, { success: true, user: updated });
      }

      // 3. AI Quota check
      if (pathname === '/api/auth/quota' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const current = db.getAiQuota(userId);
        return sendJson(res, 200, { current, limit: 15, remaining: Math.max(0, 15 - current) });
      }

      // 4. Streak
      if (pathname === '/api/streak' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const streak = db.calculateUserStreak(userId);
        return sendJson(res, 200, streak);
      }

      // 5. Favorites
      if (pathname === '/api/favorites' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const favorites = db.getFavorites(userId);
        return sendJson(res, 200, { favorites });
      }

      if (pathname === '/api/favorites' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.userId || !body.name) return sendJson(res, 400, { error: 'userId and name required' });
        const created = db.addFavorite(body);
        return sendJson(res, 201, { favorite: created });
      }

      const favMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/);
      if (favMatch && req.method === 'DELETE') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        db.deleteFavorite(favMatch[1], userId);
        return sendJson(res, 200, { success: true });
      }

      // 6. Challenges
      if (pathname === '/api/challenges' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const challenges = db.getChallenges(userId);
        return sendJson(res, 200, { challenges });
      }

      if (pathname === '/api/challenges/join' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.challengeId || !body.userId) return sendJson(res, 400, { error: 'challengeId and userId required' });
        const updated = db.joinChallenge(body.challengeId, body.userId);
        return sendJson(res, 200, { success: true, challenges: updated });
      }

      if (pathname === '/api/challenges/leave' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.challengeId || !body.userId) return sendJson(res, 400, { error: 'challengeId and userId required' });
        const updated = db.leaveChallenge(body.challengeId, body.userId);
        return sendJson(res, 200, { success: true, challenges: updated });
      }

      // 7. Monthly Calendar
      if (pathname === '/api/calendar' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        const ym = parsedUrl.searchParams.get('ym') || new Date().toISOString().slice(0, 7);
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const calendar = db.getMonthlyCalendar(userId, ym);
        return sendJson(res, 200, calendar);
      }

      // 8. Chat with Mochi AI (Phase 3)
      if (pathname === '/api/chat' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const messages = db.getChatMessages(userId);
        return sendJson(res, 200, { messages });
      }

      if (pathname === '/api/chat' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const userId = req.headers['x-user-id'] || body.userId;
        const message = body.message;
        if (!userId || !message) return sendJson(res, 400, { error: 'userId and message are required' });

        const user = db.getUser(userId);
        if (!user) return sendJson(res, 401, { error: 'unauthorized', message: 'กรุณาเข้าสู่ระบบก่อนคุยกับโมจิ' });

        // Save user message
        db.saveChatMessage({ userId, role: 'user', content: message });

        // Gather user context for today
        const todayDate = new Date().toISOString().slice(0, 10);
        const logs = db.getLogs(userId, todayDate);
        const streak = db.calculateUserStreak(userId);

        const totalCal = logs.reduce((a, b) => a + (Number(b.calorie) || 0), 0);
        const totalSugar = logs.reduce((a, b) => a + (Number(b.sugar) || 0), 0);
        const totalCarbs = Math.round(logs.reduce((a, b) => a + (Number(b.carbs) || 0), 0) * 10) / 10;
        const totalSodium = Math.round(logs.reduce((a, b) => a + (Number(b.sodium) || 0), 0));
        const totalProtein = Math.round(logs.reduce((a, b) => a + (Number(b.protein) || 0), 0) * 10) / 10;
        const totalFat = Math.round(logs.reduce((a, b) => a + (Number(b.fat) || 0), 0) * 10) / 10;

        const userContext = {
          nickname: user?.nickname || 'เพื่อน',
          personality: user?.personality || 'kind',
          goal_type: user?.goal_type || 'weight_loss',
          calorie_goal: user?.calorie_goal || 2000,
          sugar_goal: user?.sugar_goal || 25,
          today_cal: totalCal,
          today_sugar: totalSugar,
          today_carbs: totalCarbs,
          today_sodium: totalSodium,
          today_protein: totalProtein,
          today_fat: totalFat,
          today_meals: logs,
          streak: streak.current
        };

        const result = await chatWithMochi({ message, userContext });

        // Save mochi response
        db.saveChatMessage({ userId, role: 'mochi', content: result.reply });

        return sendJson(res, 200, result);
      }

      // 9. Users
      if (pathname === '/api/users' && req.method === 'GET') {
        return sendJson(res, 200, { users: db.getAllUsers() });
      }

      if (pathname === '/api/users' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const newUser = db.createUser(body);
        return sendJson(res, 201, { user: newUser });
      }

      const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch && req.method === 'GET') {
        const u = db.getUser(userMatch[1]);
        if (!u) return sendJson(res, 404, { error: 'User not found' });
        return sendJson(res, 200, { user: u });
      }

      if (userMatch && req.method === 'PUT') {
        const body = await parseJsonBody(req);
        const updated = db.updateUser(userMatch[1], body);
        if (!updated) return sendJson(res, 404, { error: 'User not found' });
        return sendJson(res, 200, { user: updated });
      }

      if (userMatch && req.method === 'DELETE') {
        db.deleteUserAndData(userMatch[1]);
        return sendJson(res, 200, { success: true, deleted: userMatch[1] });
      }

      // 10. Group Feed
      if (pathname === '/api/feed' && req.method === 'GET') {
        const date = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const userId = req.headers['x-user-id'] || parsedUrl.searchParams.get('userId') || '';
        const feed = db.getGroupFeed(date, userId);
        return sendJson(res, 200, { feed, date });
      }

      // 10.1 Activities Stream (Dashboard)
      if (pathname === '/api/activities' && req.method === 'GET') {
        const activities = db.getRecentActivities(30);
        return sendJson(res, 200, { activities });
      }

      // 10.2 Leaderboard (Goal Score & Coins)
      if (pathname === '/api/leaderboard' && req.method === 'GET') {
        const sort = parsedUrl.searchParams.get('sort') || 'goal';
        const leaderboard = db.getLeaderboard(sort);
        return sendJson(res, 200, { leaderboard, sortBy: sort });
      }

      // 10.3 Member Profile Details
      const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
      if (memberMatch && req.method === 'GET') {
        const targetUserId = memberMatch[1];
        const requesterId = req.headers['x-user-id'] || parsedUrl.searchParams.get('requesterId') || targetUserId;
        const detail = db.getMemberDetail(targetUserId, requesterId);
        if (!detail) return sendJson(res, 404, { error: 'Member not found' });
        return sendJson(res, 200, detail);
      }

      // 10.4 Send Cheer to Friend
      if (pathname === '/api/cheer' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const fromUserId = req.headers['x-user-id'] || body.fromUserId;
        const { toUserId, cheerType } = body;
        if (!fromUserId || !toUserId) {
          return sendJson(res, 400, { error: 'fromUserId and toUserId required' });
        }
        const result = db.sendCheer(fromUserId, toUserId, cheerType || 'heart');
        if (!result) return sendJson(res, 404, { error: 'User not found' });
        return sendJson(res, 200, result);
      }

      // 10.5 Water Logging & Coins
      if (pathname === '/api/water' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const userId = req.headers['x-user-id'] || body.userId;
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const act = db.recordActivity(userId, 'water', 'ดื่มน้ำเปล่าชื่นใจ 💧 (+2 🪙)', 2);
        return sendJson(res, 200, { success: true, activity: act, coinsEarned: 2 });
      }

      // 11. Meal Logs
      if (pathname === '/api/logs' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        const requesterId = req.headers['x-user-id'] || parsedUrl.searchParams.get('requesterId') || userId;
        const date = parsedUrl.searchParams.get('date');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const logs = db.getLogsSecure(userId, requesterId, date);
        return sendJson(res, 200, { logs });
      }

      if (pathname === '/api/logs' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.userId || !body.name) {
          return sendJson(res, 400, { error: 'userId and name are required' });
        }
        const created = db.addLog(body);
        return sendJson(res, 201, { log: created });
      }

      // Undo meal deletion
      if (pathname === '/api/logs/undo' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.log || !body.log.id) return sendJson(res, 400, { error: 'log is required' });
        const restored = db.restoreDeletedLog(body.log);
        return sendJson(res, 200, { success: true, log: restored });
      }

      const logMatch = pathname.match(/^\/api\/logs\/([^/]+)$/);
      if (logMatch && req.method === 'DELETE') {
        const userId = req.headers['x-user-id'] || parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const deletedLog = db.deleteLog(logMatch[1], userId);
        return sendJson(res, 200, { success: true, deletedLog });
      }

      // 12. AI Food Analysis with Rate Limiting & Group Verified Knowledge Cache
      if (pathname === '/api/analyze' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const userId = req.headers['x-user-id'] || body.userId;
        if (!userId || !db.getUser(userId)) {
          return sendJson(res, 401, { error: 'unauthorized', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน AI วิเคราะห์อาหาร' });
        }

        // Fast Path: Check Group Verified Knowledge Cache (Point 3)
        if (!body.imageBase64 && body.text) {
          const verified = db.lookupVerifiedDish(body.text);
          if (verified) {
            let cal = verified.calorie;
            let sugar = verified.sugar;
            if (body.portion === 'small') { cal = Math.round(cal * 0.75); sugar = Math.round(sugar * 0.8 * 10) / 10; }
            if (body.portion === 'large') { cal = Math.round(cal * 1.35); sugar = Math.round(sugar * 1.25 * 10) / 10; }
            return sendJson(res, 200, {
              name: verified.display_name,
              kcal: Math.round(cal),
              sugar: Math.round(sugar * 10) / 10,
              confidence: 'high',
              needs_clarification: false,
              note: `✨ ดึงจากฐานข้อมูลเมนูที่กลุ่มยืนยันแล้ว (${verified.confidence_score} ครั้ง) รวดเร็วและไม่เสียโควตา AI`,
              components: [{ name: verified.display_name, kcal: Math.round(cal), sugar: Math.round(sugar * 10) / 10 }],
              from_cache: true,
              quota: { allowed: true, current: db.getAiQuota(userId), limit: 15 }
            });
          }
        }

        const quota = db.checkAndIncrementAiQuota(userId, 15);
        if (!quota.allowed) {
          return sendJson(res, 429, {
            error: 'quota_exceeded',
            message: 'วันนี้คุณใช้โควตา AI ครบ 15 ครั้งแล้วน้า เพื่อประหยัดต้นทุน แนะนำให้กรอกตัวเลขเองในครั้งต่อไปได้นะ 🍡',
            current: quota.current,
            limit: quota.limit
          });
        }

        const result = await analyzeFoodWithGemini(body);
        result.quota = quota;
        return sendJson(res, 200, result);
      }

      // 12.1 Auto/Manual Backup API
      if (pathname === '/api/backup' && req.method === 'GET') {
        db.runAutoBackup();
        return sendJson(res, 200, { success: true, message: 'ระบบสำรองข้อมูลเรียบร้อยแล้ว' });
      }

      // 13. CSV Export
      if (pathname === '/api/export/csv' && req.method === 'GET') {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        const csv = db.exportUserCsv(userId);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="mochi_logs_${userId}_${new Date().toISOString().slice(0, 10)}.csv"`
        });
        return res.end(csv);
      }

      // 14. Settings
      if (pathname === '/api/settings' && req.method === 'GET') {
        const settings = getSettings();
        const maskedKey = settings.geminiApiKey
          ? `${settings.geminiApiKey.slice(0, 6)}...${settings.geminiApiKey.slice(-4)}`
          : '';
        return sendJson(res, 200, {
          hasGeminiKey: Boolean(settings.geminiApiKey),
          maskedKey,
          googleClientId: settings.googleClientId || ''
        });
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const toSave = {};
        if (typeof body.geminiApiKey === 'string') {
          toSave.geminiApiKey = body.geminiApiKey.trim();
        }
        if (typeof body.googleClientId === 'string') {
          toSave.googleClientId = body.googleClientId.trim();
        }
        saveSettings(toSave);
        return sendJson(res, 200, { success: true, settings: getSettings() });
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (apiErr) {
      console.error('API Error:', apiErr);
      return sendJson(res, 500, { error: apiErr.message || 'Internal Server Error' });
    }
  }

  // Static File Serving
  let relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath = path.join(__dirname, relativePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (pathname === '/favicon.ico' && fs.existsSync(path.join(__dirname, 'favicon.svg'))) {
        filePath = path.join(__dirname, 'favicon.svg');
      } else if (!path.extname(pathname)) {
        // SPA navigation route fallback
        filePath = path.join(__dirname, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      let contentType = MIME_TYPES[ext] || 'application/octet-stream';
      if (filePath.endsWith('manifest.json')) {
        contentType = 'application/manifest+json; charset=utf-8';
      }

      if (ext === '.html') {
        const html = content.toString('utf-8');
        const injected = html.includes('</body>')
          ? html.replace('</body>', `${liveReloadScript}</body>`)
          : html + liveReloadScript;
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(injected);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n  \x1b[32m\x1b[1m🍡 โมจิ · Phase 3 Ready (Chat AI, Wardrobe, Voice Input, Breakdown)\x1b[0m`);
  console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
  console.log(`  \x1b[90m➜  SQLite Database: ./data/moji.db\x1b[0m\n`);
});
