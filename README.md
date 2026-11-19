# Console Audit Delivery — Kulkas Babe

Upload CSV **order master** dari BAUS → console langsung menghitung per hari operasional:

- **Telat berangkat**: driver harus jalan paling lambat *BATAS* menit (standar 8) sejak order pertama masuk batch.
- **Telat sampai**: jam driver tekan "sampai" dibanding estimasi BAUS di struk; plus *nyaris telat* (sisa < *NYARIS* menit).
- **Order nganggur**: HEMAT/PRIORITAS yang lebih dari *SIAP* menit (standar 7) belum masuk batch.
- **NYANTAI**: ditahan sistem, barengan, dan yang lewat *NY_MAX* menit (standar 30).

Hari operasional = jam *JAM_MULAI* (09.00) s/d *JAM_SELESAI* (07.00) hari berikutnya, menurut jam order dibuat. Order di luar jam itu ditandai "di luar jam" dan tidak dihitung.

## Cara pakai
1. Buka console, masukkan **PIN**.
2. Klik **Upload CSV order master**. File baru **menggantikan** file lama untuk semua orang.
3. Hasil langsung muncul. Klik kotak hasil untuk loncat ke daftarnya; klik baris keberangkatan untuk lihat order + customer.
4. **Ubah aturan** (paling bawah) berlaku untuk semua orang.

## Pengaturan di Netlify (Environment variables, scope Functions)
| Nama | Isi |
|---|---|
| `DATABASE_URL` | connection string Neon (Postgres) |
| `CONSOLE_PIN` | PIN console (disarankan 6 digit atau lebih). Ganti PIN = semua orang otomatis keluar. |
| `SESSION_SECRET` | teks acak panjang untuk tanda tangan sesi |

Tabel database dibuat otomatis saat pertama dipakai. Lihat `ARCHITECTURE.md`.
