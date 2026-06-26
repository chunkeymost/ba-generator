(function () {
  "use strict";

  // Menjalankan setiap modul secara terisolasi: kalau satu modul gagal
  // (misal signature pad bermasalah di browser tertentu), modul lain
  // seperti QR code tetap berjalan normal, bukan ikut mati semua.
  function safeRun(label, fn) {
    try {
      fn();
    } catch (err) {
      console.error("[BA Generator] Modul '" + label + "' gagal dijalankan:", err);
    }
  }

  // ====================================================================
  // 1. AUTO-FILL TANGGAL HARI INI
  // ====================================================================
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  function formatTanggalIndonesia(dateObj) {
    const hari = HARI[dateObj.getDay()];
    const tgl = dateObj.getDate();
    const bulan = BULAN[dateObj.getMonth()];
    const tahun = dateObj.getFullYear();
    return hari + ", " + tgl + " " + bulan + " " + tahun;
  }

  function toInputDateValue(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  const inputTanggal = document.getElementById("input-tanggal");
  safeRun("auto-fill tanggal", () => {
    const today = new Date();
    inputTanggal.value = toInputDateValue(today);
  });

  // ====================================================================
  // 2. ELEMENT REFS — semua field input & target preview
  // ====================================================================
  const fields = [
    { input: "input-doctitle", preview: "doc-title", fallback: "[Judul Berita Acara]" },
    { input: "input-subtitle", preview: "doc-subtitle", fallback: "[Sub Judul / Kode CR]" },
    { input: "input-divisi", preview: "doc-divisi", fallback: "[Divisi Pelaksana]", extra: ["doc-divisi-2"] },
    { input: "p1-nama", preview: "doc-p1-nama", fallback: "[Nama Pihak 1]" },
    { input: "p1-nrp", preview: "doc-p1-nrp", fallback: "[NRP Pihak 1]" },
    { input: "p1-jabatan", preview: "doc-p1-jabatan", fallback: "[Jabatan Pihak 1]", extra: ["doc-p1-jabatan-2"] },
    { input: "p2-nama", preview: "doc-p2-nama", fallback: "[Nama Pihak 2]" },
    { input: "p2-nrp", preview: "doc-p2-nrp", fallback: "[NRP Pihak 2]" },
    { input: "p2-jabatan", preview: "doc-p2-jabatan", fallback: "[Jabatan Pihak 2]" },
    { input: "input-statement", preview: "doc-statement", fallback: "[Kalimat Pernyataan]" },
    { input: "input-lokasi", preview: "doc-lokasi", fallback: "[Lokasi]" },
  ];

  function bindLiveSync() {
    fields.forEach((f) => {
      const inputEl = document.getElementById(f.input);
      const previewEl = document.getElementById(f.preview);
      const update = () => {
        const val = inputEl.value.trim();
        previewEl.textContent = val || f.fallback;
        if (f.extra) {
          f.extra.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || f.fallback;
          });
        }
      };
      inputEl.addEventListener("input", update);
      update();
    });

    // Tanggal: gabungan lokasi + tanggal terformat
    function updateTanggalPreview() {
      const raw = inputTanggal.value;
      if (!raw) {
        document.getElementById("doc-tanggal").textContent = "[Tanggal]";
        return;
      }
      const [y, m, d] = raw.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("doc-tanggal").textContent = formatTanggalIndonesia(dateObj);
    }
    inputTanggal.addEventListener("input", updateTanggalPreview);
    updateTanggalPreview();

    // Jabatan tanda tangan (nama + jabatan di bawah kolom signature)
    function bindSigMeta(prefix, num, namaToken, jabatanToken) {
      const namaInput = document.getElementById(prefix + "-nama");
      const jabatanInput = document.getElementById(prefix + "-jabatan-ttd");
      const namaPreview = document.getElementById("doc-sig-name-" + num);
      const rolePreview = document.getElementById("doc-sig-role-" + num);

      function update() {
        const nama = namaInput.value.trim();
        const jabatan = jabatanInput.value.trim();
        namaPreview.textContent = nama || namaToken;
        rolePreview.textContent = jabatan ? "(" + jabatan + ")" : "(" + jabatanToken + ")";
      }
      namaInput.addEventListener("input", update);
      jabatanInput.addEventListener("input", update);
      update();
    }
    bindSigMeta("p1", "1", "[Nama Pihak 1]", "[Jabatan TTD Pihak 1]");
    bindSigMeta("p2", "2", "[Nama Pihak 2]", "[Jabatan TTD Pihak 2]");
  }

  safeRun("live sync form-preview", bindLiveSync);

  // ====================================================================
  // 3. SIGNATURE PAD (canvas gambar tangan + fallback upload gambar)
  // ====================================================================
  function setupSignaturePad(canvasId, targetNum) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas.closest(".sig-pad-wrap");
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let hasContent = false;

    // Scale canvas for crisp lines on high-DPI screens
    function resizeCanvas() {
      if (!ctx) return; // browser/elemen belum siap memberi context — jangan crash
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      // Kalau elemen belum punya ukuran (misal masih display:none / belum di-layout),
      // pakai ukuran atribut canvas sebagai fallback supaya tidak scale ke 0.
      const width = rect.width || canvas.width || 360;
      const height = rect.height || canvas.height || 140;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#14171c";
    }
    resizeCanvas();

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasContent = true;
      wrap.classList.add("has-sig");
      syncSignatureToPreview(targetNum, canvas.toDataURL("image/png"));
    }
    function end() {
      drawing = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);

    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasContent = false;
        wrap.classList.remove("has-sig");
        resetDefaultOnModify(targetNum);
        syncSignatureToPreview(targetNum, null);
      },
      hasContent() {
        return hasContent;
      },
      loadImage(dataUrl, resetDefault) {
        const img = new Image();
        img.onload = function () {
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(rect.width / img.width, rect.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (rect.width - w) / 2;
          const y = (rect.height - h) / 2;
          ctx.drawImage(img, x, y, w, h);
          hasContent = true;
          wrap.classList.add("has-sig");
          if (resetDefault !== false) resetDefaultOnModify(targetNum);
          syncSignatureToPreview(targetNum, canvas.toDataURL("image/png"));
        };
        img.src = dataUrl;
      },
    };
  }

  function syncSignatureToPreview(num, dataUrl) {
    const target = document.getElementById("doc-sig-" + num);
    if (dataUrl) {
      target.innerHTML = '<img src="' + dataUrl + '" alt="Tanda tangan pihak ' + num + '">';
    } else {
      target.innerHTML = "";
    }
  }

  function resetDefaultOnModify(num) {
    const check = document.querySelector(`.sig-default-check[data-signer="${num}"]`);
    if (check && check.checked) {
      check.checked = false;
      localStorage.setItem("ba-default-" + num, "false");
      localStorage.removeItem("ba-sig-data-" + num);
    }
  }

  let sigPad1 = null;
  let sigPad2 = null;

  safeRun("inisialisasi signature pad 1", () => {
    sigPad1 = setupSignaturePad("sig-pad-1", "1");
    restoreDefaultForPad("1", sigPad1);
  });
  safeRun("inisialisasi signature pad 2", () => {
    sigPad2 = setupSignaturePad("sig-pad-2", "2");
    restoreDefaultForPad("2", sigPad2);
  });

  function restoreDefaultForPad(num, pad) {
    const check = document.querySelector(`.sig-default-check[data-signer="${num}"]`);
    if (!check) return;
    const saved = localStorage.getItem("ba-default-" + num) === "true";
    const sigData = localStorage.getItem("ba-sig-data-" + num);
    if (saved && sigData && pad) {
      check.checked = true;
      pad.loadImage(sigData, false);
    }
  }

  safeRun("tombol hapus tanda tangan", () => {
    document.querySelectorAll('[data-action="clear-sig"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (target === "1" && sigPad1) sigPad1.clear();
        if (target === "2" && sigPad2) sigPad2.clear();
      });
    });
  });

  safeRun("upload gambar tanda tangan", () => {
    document.querySelectorAll(".sig-upload").forEach((input) => {
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
          const target = input.dataset.target;
          if (target === "1" && sigPad1) sigPad1.loadImage(ev.target.result);
          if (target === "2" && sigPad2) sigPad2.loadImage(ev.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
      });
    });
    document.querySelectorAll('[data-action="upload-sig"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const input = document.querySelector(`.sig-upload[data-target="${target}"]`);
        if (input) input.click();
      });
    });
  });

  safeRun("toggle default signature", () => {
    document.querySelectorAll(".sig-default-check").forEach((check) => {
      check.addEventListener("change", function () {
        const num = this.dataset.signer;
        if (this.checked) {
          const canvas = document.getElementById("sig-pad-" + num);
          const wrap = canvas.closest(".sig-pad-wrap");
          if (wrap.classList.contains("has-sig")) {
            const dataUrl = canvas.toDataURL("image/png");
            localStorage.setItem("ba-sig-data-" + num, dataUrl);
          }
        } else {
          localStorage.removeItem("ba-sig-data-" + num);
        }
        localStorage.setItem("ba-default-" + num, this.checked);
      });
    });
  });

  // ====================================================================
  // 4. QR CODE — muncul otomatis saat URL diisi (terisolasi penuh,
  //    supaya gagal di modul lain tidak ikut mematikan fitur ini)
  // ====================================================================
  safeRun("QR code generator", () => {
    const inputQrUrl = document.getElementById("input-qr-url");
    const errorMsg = document.getElementById("error-msg");
    const qrCanvas = document.getElementById("doc-qr-canvas");
    const qrPlaceholder = document.getElementById("doc-qr-placeholder");
    let qrDebounceTimer = null;

    function showPlaceholder() {
      qrPlaceholder.classList.remove("hidden");
      qrCanvas.classList.add("hidden");
      qrCanvas.innerHTML = "";
    }

    function showQrCode() {
      qrPlaceholder.classList.add("hidden");
      qrCanvas.classList.remove("hidden");
    }

    function normalizeUrl(raw) {
      let value = raw.trim();
      if (!value) return null;
      if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
        value = "https://" + value;
      }
      try {
        new URL(value);
        return value;
      } catch (e) {
        return null;
      }
    }

    function renderQr(rawValue) {
      errorMsg.textContent = "";

      if (!rawValue.trim()) {
        showPlaceholder();
        return;
      }

      const normalized = normalizeUrl(rawValue);
      if (!normalized) {
        showPlaceholder();
        errorMsg.textContent = "URL tidak valid — periksa kembali penulisannya.";
        return;
      }

      if (typeof QRCode === "undefined") {
        errorMsg.textContent =
          "Library QR code gagal dimuat — periksa koneksi internet atau refresh halaman.";
        return;
      }

      try {
        qrCanvas.innerHTML = "";
        new QRCode(qrCanvas, {
          text: normalized,
          width: 260,
          height: 260,
          colorDark: "#14171c",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M,
        });
        showQrCode();
        generateRandomCode();
      } catch (err) {
        console.error("[BA Generator] Gagal membuat QR code:", err);
        errorMsg.textContent = "Gagal membuat QR code untuk tautan ini.";
        showPlaceholder();
      }
    }

    inputQrUrl.addEventListener("input", () => {
      clearTimeout(qrDebounceTimer);
      qrDebounceTimer = setTimeout(() => renderQr(inputQrUrl.value), 350);
    });

    // Kalau field sudah terisi sebelumnya (misal lewat autofill browser), render langsung.
    if (inputQrUrl.value.trim()) {
      renderQr(inputQrUrl.value);
    }

    // Cek dini saat halaman dimuat: kalau library QR gagal termuat sama sekali,
    // beri tahu di label placeholder sebelum user sempat mengetik apa pun.
    if (typeof QRCode === "undefined") {
      inputQrUrl.placeholder = "⚠ Library QR gagal termuat — periksa koneksi internet";
      console.error(
        "[BA Generator] window.QRCode tidak ditemukan saat halaman dimuat. " +
        "Periksa koneksi internet atau apakah CDN qrcodejs bisa diakses."
      );
    }
  });

  // ====================================================================
  // 5. RANDOM CODE GENERATOR
  // ====================================================================
  function generateRandomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    document.getElementById("doc-code").textContent = result;
  }

  safeRun("random code generator init", generateRandomCode);

  // ====================================================================
  // 6. UAT STATUS TOGGLE
  // ====================================================================
  safeRun("UAT status toggle", () => {
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.value;
        document.getElementById("uat-status").value = val;
        document.querySelectorAll(".toggle-btn").forEach((b) =>
          b.classList.toggle("is-selected", b === btn)
        );
        document.querySelector(".doc-stamp-verified").classList.toggle("is-visible", val === "verified");
        document.querySelector(".doc-stamp-rejected").classList.toggle("is-visible", val === "rejected");
        updateDownloadButton();
      });
    });
  });

  function updateDownloadButton() {
    const inputIds = [
      "input-doctitle", "input-subtitle", "input-divisi",
      "p1-nama", "p1-nrp", "p1-jabatan", "p1-jabatan-ttd",
      "p2-nama", "p2-nrp", "p2-jabatan", "p2-jabatan-ttd",
      "input-statement", "input-lokasi", "input-tanggal",
      "input-qr-url", "uat-status",
    ];
    const allFilled = inputIds.every(id => {
      const el = document.getElementById(id);
      return el && el.value.trim();
    });
    const sig1 = document.querySelector('.sig-pad-wrap[data-signer="1"].has-sig');
    const sig2 = document.querySelector('.sig-pad-wrap[data-signer="2"].has-sig');
    document.getElementById("btn-download-pdf").disabled = !(allFilled && sig1 && sig2);
  }

  const allInputIds = [
    "input-doctitle", "input-subtitle", "input-divisi",
    "p1-nama", "p1-nrp", "p1-jabatan", "p1-jabatan-ttd",
    "p2-nama", "p2-nrp", "p2-jabatan", "p2-jabatan-ttd",
    "input-statement", "input-lokasi", "input-tanggal",
    "input-qr-url",
  ];
  allInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateDownloadButton);
  });

  document.querySelectorAll(".sig-pad-wrap").forEach(wrap => {
    const obs = new MutationObserver(() => updateDownloadButton());
    obs.observe(wrap, { attributes: true, attributeFilter: ["class"] });
  });

  updateDownloadButton();

  safeRun("export PDF", () => {
    const btnDownloadPdf = document.getElementById("btn-download-pdf");
    const docPage = document.getElementById("doc-page");
    const errorMsg = document.getElementById("error-msg");

    btnDownloadPdf.addEventListener("click", async () => {
      const originalLabel = btnDownloadPdf.innerHTML;
      btnDownloadPdf.disabled = true;
      btnDownloadPdf.innerHTML = "Menyiapkan PDF…";

      try {
        const canvas = await html2canvas(docPage, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.8);
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgRatio = canvas.height / canvas.width;

        let renderWidth = pageWidth;
        let renderHeight = pageWidth * imgRatio;

        if (renderHeight > pageHeight) {
          renderHeight = pageHeight;
          renderWidth = pageHeight / imgRatio;
        }

        const offsetX = (pageWidth - renderWidth) / 2;
        const offsetY = 0;

        pdf.addImage(imgData, "JPEG", offsetX, offsetY, renderWidth, renderHeight);

        const docTitleVal = document.getElementById("input-doctitle").value || "berita-acara";
        const fileSafeName = docTitleVal
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        pdf.save((fileSafeName || "berita-acara") + ".pdf");
      } catch (err) {
        errorMsg.textContent = "Gagal membuat PDF: " + err.message;
      } finally {
        btnDownloadPdf.disabled = false;
        btnDownloadPdf.innerHTML = originalLabel;
      }
    });
  });

  // ====================================================================
  // 7. MASTER DATA — sql.js, modal, dropdown auto-fill
  // ====================================================================
  safeRun("master data - inisialisasi database", () => {
    if (typeof BA_DB === "undefined") return;

    const modal = document.getElementById("modal-master");
    const modalClose = document.getElementById("modal-close");
    const modalCancel = document.getElementById("modal-cancel");
    const modalSave = document.getElementById("modal-save");
    const selectP1 = document.getElementById("p1-master");
    const selectP2 = document.getElementById("p2-master");
    let activePrefix = "p1";

    // Init sql.js + IndexedDB
    BA_DB.init().then(loadDropdowns).catch((err) => {
      console.error("[BA Generator] Gagal init database:", err);
    });

    function loadDropdowns() {
      BA_DB.getPegawaiList().then((list) => {
        populateSelect(selectP1, list);
        populateSelect(selectP2, list);
      }).catch((err) => {
        console.error("[BA Generator] Gagal load data pegawai:", err);
      });
    }

    function populateSelect(sel, list) {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">-- Tambah / Pilih Pegawai --</option>';
      list.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nama + (p.nrp ? " (" + p.nrp + ")" : "");
        sel.appendChild(opt);
      });
      if (currentVal) sel.value = currentVal;
    }

    // Tombol "+" → buka modal
    document.querySelectorAll(".btn-add-master").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePrefix = btn.dataset.target;
        document.getElementById("modal-nama").value = "";
        document.getElementById("modal-nrp").value = "";
        document.getElementById("modal-jabatan").value = "";
        document.getElementById("modal-jabatan-ttd").value = "";
        modal.classList.remove("hidden");
        document.getElementById("modal-nama").focus();
      });
    });

    function closeModal() {
      modal.classList.add("hidden");
    }

    modalClose.addEventListener("click", closeModal);
    modalCancel.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        closeModal();
      }
    });

    // Simpan data baru dari modal
    modalSave.addEventListener("click", () => {
      const nama = document.getElementById("modal-nama").value.trim();
      const nrp = document.getElementById("modal-nrp").value.trim();
      const jabatan = document.getElementById("modal-jabatan").value.trim();
      const jabatanTtd = document.getElementById("modal-jabatan-ttd").value.trim();

      if (!nama || !jabatan || !jabatanTtd) {
        alert("Nama, Jabatan, dan Jabatan Tanda Tangan wajib diisi.");
        return;
      }

      BA_DB.addPegawai({ nama, nrp, jabatan, jabatan_ttd: jabatanTtd }).then((id) => {
        closeModal();
        return BA_DB.getPegawaiList().then((list) => {
          populateSelect(selectP1, list);
          populateSelect(selectP2, list);
          const sel = activePrefix === "p1" ? selectP1 : selectP2;
          sel.value = String(id);
          sel.dispatchEvent(new Event("change"));
        });
      }).catch((err) => {
        console.error("[BA Generator] Gagal simpan data:", err);
        alert("Gagal menyimpan data.");
      });
    });

    // Dropdown → auto-fill form
    function bindMasterSelect(prefix) {
      const sel = document.getElementById(prefix + "-master");
      sel.addEventListener("change", () => {
        const id = parseInt(sel.value, 10);
        if (!id) return;
        BA_DB.getPegawaiList().then((list) => {
          const p = list.find((x) => x.id === id);
          if (!p) return;
          setField(prefix + "-nama", p.nama);
          setField(prefix + "-nrp", p.nrp || "");
          setField(prefix + "-jabatan", p.jabatan);
          setField(prefix + "-jabatan-ttd", p.jabatan_ttd);
        });
      });
    }

    function setField(id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    bindMasterSelect("p1");
    bindMasterSelect("p2");
  });

})();
