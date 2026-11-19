// GET /api/data  →  file terakhir (terkompres) + aturan yang dipakai.
import { bungkus, jawab, sql, siapkanTabel, wajibMasuk, GagalHttp } from '../../lib/inti.mjs';

export default bungkus(async (req) => {
  if (req.method !== 'GET') throw new GagalHttp(405, 'Metode tidak didukung.');
  wajibMasuk(req);
  await siapkanTabel();
  const q = sql();
  const [f] = await q`SELECT nama_file, enc, isi, jumlah_order, diupload FROM upload_terakhir WHERE id = 1`;
  const [a] = await q`SELECT isi, diubah FROM aturan WHERE id = 1`;
  return jawab({
    file: f ? { nama: f.nama_file, enc: f.enc, isi: f.isi, jumlah_order: f.jumlah_order, diupload: new Date(f.diupload).toISOString() } : null,
    aturan: a ? (typeof a.isi === 'string' ? JSON.parse(a.isi) : a.isi) : null,
    aturan_diubah: a ? new Date(a.diubah).toISOString() : null,
  });
});

export const config = { path: '/api/data' };
