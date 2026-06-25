# BA/// Generator — Skill File

## Project Overview
Aplikasi web statis untuk membuat Berita Acara (BA) UAT. Semua data diproses di browser — tidak ada server backend.

## Struktur File
| File | Fungsi |
|---|---|
| `index.html` | Struktur halaman, form input, preview dokumen |
| `script.js` | Logika aplikasi: live preview, QR code, signature pad, step validator |
| `style.css` | Semua styling (dark theme, layout, preview) |
| `SKILL.md` | File ini — panduan maintenance |

## Dependensi (CDN)
Library dimuat via CDN — tidak perlu install npm atau download:
- **qrcodejs** — `https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js`

Tidak ada build tools, tidak ada package.json.

## Cara Menjalankan
Buka `index.html` langsung dari browser (CDN tetap jalan meski via `file://`).

## Cara Kerja
1. Step indicator sticky di atas form menampilkan progress 1-6
2. Form diisi berurutan — section terkunci sampai step sebelumnya selesai
3. Signature: canvas digambar manual atau upload gambar
4. QR code: generate otomatis dari URL (350ms debounce)
5. Step 6: toggle Verified/Rejected — wajib dipilih, muncul watermark/stamp di preview

## Cara Menambahkan Field Baru
1. Tambah HTML di panel kiri (copy pola `.field` yang sudah ada)
2. Tambah element preview di `.doc-page` (panel kanan)
3. Daftarkan di array `fields` di `script.js` — live sync otomatis

## Catatan Maintenance
- Tombol "Hapus" dan "Upload gambar" di `.sig-controls` styling seragam: `flex: 1`, `display: inline-flex`
- Upload gambar menggunakan `<button>` + hidden `<input type="file">` — pastikan selector JS `[data-action="upload-sig"]` sesuai
- Signature disimpan di canvas (data:image/png) — tidak persist antar sesi
- QR code wajib diisi (step 5 terkunci sampai step 4 selesai)
- Semua `class="underline"` di preview dokumen sudah dihapus
- `.doc-page`: `aspect-ratio: 210 / 297`, padding `85px 72px` (~30mm/25mm)
- Font size: body 12px, title 14px, subtitle 13px
- Step validator — sequential unlock step 1-6, signature wajib step 2 & 3, UAT status wajib step 6. Tombol Unduh PDF disabled sampai semua step selesai. Update array `STEPS` jika field berubah
- `.form-section.is-locked { opacity: 0.35; pointer-events: none }`
- Stamp: `.doc-stamp-verified` (hijau pojok kanan), `.doc-stamp-rejected` (merah pojok kiri). Di-toggle via JS class `is-visible`

## Limitasi
- Signature tidak bisa di-undo per stroke (hanya clear all)
- Tidak ada preview multi-halaman (single page)
- Font hanya mengandalkan system fonts
