// Bagian bersama semua fungsi: database Neon, PIN, token sesi, jawaban JSON.
import { neon } from '@neondatabase/serverless';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const env = (k) => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]);

export class GagalHttp extends Error {
  constructor(status, pesan) { super(pesan); this.status = status; }
}

export const jawab = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

let _sql = null;
export function sql() {
  if (globalThis.__TEST_SQL) return globalThis.__TEST_SQL;
  if (!_sql) {
    const url = env('DATABASE_URL');
    if (!url) throw new GagalHttp(500, 'Database belum disambungkan (DATABASE_URL kosong di Netlify).');
    _sql = neon(url);
  }
  return _sql;
}

let _siap = false;
export async function siapkanTabel() {
  if (_siap) return;
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS upload_terakhir (
    id INTEGER PRIMARY KEY,
    nama_file TEXT NOT NULL,
    enc TEXT NOT NULL,
    isi TEXT NOT NULL,
    jumlah_order INTEGER NOT NULL,
    ukuran_byte INTEGER NOT NULL,
    diupload TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS aturan (
    id INTEGER PRIMARY KEY,
    isi JSONB NOT NULL,
    diubah TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS pin_salah (
    ip TEXT NOT NULL,
    waktu TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  _siap = true;
}

function rahasia() {
  const pin = env('CONSOLE_PIN'), s = env('SESSION_SECRET');
  if (!pin || !s) throw new GagalHttp(500, 'PIN console belum diatur (CONSOLE_PIN / SESSION_SECRET kosong di Netlify).');
  // PIN ikut jadi kunci tanda tangan: ganti PIN = semua orang otomatis keluar.
  return { pin: String(pin), kunci: `${s}:${pin}` };
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const tandai = (isi, kunci) => createHmac('sha256', kunci).update(isi).digest('base64url');
const JAM12 = 12 * 3600 * 1000;

export function cocokPin(masukan) {
  const { pin } = rahasia();
  const a = Buffer.from(String(masukan ?? ''));
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buatToken() {
  const { kunci } = rahasia();
  const exp = Date.now() + JAM12;
  const isi = b64u(JSON.stringify({ exp }));
  return { token: `${isi}.${tandai(isi, kunci)}`, exp };
}

export function wajibMasuk(req) {
  const { kunci } = rahasia();
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [isi, sig] = t.split('.');
  if (!isi || !sig) throw new GagalHttp(401, 'Masukkan PIN dulu.');
  const benar = tandai(isi, kunci);
  if (sig.length !== benar.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(benar))) throw new GagalHttp(401, 'Sesi tidak berlaku, masukkan PIN lagi.');
  let data;
  try { data = JSON.parse(Buffer.from(isi, 'base64url').toString()); } catch { throw new GagalHttp(401, 'Sesi tidak berlaku, masukkan PIN lagi.'); }
  if (!data.exp || data.exp < Date.now()) throw new GagalHttp(401, 'Sesi habis, masukkan PIN lagi.');
}

export function bungkus(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (e) {
      if (e instanceof GagalHttp) return jawab({ error: e.message }, e.status);
      console.error(e);
      return jawab({ error: 'Ada masalah di server. Coba lagi sebentar.' }, 500);
    }
  };
}

// Aturan yang boleh disimpan dan batas angkanya (sama dengan halaman).
export const ATURAN = { BATAS: [1, 60], SIAP: [1, 120], NYARIS: [0, 60], NY_MAX: [1, 240], JAM_MULAI: [0, 23], JAM_SELESAI: [0, 23] };

// Kolom yang wajib ada di CSV order master BAUS.
export const WAJIB = ['order_no', 'status', 'delivery_type', 'outlet_name', 'customer_name', 'customer_phone', 'address_text',
  'created_at', 'cnw_packed_at', 'batch_assigned_at', 'batch_departed_at', 'batch_return_at', 'estimated_arrived_at', 'arrived_at',
  'scheduled_delivery', 'selected_batch_id', 'selected_driver_name', 'selected_cnw_name', 'notes_entries', 'receipt_modified_at', 'distance_from_outlet_km'];
