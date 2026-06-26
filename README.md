# BA/// Generator

Generator Berita Acara UAT — web statis, semua proses di browser, tanpa server backend.

## Fitur Utama

- **Live Preview** — isian form langsung tampil di dokumen preview secara real-time
- **Signature Pad** — tanda tangan via canvas (draw) atau upload gambar, bisa persist ke localStorage
- **QR Code** — generate otomatis dari URL dengan validasi
- **PDF Export** — unduh dokumen sebagai PDF via html2canvas + jsPDF, ukuran ~200-400 KB
- **UAT Status** — toggle Verified / Rejected dengan stamp otomatis di preview
- **Master Data Pegawai** — simpan data Pihak 1 & Pihak 2 (Nama, NRP, Jabatan, Jabatan TTD) via sql.js + IndexedDB, auto-fill dari dropdown
- **Fully Client-Side** — tidak ada backend, data aman di browser

## Cara Pakai

1. Buka `index.html` di browser
2. Isi form secara berurutan (atau pilih dari master data pegawai via dropdown)
3. Klik "Unduh PDF" untuk export

## Tech Stack

- HTML + CSS + JavaScript (vanilla)
- CDN: qrcodejs, jsPDF, html2canvas, sql.js
- Font: JetBrains Mono, Inter, Times New Roman

## Struktur File

- `index.html` — halaman utama
- `scripts/script.js` — seluruh logika aplikasi
- `scripts/db.js` — sql.js wrapper + IndexedDB
- `styles/style.css` — styling dark theme + preview
