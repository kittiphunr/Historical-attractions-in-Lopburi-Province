/* ============================================================
   ข้อมูลแหล่งท่องเที่ยวประวัติศาสตร์ลพบุรี
   - ทุกสถานที่มี `sources` = แหล่งอ้างอิงที่ใช้ประกอบข้อมูลจริง
   - `photo` = null หมายถึงยังไม่ได้ใส่ภาพถ่ายจริง (ดู README หัวข้อ "ใส่ภาพพร้อมเครดิต")
     รูปแบบ: { src, alt, author, license, licenseUrl, sourceUrl }
   - `video` = ลิงก์ค้นหา YouTube (ใช้ได้จริงเสมอ) ; ถ้ามี `video.id` จะฝังวิดีโอให้
     รูปแบบ: { id, title, channel, url }
   ============================================================ */

window.SOURCES = [
  { id: 'wp-narai', name: "Wikipedia (EN) — King Narai's Palace", url: "https://en.wikipedia.org/wiki/King_Narai%27s_Palace" },
  { id: 'wp-sam', name: 'Wikipedia (EN) — Phra Prang Sam Yot', url: 'https://en.wikipedia.org/wiki/Phra_Prang_Sam_Yot' },
  { id: 'wp-khaek', name: 'Wikipedia (EN) — Prang Khaek', url: 'https://en.wikipedia.org/wiki/Prang_Khaek' },
  { id: 'wp-lop', name: 'Wikipedia (EN) — Lopburi province', url: 'https://en.wikipedia.org/wiki/Lopburi_province' },
  { id: 'silpa-45648', name: 'ศิลปวัฒนธรรม — ลพบุรีสมัยพระนารายณ์: ร่องรอยการพัฒนาในอดีตและมรดกทางวัฒนธรรม', url: 'https://www.silpa-mag.com/?p=45648' },
  { id: 'silpa-9216', name: 'ศิลปวัฒนธรรม — วัดจุฬามณี พิษณุโลก กับปรางค์พระศรีรัตนมหาธาตุ ลพบุรี', url: 'https://www.silpa-mag.com/history/article_9216' },
  { id: 'silpa-10334', name: 'ศิลปวัฒนธรรม — การเสื่อมสลายของปราสาทขอมในดินแดนไทย', url: 'https://www.silpa-mag.com/?p=10334' },
  { id: 'silpa-22625', name: 'ศิลปวัฒนธรรม — อุโบสถสีทองวัดไลย์', url: 'https://www.silpa-mag.com/?p=22625' },
  { id: 'silpa-53375', name: 'ศิลปวัฒนธรรม — “สมบัติ” ในไหฝังดินของเจ้าพระยาวิไชเยนทร์ (ฟอลคอน)', url: 'https://www.silpa-mag.com/?p=53375' },
  { id: 'silpa-4037', name: 'ศิลปวัฒนธรรม — พระพุทธรูปที่ลพบุรีอาจสร้างครอบ “ไม้กางเขน”', url: 'https://www.silpa-mag.com/?p=4037' },
  { id: 'silpa-74633', name: 'ศิลปวัฒนธรรม — ลวปุระ-ลพบุรีสมัยพระเจ้าสุริยวรมันที่ 1', url: 'https://www.silpa-mag.com/?p=74633' },
  { id: 'lovethailand-sam', name: 'LoveThailand.org — พระปรางค์สามยอด', url: 'https://www.lovethailand.org/travel/t/20-ลพบุรี/1625-พระปรางค์สามยอด.html' },
  { id: 'lovethailand-lai', name: 'LoveThailand.org — วัดไลย์', url: 'https://www.lovethailand.org/travel/t/20-ลพบุรี/1647-วัดไลย์.html' },
  { id: 'lovethailand-nakhon', name: 'LoveThailand.org — Wat Nakhon Kosa', url: 'https://www.lovethailand.org/travel/t/20-ลพบุรี/1636-วัดนครโกษา.html' },
  { id: 'lovethailand-sao', name: 'LoveThailand.org — Wat Sao Thong Thong', url: 'https://www.lovethailand.org/travel/70-phuket/20-ลพบุรี/1646-วัดเสาธงทอง.html' },
  { id: 'trueid-23', name: 'TrueID Travel — 23 ที่เที่ยวลพบุรี', url: 'https://travel.trueid.net/detail/PobBKjLzmeJo' },
  { id: 'trueid-wat', name: 'TrueID Travel — 11 วัดสวย ลพบุรี', url: 'https://travel.trueid.net/detail/xl5NXgmAMYaw' },
  { id: 'trueid-wichayen', name: 'TrueID Travel — บ้านวิชาเยนทร์', url: 'https://travel.trueid.net/detail/ldbQ9rXMLjm' },
  { id: 'lonely-sam', name: 'Lonely Planet — Prang Sam Yot', url: 'https://www.lonelyplanet.com/thailand/attractions/prang-sam-yot/a/poi-sig/1174557/357592' },
  { id: 'lonely-sao', name: 'Lonely Planet (FR) — Wat Sao Thong Thong', url: 'https://www.lonelyplanet.fr/poi/thailande-lecentrethailandecg-wat-sao-thong-thong' },
  { id: 'renown', name: 'Renown Travel — Phra Prang Sam Yot', url: 'https://renown-travel.com/khmertemples/phra-prang-sam-yot.html' },
  { id: 'umich', name: 'University of Michigan (SAAF) — Phra Prang Sam Yot', url: 'https://quod.lib.umich.edu/s/saaf/THC-SL-AR-COM-5.45R-SL-M20-COM-L67-SL-S344-SL-470/FM91_7?view=entry' },
  { id: 'thairath', name: 'ไทยรัฐ — ลิงลพบุรี (The Issue)', url: 'https://www.thairath.co.th/scoop/theissue/2746255' },
  { id: 'matichon', name: 'มติชน — ลพบุรี ‘เมืองทหาร’ ลิงศาลเจ้าพ่อ', url: 'https://www.matichon.co.th/prachachuen/news_4484156' },
  { id: 'matichon-lavo', name: 'มติชน — เมืองละโว้ ราชธานีแห่งที่ 2 ยุคขุนหลวงนารายณ์', url: 'https://www.matichon.co.th/prachachuen/news_922483' },
  { id: 'thansettakij', name: 'ฐานเศรษฐกิจ — ลิงลพบุรี', url: 'https://www.thansettakij.com/lifestyle/travel-shopping/590650' },
  { id: 'wongnai', name: 'Wongnai Trips — พิชิตเขาวงพระจันทร์ 3,790 ขั้น', url: 'https://www.wongnai.com/trips/attraction-khao-wongphrachan-lopburi' },
  { id: 'sanook', name: 'Sanook — เขาวงพระจันทร์', url: 'https://www.sanook.com/horoscope/112705/' },
  { id: 'khaosod', name: 'ข่าวสด — พระศรีอริยเมตไตรย วัดไลย์', url: 'https://www.khaosod.co.th/amulets/news_1780024' },
  { id: 'thaijo-nakhon', name: 'วารสาร AJNU (ThaiJO) — Reconstruction models in architecture of Wat Nakornkosa, Lopburi', url: 'https://so01.tci-thaijo.org/index.php/ajnu/article/view/269408' },
  { id: 'thaiholiday', name: 'Thai Holiday Guide — Wat Sao Thong Thong', url: 'https://www.thaiholidayguide.com/attraction/wat-sao-thong-thong/' },
  { id: 'tripniceday', name: 'TripNiceDay — พระปรางค์สามยอด', url: 'https://www.tripniceday.com/en/place/พระปรางค์สามยอด' },
  { id: 'onab-kawisararam', name: 'สำนักงานพระพุทธศาสนาจังหวัดลพบุรี — วัดกวิศรารามราชวรวิหาร', url: 'https://lri.onab.go.th/th/content/category/detail/id/110/iid/648' },
  { id: 'dhammathai-kawisararam', name: 'ธรรมะไทย — วัดกวิศราราม ราชวรวิหาร (พระอารามหลวง ลพบุรี)', url: 'https://www.dhammathai.org/watthai/dbview.php?No=71' },
  { id: 'lovethailand-kawisararam', name: 'LoveThailand.org — Wat Kawitsararam Ratchaworawihan', url: 'https://www.lovethailand.org/travel/en/20-Lop-Buri/1631-Wat-Kawitsararam-Ratchaworawihan.html' },
  { id: 'trip-saplek', name: 'Trip.com Moments — อ่างซับเหล็ก ลพบุรี', url: 'https://th.trip.com/moments/poi-sub-lek-reservoir-62020945/' },
  { id: '5force-saplek', name: '5 Force News — โครงการพัฒนาอ่างซับเหล็ก ลพบุรี', url: 'https://www.5forcenews.com/?p=279182' },
  { id: 'paiduaykan-saplek', name: 'ไปด้วยกัน — อ่างซับเหล็ก ลพบุรี', url: 'https://paiduaykan.com/sublek-reservoir/' },
  { id: 'mgr-phusaplek', name: 'MGR Online — “ภูซับเหล็ก” จุดชมวิวหลักล้าน อันซีนเมืองลพบุรี', url: 'https://mgronline.com/travel/detail/9650000068456' },
  { id: 'psu-sapchampa', name: 'สถาบันสุวรรณภูมิศึกษา — เมืองโบราณซับจำปา', url: 'https://suvarnabhumi.psu.ac.th/tudb/archaeologicalread/59' },
  { id: 'sac-sapchampa', name: 'ศูนย์มานุษยวิทยาสิรินธร — ศูนย์ข้อมูลเมืองโบราณซับจำปาและป่าจำปีสิรินธร', url: 'https://db.sac.or.th/museum/museum-detail/300' },
  { id: 'matichonacademy-sapchampa', name: 'มติชนอคาเดมี่ — ศรีเทพ-ซับจำปา เมืองโบราณสองวัฒนธรรม', url: 'https://www.matichonacademy.com/the-project/article_6810' },
  { id: 'sac-inscription-sapchampa', name: 'ฐานข้อมูลจารึกในประเทศไทย (ศูนย์มานุษยวิทยาสิรินธร) — จารึกซับจำปา', url: 'https://db.sac.or.th/inscriptions/inscribe/detail/925' },
  { id: 'naewna', name: 'แนวหน้า — พระนารายณ์ราชนิเวศน์', url: 'https://www.naewna.com/lady/712034' }
];

