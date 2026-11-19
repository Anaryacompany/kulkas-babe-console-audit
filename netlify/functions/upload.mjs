// POST /api/upload  {nama, enc: "gzip-base64"|"plain", isi}  →  menimpa file terakhir (selalu cuma 1 file tersimpan).
import { gunzipSync } from 'node:zlib';
import { bungkus, jawab, sql, siapkanTabel, wajibMasuk, GagalHttp, WAJIB } from '../../lib/inti.mjs';

export default bungkus(async (req) => {
  if (req.method !== 'POST') throw new GagalHttp(405, 'Metode tidak didukung.');
  wajibMasuk(req);
  let body;
  try { body = await req.json(); } catch { throw new GagalHttp(400, 'Kiriman tidak terbaca.'); }
  const nama = String(body.nama || 'order_master.csv').slice(0, 200);
  const enc = body.enc === 'plain' ? 'plain' : 'gzip-base64';
  const isi = String(body.isi || '');
  if (!isi) throw new GagalHttp(400, 'File kosong.');
  let teks;
  try { teks = enc === 'plain' ? isi : gunzipSync(Buffer.from(isi, 'base64')).toString('utf8'); } catch { throw new GagalHttp(400, 'File rusak waktu dikirim. Coba upload lagi.'); }
  if (teks.charCodeAt(0) === 0xFEFF) teks = teks.slice(1);
  const kepala = teks.slice(0, teks.search(/\r?\n/) === -1 ? teks.length : teks.search(/\r?\n/)).split(',').map((s) => s.replace(/^"|"$/g, '').trim());
  const kurang = WAJIB.filter((k) => !kepala.includes(k));
  if (kurang.length) throw new GagalHttp(400, `Kolom ini tidak ada di file: ${kurang.join(', ')}. Pastikan ini CSV order master dari BAUS.`);
  const jumlah = Math.max(0, Number(body.jumlah_order) || 0);
  await siapkanTabel();
  const q = sql();
  const [r] = await q`INSERT INTO upload_terakhir (id, nama_file, enc, isi, jumlah_order, ukuran_byte, diupload)
    VALUES (1, ${nama}, ${enc}, ${isi}, ${jumlah}, ${Buffer.byteLength(teks)}, now())
    ON CONFLICT (id) DO UPDATE SET nama_file = EXCLUDED.nama_file, enc = EXCLUDED.enc, isi = EXCLUDED.isi,
      jumlah_order = EXCLUDED.jumlah_order, ukuran_byte = EXCLUDED.ukuran_byte, diupload = now()
    RETURNING diupload`;
  return jawab({ ok: true, diupload: new Date(r.diupload).toISOString() });
});

export const config = { path: '/api/upload' };
