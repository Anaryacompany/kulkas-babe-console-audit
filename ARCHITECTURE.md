# Arsitektur — Console Audit Delivery

```
Browser (public/)                         Netlify Functions (netlify/functions/)        Neon Postgres
─────────────────                         ─────────────────────────────────────        ─────────────
index.html  tampilan                      POST /api/masuk   PIN → token sesi 12 jam      pin_salah
runtime.js  mesin hitung ulang + gambar   GET  /api/data    file terakhir + aturan       upload_terakhir (1 baris)
calc.js     SEMUA hitungan audit          GET  /api/status  kapan terakhir berubah       aturan (1 baris)
parse.js    pembaca CSV BAUS              POST /api/upload  simpan file (menimpa)
draw.js     tabel, angka, grafik          POST /api/aturan  simpan aturan
app.js      PIN, upload, aturan           lib/inti.mjs      Neon, PIN, token, tabel
```

## Alur
1. **Masuk**: PIN dicek di server (bukan di halaman). Salah 8x dalam 15 menit dari alamat yang sama, atau 60x dari semua alamat → dikunci 15 menit. Token sesi ditandatangani HMAC dengan `SESSION_SECRET:CONSOLE_PIN`, berlaku 12 jam.
2. **Upload**: browser membaca & mengecek CSV (kolom wajib, ada order, jam terbaca), mengompres (gzip) lalu kirim. Server mengecek ulang kolom lalu `INSERT … ON CONFLICT (id) DO UPDATE` ke baris id=1 → **selalu hanya 1 file tersimpan**, file lama hilang.
3. **Hitung**: semua angka dihitung di browser dari CSV mentah (`calc.js`) — sama dengan hitungan audit 16 Nov 2026 (106/175 telat berangkat, 3 telat sampai, 32 nyaris, 17 nganggur, 5 NYANTAI lewat 30 m).
4. **Orang lain**: saat tab dibuka lagi, halaman cek `/api/status`; kalau ada upload/aturan baru, data dimuat ulang.

## Data
- `upload_terakhir`: nama file, isi CSV (gzip-base64), jumlah order, ukuran, waktu upload. **Berisi data customer (nama, HP, alamat)** — sengaja disimpan untuk tracking auditor (vonis Bayu 19 Nov 2026).
- `aturan`: BATAS, SIAP, NYARIS, NY_MAX, JAM_MULAI, JAM_SELESAI (JSON).
- `pin_salah`: alamat IP + waktu PIN salah (dibersihkan setelah 1 hari).

## Batas
- Kiriman maks ±6 MB setelah kompres (kira-kira CSV beberapa minggu). File lebih besar: upload per minggu.
- Deploy Preview Netlify memakai database yang sama dengan produksi (env sama) — jangan upload data uji dari preview.
- Satu PIN untuk semua orang: tidak tercatat siapa yang upload.
