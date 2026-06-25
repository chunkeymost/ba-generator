# BA/// Generator — Skill File

## Project Overview
Aplikasi web statis untuk membuat Berita Acara (BA) UAT. Semua data diproses di browser — tidak ada server backend.

## Struktur File
| File | Fungsi |
|---|---|
| `index.html` | Struktur halaman, form input, preview dokumen |
| `script.js` | Logika aplikasi: live preview, QR code, signature pad, step validator, PDF export |
| `style.css` | Semua styling (dark theme, layout, preview, print) |
| `SKILL.md` | File ini — panduan maintenance |

## Dependensi (CDN)
Library dimuat via CDN — tidak perlu install npm atau download:
- **qrcodejs** — `https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js`
- **jsPDF** — `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- **html2canvas** — `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`

Tidak ada build tools, tidak ada package.json.

## Cara Menjalankan
Buka `index.html` langsung dari browser (CDN tetap jalan meski via `file://`).

## Cara Kerja
1. Enam form section collapsible di panel kiri — isian langsung tampil di preview panel kanan
2. Dokumen preview menggunakan format A4 (`aspect-ratio: 210 / 297`, padding ~30mm/25mm)
3. Signature: canvas digambar manual atau upload gambar, bisa persist via localStorage jika checklist "Set Default" diaktifkan
4. QR code: generate otomatis dari URL (350ms debounce), validasi URL, auto-prepend `https://`
5. Random code 10 karakter (alfanumerik + simbol) digenerate otomatis di header dokumen
6. Tanggal otomatis terisi hari ini, format Indonesia
7. Step 6: toggle Verified/Rejected — wajib dipilih, muncul watermark/stamp di preview
8. Tombol "Unduh PDF": disabled sampai semua field (16 fields) + kedua signature terisi. Gunakan `html2canvas` + `jsPDF` untuk export

## Cara Menambahkan Field Baru
1. Tambah HTML di panel kiri (copy pola `.field` yang sudah ada)
2. Tambah element preview di `.doc-page` (panel kanan)
3. Daftarkan di object `fieldMappings` di `script.js` — live sync otomatis
4. Update logika validasi di fungsi `validateForm()` jika field baru wajib diisi

## Catatan Maintenance
- Fungsi di `script.js` dibungkus IIFE + `safeRun()` untuk isolasi
- Signature disimpan di canvas (`data:image/png`), bisa persist antar sesi via localStorage jika "Set Default" dicentang
- QR code wajib diisi (step 5 terkunci sampai step 4 selesai)
- `html2canvas` menggunakan scale 3x untuk hasil PDF tajam
- Nama file PDF diambil dari judul dokumen (sanitasi otomatis)
- `.doc-page`: `aspect-ratio: 210 / 297`, padding `85px 72px` (~30mm/25mm)
- Layout dua kolom dengan `grid-template-columns: minmax(340px, 480px) 1fr`, responsive breakpoint di 900px
- Tombol "Hapus" dan "Upload gambar" di `.sig-controls` styling seragam
- Upload gambar menggunakan `<button>` + hidden `<input type="file">` — pastikan selector JS `[data-action="upload-sig"]` sesuai
- Font size preview: body 12px, title 14px, subtitle 13px
- Font: JetBrains Mono (monospace UI), Inter (sans-serif UI), Times New Roman (serif dokumen)
- Validasi: 16 field input + 2 signature canvas wajib diisi. Tombol Unduh PDF disabled sampai semua terisi
- Stamp: `.doc-stamp-verified` (hijau pojok kanan), `.doc-stamp-rejected` (merah pojok kiri). Di-toggle via JS class `is-selected`
- Form collapsible: section bisa di-click header-nya untuk expand/collapse

## Release Workflow
```bash
# Buat tag versi baru
git tag -a v1.0-beta -m "v1.0-beta"

# Push tag ke remote
git push origin v1.0-beta

# Buat GitHub Release (via gh CLI)
gh release create v1.0-beta --title "v1.0-beta" --notes "## Release Notes v1.0-beta

Rilis perdana BA/// Generator — aplikasi web statis untuk membuat Berita Acara UAT.

### Fitur
- Form input 6 section dengan live preview dokumen
- Signature pad (draw + upload) dengan localStorage persistence
- QR Code generator dari URL dengan validasi otomatis
- PDF export via html2canvas + jsPDF
- UAT Status toggle (Verified / Rejected) dengan stamp preview
- Random code generator di header dokumen
- Auto-fill tanggal dengan format Indonesia
- Validasi form sebelum download PDF
- Responsive two-column layout dengan dark theme
- Print styles support

### Tech Stack
- Vanilla HTML + CSS + JavaScript
- CDN: qrcodejs, jsPDF, html2canvas"
```

## Limitasi
- Signature tidak bisa di-undo per stroke (hanya clear all)
- Tidak ada preview multi-halaman (single page)
- Font hanya mengandalkan system fonts + CDN fonts
- Preview menggunakan `html2canvas` — elemen tertentu (seperti QR code) mungkin perlu penanganan khusus
