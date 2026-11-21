/* สร้างภาพแบนเนอร์หน้าปกและภาพตัวอย่างตอนแชร์ลิงก์จากภาพต้นฉบับ
   ใช้:  node tools/make-banner.mjs [ต้นฉบับ] [--ratio 2.9] [--focus 0.2]
   - ตัดขอบขาวรอบภาพออกอัตโนมัติ (ภาพต้นฉบับมักมีแถบขาวบน/ล่าง)
   - ตัดให้ได้สัดส่วนกว้าง:สูง = --ratio (ค่าเริ่มต้น 2.9) --focus 0..1 คือสัดส่วนของส่วนที่ตัดทิ้งที่เอาจากด้านบน
     (0 = ตัดจากด้านล่างทั้งหมด เก็บยอดอาคารไว้, 0.5 = ตัดสองข้างเท่ากัน)
   - เขียน assets/img/banner-lopburi-1600.webp, banner-lopburi-800.webp และ og-cover.jpg (1200x630 ภาพแบนเนอร์เต็มความกว้างบนพื้นเบลอ + ตราจังหวัด)
   แล้วแก้ width/height ของ <img> แบนเนอร์ใน index.html ให้ตรงกับขนาดที่พิมพ์ออกมา */
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : parseFloat(args[i + 1]); };
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || 'source-models/banner-lopburi.original.webp';
const ratio = flag('ratio', 2.9), focus = flag('focus', 0.2);

// 1) หาขอบเนื้อหา (ไม่ขาว)
const { data, info } = await sharp(src).flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const dark = (x, y) => { const i = (y * W + x) * C; return data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245; };
const rowHas = (y) => { let n = 0; for (let x = 0; x < W; x += 4) if (dark(x, y)) n++; return n >= W / 40; };
let top = 0; while (top < H - 1 && !rowHas(top)) top++;
let bot = H - 1; while (bot > top && !rowHas(bot)) bot--;
const colHas = (x) => { let n = 0; for (let y = top; y <= bot; y += 4) if (dark(x, y)) n++; return n >= 3; };
let left = 0; while (left < W - 1 && !colHas(left)) left++;
let right = W - 1; while (right > left && !colHas(right)) right--;
let cw = right - left + 1, ch = bot - top + 1;
console.log(`ต้นฉบับ ${W}x${H} -> เนื้อหาหลังตัดขอบขาว ${cw}x${ch} (${(cw / ch).toFixed(2)}:1)`);

// 2) ตัดให้ได้สัดส่วนที่ต้องการ (เฉพาะแนวตั้ง ถ้าภาพสูงเกินสัดส่วน)
if (cw / ch < ratio) {
  const nh = Math.round(cw / ratio), extra = ch - nh;
  top += Math.round(extra * focus); ch = nh;
}
const base = sharp(src).flatten({ background: '#fff' }).extract({ left, top, width: cw, height: ch });
const png = await base.clone().png().toBuffer();

// 3) ไฟล์แบนเนอร์
for (const w of [1600, 800]) {
  const out = `assets/img/banner-lopburi-${w}.webp`;
  const r = await sharp(png).resize({ width: w }).webp({ quality: 82 }).toFile(out);
  console.log(`${out}  ${r.width}x${r.height}  ${(r.size / 1024).toFixed(0)} KB`);
}

// 4) ภาพตัวอย่างตอนแชร์ลิงก์ 1200x630
const OW = 1200, OH = 630;
const bg = await sharp(png).resize(OW, OH, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55 }).png().toBuffer();
const fgH = Math.round(OW / (cw / ch));
const fg = await sharp(png).resize({ width: OW }).png().toBuffer();
const seal = await sharp('assets/img/seal-384.png').resize({ width: 200 }).png().toBuffer();
const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#201c19" stop-opacity="0"/><stop offset="1" stop-color="#201c19" stop-opacity=".55"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const o = await sharp(bg).composite([
  { input: fg, left: 0, top: Math.round((OH - fgH) / 2) },
  { input: shade, left: 0, top: 0 },
  { input: seal, left: 36, top: OH - 200 - 30 * 0 - 24 }
]).jpeg({ quality: 86, mozjpeg: true }).toFile('assets/img/og-cover.jpg');
console.log(`assets/img/og-cover.jpg  ${o.width}x${o.height}  ${(o.size / 1024).toFixed(0)} KB`);
console.log(`\nใส่ใน index.html: <img … width="1600" height="${Math.round(1600 / (cw / ch))}">`);
