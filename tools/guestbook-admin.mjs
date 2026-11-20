/* เครื่องมือเจ้าของเว็บสำหรับสมุดเยี่ยมที่แชร์ร่วมกัน (Cloudflare Worker)
   ใช้:  GUESTBOOK_API=https://<worker>.workers.dev/api/guestbook ADMIN_TOKEN=<โทเคน> node tools/guestbook-admin.mjs list
         GUESTBOOK_API=... ADMIN_TOKEN=... node tools/guestbook-admin.mjs delete <id>
   ADMIN_TOKEN คือค่าที่ตั้งด้วย `npx wrangler secret put ADMIN_TOKEN` (ห้าม commit ลง repo) */
const [cmd, id] = process.argv.slice(2);
const api = process.env.GUESTBOOK_API, token = process.env.ADMIN_TOKEN;
if (!api || !['list', 'delete'].includes(cmd) || (cmd === 'delete' && (!id || !token))) {
  console.error('ใช้: GUESTBOOK_API=<url> [ADMIN_TOKEN=<token>] node tools/guestbook-admin.mjs list | delete <id>'); process.exit(1);
}
if (cmd === 'list') {
  const rows = await (await fetch(api)).json();
  rows.forEach(r => console.log(`${r.id}  ${r.at.slice(0, 16).replace('T', ' ')}  ${'★'.repeat(r.rating).padEnd(5, '·')}  ${r.name} : ${r.message.replace(/\s+/g, ' ').slice(0, 80)}`));
  console.log(`\n${rows.length} รายการ`);
} else {
  const r = await fetch(`${api.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  console.log(r.status, await r.text());
}
