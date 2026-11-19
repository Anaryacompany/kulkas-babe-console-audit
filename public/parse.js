// Membaca CSV order master BAUS (koma, tanda kutip ganda, baris baru di dalam kutip).
function bacaCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const isi = rows.filter((r) => r.length > 1 || r[0] !== '');
  if (!isi.length) return {kolom: [], baris: []};
  const kolom = isi[0].map((k) => k.trim());
  const baris = isi.slice(1).map((r) => Object.fromEntries(kolom.map((k, j) => [k, r[j] ?? ''])));
  return {kolom, baris};
}