const yt = (q) => ({ search: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, query: q });

/*@ATTRACTIONS@*/

window.TIMELINE = [
  { era: 'ทวารวดี', when: 'ก่อนพุทธศตวรรษที่ 15', text: 'ลพบุรีหรือ “ละโว้” เป็นศูนย์กลางแว่นแคว้นสำคัญ มีร่องรอยวัฒนธรรมทวารวดีที่วัดนครโกษา', src: 'thaijo-nakhon' },
  { era: 'ขอม–เขมรพระนคร', when: 'ราวคริสต์ศตวรรษที่ 10–13', text: 'ปรางค์แขกและพระปรางค์สามยอด สะท้อนช่วงที่ลพบุรีผูกพันกับวัฒนธรรมเขมรโบราณ', src: 'silpa-74633' },
  { era: 'อยุธยา', when: 'ก่อตั้งราว พ.ศ. 1893', text: 'ลพบุรีเป็นเมืองลูกหลวง วัดไลย์เล่ากันว่ามีมาตั้งแต่ช่วงก่อตั้งกรุง', src: 'silpa-22625' },
  { era: 'สมเด็จพระนารายณ์', when: 'พ.ศ. 2199–2231', text: 'ราชธานีแห่งที่สอง พระราชวังสร้าง พ.ศ. 2209 ลพบุรีเปิดรับราชทูตและนักบวชต่างชาติ', src: 'wp-narai' },
  { era: 'รัตนโกสินทร์', when: 'รัชกาลที่ 4', text: 'บูรณะพระราชวังและพระราชทานนาม “พระนารายณ์ราชนิเวศน์”', src: 'wp-narai' },
  { era: 'ปัจจุบัน', when: 'ศตวรรษที่ 21', text: 'เมืองประวัติศาสตร์ที่มีฝูงลิงเป็นเอกลักษณ์ และงานเลี้ยงโต๊ะจีนลิงประจำปี', src: 'thairath' }
];

