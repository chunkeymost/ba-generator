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
    { input: "input-doctitle", preview: "doc-title", mode: "text" },
    { input: "input-subtitle", preview: "doc-subtitle", mode: "text" },
    { input: "input-divisi", preview: "doc-divisi", mode: "text", extra: ["doc-divisi-2"] },
    { input: "p1-nama", preview: "doc-p1-nama", mode: "text" },
    { input: "p1-nrp", preview: "doc-p1-nrp", mode: "text" },
    { input: "p1-jabatan", preview: "doc-p1-jabatan", mode: "text", extra: ["doc-p1-jabatan-2"] },
    { input: "p2-nama", preview: "doc-p2-nama", mode: "text" },
    { input: "p2-nrp", preview: "doc-p2-nrp", mode: "text" },
    { input: "p2-jabatan", preview: "doc-p2-jabatan", mode: "text" },
    { input: "input-statement", preview: "doc-statement", mode: "text" },
    { input: "input-lokasi", preview: "doc-lokasi", mode: "text" },
  ];

  function bindLiveSync() {
    fields.forEach((f) => {
      const inputEl = document.getElementById(f.input);
      const previewEl = document.getElementById(f.preview);
      const update = () => {
        const val = inputEl.value || "";
        previewEl.textContent = val;
        if (f.extra) {
          f.extra.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
          });
        }
      };
      inputEl.addEventListener("input", update);
      update(); // initial sync
    });

    // Tanggal: gabungan lokasi + tanggal terformat
    function updateTanggalPreview() {
      const raw = inputTanggal.value; // yyyy-mm-dd
      if (!raw) {
        document.getElementById("doc-tanggal").textContent = "";
        return;
      }
      const [y, m, d] = raw.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      document.getElementById("doc-tanggal").textContent = formatTanggalIndonesia(dateObj);
    }
    inputTanggal.addEventListener("input", updateTanggalPreview);
    updateTanggalPreview();

    // Jabatan tanda tangan (nama + jabatan di bawah kolom signature)
    function bindSigMeta(prefix, num) {
      const namaInput = document.getElementById(prefix + "-nama");
      const jabatanInput = document.getElementById(prefix + "-jabatan-ttd");
      const namaPreview = document.getElementById("doc-sig-name-" + num);
      const rolePreview = document.getElementById("doc-sig-role-" + num);

      function update() {
        namaPreview.textContent = namaInput.value || "";
        rolePreview.textContent = jabatanInput.value ? "(" + jabatanInput.value + ")" : "";
      }
      namaInput.addEventListener("input", update);
      jabatanInput.addEventListener("input", update);
      update();
    }
    bindSigMeta("p1", "1");
    bindSigMeta("p2", "2");
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
        syncSignatureToPreview(targetNum, null);
      },
      hasContent() {
        return hasContent;
      },
      loadImage(dataUrl) {
        const img = new Image();
        img.onload = function () {
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // fit image within canvas while preserving aspect ratio
          const scale = Math.min(rect.width / img.width, rect.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (rect.width - w) / 2;
          const y = (rect.height - h) / 2;
          ctx.drawImage(img, x, y, w, h);
          hasContent = true;
          wrap.classList.add("has-sig");
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

  let sigPad1 = null;
  let sigPad2 = null;

  safeRun("inisialisasi signature pad 1", () => {
    sigPad1 = setupSignaturePad("sig-pad-1", "1");
  });
  safeRun("inisialisasi signature pad 2", () => {
    sigPad2 = setupSignaturePad("sig-pad-2", "2");
  });

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

  // ====================================================================
  // 4. QR CODE — muncul otomatis saat URL diisi (terisolasi penuh,
  //    supaya gagal di modul lain tidak ikut mematikan fitur ini)
  // ====================================================================
  safeRun("QR code generator", () => {
    const inputQrUrl = document.getElementById("input-qr-url");
    const errorMsg = document.getElementById("error-msg");
    const qrWrap = document.getElementById("doc-qr-wrap");
    const qrCanvas = document.getElementById("doc-qr-canvas");
    let qrDebounceTimer = null;

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
        qrWrap.style.display = "none";
        qrCanvas.innerHTML = "";
        return;
      }

      const normalized = normalizeUrl(rawValue);
      if (!normalized) {
        qrWrap.style.display = "none";
        qrCanvas.innerHTML = "";
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
        qrWrap.style.display = "flex";
        generateRandomCode();
      } catch (err) {
        console.error("[BA Generator] Gagal membuat QR code:", err);
        errorMsg.textContent = "Gagal membuat QR code untuk tautan ini.";
        qrWrap.style.display = "none";
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
          scale: 3,
          backgroundColor: "#ffffff",
          useCORS: true,
        });

        const imgData = canvas.toDataURL("image/png");
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

        pdf.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight);

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

})();
