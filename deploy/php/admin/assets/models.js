/* หน้า admin/models.php: กล่องยืนยันของปุ่ม data-confirm · ตรวจขนาดไฟล์ก่อนส่ง (ไม่เกินขีดจำกัดอัปโหลดของโฮสต์) · กันกดซ้ำและแจ้งสถานะระหว่างอัปโหลด */
(function () {
  'use strict';
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-confirm]');
    if (b && !window.confirm(b.getAttribute('data-confirm'))) ev.preventDefault();
  });
  var form = document.getElementById('modelForm');
  if (!form) return;
  var msg = document.createElement('p'); msg.className = 'warn'; msg.setAttribute('role', 'alert'); msg.hidden = true;
  form.insertBefore(msg, form.firstChild);
  form.addEventListener('submit', function (ev) {
    var limit = parseInt(form.getAttribute('data-limit') || '0', 10);
    var total = 0, files = form.querySelectorAll('input[type=file]');
    Array.prototype.forEach.call(files, function (f) { if (f.files && f.files[0]) total += f.files[0].size; });
    if (limit && total > limit - 65536) {
      ev.preventDefault();
      msg.textContent = 'ไฟล์รวมกัน ' + (total / 1048576).toFixed(1) + ' MB เกินขีดจำกัดอัปโหลดของโฮสต์ (' + Math.floor(limit / 1048576) + ' MB) — ย่อไฟล์ หรืออัปโหลดทีละไฟล์ หรือขอให้โฮสต์เพิ่ม upload_max_filesize และ post_max_size';
      msg.hidden = false; return;
    }
    msg.hidden = true;
    var s = form.querySelector('input[type=submit]');
    if (s) { s.disabled = true; s.value = 'กำลังอัปโหลด… อย่าปิดหน้านี้'; }
  });
})();