window.ROUTE = [   /* เส้นทางประวัติศาสตร์ (A) ตามแผนที่: 1→2→3→4→5→6→9→7→8 — หมายเลขที่แสดงคือหมายเลขสถานที่บนแผนที่ */
  ['พระนารายณ์ราชนิเวศน์', 'narai-palace', 'ใช้เวลาหลักของวัน'],
  ['บ้านวิชาเยนทร์', 'wichayen', 'เรื่องเล่าต่างชาติสมัยพระนารายณ์'],
  ['วัดเสาธงทอง', 'sao-thong-thong', 'หน้าต่างโกธิคกลางเมือง'],
  ['ปรางค์แขก', 'prang-khaek', 'หนึ่งในปราสาทขอมที่เก่าที่สุดของเมือง'],
  ['วัดพระศรีรัตนมหาธาตุ', 'mahathat', 'ปรางค์ประธานกลางเมือง'],
  ['พระปรางค์สามยอด', 'sam-yot', 'ไฮไลต์ภาพถ่ายของเมือง'],
  ['วัดกวิศรารามราชวรวิหาร', 'kawisararam', 'อยู่ติดพระราชวังทางทิศใต้'],
  ['ศาลพระกาฬ', 'sala-phra-kan', 'ทักทายลิงและสักการะ'],
  ['วัดนครโกษา', 'nakhon-kosa', 'ซากทวารวดีแห่งเดียวในเมือง']
];

