(function () {
  "use strict";

  var BA_DB = {
    ready: false,
    _db: null,
    _SQL: null,
  };

  var DB_NAME = "ba-generator";
  var DB_STORE = "files";
  var DB_FILE_KEY = "master-data.sqlite";

  // ====================================================================
  // IndexedDB helpers
  // ====================================================================
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, "readonly");
        var req = tx.objectStore(DB_STORE).get(key);
        req.onsuccess = function () { db.close(); resolve(req.result); };
        req.onerror = function () { db.close(); reject(req.error); };
      });
    });
  }

  // ====================================================================
  // Database initialization
  // ====================================================================
  function initDatabase() {
    if (typeof initSqlJs === "undefined") {
      return Promise.reject(new Error("sql.js (initSqlJs) tidak ditemukan"));
    }

    return initSqlJs({
      locateFile: function (url) {
        return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/" + url;
      },
    }).then(function (SQL) {
      BA_DB._SQL = SQL;
      return idbGet(DB_FILE_KEY);
    }).then(function (savedData) {
      if (savedData) {
        BA_DB._db = new BA_DB._SQL.Database(savedData);
      } else {
        BA_DB._db = new BA_DB._SQL.Database();
      }
      runMigrations(BA_DB._db);
      BA_DB.ready = true;

      if (savedData) {
        return BA_DB;
      }

      // Seed default master data dari file data.json (kalau belum ada di IndexedDB)
      return fetch("data.json")
        .then(function (res) { return res.json(); })
        .then(function (payload) { return seedFromJson(payload); })
        .then(function () { return BA_DB; });
    });
  }

  function seedFromJson(payload) {
    var db = BA_DB._db;
    if (payload && Array.isArray(payload.master_pegawai)) {
      payload.master_pegawai.forEach(function (row) {
        if (!row || !row.nama) return;
        db.run(
          "INSERT INTO master_pegawai (nama, nrp, jabatan, jabatan_ttd, jenis) VALUES (?, ?, ?, ?, ?)",
          [row.nama, row.nrp || null, row.jabatan, row.jabatan_ttd, row.jenis || "p1"]
        );
      });
    }
    if (payload && Array.isArray(payload.master_dokumen)) {
      payload.master_dokumen.forEach(function (row) {
        if (!row || !row.judul) return;
        db.run("INSERT INTO master_dokumen (judul, divisi) VALUES (?, ?)", [row.judul, row.divisi]);
      });
    }
    var data = BA_DB._db.export();
    return idbPut(DB_FILE_KEY, data);
  }

  function runMigrations(db) {
    db.run(
      "CREATE TABLE IF NOT EXISTS master_pegawai (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  nama TEXT NOT NULL," +
      "  nrp TEXT," +
      "  jabatan TEXT NOT NULL," +
      "  jabatan_ttd TEXT NOT NULL," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")"
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_master_pegawai_nama ON master_pegawai(nama)"
    );
    // Safe add jenis column — check if exists first
    try {
      var colInfo = db.exec("PRAGMA table_info(master_pegawai)");
      var hasJenis = false;
      if (colInfo.length > 0) {
        for (var i = 0; i < colInfo[0].values.length; i++) {
          if (colInfo[0].values[i][1] === "jenis") { hasJenis = true; break; }
        }
      }
      if (!hasJenis) {
        db.run("ALTER TABLE master_pegawai ADD COLUMN jenis TEXT NOT NULL DEFAULT 'p1'");
      }
    } catch (_) { /* table mungkin belum ada — skip */ }
    db.run(
      "CREATE TABLE IF NOT EXISTS master_dokumen (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  judul TEXT NOT NULL UNIQUE," +
      "  divisi TEXT NOT NULL," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))" +
      ")"
    );
  }

  // ====================================================================
  // Persist database to IndexedDB
  // ====================================================================
  function saveDatabase() {
    if (!BA_DB._db) return Promise.resolve();
    var data = BA_DB._db.export();
    return idbPut(DB_FILE_KEY, data);
  }

  // ====================================================================
  // CRUD operations
  // ====================================================================
  function getPegawaiList() {
    if (!BA_DB._db) return Promise.resolve([]);
    try {
      var stmt = BA_DB._db.prepare(
        "SELECT * FROM master_pegawai ORDER BY nama ASC"
      );
      var rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function addPegawai(data) {
    if (!BA_DB._db) return Promise.reject(new Error("Database belum siap"));
    try {
      BA_DB._db.run(
        "INSERT INTO master_pegawai (nama, nrp, jabatan, jabatan_ttd, jenis) VALUES (?, ?, ?, ?, ?)",
        [data.nama, data.nrp || null, data.jabatan, data.jabatan_ttd, data.jenis || "p1"]
      );
      var id = BA_DB._db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
      return saveDatabase().then(function () { return id; });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function deletePegawai(id) {
    if (!BA_DB._db) return Promise.reject(new Error("Database belum siap"));
    try {
      BA_DB._db.run("DELETE FROM master_pegawai WHERE id = ?", [id]);
      return saveDatabase();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // ====================================================================
  // Dokumen CRUD
  // ====================================================================
  function getDokumenList() {
    if (!BA_DB._db) return Promise.resolve([]);
    try {
      var stmt = BA_DB._db.prepare(
        "SELECT * FROM master_dokumen ORDER BY judul ASC"
      );
      var rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function addDokumen(data) {
    if (!BA_DB._db) return Promise.reject(new Error("Database belum siap"));
    try {
      BA_DB._db.run(
        "INSERT INTO master_dokumen (judul, divisi) VALUES (?, ?)",
        [data.judul, data.divisi]
      );
      var id = BA_DB._db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
      return saveDatabase().then(function () { return id; });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function deleteDokumen(id) {
    if (!BA_DB._db) return Promise.reject(new Error("Database belum siap"));
    try {
      BA_DB._db.run("DELETE FROM master_dokumen WHERE id = ?", [id]);
      return saveDatabase();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Export master data ke format JSON (dipakai untuk data.json / default sebelum deploy)
  function exportMasterData() {
    return Promise.all([getPegawaiList(), getDokumenList()]).then(function (results) {
      var pegawai = results[0] || [];
      var dokumen = results[1] || [];
      var payload = { master_pegawai: [], master_dokumen: [] };
      for (var i = 0; i < pegawai.length; i++) {
        var p = pegawai[i];
        payload.master_pegawai.push({
          nama: p.nama,
          nrp: p.nrp || "",
          jabatan: p.jabatan,
          jabatan_ttd: p.jabatan_ttd,
          jenis: p.jenis || "p1",
        });
      }
      for (var j = 0; j < dokumen.length; j++) {
        var d = dokumen[j];
        payload.master_dokumen.push({ judul: d.judul, divisi: d.divisi });
      }
      return payload;
    });
  }

  // ====================================================================
  // Public API
  // ====================================================================
  window.BA_DB = {
    ready: false,
    init: initDatabase,
    save: saveDatabase,
    getPegawaiList: getPegawaiList,
    addPegawai: addPegawai,
    deletePegawai: deletePegawai,
    getDokumenList: getDokumenList,
    addDokumen: addDokumen,
    deleteDokumen: deleteDokumen,
    exportMasterData: exportMasterData,
  };

  // Proxy ready state
  Object.defineProperty(window.BA_DB, "ready", {
    get: function () { return BA_DB.ready; },
  });
})();
