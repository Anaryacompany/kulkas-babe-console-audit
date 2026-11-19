// POST /api/masuk  {pin}  →  {token, exp}. Salah PIN 8x dalam 15 menit dari alamat yang sama = dikunci sementara.
import { bungkus, jawab, sql, siapkanTabel, cocokPin, buatToken, GagalHttp } from '../../lib/inti.mjs';

export default bungkus(async (req, context) => {
  if (req.method !== 'POST') throw new GagalHttp(405, 'Metode tidak didukung.');
  await siapkanTabel();
  const q = sql();
  const ip = (context && context.ip) || 'tanpa-ip';
  const [{ n: salahIp }] = await q`SELECT count(*)::int AS n FROM pin_salah WHERE ip = ${ip} AND waktu > now() - interval '15 minutes'`;
  const [{ n: salahSemua }] = await q`SELECT count(*)::int AS n FROM pin_salah WHERE waktu > now() - interval '15 minutes'`;
  if (salahIp >= 8 || salahSemua >= 60) throw new GagalHttp(429, 'Terlalu banyak PIN salah. Coba lagi 15 menit lagi.');
  let body = {};
  try { body = await req.json(); } catch { /* kosong */ }
  if (!cocokPin(body.pin)) {
    await q`INSERT INTO pin_salah (ip) VALUES (${ip})`;
    throw new GagalHttp(401, 'PIN salah.');
  }
  await q`DELETE FROM pin_salah WHERE ip = ${ip} OR waktu < now() - interval '1 day'`;
  return jawab(buatToken());
});

export const config = { path: '/api/masuk' };
