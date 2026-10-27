import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsFile = path.join(__dirname, 'data', 'settings.json');

// Centralized AI Model Name (Pillar 2: Easy single-place modification)
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const fmt = n => Math.round((Number(n) || 0) * 10) / 10;

export function getFoodEmoji(name = '') {
  const n = String(name).toLowerCase();
  if (n.includes('ข้าว')) return '🍚';
  if (n.includes('ไข่')) return '🍳';
  if (n.includes('ไก่')) return '🍗';
  if (n.includes('หมู') || n.includes('เนื้อ') || n.includes('สเต็ก')) return '🥩';
  if (n.includes('กุ้ง') || n.includes('ปลา') || n.includes('ซีฟู้ด') || n.includes('หอย') || n.includes('ปู')) return '🦐';
  if (n.includes('เส้น') || n.includes('ก๋วยเตี๋ยว') || n.includes('ผัดไทย') || n.includes('วุ้นเส้น') || n.includes('ราเมง') || n.includes('สปาเก็ตตี้')) return '🍜';
  if (n.includes('ผัก') || n.includes('ส้มตำ') || n.includes('มะละกอ') || n.includes('สลัด')) return '🥗';
  if (n.includes('ชา') || n.includes('มุก') || n.includes('นม') || n.includes('ลาเต้') || n.includes('กาแฟ') || n.includes('สมูทตี้')) return '🧋';
  if (n.includes('ซุป') || n.includes('น้ำซุป') || n.includes('น้ำจิ้ม') || n.includes('ซอส')) return '🥣';
  if (n.includes('เห็ด')) return '🍄';
  if (n.includes('อโวคาโด') || n.includes('avocado')) return '🥑';
  if (n.includes('ขนม') || n.includes('เค้ก') || n.includes('เบเกอรี่') || n.includes('โดนัท')) return '🍰';
  if (n.includes('ขนมปัง') || n.includes('โทสต์') || n.includes('แซนวิช')) return '🍞';
  if (n.includes('ผลไม้') || n.includes('แอปเปิ้ล') || n.includes('กล้วย') || n.includes('ส้ม')) return '🍎';
  if (n.includes('น้ำ') || n.includes('เครื่องดื่ม')) return '💧';
  return '🍽️';
}

export function enrichComponents(components, defaultName = 'มื้ออาหาร', defaultKcal = 0, defaultSugar = 0, defaultCarbs = null, defaultProtein = null, defaultFat = null) {
  const pinSlots = [
    { x: 30, y: 44 },
    { x: 68, y: 36 },
    { x: 42, y: 68 },
    { x: 74, y: 60 },
    { x: 50, y: 26 },
    { x: 25, y: 70 }
  ];

  const cal = Math.max(0, Math.round(Number(defaultKcal) || 0));
  const sug = Math.max(0, Math.round((Number(defaultSugar) || 0) * 10) / 10);
  const defCarb = defaultCarbs !== null && defaultCarbs !== undefined ? Math.round(Number(defaultCarbs) * 10) / 10 : Math.round((cal * 0.45 / 4) * 10) / 10;
  const defProt = defaultProtein !== null && defaultProtein !== undefined ? Math.round(Number(defaultProtein) * 10) / 10 : Math.round((cal * 0.2 / 4) * 10) / 10;
  const defFat = defaultFat !== null && defaultFat !== undefined ? Math.round(Number(defaultFat) * 10) / 10 : Math.round((cal * 0.35 / 9) * 10) / 10;

  if (!Array.isArray(components) || components.length === 0) {
    return [{
      name: defaultName || 'มื้อหลัก',
      kcal: cal,
      carbs: defCarb,
      sugar: sug,
      protein: defProt,
      fat: defFat,
      icon: getFoodEmoji(defaultName),
      x: 50,
      y: 50
    }];
  }

  return components.map((c, i) => {
    const slot = pinSlots[i % pinSlots.length];
    const name = String(c.name || `ส่วนประกอบ ${i + 1}`);
    const x = typeof c.x === 'number' && c.x >= 10 && c.x <= 90 ? Math.round(c.x) : slot.x;
    const y = typeof c.y === 'number' && c.y >= 10 && c.y <= 90 ? Math.round(c.y) : slot.y;
    const k = Math.max(0, Math.round(Number(c.kcal) || 0));
    const s = Math.max(0, Math.round((Number(c.sugar) || 0) * 10) / 10);
    const cb = c.carbs !== undefined && c.carbs !== null ? Math.round(Number(c.carbs) * 10) / 10 : Math.round((k * 0.45 / 4) * 10) / 10;
    const pr = c.protein !== undefined && c.protein !== null ? Math.round(Number(c.protein) * 10) / 10 : Math.round((k * 0.2 / 4) * 10) / 10;
    const ft = c.fat !== undefined && c.fat !== null ? Math.round(Number(c.fat) * 10) / 10 : Math.round((k * 0.35 / 9) * 10) / 10;
    const sd = c.sodium !== undefined && c.sodium !== null ? Math.round(Number(c.sodium)) : Math.round(k * 1.3);

    return {
      name,
      kcal: k,
      carbs: cb,
      sugar: s,
      protein: pr,
      fat: ft,
      sodium: sd,
      icon: c.icon || getFoodEmoji(name),
      x,
      y
    };
  });
}

export function getSettings() {
  let fileData = {};
  try {
    if (fs.existsSync(settingsFile)) {
      fileData = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    }
  } catch (_) {}
  return {
    geminiApiKey: fileData.geminiApiKey || process.env.GEMINI_API_KEY || '',
    googleClientId: fileData.googleClientId || process.env.GOOGLE_CLIENT_ID || ''
  };
}

