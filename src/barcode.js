/* บาร์โค้ด Code 128 จริง (สแกนได้) วาดเป็น SVG ด้วย JsBarcode — ใช้บนตั๋ว Heritage Pass
   window.renderBarcode(svgElement, text) */
import JsBarcode from 'jsbarcode';

window.renderBarcode = function (svg, text) {
  JsBarcode(svg, text, { format: 'CODE128', displayValue: false, margin: 0, width: 2, height: 46, background: 'transparent', lineColor: '#2a2320' });
  // ให้ขยาย/ย่อตามความกว้างของกล่อง โดยคงสัดส่วนแท่ง
  const w = svg.getAttribute('width'), h = svg.getAttribute('height');
  if (w && h) { svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`); svg.removeAttribute('width'); svg.removeAttribute('height'); }
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('shape-rendering', 'crispEdges');
};
