# BA/// Generator

Generator Berita Acara UAT — web statis, semua proses di browser, tanpa server backend.

## Fitur Utama

- **Live Preview** — isian form langsung tampil di dokumen preview secara real-time
- **Signature Pad** — tanda tangan via canvas (draw) atau upload gambar, bisa persist ke localStorage
- **QR Code** — generate otomatis dari URL dengan validasi
- **PDF Export** — unduh dokumen sebagai PDF via html2canvas + jsPDF
- **UAT Status** — toggle Verified / Rejected dengan stamp otomatis di preview
- **Fully Client-Side** — tidak ada backend, data aman di browser

## Cara Pakai

1. Buka `index.html` di browser
2. Isi form secara berurutan
3. Klik "Unduh PDF" untuk export

## Tech Stack

- HTML + CSS + JavaScript (vanilla)
- CDN: qrcodejs, jsPDF, html2canvas
- Font: JetBrains Mono, Inter, Times New Roman

## Struktur File

- `index.html` — halaman utama
- `script.js` — seluruh logika aplikasi
- `style.css` — styling dark theme + preview