export function saveSettings(settings) {
  const current = getSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

// Built-in Thai food & drink baseline database
const THAI_FOOD_DB = [
  { keywords: ['ชานมไข่มุก', 'ชานม', 'boba'], name: 'ชานมไข่มุก', baseCal: 360, baseSugar: 28, baseSodium: 75, isDrink: true, components: [{ name: 'ชาและนม', kcal: 220, sugar: 20, sodium: 55, icon: '🧋', x: 50, y: 38 }, { name: 'ไข่มุกบราวน์ชูการ์', kcal: 140, sugar: 8, sodium: 20, icon: '🧋', x: 50, y: 72 }] },
  { keywords: ['ชาไทย', 'ชาเย็น'], name: 'ชาไทยเย็น', baseCal: 220, baseSugar: 24, baseSodium: 85, isDrink: true, components: [{ name: 'ชาไทยสกัด', kcal: 20, sugar: 0, sodium: 10, icon: '🧋', x: 50, y: 35 }, { name: 'นมข้นหวานและนมสด', kcal: 200, sugar: 24, sodium: 75, icon: '🥛', x: 50, y: 65 }] },
  { keywords: ['ชาเขียวเย็น', 'มัทฉะลาเต้', 'ชาเขียวนม'], name: 'ชาเขียวนมเย็น', baseCal: 240, baseSugar: 22, baseSodium: 80, isDrink: true, components: [{ name: 'มัทฉะแท้', kcal: 30, sugar: 0, sodium: 10, icon: '🍵', x: 50, y: 35 }, { name: 'นมสดและไซรัป', kcal: 210, sugar: 22, sodium: 70, icon: '🥛', x: 50, y: 65 }] },
  { keywords: ['กาแฟดำ', 'อเมริกาโน่', 'americano'], name: 'อเมริกาโน่เย็น (ไม่หวาน)', baseCal: 15, baseSugar: 0, baseSodium: 10, isDrink: true, components: [{ name: 'เอสเพรสโซ่ช็อต + น้ำ', kcal: 15, sugar: 0, sodium: 10, icon: '☕', x: 50, y: 50 }] },
  { keywords: ['ลาเต้', 'latte', 'คาปูชิโน่', 'cappuccino'], name: 'ลาเต้เย็น', baseCal: 180, baseSugar: 12, baseSodium: 110, isDrink: true, components: [{ name: 'กาแฟ', kcal: 15, sugar: 0, sodium: 10, icon: '☕', x: 50, y: 35 }, { name: 'นมสด', kcal: 165, sugar: 12, sodium: 100, icon: '🥛', x: 50, y: 65 }] },
  { keywords: ['กะเพรา', 'ผัดกะเพรา'], name: 'ผัดกะเพราหมูสับ + ไข่ดาว', baseCal: 630, baseSugar: 3, baseSodium: 980, components: [{ name: 'ข้าวสวย 1 จาน', kcal: 200, sugar: 0, sodium: 15, icon: '🍚', x: 34, y: 58 }, { name: 'ผัดกะเพราหมูสับ', kcal: 310, sugar: 2.5, sodium: 820, icon: '🥩', x: 68, y: 46 }, { name: 'ไข่ดาว', kcal: 120, sugar: 0.5, sodium: 145, icon: '🍳', x: 48, y: 28 }] },
  { keywords: ['ข้าวมันไก่'], name: 'ข้าวมันไก่ตอน', baseCal: 580, baseSugar: 1.5, baseSodium: 850, components: [{ name: 'ข้าวมัน', kcal: 300, sugar: 0.5, sodium: 280, icon: '🍚', x: 38, y: 60 }, { name: 'เนื้อไก่ตอน', kcal: 220, sugar: 0, sodium: 160, icon: '🍗', x: 62, y: 45 }, { name: 'น้ำจิ้มและน้ำซุป', kcal: 60, sugar: 1, sodium: 410, icon: '🥣', x: 50, y: 25 }] },
  { keywords: ['ข้าวผัด'], name: 'ข้าวผัดหมู/ไก่', baseCal: 550, baseSugar: 2.5, baseSodium: 780, components: [{ name: 'ข้าวผัดน้ำมัน', kcal: 420, sugar: 1.5, sodium: 520, icon: '🍚', x: 45, y: 56 }, { name: 'เนื้อสัตว์และไข่', kcal: 130, sugar: 1, sodium: 260, icon: '🥩', x: 65, y: 40 }] },
  { keywords: ['ก๋วยเตี๋ยวต้มยำ'], name: 'ก๋วยเตี๋ยวต้มยำน้ำข้น', baseCal: 480, baseSugar: 9, baseSodium: 1450, components: [{ name: 'เส้นก๋วยเตี๋ยว', kcal: 180, sugar: 0, sodium: 50, icon: '🍜', x: 42, y: 55 }, { name: 'หมูสับ/ลูกชิ้น', kcal: 160, sugar: 1, sodium: 450, icon: '🥩', x: 68, y: 42 }, { name: 'น้ำซุปต้มยำปรุงรส', kcal: 140, sugar: 8, sodium: 950, icon: '🥣', x: 50, y: 72 }] },
  { keywords: ['ผัดไทย'], name: 'ผัดไทยกุ้งสด', baseCal: 550, baseSugar: 15, baseSodium: 980, components: [{ name: 'เส้นจันท์และเต้าหู้', kcal: 320, sugar: 2, sodium: 320, icon: '🍜', x: 42, y: 54 }, { name: 'กุ้งสดและไข่', kcal: 110, sugar: 0, sodium: 180, icon: '🦐', x: 66, y: 38 }, { name: 'น้ำซอสผัดไทยน้ำมะขาม', kcal: 120, sugar: 13, sodium: 480, icon: '🥣', x: 52, y: 72 }] },
  { keywords: ['ส้มตำไทย'], name: 'ส้มตำไทย', baseCal: 120, baseSugar: 14, baseSodium: 890, components: [{ name: 'มะละกอและผัก', kcal: 45, sugar: 2, sodium: 20, icon: '🥗', x: 45, y: 45 }, { name: 'น้ำส้มตำน้ำตาลปี๊บ', kcal: 75, sugar: 12, sodium: 870, icon: '🥣', x: 62, y: 60 }] },
  { keywords: ['สุกี้'], name: 'สุกี้น้ำรวมมิตร', baseCal: 320, baseSugar: 6, baseSodium: 1120, components: [{ name: 'วุ้นเส้นและผักสด', kcal: 130, sugar: 1, sodium: 60, icon: '🥗', x: 40, y: 50 }, { name: 'เนื้อสัตว์และไข่', kcal: 130, sugar: 0, sodium: 210, icon: '🥩', x: 64, y: 42 }, { name: 'น้ำจิ้มสุกี้', kcal: 60, sugar: 5, sodium: 850, icon: '🥣', x: 50, y: 70 }] },
];

const BRAND_BASELINES = {
  amazon: { name: 'Cafe Amazon', factor: 1.35 },
  street: { name: 'ร้านชงโบราณ / รถเข็น', factor: 1.5 },
  chatramue: { name: 'ชาตรามือ / ชานมไข่มุก', factor: 1.15 },
  taobin: { name: 'เต่าบิน (Tao Bin)', factor: 0.95 },
  starbucks: { name: 'Starbucks', factor: 0.95 },
  standard: { name: 'ร้านทั่วไป / คาเฟ่', factor: 1.0 }
};

function fallbackAnalyze(text = '', sweetness = 'normal', portion = 'normal', brand = 'standard', toppings = []) {
  if (!text.trim()) {
    return {
      name: '',
      kcal: 0,
      sugar: 0,
      is_food: false,
      confidence: 'low',
      needs_clarification: false,
      clarification_question: null,
      options: null,
      components: [],
      note: '💡 ยังไม่ได้เชื่อมต่อ Gemini API Key สำหรับสแกนรูปภาพ กรุณาพิมพ์ชื่ออาหารด้านบน หรือใส่ API Key ในหน้าตั้งค่า 🍡',
      is_fallback: true
    };
  }

  const lower = text.toLowerCase();
  let matched = THAI_FOOD_DB.find(item => item.keywords.some(k => lower.includes(k)));

  if (!matched) {
    const isSweetDrink = lower.includes('ชา') || lower.includes('กาแฟ') || lower.includes('นม') || lower.includes('หวาน') || lower.includes('amazon') || lower.includes('เต่าบิน');
    let baseSugar = isSweetDrink ? 24 : 4;
    let baseKcal = isSweetDrink ? 220 : 450;

    if (isSweetDrink) {
      const brandFactor = BRAND_BASELINES[brand]?.factor || 1.0;
      baseSugar *= brandFactor;
      if (sweetness === 'none') baseSugar = 0;
      else if (sweetness === 'less') baseSugar *= 0.35;
      else if (sweetness === 'half') baseSugar *= 0.6;
      else if (sweetness === 'sweet') baseSugar *= 1.25;

      if (toppings.includes('boba')) { baseSugar += 12; baseKcal += 110; }
      if (toppings.includes('whip')) { baseSugar += 2; baseKcal += 85; }
      if (toppings.includes('jelly')) { baseSugar += 1; baseKcal += 15; }
    }

    const fbSodiumDrink = Math.round(isSweetDrink ? 60 : (baseKcal * 1.3));
    return {
      name: text.trim() || 'มื้ออาหาร',
      kcal: Math.round(baseKcal),
      carbs: Math.round((baseKcal * 0.45 / 4) * 10) / 10,
      sugar: Math.round(baseSugar * 10) / 10,
      protein: Math.round((baseKcal * 0.2 / 4) * 10) / 10,
      fat: Math.round((baseKcal * 0.35 / 9) * 10) / 10,
      sodium: fbSodiumDrink,
      confidence: 'medium',
      needs_clarification: isSweetDrink && sweetness === 'normal',
      clarification_question: isSweetDrink ? 'แก้วนี้สั่งหวานระดับไหนคะ? เพื่อคำนวณน้ำตาลให้แม่นยำ' : 'ระบุขนาดหรือส่วนผสมเพิ่มเติมได้นะ',
      note: isSweetDrink ? `ประเมินตามสูตร ${BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป'}` : 'ประเมินจากฐานข้อมูลอาหารไทยเบื้องต้น',
      components: enrichComponents(
        [{ name: text.trim() || 'มื้อหลัก', kcal: Math.round(baseKcal), sugar: Math.round(baseSugar * 10) / 10, sodium: fbSodiumDrink }],
        text.trim() || 'มื้ออาหาร',
        baseKcal,
        baseSugar
      ),
      is_fallback: true
    };
  }

  let cal = matched.baseCal;
  let sugar = matched.baseSugar;
  let sodium = matched.baseSodium || (matched.isDrink ? 70 : 800);

  if (matched.isDrink) {
    const brandFactor = BRAND_BASELINES[brand]?.factor || 1.0;
    sugar *= brandFactor;

    if (sweetness === 'none' || lower.includes('ไม่หวาน') || lower.includes('0%')) {
      sugar = Math.max(0, sugar * 0.04);
      cal -= 60;
    } else if (sweetness === 'less' || lower.includes('หวานน้อย') || lower.includes('25%')) {
      sugar = Math.round(sugar * 0.35 * 10) / 10;
      cal -= 40;
    } else if (sweetness === 'half' || lower.includes('หวาน 50%') || lower.includes('50%')) {
      sugar = Math.round(sugar * 0.6 * 10) / 10;
      cal -= 25;
    } else if (sweetness === 'sweet' || lower.includes('หวานมาก') || lower.includes('120%')) {
      sugar = Math.round(sugar * 1.25 * 10) / 10;
      cal += 40;
    }

    if (toppings.includes('boba')) { sugar += 12; cal += 110; sodium += 20; }
    if (toppings.includes('whip')) { sugar += 2; cal += 85; sodium += 30; }
    if (toppings.includes('jelly')) { sugar += 1; cal += 15; sodium += 10; }
  }

  if (portion === 'small') {
    cal = Math.round(cal * 0.75);
    sugar = Math.round(sugar * 0.8 * 10) / 10;
    sodium = Math.round(sodium * 0.8);
  } else if (portion === 'large') {
    cal = Math.round(cal * 1.35);
    sugar = Math.round(sugar * 1.25 * 10) / 10;
    sodium = Math.round(sodium * 1.3);
  }

  const needsClarification = matched.isDrink && sweetness === 'normal' && !lower.includes('หวาน');

  const fbCarbs = Math.round((cal * 0.45 / 4) * 10) / 10;
  const fbProtein = Math.round((cal * 0.2 / 4) * 10) / 10;
  const fbFat = Math.round((cal * 0.35 / 9) * 10) / 10;

  return {
    name: matched.name,
    kcal: Math.round(cal),
    carbs: fbCarbs,
    sugar: Math.round(sugar * 10) / 10,
    protein: fbProtein,
    fat: fbFat,
    sodium: Math.round(sodium),
    confidence: 'high',
    needs_clarification: needsClarification,
    clarification_question: needsClarification ? `สั่ง "${matched.name}" ระดับความหวานเท่าไหร่? (ค่านี้คิดจากหวานปกติ 100%)` : null,
    options: matched.isDrink ? ['ไม่หวาน 0% (~0g)', 'หวานน้อย 25% (~8g)', 'หวานปกติ 100% (~' + Math.round(sugar) + 'g)'] : null,
    note: `คำนวณจากสูตรอาหารไทยมาตรฐาน (${matched.name}) อิง ${BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป'}`,
    components: enrichComponents(matched.components, matched.name, cal, sugar, fbCarbs, fbProtein, fbFat),
    is_fallback: true
  };
}

export async function analyzeFoodWithGemini({ text = '', imageBase64 = null, imageMimeType = 'image/jpeg', sweetness = 'normal', portion = 'normal', brand = 'standard', toppings = [] }) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    if (!text.trim()) {
      return {
        name: '',
        kcal: 0,
        sugar: 0,
        is_food: false,
        confidence: 'low',
        needs_clarification: false,
        clarification_question: null,
        options: null,
        components: [],
        note: '💡 ยังไม่ได้เชื่อมต่อ Gemini API Key ในการดูรูปภาพ กรุณาพิมพ์ชื่อเมนูอาหาร หรือใส่ API Key ในหน้าตั้งค่า 🍡',
        is_fallback: true
      };
    }
    const res = fallbackAnalyze(text, sweetness, portion, brand, toppings);
    res.note += ' 💡 (ใส่ Gemini API Key ในเมนูตั้งค่าเพื่อเปิดระบบวิเคราะห์รูปภาพด้วย AI)';
    return res;
  }

  const brandInfo = BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป';
  const toppingsList = Array.isArray(toppings) ? toppings.join(', ') : '';

  const prompt = `
คุณคือผู้ช่วยโภชนาการและนักวิเคราะห์ภาพอาหารระบบ AI ชั้นสูง (AR Food Vision Scanner)
วิเคราะห์อาหารหรือเครื่องดื่มจากรูปภาพที่แนบมา และคำอธิบายของผู้ใช้
- คำอธิบาย: "${text || '(ไม่มี)'}"
- ระดับความหวานที่เลือกไว้: "${sweetness}"
- ร้าน/แบรนด์เครื่องดื่มที่เลือก: "${brandInfo}"
- ท็อปปิ้งเพิ่มเติม: "${toppingsList || 'ไม่มี'}"
- ขนาดส่วนที่เลือกไว้: "${portion}"

บริบทเรื่องความหวานของร้านและแบรนด์ในประเทศไทย:
1. Cafe Amazon: หวาน 100% มีน้ำตาลสูงมาก ~40-45g (10-11 ช้อนชา), หวาน 50% ~21g, หวาน 25% ~11g
2. ชาตรามือ / Kamu / KOI Thé / ชานมไข่มุก: หวาน 100% ~36-38g (9 ช้อนชา), ถ้าใส่ไข่มุกให้บวกน้ำตาลเพิ่ม +10-12g (+110 kcal)
3. ร้านชงโบราณ / รถเข็น / ตลาดนัด: ใช้นมข้นหวาน+น้ำเชื่อมจัดเต็ม หวาน 100% สูงถึง ~48-52g (12-13 ช้อนชา)
4. ตู้เต่าบิน (Tao Bin): หวาน 100% ~28-30g, หวาน 60% ~18g
5. Starbucks: ไซรัปมาตรฐาน 3-4 ปั๊ม (ปั๊มละ ~5g)
6. หากผู้ใช้เลือกความหวาน:
   - "none" (0%): น้ำตาลเติมแต่งเป็น 0g (คงเหลือน้ำตาลธรรมชาติจากนม 0-2g เท่านั้น)
   - "less" (25%): ให้น้ำตาลประมาณ 25-30% ของสูตรปกติ
   - "half" (50%): ให้น้ำตาลประมาณ 50-60% ของสูตรปกติ
   - "normal" (100%): ให้น้ำตาลตามสูตรจริงของร้าน
   - "sweet" (120%): ให้น้ำตาลประมาณ 125-130%

ข้อกำหนดสำคัญในการตอบ:
1. ตอบเป็น JSON object ตัวเดียวเท่านั้น ห้ามมี markdown หรือ backticks
2. ต้องประเมิน:
   - "is_food": boolean (ต้องเป็น true เฉพาะเมื่อรูปภาพหรือคำอธิบายเป็นอาหาร เครื่องดื่ม ขนม ของกิน หรือวัตถุดิบจริงเท่านั้น! หากเป็นรูปเอกสาร ข้อความ คน สัตว์ สิ่งของ รถยนต์ หรือวิวทิวทัศน์ ให้ตอบ false ทันที)
   - "name": ชื่อเมนูสั้นๆ ภาษาไทย (หากไม่ใช่ของกิน ให้ใส่ "ไม่ใช่รูปอาหาร")
   - "kcal": แคลอรีรวมทั้งจาน (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "carbs": ปริมาณแป้งและคาร์โบไฮเดรตรวมทั้งจานเป็นกรัม (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "sugar": ปริมาณน้ำตาลรวมทั้งจานเป็นกรัม (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "protein": ปริมาณโปรตีนรวมทั้งจานเป็นกรัม (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "fat": ปริมาณไขมันรวมทั้งจานเป็นกรัม (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "sodium": ปริมาณโซเดียมรวมทั้งจานเป็นมิลลิกรัม mg (เช่น อาหารไทย/ก๋วยเตี๋ยว/แกง มักมี 600-1400mg, ข้าวจานเดียว 500-900mg, สลัด/ผลไม้ 10-150mg, เครื่องดื่ม 20-120mg) (ถ้าไม่ใช่ของกินให้ใส่ 0)
   - "confidence": "high" | "medium" | "low"
   - "needs_clarification": true ถ้าเป็นเครื่องดื่มหรือของหวานที่ข้อมูลความหวานหรือไซส์ไม่ชัดเจน
   - "clarification_question": คำถามสั้นๆ ถามกลับเมื่อข้อมูลไม่พอ
   - "options": อาเรย์ของตัวเลือกแนะนำ หรือ null
   - "components": อาเรย์แจกแจงแยกชิ้นส่วนของอาหารแต่ละอย่างในจาน เพื่อนำไปปักหมุด AR Pin บนรูปภาพ เช่น ขนมปังโทสต์อะโวคาโด, ไข่ต้ม, เห็ดผัด, มะเขือเทศ:
     ตัวอย่าง:
     [
       {"name":"โทสต์อะโวคาโด","icon":"🥑","kcal":240,"carbs":22,"sugar":1.5,"protein":4.5,"fat":15,"sodium":280,"x":25,"y":45},
       {"name":"เห็ดผัดซอส","icon":"🍄","kcal":170,"carbs":24,"sugar":2.0,"protein":6.0,"fat":5.5,"sodium":360,"x":65,"y":35},
       {"name":"ไข่ต้มผ่าซีก","icon":"🥚","kcal":216,"carbs":1.2,"sugar":0.5,"protein":18.0,"fat":14.0,"sodium":140,"x":40,"y":68},
       {"name":"มะเขือเทศราชินี","icon":"🍅","kcal":20,"carbs":4.0,"sugar":2.6,"protein":0.9,"fat":0.2,"sodium":8,"x":78,"y":52}
     ]
     *** ข้อกำหนดสำหรับ AR Object Detection & Calorie Pin ***:
     1. ถ้ามีรูปภาพ ให้ตรวจจับตำแหน่งของแต่ละวัตถุดิบ/อาหารบนรูป และระบุพิกัดตรงกลางของอาหารชิ้นนั้นเป็นเปอร์เซ็นต์ (15 ถึง 85):
        - "x": พิกัดแนวนอน (15 ถึง 85)
        - "y": พิกัดแนวตั้ง (15 ถึง 85)
     2. ใส่ "icon" เป็น emoji อาหารที่ตรงที่สุด เช่น 🥑, 🍄, 🥚, 🍅, 🍳, 🥩, 🍚, 🍗, 🥬, 🍜, 🧋, 🥣, 🍞
     3. แจกแจง "kcal" (แคลอรี), "carbs" (แป้ง g), "sugar" (น้ำตาล g), "protein" (โปรตีน g), "fat" (ไขมัน g), "sodium" (โซเดียม mg) ของแต่ละชิ้นส่วนในจานให้สมเหตุสมผล โดยผลรวมใกล้เคียงกับค่ารวมทั้งจาน
   - "note": คำอธิบายสั้นๆ 1-2 ประโยค สรุปโภชนาการ สัดส่วนแป้ง โซเดียม และน้ำตาล หรือคำแนะนำสุขภาพที่เป็นมิตร
`;

  try {
    const parts = [{ text: prompt }];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      parts.push({
        inline_data: {
          mime_type: imageMimeType,
          data: cleanBase64
        }
      });
    }

    const candidateModels = [GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
    let response = null;
    let lastStatus = 0;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2,
              maxOutputTokens: 2500
            }
          })
        });
        if (res.ok) {
          response = res;
          break;
        }
        lastStatus = res.status;
      } catch (err) {
        // Try next model on error or timeout
      }
    }

    if (!response || !response.ok) {
      const fb = fallbackAnalyze(text, sweetness, portion);
      fb.note = `⚠️ ระบบ AI ขณะนี้ไม่พร้อมใช้งานชั่วคราว (${lastStatus || 503}) — ดึงค่ามาตรฐานมาให้แทน สามารถกดแก้ไขตัวเลขได้ตามต้องการ`;
      return fb;
    }

    const data = await response.json();
    const candidateParts = data.candidates?.[0]?.content?.parts || [];
    const candidateText = candidateParts.map(p => p.text).filter(Boolean).join('\n').trim();
    if (!candidateText) {
      const fb = fallbackAnalyze(text, sweetness, portion);
      fb.note = '⚠️ ผลการวิเคราะห์จาก AI ว่างเปล่า — ใช้ค่ามาตรฐานแทน คุณสามารถแก้ไขได้เลยน้า';
      return fb;
    }

    const parsed = JSON.parse(candidateText);

    if (parsed.is_food === false) {
      return {
        name: 'ไม่ใช่รูปอาหาร',
        kcal: 0,
        sugar: 0,
        is_food: false,
        confidence: 'high',
        needs_clarification: false,
        clarification_question: null,
        options: null,
        components: [],
        note: '⚠️ ภาพนี้ดูเหมือนจะไม่ใช่อาหารหรือเครื่องดื่ม กรุณาถ่ายภาพจานอาหารใหม่อีกครั้งนะ 🍽️',
        is_fallback: false
      };
    }

    const parsedKcal = Math.round(Number(parsed.kcal) || 0);
    const parsedSugar = Math.round((Number(parsed.sugar) || 0) * 10) / 10;
    const parsedCarbs = parsed.carbs !== undefined && parsed.carbs !== null ? Math.round(Number(parsed.carbs) * 10) / 10 : null;
    const parsedProtein = parsed.protein !== undefined && parsed.protein !== null ? Math.round(Number(parsed.protein) * 10) / 10 : null;
    const parsedFat = parsed.fat !== undefined && parsed.fat !== null ? Math.round(Number(parsed.fat) * 10) / 10 : null;
    const parsedSodium = parsed.sodium !== undefined && parsed.sodium !== null ? Math.round(Number(parsed.sodium)) : null;
    const parsedName = String(parsed.name || text || 'มื้ออาหาร');

    const components = enrichComponents(parsed.components, parsedName, parsedKcal, parsedSugar, parsedCarbs, parsedProtein, parsedFat);

    const finalCarbs = parsedCarbs !== null ? parsedCarbs : Math.round(components.reduce((a, b) => a + (b.carbs || 0), 0) * 10) / 10;
    const finalProtein = parsedProtein !== null ? parsedProtein : Math.round(components.reduce((a, b) => a + (b.protein || 0), 0) * 10) / 10;
    const finalFat = parsedFat !== null ? parsedFat : Math.round(components.reduce((a, b) => a + (b.fat || 0), 0) * 10) / 10;
    const finalSodium = parsedSodium !== null ? parsedSodium : Math.round(components.reduce((a, b) => a + (b.sodium || 0), 0));

    return {
      name: parsedName,
      kcal: parsedKcal,
      carbs: finalCarbs,
      sugar: parsedSugar,
      protein: finalProtein,
      fat: finalFat,
      sodium: finalSodium,
      is_food: true,
      confidence: parsed.confidence || 'medium',
      needs_clarification: Boolean(parsed.needs_clarification),
      clarification_question: parsed.clarification_question || null,
      options: Array.isArray(parsed.options) ? parsed.options : null,
      components,
      note: parsed.note || 'วิเคราะห์ด้วย Google Gemini',
      is_fallback: false
    };
  } catch (err) {
    const fb = fallbackAnalyze(text, sweetness, portion);
    fb.note = '⚠️ เชื่อมต่อ AI ไม่สำเร็จ — ใช้ค่ามาตรฐานภาษาไทยแทน คุณสามารถแก้ไขตัวเลขก่อนบันทึกได้เลย';
    return fb;
  }
}

