/* หน้า admin/places.php: เปิดตัวแก้ไข CKEditor ให้ textarea.lop-rt ทุกช่อง · เตือนก่อนออกจากหน้าเมื่อมีการแก้ที่ยังไม่บันทึก · กล่องยืนยันของปุ่ม data-confirm */
(function () {
  'use strict';
  var form = document.getElementById('cmsForm');
  var editors = [], dirty = false;

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-confirm]');
    if (b && !window.confirm(b.getAttribute('data-confirm'))) ev.preventDefault();
  });
  if (!form) return;

  var warn = function (msg) {
    var p = document.createElement('p'); p.className = 'card warn'; p.setAttribute('role', 'alert'); p.textContent = msg;
    form.parentNode.insertBefore(p, form);
  };
  if (!window.LopEditor) { warn('โหลดตัวแก้ไขไม่สำเร็จ (assets/editor.js) — ช่องข้อความด้านล่างจะเป็นโค้ด HTML ดิบ แนะนำให้ตรวจไฟล์แล้วโหลดหน้าใหม่'); return; }

  var areas = form.querySelectorAll('textarea.lop-rt');
  Array.prototype.forEach.call(areas, function (t) {
    window.LopEditor.create(t, { uploadUrl: form.getAttribute('data-upload'), csrf: form.getAttribute('data-csrf'), placeholder: t.getAttribute('data-ph') || '' })
      .then(function (ed) {
        editors.push({ t: t, ed: ed });
        ed.model.document.on('change:data', function () { dirty = true; });
      })
      .catch(function (e) { if (window.console) console.error(e); warn('เปิดตัวแก้ไขของช่อง "' + (t.getAttribute('aria-label') || '') + '" ไม่สำเร็จ'); });
  });
  form.addEventListener('submit', function (ev) {
    if (editors.length !== areas.length) { ev.preventDefault(); warn('ตัวแก้ไขยังโหลดไม่ครบ ลองอีกครั้งในอีกสักครู่'); return; }
    editors.forEach(function (x) { x.t.value = x.ed.getData(); });
    dirty = false;
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
