# Panduan Perbaikan Error 403 (Forbidden)

Error 403 "Forbidden" biasanya terjadi karena **struktur folder** yang salah saat upload ke GitHub.

Saat ini Vercel mencari file di posisi: `hastma-cup-2026/index.html` (DI HALAMAN DEPAN)
Tapi kemungkinan file Anda ada di: `hastma-cup-2026/website/index.html` (MASUK DALAM FOLDER)

---

## Solusi 1: Cek GitHub Anda (Paling Mungkin)
1.  Buka repository GitHub Anda.
2.  Lihat daftar filenya.
3.  Apakah Anda melihat `index.html` **LANGSUNG** di daftar? 
    *   **Jika YA**: Lanjut ke Solusi 2.
    *   **Jika TIDAK** (dan Anda melihat folder bernama `website` atau lainnya):
        *   Klik folder tersebut.
        *   Jika `index.html` ada di dalamnya, berarti ini masalahnya!

**Cara Memperbaiki (Jika file ada dalam folder):**
1.  Buka Dashboard Vercel project Anda.
2.  Masuk ke **"Settings"** -> **"General"**.
3.  Cari bagian **"Root Directory"**.
4.  Klik **"Edit"**.
5.  Ketik nama folder tempat file berada (contoh: `website`).
    *   *Sesuikan dengan nama folder yang Anda lihat di GitHub.*
6.  Klik **"Save"**.
7.  Website akan otomatis Deploy ulang. Tunggu 1-2 menit.

---

## Solusi 2: Hapus Konfigurasi Rewrite (Jika Solusi 1 Tidak Berhasil)
Jika file sudah BENAR di root (Solusi 1 tidak relevan), mungkin konfigurasi `vercel.json` saya terlalu ketat. Mari kita sederhanakan.

**Update file `vercel.json` di komputer Anda menjadi:**
```json
{
  "rewrites": [
  ]
}
```
*(Kosongkan saja isinya)*

Lalu upload ulang file `vercel.json` ini ke GitHub.

---

## Solusi 3: Upload Ulang dengan Benar
Jika Anda bingung, ini cara paling "bersih":
1.  Buka halaman awal Repository GitHub Anda.
2.  Hapus repository ini (Settings -> Delete repository), atau buat repository baru.
3.  Saat upload file (**Add file -> Upload files**):
    *   **JANGAN** tarik folder `website`.
    *   **BUKA** folder `website` di komputer Anda dulu.
    *   **BLOK SEMUA FILE** di dalamnya (Ctrl+A).
    *   Baru **TARIK** semua file itu ke GitHub.
    *   *Pastikan `index.html` terlihat sebagai file terpisah saat proses upload, bukan dalam folder.*