// Smart Thai Conversational Engine for Mochi (when Gemini API is offline or quota exceeded)
export function generateSmartMochiReply(message = '', userContext = {}) {
  const {
    nickname = 'เพื่อนโมจิ',
    personality = 'kind',
    goal_type = 'weight_loss',
    calorie_goal = 1800,
    sugar_goal = 25,
    today_cal = 0,
    today_sugar = 0,
    today_carbs = 0,
    today_sodium = 0,
    today_protein = 0,
    today_fat = 0,
    today_meals = [],
    streak = 0
  } = userContext;

  const remCal = Math.max(0, calorie_goal - today_cal);
  const remSugar = Math.round((sugar_goal - today_sugar) * 10) / 10;
  const isOverSugar = remSugar < 0;
  const q = String(message || '').toLowerCase().trim();
  let cleanName = (nickname || 'เพื่อน').trim();
  if (cleanName === 'โมจิจัง' || cleanName === 'โมจิ') cleanName = 'เพื่อน';
  const userDisplayName = cleanName.startsWith('คุณ') ? cleanName : `คุณ${cleanName}`;

  // 1. GREETING INTENT
  if (/^(สวัสดี|หวัดดี|ดีจ้า|ดีครับ|ดีค่ะ|ฮัลโหล|hello|hi|hey|โย่ว|ว่าไง|อรุณสวัสดิ์)/i.test(q) || q === 'สวัสดี' || q === 'หวัดดี') {
    if (personality === 'cheerful') {
      return {
        reply: `สวัสดีค่า${userDisplayName}! 🌟 วันนี้โมจิพร้อมลุยช่วยดูแลความสดชื่นและสุขภาพให้แล้วน้า มีอะไรอยากปรึกษาหรือหิวมื้อไหนพิมพ์บอกโมจิได้เลยจ้า 🍡✨`,
        mochiMood: 'happy'
      };
    }
    if (personality === 'disciplined') {
      return {
        reply: `สวัสดีครับ${userDisplayName} 📋 วันนี้เป้าหมายคุมน้ำตาลอยู่ที่ < ${sugar_goal}g พร้อมบันทึกมื้ออาหารอย่างมีวินัยไปด้วยกันครับ มีคำถามเรื่องอาหารปรึกษาได้เลยครับ!`,
        mochiMood: 'ok'
      };
    }
    return {
      reply: `สวัสดีค่า${userDisplayName} 💖 ดีใจที่ได้คุยกันนะคะ วันนี้เป็นยังไงบ้างเอ่ย มีอะไรอยากให้โมจิช่วยดูแลเรื่องอาหารหรือสุขภาพ บอกได้เลยน้า 🍡`,
      mochiMood: 'happy'
    };
  }

  // 2. FOOD RECOMMENDATION / HUNGER INTENT
  if (q.includes('มื้อเย็น') || q.includes('กินอะไรดี') || q.includes('กินไรดี') || q.includes('หิว') || q.includes('แนะนำอาหาร') || q.includes('มื้อเที่ยง') || q.includes('มื้อเช้า') || q.includes('เมนู')) {
    if (isOverSugar) {
      return {
        reply: `ตอนนี้น้ำตาลเกินโควตาไปนิดหน่อย (${fmt(Math.abs(remSugar))}g) ไม่ต้องกังวลน้า! โมจิแนะนำมื้อนี้เน้นอาหารไม่ใส่น้ำตาล เช่น แกงจืดเต้าหู้หมูสับ ต้มยำน้ำใสไม่หวาน หรือไข่ต้มผักลวก อิ่มท้องสบายใจแน่นอน 🍲🥬`,
        mochiMood: 'worry'
      };
    }
    if (goal_type === 'muscle_gain') {
      return {
        reply: `สำหรับสายสร้างกล้ามเนื้อ โมจิแนะนำมื้อเน้นโปรตีนแน่นๆ เช่น ข้าวกล้องอกไก่ย่าง ไข่ต้ม 2 ฟอง หรือสเต็กปลาแซลมอน/อกไก่พริกไทยดำ เติมพลังงานได้ดีและน้ำตาลน้อยมากจ้า 💪🍗`,
        mochiMood: 'happy'
      };
    }
    if (remSugar <= 6) {
      return {
        reply: `ตอนนี้เหลือน้ำตาลอีก ${fmt(remSugar)}g น้า แนะนำเมนูเบาหวานน้อย เช่น สุกี้น้ำไม่หวาน (ใส่น้ำจิ้มน้อยๆ) ปลานึ่งมะนาว หรือเกาเหลาหมูตุ๋นไม่ปรุงน้ำตาลเพิ่มนะจ๊ะ 🐟🍲`,
        mochiMood: 'ok'
      };
    }
    return {
      reply: `วันนี้น้ำตาลเหลือสบายๆ อีก ${fmt(remSugar)}g (แคลเหลือ ${Math.round(remCal)} kcal) แนะนำข้าวกะเพราไก่ไม่หวานคู่ไข่ดาว หรือส้มตำไทยหวานน้อยคู่ไก่ย่างได้เลย อิ่มอร่อยกำลังดีจ้า 😋✨`,
      mochiMood: 'happy'
    };
  }

  // 3. SWEET CRAVINGS INTENT
  if (q.includes('ของหวาน') || q.includes('ชานม') || q.includes('ขนม') || q.includes('อยากกินหวาน') || q.includes('ไอติม') || q.includes('เค้ก') || q.includes('บิงซู') || q.includes('ชาเขียว') || q.includes('โกโก้')) {
    if (remSugar < 6) {
      return {
        reply: `เข้าใจเลยว่าอยากกินของหวาน 💕 แต่วันนี้น้ำตาลเหลือแค่ ${fmt(remSugar)}g ลองจิบชาผลไม้หวาน 0% ชาเขียวร้อน หรือผลไม้ฉ่ำน้ำอย่างฝรั่งหรือชมพู่แทนก่อนน้า ดับความอยากได้ดีมากจ้า 🍎🍵`,
        mochiMood: 'worry'
      };
    }
    return {
      reply: `ถ้าอยากทานชานมหรือของหวาน โมจิแนะนำสั่งระดับหวาน 25% หรือแชร์กับเพื่อนคนละครึ่งแก้ว จะได้รับความฟินแบบโควตาน้ำตาลยังปลอดภัยหายห่วงน้า 🧋✨`,
      mochiMood: 'wink'
    };
  }

  // 4. PROGRESS & NUTRIENTS STATUS
  if (q.includes('น้ำตาล') || q.includes('แคล') || q.includes('เหลือ') || q.includes('สถานะ') || q.includes('วันนี้เป็นไง') || q.includes('สรุป')) {
    const statusNote = isOverSugar ? 'เกินโควตาไปนิดหน่อย มื้อถัดไปเน้นผักโปรตีนน้า' : 'ยังอยู่ในเกณฑ์ที่ยอดเยี่ยม!';
    return {
      reply: `วันนี้คุณ ${nickname} ทานแคลไป ${Math.round(today_cal)} / ${calorie_goal} kcal (เหลือ ${Math.round(remCal)}) และน้ำตาล ${fmt(today_sugar)} / ${sugar_goal}g (เหลือ ${fmt(remSugar)}g) ${statusNote} 🔥 ติดต่อกัน ${streak} วันแล้ว สู้ๆ น้า!`,
      mochiMood: isOverSugar ? 'worry' : 'happy'
    };
  }

  // 5. SODIUM & WATER
  if (q.includes('โซเดียม') || q.includes('เค็ม') || q.includes('บวม') || q.includes('ไต') || q.includes('ดื่มน้ำ') || q.includes('น้ำเปล่า')) {
    if (today_sodium > 1500) {
      return {
        reply: `วันนี้รับโซเดียมไปแล้ว ${Math.round(today_sodium)} mg (เริ่มแตะระดับเกณฑ์ 2,000 mg) แนะนำจิบน้ำเปล่าบ่อยๆ ตลอดวัน เพื่อช่วยให้ไตขับโซเดียมส่วนเกินและลดอาการบวมน้ำน้า 💧🥒`,
        mochiMood: 'worry'
      };
    }
    return {
      reply: `การดื่มน้ำวันละ 7-8 แก้ว (ประมาณ 2 ลิตร) ช่วยระบบเผาผลาญและช่วยลดความอยากหวานได้ดีมากๆ เลยน้า อย่าลืมจิบน้ำเรื่อยๆ นะจ๊ะ 💧✨`,
      mochiMood: 'happy'
    };
  }

  // 6. CHEAT MEAL / GUILT / MOTIVATION
  if (q.includes('หลุด') || q.includes('กินเยอะ') || q.includes('อ้วน') || q.includes('ท้อ') || q.includes('เครียด') || q.includes('ผิดไหม') || q.includes('กังวล')) {
    return {
      reply: `ไม่เป็นไรเลยน้าคุณ ${nickname}! มื้ออร่อยคือความสุขของชีวิต การหลุดกินบ้างเป็นเรื่องธรรมชาติมาก ไม่ต้องอดอาหารหรือรู้สึกผิดเลย แค่มื้อต่อไปดื่มน้ำเยอะๆ แล้วค่อยปรับสมดุลไปด้วยกัน โมจิอยู่ข้างๆ เสมอนะ 💖🍡`,
      mochiMood: 'love'
    };
  }

  // 7. THANKS & PRAISE
  if (q.includes('ขอบคุณ') || q.includes('แต๊ง') || q.includes('น่ารัก') || q.includes('เก่งมาก') || q.includes('รัก')) {
    return {
      reply: `ยินดีเสมอเลยจ้า! 💕 มีคุณ ${nickname} มาดูแลสุขภาพด้วยกันแบบนี้ โมจิมีความสุขที่สุดเลย ปรึกษาได้ตลอดเวลาเลยน้า 🍡✨`,
      mochiMood: 'love'
    };
  }

  // 8. DEFAULT DYNAMIC MOCHI RESPONSE
  const toneEnd = personality === 'disciplined' ? 'พร้อมบันทึกและลุยเป้าหมายไปด้วยกันครับ 📋' : 'อยากปรึกษาเรื่องอาหารหรือระบายอะไร พิมพ์บอกโมจิได้เลยน้า 🍡';
  return {
    reply: `โมจิรับฟังอยู่น้า! วันนี้คุมน้ำตาลไป ${fmt(today_sugar)}g (เหลือ ${fmt(remSugar)}g จากเป้า ${sugar_goal}g) ${toneEnd}`,
    mochiMood: isOverSugar ? 'worry' : 'happy'
  };
}

