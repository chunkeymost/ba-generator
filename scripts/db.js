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
      return BA_DB;
    });
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
        "INSERT INTO master_pegawai (nama, nrp, jabatan, jabatan_ttd) VALUES (?, ?, ?, ?)",
        [data.nama, data.nrp || null, data.jabatan, data.jabatan_ttd]
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
  };

  // Proxy ready state
  Object.defineProperty(window.BA_DB, "ready", {
    get: function () { return BA_DB.ready; },
  });
})();
