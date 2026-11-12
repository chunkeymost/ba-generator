# BA/// Generator

Generator Berita Acara UAT — web statis, semua proses di browser, tanpa server backend.

## Fitur Utama

- **Live Preview** — isian form langsung tampil di dokumen preview secara real-time
- **Signature Pad** — tanda tangan via canvas (draw) atau upload gambar, bisa persist ke localStorage
- **QR Code** — generate otomatis dari URL dengan validasi
- **PDF Export** — unduh dokumen sebagai PDF via html2canvas + jsPDF, ukuran ~200-400 KB
- **Integrasi Google Apps Script** — metadata berita acara otomatis dikirim ke Google Script saat tombol "Unduh PDF" diklik
- **UAT Status** — toggle Verified / Rejected dengan stamp otomatis di preview
- **Catatan Rilis** — field catatan opsional untuk keterangan rilis BA, tampil di preview jika diisi
- **Master Data Pegawai** — simpan data Pihak 1 & Pihak 2 (Nama, NRP, Jabatan, Jabatan TTD) via sql.js + IndexedDB, auto-fill & hapus dari dropdown
- **Master Data Dokumen** — simpan Judul & Divisi via sql.js + IndexedDB, auto-fill & hapus dari dropdown
- **Fully Client-Side** — tidak ada backend, data aman di browser

## Cara Pakai

1. Buka `index.html` di browser
2. Isi form secara berurutan (atau pilih dari master data pegawai/dokumen via dropdown)
3. Hapus data tersimpan via ikon trash (muncul saat item dipilih)
4. (Opsional) Isi catatan rilis di section CATATAN
5. Klik "Unduh PDF" — PDF diunduh dan metadata berita acara dikirim ke Google Apps Script
6. Klik "Go Top" untuk scroll panel input kembali ke atas

## Tech Stack

- HTML + CSS + JavaScript (vanilla)
- CDN: qrcodejs, jsPDF, html2canvas, sql.js, @sentry/browser
- Google Apps Script Web App (endpoint POST metadata)
- Font: JetBrains Mono, Inter, Times New Roman
- Error Tracking: Sentry (via browser.sentry-cdn.com)

## Struktur File

- `index.html` — halaman utama
- `scripts/script.js` — seluruh logika aplikasi + inisialisasi Sentry
- `scripts/db.js` — sql.js wrapper + IndexedDB
- `styles/style.css` — styling dark theme + preview
- `ARCHITECTURE.md` — dokumentasi arsitektur & skema DB
