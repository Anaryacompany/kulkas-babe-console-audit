// POST /api/aturan  {BATAS, SIAP, NYARIS, NY_MAX, JAM_MULAI, JAM_SELESAI}  →  dipakai semua orang.
import { bungkus, jawab, sql, siapkanTabel, wajibMasuk, GagalHttp, ATURAN } from '../../lib/inti.mjs';

export default bungkus(async (req) => {
  if (req.method !== 'POST') throw new GagalHttp(405, 'Metode tidak didukung.');
  wajibMasuk(req);
  let body;
  try { body = await req.json(); } catch { throw new GagalHttp(400, 'Kiriman tidak terbaca.'); }
  const isi = {};
  for (const [k, [lo, hi]] of Object.entries(ATURAN)) {
    const v = Number(body[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) throw new GagalHttp(400, `Angka ${k} harus antara ${lo} dan ${hi}.`);
    isi[k] = v;
  }
  await siapkanTabel();
  const q = sql();
  const [r] = await q`INSERT INTO aturan (id, isi, diubah) VALUES (1, ${JSON.stringify(isi)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET isi = EXCLUDED.isi, diubah = now() RETURNING diubah`;
  return jawab({ ok: true, aturan: isi, diubah: new Date(r.diubah).toISOString() });
});

export const config = { path: '/api/aturan' };
