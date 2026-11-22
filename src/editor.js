/* ตัวแก้ไขข้อความของหน้า /admin/places.php — CKEditor 5 (GPL-2.0-or-later) ประกอบเฉพาะปลั๊กอินที่ใช้
   สร้างไฟล์ด้วย npm run build:editor -> deploy/php/admin/assets/editor.js + editor.css
   ผลลัพธ์ HTML ถูกกรองซ้ำฝั่งเซิร์ฟเวอร์เสมอ (api/content.php lop_rt_clean) — ตัวแก้ไขไม่ใช่ด่านความปลอดภัย */
import {
  ClassicEditor, Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript, RemoveFormat,
  Link, AutoLink, List, BlockQuote, Table, TableToolbar, HorizontalLine, Undo, PasteFromOffice, Autoformat,
  Image, ImageCaption, ImageToolbar, ImageUpload, SimpleUploadAdapter
} from 'ckeditor5';
import th from 'ckeditor5/translations/th.js';
import 'ckeditor5/ckeditor5.css';

window.LopEditor = {
  /** el = <textarea> ที่มี HTML เริ่มต้น; opts = { uploadUrl, csrf, placeholder } คืน Promise<editor> */
  create(el, opts) {
    return ClassicEditor.create(el, {
      licenseKey: 'GPL',
      language: 'th',
      translations: [th],
      placeholder: opts.placeholder || '',
      plugins: [Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript, RemoveFormat,
        Link, AutoLink, List, BlockQuote, Table, TableToolbar, HorizontalLine, Undo, PasteFromOffice, Autoformat,
        Image, ImageCaption, ImageToolbar, ImageUpload, SimpleUploadAdapter],
      toolbar: { items: ['undo', 'redo', '|', 'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
        'link', 'bulletedList', 'numberedList', 'blockQuote', 'insertTable', 'uploadImage', 'horizontalLine'], shouldNotGroupWhenFull: true },
      heading: { options: [
        { model: 'paragraph', title: 'ย่อหน้า', class: 'ck-heading_paragraph' },
        { model: 'heading3', view: 'h3', title: 'หัวข้อ', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'หัวข้อย่อย', class: 'ck-heading_heading4' }
      ] },
      link: { addTargetToExternalLinks: true, defaultProtocol: 'https://' },
      image: { toolbar: ['imageTextAlternative', 'toggleImageCaption'] },
      table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
      simpleUpload: { uploadUrl: opts.uploadUrl, withCredentials: true, headers: { 'X-CSRF-Token': opts.csrf } }
    });
  }
};
