// Minimal PDF writer: one page per JPEG image (DCTDecode). No external libraries.
'use strict';

/**
 * @param {{jpeg: Uint8Array, width: number, height: number, pageWidth: number, pageHeight: number}[]} pages
 *   width/height in image pixels; pageWidth/pageHeight in PDF points.
 * @returns {Blob}
 */
function buildPdf(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (num, body) => {
    offsets[num] = length;
    push(`${num} 0 obj\n`);
    for (const part of body) push(part);
    push('\nendobj\n');
  };
  const fmt = (n) => (Math.round(n * 100) / 100).toString();

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment

  const pageNums = pages.map((_, i) => 3 + i * 3);
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] >>`]);

  pages.forEach((p, i) => {
    const pageNum = pageNums[i];
    const imgNum = pageNum + 1;
    const contentNum = pageNum + 2;
    const w = fmt(p.pageWidth);
    const h = fmt(p.pageHeight);
    obj(pageNum, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] `
      + `/Resources << /XObject << /Im${i} ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>`]);
    obj(imgNum, [
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB `
        + `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      '\nendstream',
    ]);
    const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im${i} Do\nQ\n`;
    obj(contentNum, [`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`]);
  });

  const count = 3 + pages.length * 3;
  const xrefAt = length;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
