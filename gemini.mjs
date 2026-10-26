import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsFile = path.join(__dirname, 'data', 'settings.json');

// Centralized AI Model Name (Pillar 2: Easy single-place modification)
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const fmt = n => Math.round((Number(n) || 0) * 10) / 10;

export function getSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    }
  } catch (_) {}
  return { geminiApiKey: process.env.GEMINI_API_KEY || '' };
}

export function saveSettings(settings) {
  const current = getSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

// Built-in Thai food & drink baseline database
const THAI_FOOD_DB = [
  { keywords: ['ชานมไข่มุก', 'ชานม', 'boba'], name: 'ชานมไข่มุก', baseCal: 360, baseSugar: 28, isDrink: true, components: [{ name: 'ชาและนม', kcal: 220, sugar: 20 }, { name: 'ไข่มุกบราวน์ชูการ์', kcal: 140, sugar: 8 }] },
  { keywords: ['ชาไทย', 'ชาเย็น'], name: 'ชาไทยเย็น', baseCal: 220, baseSugar: 24, isDrink: true, components: [{ name: 'ชาไทยสกัด', kcal: 20, sugar: 0 }, { name: 'นมข้นหวานและนมสด', kcal: 200, sugar: 24 }] },
  { keywords: ['ชาเขียวเย็น', 'มัทฉะลาเต้', 'ชาเขียวนม'], name: 'ชาเขียวนมเย็น', baseCal: 240, baseSugar: 22, isDrink: true, components: [{ name: 'มัทฉะแท้', kcal: 30, sugar: 0 }, { name: 'นมสดและไซรัป', kcal: 210, sugar: 22 }] },
  { keywords: ['กาแฟดำ', 'อเมริกาโน่', 'americano'], name: 'อเมริกาโน่เย็น (ไม่หวาน)', baseCal: 15, baseSugar: 0, isDrink: true, components: [{ name: 'เอสเพรสโซ่ช็อต + น้ำ', kcal: 15, sugar: 0 }] },
  { keywords: ['ลาเต้', 'latte', 'คาปูชิโน่', 'cappuccino'], name: 'ลาเต้เย็น', baseCal: 180, baseSugar: 12, isDrink: true, components: [{ name: 'กาแฟ', kcal: 15, sugar: 0 }, { name: 'นมสด', kcal: 165, sugar: 12 }] },
  { keywords: ['กะเพรา', 'ผัดกะเพรา'], name: 'ผัดกะเพราหมูสับ + ไข่ดาว', baseCal: 630, baseSugar: 3, components: [{ name: 'ข้าวสวย 1 จาน', kcal: 200, sugar: 0 }, { name: 'ผัดกะเพราหมูสับ', kcal: 310, sugar: 2.5 }, { name: 'ไข่ดาว', kcal: 120, sugar: 0.5 }] },
  { keywords: ['ข้าวมันไก่'], name: 'ข้าวมันไก่ตอน', baseCal: 580, baseSugar: 1.5, components: [{ name: 'ข้าวมัน', kcal: 300, sugar: 0.5 }, { name: 'เนื้อไก่ตอน', kcal: 220, sugar: 0 }, { name: 'น้ำจิ้มและน้ำซุป', kcal: 60, sugar: 1 }] },
  { keywords: ['ข้าวผัด'], name: 'ข้าวผัดหมู/ไก่', baseCal: 550, baseSugar: 2.5, components: [{ name: 'ข้าวผัดน้ำมัน', kcal: 420, sugar: 1.5 }, { name: 'เนื้อสัตว์และไข่', kcal: 130, sugar: 1 }] },
  { keywords: ['ก๋วยเตี๋ยวต้มยำ'], name: 'ก๋วยเตี๋ยวต้มยำน้ำข้น', baseCal: 480, baseSugar: 9, components: [{ name: 'เส้นก๋วยเตี๋ยว', kcal: 180, sugar: 0 }, { name: 'หมูสับ/ลูกชิ้น', kcal: 160, sugar: 1 }, { name: 'น้ำซุปต้มยำปรุงรส', kcal: 140, sugar: 8 }] },
  { keywords: ['ผัดไทย'], name: 'ผัดไทยกุ้งสด', baseCal: 550, baseSugar: 15, components: [{ name: 'เส้นจันท์และเต้าหู้', kcal: 320, sugar: 2 }, { name: 'กุ้งสดและไข่', kcal: 110, sugar: 0 }, { name: 'น้ำซอสผัดไทยน้ำมะขาม', kcal: 120, sugar: 13 }] },
  { keywords: ['ส้มตำไทย'], name: 'ส้มตำไทย', baseCal: 120, baseSugar: 14, components: [{ name: 'มะละกอและผัก', kcal: 45, sugar: 2 }, { name: 'น้ำส้มตำน้ำตาลปี๊บ', kcal: 75, sugar: 12 }] },
  { keywords: ['สุกี้'], name: 'สุกี้น้ำรวมมิตร', baseCal: 320, baseSugar: 6, components: [{ name: 'วุ้นเส้นและผักสด', kcal: 130, sugar: 1 }, { name: 'เนื้อสัตว์และไข่', kcal: 130, sugar: 0 }, { name: 'น้ำจิ้มสุกี้', kcal: 60, sugar: 5 }] },
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

    return {
      name: text.trim() || 'มื้ออาหาร',
      kcal: Math.round(baseKcal),
      sugar: Math.round(baseSugar * 10) / 10,
      confidence: 'medium',
      needs_clarification: isSweetDrink && sweetness === 'normal',
      clarification_question: isSweetDrink ? 'แก้วนี้สั่งหวานระดับไหนคะ? เพื่อคำนวณน้ำตาลให้แม่นยำ' : 'ระบุขนาดหรือส่วนผสมเพิ่มเติมได้นะ',
      note: isSweetDrink ? `ประเมินตามสูตร ${BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป'}` : 'ประเมินจากฐานข้อมูลอาหารไทยเบื้องต้น',
      components: [
        { name: text.trim() || 'มื้อหลัก', kcal: Math.round(baseKcal), sugar: Math.round(baseSugar * 10) / 10 }
      ],
      is_fallback: true
    };
  }

  let cal = matched.baseCal;
  let sugar = matched.baseSugar;

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

    if (toppings.includes('boba')) { sugar += 12; cal += 110; }
    if (toppings.includes('whip')) { sugar += 2; cal += 85; }
    if (toppings.includes('jelly')) { sugar += 1; cal += 15; }
  }

  if (portion === 'small') {
    cal = Math.round(cal * 0.75);
    sugar = Math.round(sugar * 0.8 * 10) / 10;
  } else if (portion === 'large') {
    cal = Math.round(cal * 1.35);
    sugar = Math.round(sugar * 1.25 * 10) / 10;
  }

  const needsClarification = matched.isDrink && sweetness === 'normal' && !lower.includes('หวาน');

  return {
    name: matched.name,
    kcal: Math.round(cal),
    sugar: Math.round(sugar * 10) / 10,
    confidence: 'high',
    needs_clarification: needsClarification,
    clarification_question: needsClarification ? `สั่ง "${matched.name}" ระดับความหวานเท่าไหร่? (ค่านี้คิดจากหวานปกติ 100%)` : null,
    options: matched.isDrink ? ['ไม่หวาน 0% (~0g)', 'หวานน้อย 25% (~8g)', 'หวานปกติ 100% (~' + Math.round(sugar) + 'g)'] : null,
    note: `คำนวณจากสูตรอาหารไทยมาตรฐาน (${matched.name}) อิง ${BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป'}`,
    components: matched.components || [{ name: matched.name, kcal: Math.round(cal), sugar: Math.round(sugar * 10) / 10 }],
    is_fallback: true
  };
}