/* โมเดลแผนที่ 3 มิติทั้งจังหวัด (ปั้นโดยเจ้าของโปรเจกต์)
   hotspots: พิกัด x,z ในหน่วยของไฟล์ต้นฉบับ (กึ่งกลางโมเดล ≈ 0,0; x ขวา, z ลงล่างในมุมมองจากด้านบน เหนืออยู่บน)
   ความสูงของหมุดคำนวณจากผิวโมเดลอัตโนมัติ — ถ้าเปลี่ยนโมเดลต้องวัดพิกัดใหม่ */
window.PROVINCE_MODEL = {
  url: 'assets/model/lopburi-province.glb',
  ar: 'assets/model/lopburi-province.ar.glb',
  credit: 'โมเดลแผนที่ 3 มิติ: ปั้นโดยเจ้าของโปรเจกต์ (Kittiphun Ruttanakorn)',
  hotspots: [   /* วัดจากภาพมุมมองจากด้านบนของโมเดลแผนที่ (เหนืออยู่บน) เรียงตามหมายเลขบนแผนที่ 2D — ปรับตำแหน่งได้ด้วย map-debug.html */
    { id: 'narai-palace', x: -0.394, z: 0.532 },
    { id: 'wichayen', x: -0.285, z: 0.240 },
    { id: 'sao-thong-thong', x: -0.529, z: 0.259 },
    { id: 'prang-khaek', x: -0.276, z: 0.026 },
    { id: 'mahathat', x: -0.039, z: 0.433 },
    { id: 'sam-yot', x: -0.022, z: 0.227 },
    { id: 'sala-phra-kan', x: 0.131, z: 0.259 },
    { id: 'nakhon-kosa', x: 0.171, z: 0.613 },
    { id: 'kawisararam', x: -0.112, z: 0.706 },
    { id: 'wat-lai', x: -0.650, z: -0.400 },
    { id: 'ang-sap-lek', x: 0.459, z: -0.079 },
    { id: 'khao-wong', x: 0.542, z: -0.794 }
  ]
};