// Phase 3: Conversational AI with Mochi
export async function chatWithMochi({ message, userContext, history = [] }) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  const { nickname, personality, goal_type, calorie_goal, sugar_goal, today_cal, today_sugar, today_carbs, today_sodium, today_protein, today_fat, today_meals, streak } = userContext;
  const remCal = Math.max(0, calorie_goal - today_cal);
  const remSugar = Math.round((sugar_goal - today_sugar) * 10) / 10;
  let cleanName = (nickname || 'เพื่อน').trim();
  if (cleanName === 'โมจิจัง' || cleanName === 'โมจิ') cleanName = 'เพื่อน';
  const userDisplayName = cleanName.startsWith('คุณ') ? cleanName : `คุณ${cleanName}`;

  // If no API key configured, use our rich Smart Mochi engine immediately
  if (!apiKey) {
    return generateSmartMochiReply(message, userContext);
  }

  const personalityDesc = personality === 'cheerful'
    ? 'ร่าเริง สดใส พลังบวกสูง ใช้ emoji น่ารัก ชอบให้กำลังใจและชวนคุยอย่างเป็นกันเอง'
    : personality === 'disciplined'
    ? 'สุภาพ จริงจัง มีวินัย แนะนำตัวเลขและเทคนิคคุมน้ำตาลอย่างกระชับ แม่นยำ'
    : 'อบอุ่น ใจดี เป็นมิตร ปลอบประโลม ไม่กดดัน และไม่ตำหนิผู้ใช้';

  const systemPrompt = `
คุณคือ "น้องโมจิ" (Mochi 🍡) AI ผู้ช่วยน่ารักประจำตัวที่คอยดูแลอาหาร โภชนาการ และการคุมน้ำตาล
คู่สนทนาของคุณคือ: "${userDisplayName}"

ข้อมูลสุขภาพและมื้ออาหารของผู้ใช้ในวันนี้ (ใช้อ้างอิงเมื่อผู้ใช้ถามเรื่องอาหารหรือสุขภาพ):
- เป้าหมายสุขภาพหลัก: ${goal_type || 'ควบคุมน้ำหนักและสุขภาพ'}
- สถิติวันนี้:
  • แคลอรี: ${Math.round(today_cal)} / ${calorie_goal} kcal (เหลืออีก ${Math.round(remCal)} kcal)
  • น้ำตาล: ${fmt(today_sugar)} / ${sugar_goal} g (เหลือโควตาอีก ${fmt(remSugar)} g)
  • แป้ง (คาร์บ): ${fmt(today_carbs || 0)} g
  • โซเดียม: ${fmt(today_sodium || 0)} mg (เกณฑ์แนะนำไม่ควรเกิน 2,000 mg/วัน)
  • โปรตีน: ${fmt(today_protein || 0)} g
  • ไขมัน: ${fmt(today_fat || 0)} g
- มื้ออาหารที่กินไปแล้ววันนี้ (${today_meals?.length || 0} มื้อ):
  ${today_meals && today_meals.length ? today_meals.map(m => `• ${m.name} (${Math.round(m.calorie)} kcal, น้ำตาล ${fmt(m.sugar)}g, แป้ง ${fmt(m.carbs||0)}g, โซเดียม ${fmt(m.sodium||0)}mg, โปรตีน ${fmt(m.protein||0)}g)`).join('\n  ') : 'ยังไม่มีการบันทึกมื้ออาหารใดในวันนี้'}

กฎและแนวทางการตอบอย่างเป็นธรรมชาติ (สำคัญมากที่สุด):
1. **การทักทายและการพูดคุยทั่วไป (Greetings & Casual Chat):**
   - หากผู้ใช้แค่ "ทักทาย" หรือคุยเล่น (เช่น "สวัสดี", "ดีจ้า", "หวัดดี", "ฮัลโหล", "hi", "hello", "ว่าไง", "กินข้าวยัง", "เป็นไงบ้าง")
   - ให้ตอบทักทายกลับอย่างน่ารัก อบอุ่น สั้นกระชับ 1-2 ประโยค ชวนคุยถามไถ่ทั่วไป (เช่น "สวัสดีค่า${userDisplayName}! 🍡 ดีใจที่ได้คุยกันนะคะ วันนี้เป็นยังไงบ้างเอ่ย มีอะไรอยากให้โมจิช่วยไหมคะ ✨")
   - ⚠️ ห้ามเด็ดขาด: อย่าวิเคราะห์แคลอรี น้ำตาล หรือยัดเยียดแนะนำเมนูอาหารในคำทักทายเด็ดขาด! ผู้ใช้ยังไม่ได้ถามหาเมนูอาหาร!
2. **การเรียกชื่อและตัวตน (Identity):**
   - ตัวคุณคือ "น้องโมจิ" (AI ผู้ช่วย) แทนตัวเองว่า "โมจิ"
   - ห้ามเรียกผู้ใช้ว่า "โมจิ" หรือ "โมจิจัง" เป็นอันขาด เพราะนั่นคือชื่อของคุณเอง! ให้เรียกผู้ใช้ว่า "${userDisplayName}" หรือ "คุณ"
3. **เมื่อผู้ใช้ถามเรื่องอาหาร / ขอมื้อเย็น / หิว / ปรึกษาโภชนาการ:**
   - ค่อยนำสถิติอาหารวันนี้และโควตาน้ำตาลที่เหลือ (${fmt(remSugar)}g) มาแนะนำเมนูอาหารไทยที่อร่อย อิ่มท้อง และดีต่อสุขภาพ หากโซเดียมสูงให้เตือนจิบน้ำเปล่าเพิ่ม
4. **เมื่อผู้ใช้บ่นหลุดกิน / เครียด / ท้อ:**
   - ปลอบใจอย่างอ่อนโยน ให้กำลังใจแบบเพื่อนสนิท ไม่ตัดสิน ไม่ซ้ำเติม
5. **ความยาวและโทนเสียง:**
   - บุคลิก: ${personalityDesc}
   - ตอบเป็นภาษาไทย สั้น กระชับ เป็นกันเอง น่ารัก ไม่เกิน 2-4 ประโยค ไม่ใช้ภาษาทางการแข็งทื่อเหมือนหุ่นยนต์
`;

  // Build conversational context with history
  let conversationText = systemPrompt + '\n\n';
  if (Array.isArray(history) && history.length > 0) {
    conversationText += 'ประวัติการสนทนาก่อนหน้านี้:\n';
    for (const h of history.slice(-6)) {
      conversationText += `${h.role === 'mochi' ? 'น้องโมจิ' : userDisplayName}: ${h.content}\n`;
    }
    conversationText += `\nข้อความล่าสุดจากผู้ใช้ (${userDisplayName}): ${message}`;
  } else {
    conversationText += `ข้อความล่าสุดจากผู้ใช้ (${userDisplayName}): ${message}`;
  }

  // Candidate models to attempt in case of model retirement or quota limits
  const candidateModels = [
    GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite'
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = [
        { role: 'user', parts: [{ text: conversationText }] }
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const replyText = parts.map(p => p.text).filter(Boolean).join('\n').trim();
        if (replyText) {
          return {
            reply: replyText,
            mochiMood: remSugar < 0 ? 'worry' : 'happy'
          };
        }
      } else if (response.status === 429) {
        console.warn(`[Mochi AI] Gemini API key quota exceeded (429) on model ${model}. Switching to Smart Mochi Engine.`);
        break;
      } else {
        console.warn(`[Mochi AI] Model ${model} returned status ${response.status}`);
      }
    } catch (err) {
      console.warn(`[Mochi AI] Model ${model} attempt error:`, err.message);
    }
  }

  // If all Gemini API models fail or quota is exhausted (429), fall back smoothly to smart conversational engine
  return generateSmartMochiReply(message, userContext);
}