export async function analyzeFoodWithGemini({ text = '', imageBase64 = null, imageMimeType = 'image/jpeg', sweetness = 'normal', portion = 'normal', brand = 'standard', toppings = [] }) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const res = fallbackAnalyze(text, sweetness, portion, brand, toppings);
    res.note += ' 💡 (ใส่ Gemini API Key ในเมนูตั้งค่าเพื่อเปิดระบบวิเคราะห์รูปภาพด้วย AI)';
    return res;
  }

  const brandInfo = BRAND_BASELINES[brand]?.name || 'ร้านทั่วไป';
  const toppingsList = Array.isArray(toppings) ? toppings.join(', ') : '';

  const prompt = `
คุณคือผู้ช่วยโภชนาการที่เชี่ยวชาญอาหารและเครื่องดื่มไทยโดยเฉพาะ
ประเมินอาหารหรือเครื่องดื่มจากรูปภาพ (ถ้ามี) และคำอธิบายของผู้ใช้
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

ข้อกำหนดสำคัญ:
1. ตอบเป็น JSON object ตัวเดียวเท่านั้น ห้ามมี markdown หรือ backticks
2. ต้องประเมิน:
   - "name": ชื่อเมนูสั้นๆ ภาษาไทย (เช่น "ชาเขียวเย็น Cafe Amazon หวาน 50%", "ข้าวมันไก่ต้ม")
   - "kcal": แคลอรีรวมทั้งหมด (ตัวเลขจำนวนเต็ม ห้ามเป็น null)
   - "sugar": น้ำตาลรวมทั้งหมดเป็นกรัม (ตัวเลขทศนิยม 1 ตำแหน่ง ห้ามเป็น null)
   - "confidence": "high" | "medium" | "low"
   - "needs_clarification": true ถ้าเป็นเครื่องดื่มหรือของหวานที่ข้อมูลความหวานหรือไซส์ไม่ชัดเจน
   - "clarification_question": คำถามสั้นๆ ถามกลับเมื่อข้อมูลไม่พอ
   - "options": อาเรย์ของตัวเลือกแนะนำ หรือ null
   - "components": อาเรย์แจกแจงส่วนประกอบในจาน เช่น [{"name":"ข้าวสวย","kcal":200,"sugar":0},{"name":"หมูสับผัดกะเพรา","kcal":310,"sugar":2.5},{"name":"ไข่ดาว","kcal":120,"sugar":0.5}]
   - "note": คำอธิบายสั้นๆ 1-2 ประโยค เทียบปริมาณน้ำตาลเป็นช้อนชา (1 ช้อนชา = 4 กรัม) หรือคำแนะนำสุขภาพที่เป็นมิตร
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const fb = fallbackAnalyze(text, sweetness, portion);
      fb.note = `⚠️ ระบบ AI ขณะนี้ไม่พร้อมใช้งานชั่วคราว (${response.status}) — ดึงค่ามาตรฐานมาให้แทน สามารถกดแก้ไขตัวเลขได้ตามต้องการ`;
      return fb;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      const fb = fallbackAnalyze(text, sweetness, portion);
      fb.note = '⚠️ ผลการวิเคราะห์จาก AI ว่างเปล่า — ใช้ค่ามาตรฐานแทน คุณสามารถแก้ไขได้เลยน้า';
      return fb;
    }

    const parsed = JSON.parse(candidateText);
    return {
      name: String(parsed.name || text || 'มื้ออาหาร'),
      kcal: Math.round(Number(parsed.kcal) || 0),
      sugar: Math.round((Number(parsed.sugar) || 0) * 10) / 10,
      confidence: parsed.confidence || 'medium',
      needs_clarification: Boolean(parsed.needs_clarification),
      clarification_question: parsed.clarification_question || null,
      options: Array.isArray(parsed.options) ? parsed.options : null,
      components: Array.isArray(parsed.components) ? parsed.components : null,
      note: parsed.note || 'วิเคราะห์ด้วย Google Gemini',
      is_fallback: false
    };
  } catch (err) {
    const fb = fallbackAnalyze(text, sweetness, portion);
    fb.note = '⚠️ เชื่อมต่อ AI ไม่สำเร็จ — ใช้ค่ามาตรฐานภาษาไทยแทน คุณสามารถแก้ไขตัวเลขก่อนบันทึกได้เลย';
    return fb;
  }
}

// Phase 3: Conversational AI with Mochi
export async function chatWithMochi({ message, userContext, history = [] }) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  const { nickname, personality, calorie_goal, sugar_goal, today_cal, today_sugar, today_meals, streak } = userContext;
  const remCal = Math.max(0, calorie_goal - today_cal);
  const remSugar = Math.round((sugar_goal - today_sugar) * 10) / 10;

  const personalityDesc = personality === 'cheerful'
    ? 'ร่าเริง สดใส พลังบวกสูง ใช้ emoji เยอะ ชอบให้กำลังใจและชวนหัวเราะ'
    : personality === 'disciplined'
    ? 'จริงจัง มีวินัย แนะนำตัวเลขและเทคนิคคุมน้ำตาลอย่างแม่นยำ สุภาพ'
    : 'อบอุ่น ใจดี เป็นมิตร ปลอบประโลม ไม่กดดัน และไม่ตำหนิผู้ใช้';

  const systemPrompt = `
