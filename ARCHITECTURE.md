# Architecture — BA/// Generator

## 1. System Overview

Aplikasi web statis 100% client-side untuk generating Berita Acara (BA) UAT.
Tidak ada server backend, tidak ada build tools. Semua proses terjadi di browser
pengguna.

```
┌──────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                 │
│                                                                      │
│  ┌──────────────────────────┐    ┌──────────────────────────────┐   │
│  │       index.html         │    │     styles/style.css         │   │
│  │   (struktur halaman)     │    │   (semua styling + modal)    │   │
│  └──────┬───────────────────┘    └──────────────────────────────┘   │
│         │                                                            │
│  ┌──────▼───────────────────────────────────────────────────┐       │
│  │                    scripts/                               │       │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐   │       │
│  │  │      db.js          │  │       script.js          │   │       │
│  │  │  sql.js wrapper     │  │  UI logic: form,         │   │       │
│  │  │  IndexedDB I/O      │  │  preview, signature,     │   │       │
│  │  │  CRUD pegawai       │  │  QR, PDF, modal master   │   │       │
│  │  └────────┬────────────┘  └──────────────────────────┘   │       │
│  └───────────┼───────────────────────────────────────────────┘       │
│              │                                                        │
│  ┌───────────▼──────────────────────────────────────────────────┐   │
│  │                      Storage Layer                            │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │      IndexedDB       │  │        localStorage          │  │   │
│  │  │  master-data.sqlite  │  │  ba-sig-data-{1,2}           │  │   │
│  │  │  (binary file)       │  │  ba-default-{1,2}            │  │   │
│  │  └──────────────────────┘  └──────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      CDN Dependencies                        │   │
│  │  qrcodejs · jsPDF · html2canvas · sql.js (WASM ~1.2 MB)     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Tech Stack

| Layer | Teknologi | Sumber |
|---|---|---|
| UI | Vanilla HTML5 + CSS3 + JavaScript (ES6) | Local |
| QR Code | qrcodejs 1.0.0 | CDN jsdelivr |
| PDF Export | jsPDF 2.5.1 + html2canvas 1.4.1 | CDN cdnjs |
| Database Engine | sql.js 1.11.0 (SQLite via WASM) | CDN cdnjs |
| Persistent Storage | IndexedDB + localStorage | Built-in browser |
| Deployment | GitHub Pages | github.io |

## 3. Component Architecture

### scripts/db.js (sql.js + IndexedDB wrapper)

Semua operasi CRUD untuk master pegawai & dokumen.

Fungsi utama:
- `initDatabase()` — load WASM sql.js, restore DB dari IndexedDB, migrasi schema
- `saveDatabase()` — export DB ke binary, simpan ke IndexedDB
- `getPegawaiList()` — SELECT * FROM master_pegawai ORDER BY nama
- `addPegawai(data)` — INSERT + auto persist ke IndexedDB (termasuk `jenis`)
- `deletePegawai(id)` — DELETE + auto persist
- `getDokumenList()` — SELECT * FROM master_dokumen ORDER BY judul
- `addDokumen(data)` — INSERT + auto persist ke IndexedDB
- `deleteDokumen(id)` — DELETE + auto persist

Alur persistensi:

```
  sql.js (in-memory SQL engine) ←──export/import──→ IndexedDB (.sqlite file)
       │
       └── Setiap write → db.export() (Uint8Array) → idbPut()
       └── Setiap load → idbGet() → new SQL.Database(binary)
