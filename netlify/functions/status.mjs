// GET /api/status  →  kapan file & aturan terakhir berubah (dipakai halaman untuk tahu perlu muat ulang atau tidak).
import { bungkus, jawab, sql, siapkanTabel, wajibMasuk, GagalHttp } from '../../lib/inti.mjs';

export default bungkus(async (req) => {
  if (req.method !== 'GET') throw new GagalHttp(405, 'Metode tidak didukung.');
  wajibMasuk(req);
  await siapkanTabel();
  const q = sql();
  const [f] = await q`SELECT diupload FROM upload_terakhir WHERE id = 1`;
  const [a] = await q`SELECT diubah FROM aturan WHERE id = 1`;
  return jawab({ diupload: f ? new Date(f.diupload).toISOString() : null, aturan_diubah: a ? new Date(a.diubah).toISOString() : null });
});

export const config = { path: '/api/status' };