คุณคือ "โมจิ" (Mochi 🍡) ตัวละครผู้ช่วยโภชนาการและคุมน้ำตาลสุดน่ารัก
ข้อมูลผู้ใช้ปัจจุบัน:
- ชื่อเล่น: ${nickname || 'เพื่อน'}
- บุคลิกของคุณ: ${personalityDesc}
- สถิติวันนี้: กินไปแล้ว ${Math.round(today_cal)} / ${calorie_goal} kcal (เหลืออีก ${Math.round(remCal)} kcal)
- น้ำตาลวันนี้: กินไปแล้ว ${fmt(today_sugar)} / ${sugar_goal} g (เหลือโควตาอีก ${fmt(remSugar)} g)
- Streak ความสม่ำเสมอ: ${streak || 0} วันติด
- มื้ออาหารที่กินไปแล้ววันนี้: ${today_meals && today_meals.length ? today_meals.map(m => m.name + ` (${m.sugar}g น้ำตาล)`).join(', ') : 'ยังไม่ได้บันทึกมื้อใด'}

แนวทางการตอบ:
1. ตอบเป็นภาษาไทย น่ารัก อบอุ่น กระชับ ไม่เกิน 2-4 ประโยค
2. ถ้าผู้ใช้ถามหาของกินหรือมื้อเย็น ให้แนะนำเมนูอาหารไทยที่อร่อยและสอดคล้องกับ "โควตาน้ำตาลที่เหลือ (${fmt(remSugar)}g)"
   - ถ้าน้ำตาลเหลือน้อย (<5g): แนะนำของไม่หวาน เช่น แกงจืดเต้าหู้หมูสับ, ต้มยำกุ้งน้ำใส, อกไก่ย่าง, ชาเขียวร้อนไม่หวาน
   - ถ้าน้ำตาลเหลือเยอะ (>15g): แนะนำผลไม้สดหวานน้อย หรือของหวานชิ้นเล็กได้พอชื่นใจ