// -------------------------------------------------------------
// Smart Meal Recommendation Engine ("เย็นนี้กินไรดี?")
// -------------------------------------------------------------
export async function recommendSmartMeal({ user, todayLogs = [] }) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  const nickname = (user?.nickname || 'เพื่อน').trim();
  const goalType = user?.goal_type || 'weight_loss';
  const calGoal = Number(user?.calorie_goal) || 2000;
  const sugarGoal = Number(user?.sugar_goal) || 25;

  const todayCal = todayLogs.reduce((sum, l) => sum + (Number(l.calorie) || 0), 0);
  const todaySugar = todayLogs.reduce((sum, l) => sum + (Number(l.sugar) || 0), 0);
  const todayProtein = todayLogs.reduce((sum, l) => sum + (Number(l.protein) || 0), 0);
  const remCal = Math.max(0, calGoal - todayCal);
  const remSugar = Math.max(0, Math.round((sugarGoal - todaySugar) * 10) / 10);

  const goalLabel = goalType === 'weight_loss' ? 'ลดน้ำหนักและลดไขมัน'
    : goalType === 'muscle_gain' ? 'สร้างกล้ามเนื้อและเพิ่มความกระชับ'
    : 'รักษาสุขภาพและควบคุมน้ำหนัก';

  // Rule-based fallback builder
  const fallbackGenerator = () => {
    let advice = `เย็นนี้คุณ${nickname} มีโควต้าคงเหลือ ${Math.round(remCal)} kcal โมจิช่วยคัดสรร 3 เมนูแนะนำที่พอดีกับเป้าหมาย${goalLabel} มาให้แล้วครับ 🍡✨`;
    let recs = [];

    if (remCal < 350) {
      recs = [
        {
          category: '🏪 7-Eleven สะดวกซื้อ',
          name: 'อกไก่นุ่มพริกไทยดำ + น้ำเต้าหู้โทฟุซัง (หวาน 0%)',
          calorie: 180,
          sugar: 1,
          protein: 26,
          carbs: 4,
          fat: 5,
          reason: 'โควต้าแคลอรี่เหลือน้อย มื้อนี้เน้นโปรตีนล้วน อิ่มท้องสบายใจ ไม่สะสมไขมัน',
          tips: 'เวฟร้อนทานได้ทันที เลี่ยงการใส่น้ำจิ้มหวานเพิ่ม'
        },
        {
          category: '🍳 อาหารตามสั่ง',
          name: 'เกาเหลาต้มเลือดหมูใบตำลึง (ไม่กระเทียมเจียว) ข้าวสวย 1/3 ถ้วย',
          calorie: 260,
          sugar: 1.5,
          protein: 24,
          carbs: 18,
          fat: 7,
          reason: 'ซดน้ำซุปร้อนๆ คล่องคอ ผักตำลึงไฟเบอร์สูง ช่วยขับถ่าย',
          tips: 'สั่งแม่ค้าว่าไม่ใส่หมูกรอบ ไม่ใส่ชูรส ไม่ใส่กระเทียมเจียว'
        },
        {
          category: '🥗 สุขภาพ / ปรุงง่าย',
          name: 'ยำวุ้นเส้นอกไก่ฉีกแตงกวา (มะนาวสด)',
          calorie: 210,
          sugar: 2,
          protein: 22,
          carbs: 22,
          fat: 3,
          reason: 'แซ่บจัดจ้าน ไฟเบอร์แน่น แต่น้ำตาลและไขมันต่ำมาก',
          tips: 'ใช้น้ำมะนาวสดแท้ ไม่เติมน้ำตาลทราย'
        }
      ];
    } else if (remCal < 650) {
      recs = [
        {
          category: '🏪 7-Eleven สะดวกซื้อ',
          name: 'ข้าวกล้อง + อกไก่นุ่มคั่วกลิ้ง + ไข่ต้มยางมะตูม 1 ฟอง',
          calorie: 390,
          sugar: 2,
          protein: 34,
          carbs: 42,
          fat: 9,
          reason: 'สารอาหารครบ 5 หมู่ โปรตีน 34g ช่วยฟื้นฟูกล้ามเนื้อ อิ่มยาวถึงเช้า',
          tips: 'เลือกข้าวกล้องหรือไรซ์เบอร์รี่ ดัชนีน้ำตาลต่ำกว่าข้าวขาว'
        },
        {
          category: '🍳 อาหารตามสั่ง',
          name: 'สุกี้น้ำอกไก่ ผักรวม เน้นโปรตีน (น้ำจิ้ม 1 ช้อนชา)',
          calorie: 340,
          sugar: 3.5,
          protein: 30,
          carbs: 35,
          fat: 6,
          reason: 'ผักกาดขาวและผักบุ้งให้อิ่มจุกๆ แคลอรี่เบาๆ สบายท้อง',
          tips: 'แยกน้ำจิ้มสุกี้ ตักจิ้มทีละนิดแทนการเทราดทั้งชาม'
        },
        {
          category: '🥗 สุขภาพ / ปรุงง่าย',
          name: 'สเต็กอกไก่ย่างเกลือพริกไทย + มันเทศนึ่ง + บรอกโคลีลวก',
          calorie: 420,
          sugar: 3,
          protein: 40,
          carbs: 45,
          fat: 8,
          reason: 'เมนูคลีนในฝัน คาร์บเชิงซ้อนจากมันเทศ อิ่มนาน ไม่กระตุ้นอินซูลิน',
          tips: 'ใช้น้ำมันมะกอกสเปรย์บางๆ หรือหม้อทอดไร้น้ำมัน'
        }
      ];
    } else {
      recs = [
        {
          category: '🏪 7-Eleven สะดวกซื้อ',
          name: 'สปาเก็ตตี้อกไก่ซอสมะเขือเทศ + ไข่ตุ๋นคัพ 7-11',
          calorie: 480,
          sugar: 5,
          protein: 36,
          carbs: 58,
          fat: 12,
          reason: 'โควต้าแคลอรี่เหลือเยอะ อร่อยฟิน โปรตีนและคาร์บครบถ้วน',
          tips: 'ทานคู่กับน้ำเปล่าเย็นๆ เติมความสดชื่น'
        },
        {
          category: '🍳 อาหารตามสั่ง',
          name: 'ข้าวราดกะเพราอกไก่ชิ้น (ไม่ติดมัน) ไข่ดาวน้ำ',
          calorie: 520,
          sugar: 2.5,
          protein: 38,
          carbs: 60,
          fat: 14,
          reason: 'เมนูยอดฮิต พริกและกะเพราช่วยกระตุ้นการเผาผลาญ',
          tips: 'สั่งแม่ค้าว่าผัดน้ำมันน้อย ไม่ใส่น้ำตาล และขอไข่ดาวน้ำ'
        },
        {
          category: '🥗 สุขภาพ / ปรุงง่าย',
          name: 'แซลมอนย่างซีอิ๊วญี่ปุ่น + ข้าวญี่ปุ่น + สลัดผักงาขาว',
          calorie: 550,
          sugar: 4,
          protein: 42,
          carbs: 52,
          fat: 18,
          reason: 'โอเมก้า 3 จากปลาแซลมอนช่วยลดการอักเสบ บำรุงสมองและหัวใจ',
          tips: 'ย่างบนกระทะเทฟลอนโดยไม่ต้องเติมน้ำมันเพิ่ม'
        }
      ];
    }

    return {
      success: true,
      remaining_cal: Math.round(remCal),
      remaining_sugar: remSugar,
      advice,
      recommendations: recs
    };
  };

  if (!apiKey) {
    return fallbackGenerator();
  }

  const prompt = `
คุณคือน้องโมจิ (Moji Kal 🍡) นักโภชนาการ AI ประจำตัวของ "${nickname}"
ผู้ใช้คนนี้มีเป้าหมาย: "${goalLabel}"
สถิติโควต้าวันนี้:
- แคลอรีเป้าหมาย: ${calGoal} kcal, กินไปแล้ว: ${Math.round(todayCal)} kcal, **เหลือโควต้าอีก: ${Math.round(remCal)} kcal**
- น้ำตาลเป้าหมาย: ${sugarGoal} g, กินไปแล้ว: ${fmt(todaySugar)} g, **เหลือโควต้า: ${fmt(remSugar)} g**
- โปรตีนที่กินไปแล้ว: ${fmt(todayProtein)} g

โจทย์: แนะนำ 3 เมนูอาหารสำหรับมื้อต่อไป (มื้อเย็น) ที่เข้ากับโควต้าแคลอรีที่เหลือและเป้าหมายสุขภาพ:
1. หมวด "🏪 7-Eleven สะดวกซื้อ"
2. หมวด "🍳 อาหารตามสั่ง"
3. หมวด "🥗 สุขภาพ / ปรุงง่าย"

ตอบกลับเป็น JSON format เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "advice": "ข้อความทักทายสั้นๆ น่ารักจากโมจิ ประเมินโควต้าวันนี้อย่างอบอุ่น (ประมาณ 1-2 ประโยค)",
  "recommendations": [
    {
      "category": "🏪 7-Eleven สะดวกซื้อ",
      "name": "ชื่อเมนูภาษาไทย",
      "calorie": 350,
      "sugar": 2,
      "protein": 32,
      "carbs": 35,
      "fat": 8,
      "reason": "ทำไมโมจิถึงแนะนำเมนูนี้ให้ผู้ใช้คนนี้",
      "tips": "ทริคการกินหรือการสั่งแบบสุขภาพดี"
    }
  ]
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.5,
          maxOutputTokens: 1200
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(rawText);
      if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length) {
        return {
          success: true,
          remaining_cal: Math.round(remCal),
          remaining_sugar: remSugar,
          advice: parsed.advice || `โมจิเลือก 3 เมนูแนะนำมาให้คุณ${nickname} แล้วครับ 🍡✨`,
          recommendations: parsed.recommendations
        };
      }
    }
  } catch (err) {
    console.warn('[Mochi AI] Gemini recommendSmartMeal error, using fallback:', err.message);
  }

  return fallbackGenerator();
}