```

### scripts/script.js (UI Logic)

| Modul | Baris | Fungsi |
|---|---|---|
| Auto-fill tanggal | ~40-43 | Isi input date hari ini |
| Live preview sync | ~62-115 | Binding input → preview DOM |
| Signature pad | ~120-305 | Canvas draw + upload + localStorage |
| QR code generator | ~311-401 | URL → QR code with 350ms debounce |
| Random code | ~407-416 | 10-char random di header dokumen |
| UAT status toggle | ~421-434 | Verified / Rejected toggle |
| Validation + PDF | ~436-529 | 16 field check + html2canvas → jsPDF |
| Master data | ~535-830 | Modal CRUD pegawai & dokumen, dropdown, sql.js init, auto-fill, delete |

## 4. Database Schema

Skema saat ini (Phase 1 - 3):

```sql
-- Master data pegawai (Pihak 1 & 2)
CREATE TABLE master_pegawai (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nama         TEXT NOT NULL,
    nrp          TEXT,
    jabatan      TEXT NOT NULL,
    jabatan_ttd  TEXT NOT NULL,
    jenis        TEXT NOT NULL DEFAULT 'p1',  -- 'p1' atau 'p2'
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_master_pegawai_nama ON master_pegawai(nama);

-- Master data dokumen (judul & divisi)
CREATE TABLE master_dokumen (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    judul        TEXT NOT NULL UNIQUE,
    divisi       TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

Alasan satu tabel master_pegawai (bukan pisah Pihak1/Pihak2):
- Orang yang sama bisa jadi Pihak 1 di satu BA dan Pihak 2 di BA lain
- Satu sumber data untuk kedua dropdown
- Menghindari duplikasi data

Alasan satu tabel master_dokumen (judul + divisi digabung):
- Setiap judul memiliki divisi default yang terkait
- Auto-fill divisi saat judul dipilih
- Menghindari inkonsistensi data (judul A selalu pakai divisi X)

## 5. Storage Strategy

| Data | Storage | Format | Lifetime | Alasan |
|---|---|---|---|---|
| Master pegawai | IndexedDB (via sql.js) | SQLite binary (.sqlite) | Permanen | Relasi, query, portable |
| Signature images | localStorage | base64 PNG | Permanen (opsional) | Binary kecil, akses sync |
| Set Default flag | localStorage | "true" / "false" | Permanen | Flag sederhana |
| Form field values | In-memory (DOM) | String | Session | Sekali pakai → generate PDF |
| QR code image | In-memory (canvas) | Canvas DOM | Session | Regenerated tiap URL berubah |
| PDF output | Download file | .pdf (JPEG q0.8) | One-shot | Langsung di-download user |

## 6. Data Flow

### Master Data (Add + Auto-fill)

```
[User] ──klik [+]──► Modal tambah pegawai
                        │
                        ▼
                 Validasi (Nama, Jabatan, Jabatan TTD required)
                        │
                        ▼
                 db.addPegawai({nama, nrp, jabatan, jabatan_ttd})
                        │
                        ├──► INSERT INTO master_pegawai
                        └──► db.export() → idbPut('master-data.sqlite')
                        └──► Reload dropdown → auto-select → auto-fill form
                              │
                              ├──► setField(p1-nama, ...)
                              ├──► setField(p1-nrp, ...)
                              ├──► setField(p1-jabatan, ...)
                              └──► setField(p1-jabatan-ttd, ...)
                                    │
                                    └──► dispatchEvent('input')
                                           ├──► live preview update
                                           └──► updateDownloadButton()
```

### Master Data Dokumen (Add + Auto-fill)

```
[User] ──klik [+] di label JENIS & JUDUL──► Modal tambah dokumen
                                               │
                                               ▼
                                        Validasi (Judul & Divisi required)
                                               │
                                               ▼
                                        db.addDokumen({judul, divisi})
                                               │
                                               ├──► INSERT INTO master_dokumen
                                               └──► db.export() → idbPut('master-data.sqlite')
                                               └──► Reload dropdown judul & divisi
                                               └──► Auto-select judul baru
                                                     │
                                                     └──► dispatchEvent('change')
                                                            │
                                                            ├──► setField(input-divisi, divisi)
                                                            │     └──► dispatchEvent('input')
                                                            │           ├──► live preview update
                                                            │           └──► updateDownloadButton()
                                                            │
                                                            └──► live preview update (judul)

[User] ──pilih judul dari dropdown──► selectJudul.change()
                                         │
                                         ▼
                                  db.getDokumenList()
                                         │
                                         ▼
                                  cari record by judul
                                         │
                                         ▼
                                  setField("input-divisi", d.divisi)
                                         │
                                         └──► dispatchEvent('input')
                                               ├──► live preview update
                                               └──► updateDownloadButton()
```

### Form Input → Live Preview

```
[User] ──ketik di input──► input event
                            │
                            ▼
                     live sync handler
                            │
                            ▼
                     previewEl.textContent = value
                            │
                     Signature: bindSigMeta()
                            │
                     UAT Status: toggle class is-visible
```

### PDF Generation

```
[User] ──klik "Unduh PDF"──► html2canvas(doc-page, {scale: 2})
                                │
                                ▼
                          canvas.toDataURL('image/jpeg', 0.8)
                                │
                                ▼
                          jsPDF.addImage() → pdf.save()
```

## 7. Dependency Graph (Load Order)

```
index.html:
  1. styles/style.css                              (blocking render)
  2. qrcodejs CDN                                   (sync <script>)
  3. jspdf CDN                                      (sync <script>)
  4. html2canvas CDN                                (sync <script>)
  5. sql.js CDN                                     (sync <script>, init async)
  6. scripts/db.js                                  (sync, exposes window.BA_DB)
  7. scripts/script.js                              (sync, calls BA_DB.init() async)
```

Catatan: sql.js init bersifat async (fetch WASM binary ~1.2 MB). Form tetap bisa diisi
manual selama inisialisasi berlangsung. Dropdown baru terisi setelah DB ready.

## 8. Deployment Architecture

```
┌──────────────────────────────────────────┐
│          GitHub Repository               │
│  ba-generator/                           │
│  ├── index.html                          │
│  ├── ARCHITECTURE.md                     │
│  ├── styles/style.css                    │
│  ├── scripts/db.js                       │
│  ├── scripts/script.js                   │
│  └── .github/workflows/deploy.yml        │
└────────────┬─────────────────────────────┘
             │ push ke branch main
             ▼
┌──────────────────────────────────────────┐
│          GitHub Actions                  │
│  .github/workflows/deploy.yml            │
│  → Deploy ke branch gh-pages             │
└────────────┬─────────────────────────────┘
             ▼
┌──────────────────────────────────────────┐
│          GitHub Pages                    │
│  https://{user}.github.io/ba-generator   │
│  Static file serving                     │
│  CDN dependencies loaded at runtime      │
└──────────────────────────────────────────┘
```

## 9. Error Handling Strategy

### UI Error Isolation
Setiap modul di `script.js` dibungkus `safeRun(label, fn)`:
- Jika satu modul gagal (misal signature pad di browser tertentu), modul lain tetap berjalan
- Error di-log ke console dengan prefix `[BA Generator]`

### Database Error Handling
- sql.js WASM gagal load → console.error, dropdown tetap kosong, form tetap bisa diisi manual
- IndexedDB tidak tersedia/penuh → error di-log, operasi CRUD skipped tanpa crash
- Semua operasi DB via Promise → `.catch()` tanpa crash propagation

### Form Validation
- Tombol "Unduh PDF" disabled sampai 16 fields + 2 signatures terisi
- Modal required fields (Nama, Jabatan, Jabatan TTD) dicek sebelum INSERT

## 10. Future Architecture

Fitur yang direncanakan untuk phase selanjutnya:

| Phase | Fitur | Perubahan Schema |
|---|---|---|---|
| 3 | History BA Log | Tambah tabel `ba_log` |
| 3 | Edit/Hapus Master | UI update/delete + konfirmasi relasi |
| 3 | Search Pegawai | Autocomplete input (bukan dropdown) |
| 4 | Export/Import DB | Download .sqlite / upload restore |
| 4 | Multiple Pihak | Bisa tambah pihak >2 |

### Completed

| Phase | Fitur | Keterangan |
|---|---|---|
| 1 | Master Data Pegawai | Tabel `master_pegawai` — CRUD + dropdown + auto-fill NRP, Jabatan, Jabatan TTD |
| 2 | Master Data Dokumen | Tabel `master_dokumen` — CRUD + dropdown + auto-fill Divisi saat Judul dipilih |
| 3 | Pisah List P1/P2 | Kolom `jenis` (p1/p2) — dropdown P1 filter `jenis='p1'`, P2 filter `jenis='p2'` |
| 3 | Hapus Master Data | Ikon trash per dropdown (visible hanya saat item terpilih) — konfirmasi → delete → reload → reset form |