3. ไม่ส่งเสริมการอดอาหารเด็ดขาด แนะนำให้กินโปรตีนและผักเพื่อความอิ่มท้อง
`;

  if (!apiKey) {
    // Smart Rule-based Response if no API Key
    let reply = '';
    const q = (message || '').toLowerCase();

    if (q.includes('มื้อเย็น') || q.includes('กินอะไรดี') || q.includes('หิว')) {
      if (remSugar <= 4) {
        reply = `ตอนนี้โควตาน้ำตาลเหลืออีกแค่ ${fmt(remSugar)}g น้า โมจิแนะนำมื้อเย็นแบบหวานน้อยแต่อิ่มท้อง เช่น แกงจืดเต้าหู้หมูสับ ต้มยำกุ้งน้ำใส หรือสุกี้น้ำไม่ใส่น้ำจิ้มเยอะนะ 🍡🍲`;
      } else if (remSugar <= 12) {
        reply = `น้ำตาลเหลือโควตาอีก ${fmt(remSugar)}g แนะนำข้าวกะเพราหมูสับไม่ใส่น้ำตาลเพิ่ม หรือส้มตำไทยเปรี้ยวเผ็ดหวานน้อย คู่กับไก่ย่างร้อนๆ ได้เลยนะ 😋`;
      } else {
        reply = `วันนี้คุมน้ำตาลได้เยี่ยมมาก ยังเหลือน้ำตาลอีกตั้ง ${fmt(remSugar)}g! มื้อเย็นกินอาหารตามใจชอบได้สบายๆ หรือจะตบท้ายด้วยผลไม้สดอย่างฝรั่งหรือแอปเปิ้ลก็สดชื่นน้า 🍎✨`;
      }
    } else if (q.includes('น้ำตาล') || q.includes('เหลือ')) {
      reply = `วันนี้ ${nickname} กินน้ำตาลไปแล้ว ${fmt(today_sugar)}g จากเป้า ${sugar_goal}g (เหลืออีก ${fmt(remSugar)}g น้า) สู้ๆ ไปด้วยกันนะ! 🔥`;
    } else if (q.includes('ของหวาน') || q.includes('ชานม') || q.includes('ขนม')) {
      if (remSugar < 8) {
        reply = `ใจเย็นๆ ก่อนน้า วันนี้น้ำตาลเหลือแค่ ${fmt(remSugar)}g เอง ลองดื่มชาผลไม้ไม่หวาน ชาเขียวร้อน หรือดื่มน้ำเปล่าเย็นๆ ชื่นใจแทนก่อนดีไหมคะ 💧`;
      } else {
        reply = `ถ้าอยากกินชานมหรือขนม แนะนำสั่งระดับความหวาน 25% หรือแชร์กับเพื่อนคนละครึ่งแก้ว จะได้ฟินแบบไม่เกินโควตาน้า 🧋💕`;
      }
    } else {
      reply = `โมจิอยู่ตรงนี้เสมอเลย! วันนี้ ${nickname} คุมน้ำตาลไป ${fmt(today_sugar)}g (เหลืออีก ${fmt(remSugar)}g) มีอะไรอยากปรึกษาเรื่องอาหารพิมพ์บอกโมจิได้เลยนะ 🍡`;
    }

    return { reply, mochiMood: remSugar < 0 ? 'worry' : 'happy' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nคำถามจากผู้ใช้: ' + message }] }
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
        }
      })
    });

    if (!response.ok) throw new Error('Gemini API error');

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return {
      reply: replyText || 'โมจิรับฟังอยู่นะ ค่อยๆ ปรับการกินไปด้วยกันนะ 🍡',
      mochiMood: remSugar < 0 ? 'worry' : 'happy'
    };
  } catch (e) {
    return {
      reply: `วันนี้เหลือน้ำตาลอีก ${fmt(remSugar)}g แนะนำทานอาหารที่มีโปรตีนและผักเพื่อสุขภาพที่ดีนะ 🍡`,
      mochiMood: 'happy'
    };
  }
}
