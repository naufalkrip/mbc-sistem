/**
 * ============================================================
 * MB CHONDRO — Google Apps Script Backend
 * ============================================================
 * Berfungsi sebagai API antara website React dan Google Spreadsheet.
 *
 * CARA PAKAI:
 * 1. Buka https://script.google.com (project: 1zJPjV4XTa6dZe0KHpHKEI2qfMA-WtEh1ekF8BCNb9DwE5_O8BAAh274l)
 * 2. Ganti seluruh isi Code.gs dengan file ini.
 * 3. Klik Deploy → New deployment → Web app.
 *    - Description: mbc sistem API
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Salin URL /exec → paste ke src/config.ts sebagai API_URL.
 *
 * Spreadsheet: 1GXkAFCQrbf-I7KgYjohQ5TIvJMsIt1Ga0M1BcijrPi8
 * (JANGAN menghapus data yang sudah ada — script ini hanya membuat
 *  sheet/header bila belum ada, tidak menghapus apa pun.)
 * ============================================================
 */

// ============================================================
// KONFIGURASI
// ============================================================

var SPREADSHEET_ID = "1GXkAFCQrbf-I7KgYjohQ5TIvJMsIt1Ga0M1BcijrPi8";

// Opsional: jika diisi, semua request harus menyertakan token.
// Kosongkan ("") untuk menonaktifkan proteksi token.
var API_TOKEN = "";

var SHEET_CONFIG = [
  {
    key: "ANGGOTA",
    name: "ANGGOTA",
    idPrefix: "MB",
    headers: ["ID Anggota", "Nama Lengkap", "Nama Panggilan", "Divisi", "Jabatan", "No. HP", "Status", "Tanggal Bergabung", "Keterangan", "Foto"],
    keys: ["id", "nama", "namaPanggilan", "divisi", "jabatan", "noHp", "status", "tanggalBergabung", "keterangan", "foto"],
    idCol: 0
  },
  {
    key: "ABSENSI",
    name: "ABSENSI",
    idPrefix: "ABS",
    headers: ["ID Absensi", "ID Anggota", "Nama", "Tanggal", "Kegiatan", "Status Kehadiran", "Keterangan", "Waktu"],
    keys: ["id", "idAnggota", "nama", "tanggal", "kegiatan", "status", "keterangan", "waktu"],
    idCol: 0
  },
  {
    key: "KEUANGAN_CHONDRO",
    name: "KEUANGAN_CHONDRO",
    idPrefix: "TRX",
    headers: ["ID Transaksi", "Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal", "Penanggung Jawab"],
    keys: ["id", "tanggal", "jenis", "kategori", "keterangan", "nominal", "penanggungJawab"],
    idCol: 0
  },
  {
    key: "KEUANGAN_MEDIA",
    name: "KEUANGAN_MEDIA",
    idPrefix: "TRX",
    headers: ["ID Transaksi", "Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal", "Penanggung Jawab"],
    keys: ["id", "tanggal", "jenis", "kategori", "keterangan", "nominal", "penanggungJawab"],
    idCol: 0
  },
  {
    key: "TRANSAKSI_GROUP",
    name: "TRANSAKSI_GROUP",
    idPrefix: "TG",
    headers: ["id", "judul", "tanggal", "keterangan", "createdAt", "updatedAt"],
    keys: ["id", "judul", "tanggal", "keterangan", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "TRANSAKSI_DETAIL",
    name: "TRANSAKSI_DETAIL",
    idPrefix: "TD",
    headers: ["id", "transaksiGroupId", "tanggal", "jenis", "kategori", "nominal", "keterangan", "createdAt", "updatedAt"],
    keys: ["id", "transaksiGroupId", "tanggal", "jenis", "kategori", "nominal", "keterangan", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "REKRUITMEN_FORM",
    name: "REKRUITMEN_FORM",
    idPrefix: "RF",
    headers: ["id", "title", "description", "status", "createdAt", "updatedAt"],
    keys: ["id", "title", "description", "status", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "REKRUITMEN_FIELDS",
    name: "REKRUITMEN_FIELDS",
    idPrefix: "RFLD",
    headers: ["id", "formId", "label", "description", "fieldType", "required", "options", "sortOrder", "placeholder", "exampleImageUrl", "exampleImageTitle", "maxFileSize", "allowedFileTypes", "createdAt", "updatedAt"],
    keys: ["id", "formId", "label", "description", "fieldType", "required", "options", "sortOrder", "placeholder", "exampleImageUrl", "exampleImageTitle", "maxFileSize", "allowedFileTypes", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "REKRUITMEN_SUBMISSIONS",
    name: "REKRUITMEN_SUBMISSIONS",
    idPrefix: "RSUB",
    headers: ["id", "formId", "status", "adminNote", "submittedAt", "reviewedAt", "reviewedBy"],
    keys: ["id", "formId", "status", "adminNote", "submittedAt", "reviewedAt", "reviewedBy"],
    idCol: 0
  },
  {
    key: "REKRUITMEN_ANSWERS",
    name: "REKRUITMEN_ANSWERS",
    idPrefix: "RANS",
    headers: ["id", "submissionId", "fieldId", "value", "fileUrl", "fileName", "fileType", "fileSize", "createdAt"],
    keys: ["id", "submissionId", "fieldId", "value", "fileUrl", "fileName", "fileType", "fileSize", "createdAt"],
    idCol: 0
  },
  {
    key: "USERS",
    name: "USERS",
    idPrefix: "USR",
    headers: ["id", "username", "password", "nama", "role", "status", "createdAt", "updatedAt"],
    keys: ["id", "username", "password", "nama", "role", "status", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "ORDER_FORM",
    name: "ORDER_FORM",
    idPrefix: "OF",
    headers: ["id", "title", "description", "status", "publicLink", "bannerImageUrl", "bannerImageTitle", "createdAt", "updatedAt"],
    keys: ["id", "title", "description", "status", "publicLink", "bannerImageUrl", "bannerImageTitle", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "ORDER_FIELDS",
    name: "ORDER_FIELDS",
    idPrefix: "OFLD",
    headers: ["id", "formId", "label", "description", "fieldType", "required", "options", "sortOrder", "placeholder", "maxFileSize", "imageUrl", "imageTitle", "infoText", "exampleImageUrl", "price", "createdAt", "updatedAt"],
    keys: ["id", "formId", "label", "description", "fieldType", "required", "options", "sortOrder", "placeholder", "maxFileSize", "imageUrl", "imageTitle", "infoText", "exampleImageUrl", "price", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "ORDERS",
    name: "ORDERS",
    idPrefix: "ORD",
    headers: ["id", "formId", "customerName", "whatsapp", "status", "adminNote", "createdAt", "updatedAt"],
    keys: ["id", "formId", "customerName", "whatsapp", "status", "adminNote", "createdAt", "updatedAt"],
    idCol: 0
  },
  {
    key: "ORDER_ANSWERS",
    name: "ORDER_ANSWERS",
    idPrefix: "OANS",
    headers: ["id", "orderId", "fieldId", "label", "value", "fileUrl", "fileName", "fileType", "fileSize", "createdAt"],
    keys: ["id", "orderId", "fieldId", "label", "value", "fileUrl", "fileName", "fileType", "fileSize", "createdAt"],
    idCol: 0
  },
  {
    key: "KUPON_LOCATIONS",
    name: "KUPON_LOCATIONS",
    idPrefix: "KPN",
    headers: ["id", "name", "picName", "whatsapp", "latitude", "longitude", "address", "description", "photoUrl", "status", "createdAt", "updatedAt"],
    keys: ["id", "name", "picName", "whatsapp", "latitude", "longitude", "address", "description", "photoUrl", "status", "createdAt", "updatedAt"],
    idCol: 0
  }
];

// ============================================================
// ENTRY POINT (doGet / doPost)
// ============================================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  return handleRequest(action, {});
}

function doPost(e) {
  var payload = {};
  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      // payload tetap {}
    }
  }
  var action = payload.action || (e && e.parameter && e.parameter.action) || "";
  var data = payload.data || {};
  return handleRequest(action, data);
}

function handleRequest(action, data) {
  try {
    if (action === "setup") {
      ensureSetup();
      return jsonResponse({ success: true, message: "Setup selesai." });
    }

    if (API_TOKEN && data.token !== API_TOKEN) {
      return jsonResponse({ success: false, message: "Token tidak valid." });
    }

    var result = executeAction(action, data);
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, message: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function executeAction(action, data) {
  switch (action) {
    // Dashboard
    case "getDashboard":
      return getDashboard();

    // Anggota
    case "getAnggota":
      return getAnggota();
    case "addAnggota":
      return addAnggota(data);
    case "updateAnggota":
      return updateAnggota(data);
    case "deleteAnggota":
      return deleteAnggota(data);
    case "repairDataAnggota":
      return repairDataAnggota();

    // Absensi
    case "getAbsensi":
      return getAbsensi();
    case "addAbsensi":
      return addAbsensi(data);
    case "updateAbsensi":
      return updateAbsensi(data);
    case "deleteAbsensi":
      return deleteAbsensi(data);
    case "saveAbsensiBatch":
      return saveAbsensiBatch(data.items);
    case "updateAbsensiBatch":
      return updateAbsensiBatch(data.items);
    case "deleteAbsensiBatch":
      return deleteAbsensiBatch(data.ids);

    // Keuangan mbc sistem
    case "getKeuanganChondro":
      return getKeuanganChondro();
    case "addKeuanganChondro":
      return addKeuanganChondro(data);
    case "updateKeuanganChondro":
      return updateKeuanganChondro(data);
    case "deleteKeuanganChondro":
      return deleteKeuanganChondro(data);

    // Keuangan Media
    case "getKeuanganMedia":
      return getKeuanganMedia();
    case "addKeuanganMedia":
      return addKeuanganMedia(data);
    case "updateKeuanganMedia":
      return updateKeuanganMedia(data);
    case "deleteKeuanganMedia":
      return deleteKeuanganMedia(data);

    // Transaksi Group
    case "getTransaksiGroup":
      return getTransaksiGroup();
    case "addTransaksiGroup":
      return addTransaksiGroup(data);
    case "updateTransaksiGroup":
      return updateTransaksiGroup(data);
    case "deleteTransaksiGroup":
      return deleteTransaksiGroup(data);

    // Transaksi Detail
    case "getTransaksiDetail":
      return getTransaksiDetail(data.transaksiGroupId);
    case "addTransaksiDetail":
      return addTransaksiDetail(data);
    case "updateTransaksiDetail":
      return updateTransaksiDetail(data);
    case "deleteTransaksiDetail":
      return deleteTransaksiDetail(data);

    // Rekrutmen Form
    case "getRekrutmenForm":
      return getRekrutmenForm();
    case "addRekrutmenForm":
      return addRekrutmenForm(data);
    case "updateRekrutmenForm":
      return updateRekrutmenForm(data);
    case "deleteRekrutmenForm":
      return deleteRekrutmenForm(data);

    // Rekrutmen Fields
    case "getRekrutmenFields":
      return getRekrutmenFields(data.formId);
    case "addRekrutmenField":
      return addRekrutmenField(data);
    case "updateRekrutmenField":
      return updateRekrutmenField(data);
    case "deleteRekrutmenField":
      return deleteRekrutmenField(data);
    case "reorderRekrutmenFields":
      return reorderRekrutmenFields(data.formId, data.fieldOrders);
    case "uploadRekrutmenImage":
      return uploadRekrutmenImage(data);
    case "getRekrutmenImageBase64":
      return getRekrutmenImageBase64(data);
    case "updateRekrutmenAnswerPhoto":
      return updateRekrutmenAnswerPhoto(data);

    // Rekrutmen Submissions
    case "getRekrutmenSubmissions":
      return getRekrutmenSubmissions(data.formId);
    case "addRekrutmenSubmission":
      return addRekrutmenSubmission(data);
    case "updateRekrutmenSubmission":
      return updateRekrutmenSubmission(data.id, data);
    case "deleteRekrutmenSubmission":
      return deleteRekrutmenSubmission(data);
    case "getRekrutmenSubmissionDetail":
      return getRekrutmenSubmissionDetail(data.submissionId);
    case "getRekrutmenAnswers":
      return getRekrutmenAnswers(data.submissionId);
    case "getRekrutmenStats":
      return getRekrutmenStats(data.formId);

    // ==================== KELOLA PESANAN ====================
    case "uploadOrderImage":
      return uploadOrderImage(data);
    case "getOrderForms":
      return getOrderForms();
    case "getOrderForm":
      return getOrderForm(data.id);
    case "addOrderForm":
      return addOrderForm(data);
    case "updateOrderForm":
      return updateOrderForm(data);
    case "deleteOrderForm":
      return deleteOrderForm(data);
    case "getOrderFields":
      return getOrderFields(data.formId);
    case "addOrderField":
      return addOrderField(data);
    case "updateOrderField":
      return updateOrderField(data);
    case "deleteOrderField":
      return deleteOrderField(data);
    case "reorderOrderFields":
      return reorderOrderFields(data.formId, data.fieldOrders);
    case "getOrders":
      return getOrders(data.formId);
    case "addOrder":
      return addOrder(data);
    case "updateOrderStatus":
      return updateOrderStatus(data);
    case "deleteOrder":
      return deleteOrder(data);
    case "getOrderStats":
      return getOrderStats(data.formId);

    // Users & Autentikasi
    case "login":
      return loginUser(data.username, data.password);
    case "getUsers":
      return getUsers();
    case "addUser":
      return addUser(data);
    case "updateUser":
      return updateUser(data);
    case "deleteUser":
      return deleteUser(data);

    // Kupon Lokasi
    case "getCouponLocations":
      return getCouponLocations(data ? (data.activeOnly === true || data.activeOnly === "true") : false);
    case "addCouponLocation":
      return addCouponLocation(data);
    case "updateCouponLocation":
      return updateCouponLocation(data);
    case "deleteCouponLocation":
      return deleteCouponLocation(data);

    default:
      throw new Error("Action tidak dikenal: " + action);
  }
}

// ============================================================
// SETUP SPREADSHEET (non-destruktif)
// ============================================================

var _spreadsheetInstance = null;
function getSpreadsheet() {
  if (!_spreadsheetInstance) {
    _spreadsheetInstance = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _spreadsheetInstance;
}

var _sheetCache = {};
function getOrCreateSheet(cfg) {
  if (_sheetCache[cfg.name]) {
    return _sheetCache[cfg.name];
  }
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  if (!sheet) {
    sheet = ss.insertSheet(cfg.name);
    ensureHeaders(sheet, cfg);
  }
  _sheetCache[cfg.name] = sheet;
  return sheet;
}

function ensureSetup() {
  for (var i = 0; i < SHEET_CONFIG.length; i++) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_CONFIG[i].name);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_CONFIG[i].name);
    }
    ensureHeaders(sheet, SHEET_CONFIG[i]);
  }
}

// Daftar alias header umum untuk mapping kolom yang fleksibel dan kebal pergeseran
var HEADER_ALIASES = {
  "id": ["id", "id anggota", "id_anggota", "id absensi", "id transaksi", "kode"],
  "nama": ["nama", "nama lengkap", "nama_lengkap", "namalengkap", "full name"],
  "namapanggilan": ["nama panggilan", "nama_panggilan", "namapanggilan", "panggilan", "nickname", "alias"],
  "divisi": ["divisi", "division", "seksi", "bidang"],
  "jabatan": ["jabatan", "role", "posisi", "position"],
  "nohp": ["nohp", "no. hp", "no hp", "nomor hp", "nomor handphone", "telepon", "phone", "wa"],
  "status": ["status", "status keaktifan", "keaktifan"],
  "tanggalbergabung": ["tanggal bergabung", "tanggal_bergabung", "tanggalbergabung", "tgl bergabung", "join date"],
  "keterangan": ["keterangan", "catatan", "notes", "ket", "deskripsi", "description"],
  "foto": ["foto", "photo", "image", "avatar", "foto profil", "gambar", "photourl"],
  "name": ["name", "nama", "nama lokasi"],
  "picname": ["picname", "pic_name", "pic", "penanggung jawab"],
  "whatsapp": ["whatsapp", "wa", "no hp", "nohp", "telepon"],
  "latitude": ["latitude", "lat"],
  "longitude": ["longitude", "lng", "lon"],
  "address": ["address", "alamat"],
  "description": ["description", "deskripsi", "keterangan"],
  "photourl": ["photourl", "photo_url", "foto", "gambar"]
};

function resolveColumnIndex(colMap, key, header) {
  var k = String(key || "").trim().toLowerCase();
  var h = String(header || "").trim().toLowerCase();

  // 1. Cek langsung key atau header
  if (k && colMap[k] !== undefined) return colMap[k];
  if (h && colMap[h] !== undefined) return colMap[h];

  // 2. Cek alias
  var candidates = HEADER_ALIASES[k] || HEADER_ALIASES[h] || [];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i].toLowerCase();
    if (colMap[c] !== undefined) return colMap[c];
  }

  // 3. Normalisasi alfanumerik (hilangkan spasi, titik, underscore)
  var cleanK = k.replace(/[^a-z0-9]/g, "");
  var cleanH = h.replace(/[^a-z0-9]/g, "");
  for (var mapKey in colMap) {
    var cleanMapKey = String(mapKey).replace(/[^a-z0-9]/g, "");
    if ((cleanK && cleanMapKey === cleanK) || (cleanH && cleanMapKey === cleanH)) {
      return colMap[mapKey];
    }
  }

  return -1;
}

function ensureAnggotaStructure(sheet) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colMap = {};
  for (var c = 0; c < headerRow.length; c++) {
    var hText = String(headerRow[c] || "").trim().toLowerCase();
    if (hText) colMap[hText] = c;
  }

  // Cek apakah kolom "Nama Panggilan" sudah ada
  var hasPanggilan = resolveColumnIndex(colMap, "namapanggilan", "Nama Panggilan") !== -1;
  if (!hasPanggilan) {
    // Jika kolom 3 adalah "Divisi", sisipkan kolom "Nama Panggilan" tepat di kolom C (index 3)
    var col3Text = headerRow.length >= 3 ? String(headerRow[2] || "").trim().toLowerCase() : "";
    if (col3Text.indexOf("divisi") !== -1) {
      sheet.insertColumnBefore(3);
      sheet.getRange(1, 3).setValue("Nama Panggilan").setFontWeight("bold");
    } else {
      // Sisipkan di kolom terakhir
      sheet.getRange(1, lastCol + 1).setValue("Nama Panggilan").setFontWeight("bold");
    }
  }

  // Refresh kolom setelah kemungkinan penambahan kolom
  lastCol = sheet.getLastColumn();
  headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  colMap = {};
  for (var c2 = 0; c2 < headerRow.length; c2++) {
    var hText2 = String(headerRow[c2] || "").trim().toLowerCase();
    if (hText2) colMap[hText2] = c2;
  }

  // Cek apakah kolom "Foto" sudah ada
  var hasFoto = resolveColumnIndex(colMap, "foto", "Foto") !== -1;
  if (!hasFoto) {
    sheet.getRange(1, lastCol + 1).setValue("Foto").setFontWeight("bold");
  }

  sheet.setFrozenRows(1);
}

function ensureHeaders(sheet, cfg) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }
  // Pastikan baris pertama berisi header; jika kosong, isi header.
  var firstRow = sheet.getRange(1, 1, 1, Math.max(lastCol, cfg.headers.length)).getValues()[0];
  var needsHeader = firstRow.every(function (cell) { return cell === "" || cell === null; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  // Khusus sheet ANGGOTA: pastikan struktur kolom terjaga
  if (cfg.key === "ANGGOTA") {
    ensureAnggotaStructure(sheet);
    return;
  }

  // Cek apakah ada header baru yang belum ada di spreadsheet
  var existingMap = {};
  for (var i = 0; i < firstRow.length; i++) {
    var txt = String(firstRow[i] || "").trim().toLowerCase();
    if (txt) existingMap[txt] = i;
  }
  var missing = [];
  for (var j = 0; j < cfg.headers.length; j++) {
    var hName = cfg.headers[j];
    var kName = cfg.keys[j];
    if (resolveColumnIndex(existingMap, kName, hName) === -1) {
      missing.push(hName);
    }
  }
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setFontWeight("bold");
  }
}

function getSheetConfig(key) {
  for (var i = 0; i < SHEET_CONFIG.length; i++) {
    if (SHEET_CONFIG[i].key === key) return SHEET_CONFIG[i];
  }
  throw new Error("Konfigurasi sheet tidak ditemukan: " + key);
}

// ============================================================
// BANTUAN UMUM
// ============================================================

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatDate(d) {
  if (d instanceof Date) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  return String(d).slice(0, 10);
}

function readRows(cfg) {
  var sheet = getOrCreateSheet(cfg);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var numCols = Math.max(lastCol, cfg.keys.length);
  var values = sheet.getRange(1, 1, lastRow, numCols).getValues();
  var headerRow = values[0];

  // Petakan nama header / key ke index kolom (case-insensitive)
  var colMap = {};
  for (var h = 0; h < headerRow.length; h++) {
    var headerText = String(headerRow[h] || "").trim().toLowerCase();
    if (headerText) {
      colMap[headerText] = h;
    }
  }

  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var idColIdx = cfg.idCol;
    var idKey = String(cfg.keys[cfg.idCol] || "").toLowerCase();
    var idHeader = String(cfg.headers[cfg.idCol] || "").toLowerCase();
    var resolvedIdCol = resolveColumnIndex(colMap, idKey, idHeader);
    if (resolvedIdCol !== -1) idColIdx = resolvedIdCol;

    var idRaw = row[idColIdx];
    if (idRaw === "" || idRaw === null || idRaw === undefined) continue;

    var obj = {};
    for (var c = 0; c < cfg.keys.length; c++) {
      var kName = cfg.keys[c];
      var hName = cfg.headers[c];
      var idx = resolveColumnIndex(colMap, kName, hName);
      
      // JANGAN PERNAH fallback ke idx = c jika kolom tidak ditemukan di sheet!
      if (idx === -1 || idx >= row.length) {
        obj[kName] = "";
      } else {
        var raw = row[idx];
        if (kName === "noHp") {
          var strHp = String(raw === null || raw === undefined ? "" : raw).trim();
          if (strHp.startsWith("'")) strHp = strHp.slice(1);
          if (/^8\d{6,14}$/.test(strHp)) strHp = "0" + strHp;
          obj[kName] = strHp;
        } else {
          obj[kName] = raw instanceof Date ? formatDate(raw) : (raw === null || raw === undefined ? "" : raw);
        }
      }
    }
    result.push(obj);
  }
  return result;
}

function generateId(cfg) {
  var sheet = getOrCreateSheet(cfg);
  var lastRow = sheet.getLastRow();
  var max = 0;
  if (lastRow >= 1) {
    var ids = sheet.getRange(1, cfg.idCol + 1, lastRow, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var s = String(ids[i][0]);
      var m = s.match(/(\d+)$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return cfg.idPrefix + String(max + 1).padStart(3, "0");
}

function findRowIndex(cfg, id) {
  if (!id) return -1;
  var sheet = getOrCreateSheet(cfg);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return -1;

  var targetId = String(id).trim().toLowerCase();
  var headerMap = getHeaderIndexMap(sheet);
  var idColIdx = cfg.idCol;
  var idKey = String(cfg.keys[cfg.idCol] || "").toLowerCase();
  var idHeader = String(cfg.headers[cfg.idCol] || "").toLowerCase();
  if (headerMap[idKey] !== undefined) idColIdx = headerMap[idKey];
  else if (headerMap[idHeader] !== undefined) idColIdx = headerMap[idHeader];

  // 1. Cek pada kolom ID utama
  var ids = sheet.getRange(1, idColIdx + 1, lastRow, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    var val = String(ids[i][0] || "").trim().toLowerCase();
    if (val === targetId) return i + 1; // 1-based baris sheet
  }

  // 2. Fallback: scan seluruh baris jika ID berpindah kolom
  var allData = sheet.getRange(2, 1, lastRow - 1, Math.min(lastCol, 10)).getValues();
  for (var r = 0; r < allData.length; r++) {
    for (var c = 0; c < allData[r].length; c++) {
      if (String(allData[r][c] || "").trim().toLowerCase() === targetId) {
        return r + 2;
      }
    }
  }

  return -1;
}

function getHeaderIndexMap(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var h = String(headerRow[c] || "").trim().toLowerCase();
    if (h) map[h] = c;
  }
  return map;
}

function buildRowArray(sheet, cfg, dataObj) {
  var headerMap = getHeaderIndexMap(sheet);
  var lastCol = Math.max(sheet.getLastColumn(), cfg.keys.length);
  var row = new Array(lastCol).fill("");

  // Isi array dengan mencocokkan nama key / header ke kolom sheet sebenarnya
  for (var k = 0; k < cfg.keys.length; k++) {
    var key = cfg.keys[k];
    var header = cfg.headers[k];
    var val = dataObj[key];
    if (val === undefined || val === null) val = "";

    // Jaga agar angka '0' di awal nomor HP tidak hilang di Google Sheets
    if (key === "noHp" || String(header).toLowerCase().indexOf("hp") !== -1) {
      if (val !== "") {
        var cleanHp = String(val).trim();
        if (cleanHp.startsWith("'")) cleanHp = cleanHp.slice(1);
        if (/^8\d{6,14}$/.test(cleanHp)) cleanHp = "0" + cleanHp;
        // Beri awalan tanda petik satu (') agar Google Sheets memperlakukannya murni sebagai string/teks
        val = "'" + cleanHp;
      }
    }

    var colIdx = resolveColumnIndex(headerMap, key, header);
    if (colIdx >= 0 && colIdx < row.length) {
      row[colIdx] = val;
    }
  }
  return row;
}

function createRow(cfg, dataObj) {
  var sheet = getOrCreateSheet(cfg);
  if (!dataObj.id) {
    dataObj.id = generateId(cfg);
  }
  var row = buildRowArray(sheet, cfg, dataObj);
  sheet.appendRow(row);
  return dataObj;
}

function updateRow(cfg, id, dataObj) {
  var rowIndex = findRowIndex(cfg, id);
  if (rowIndex === -1) throw new Error("Data dengan ID " + id + " tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  var lastCol = Math.max(sheet.getLastColumn(), cfg.keys.length);
  var existingValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  var headerMap = getHeaderIndexMap(sheet);
  var mergedObj = {};
  for (var k = 0; k < cfg.keys.length; k++) {
    var key = cfg.keys[k];
    var header = cfg.headers[k];
    var colIdx = resolveColumnIndex(headerMap, key, header);
    mergedObj[key] = (colIdx >= 0 && colIdx < existingValues.length) ? existingValues[colIdx] : "";
  }
  for (var prop in dataObj) {
    if (dataObj[prop] !== undefined) {
      mergedObj[prop] = dataObj[prop];
    }
  }
  mergedObj.id = id;
  var newRow = buildRowArray(sheet, cfg, mergedObj);
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  return mergedObj;
}

function deleteRow(cfg, id) {
  var rowIndex = findRowIndex(cfg, id);
  if (rowIndex === -1) throw new Error("Data dengan ID " + id + " tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  sheet.deleteRow(rowIndex);
  return { success: true };
}

function hitungSaldo(list) {
  var pemasukan = 0;
  var pengeluaran = 0;
  for (var i = 0; i < list.length; i++) {
    var nominal = Number(list[i].nominal) || 0;
    if (list[i].jenis === "Pemasukan") pemasukan += nominal;
    else pengeluaran += nominal;
  }
  return { pemasukan: pemasukan, pengeluaran: pengeluaran, saldo: pemasukan - pengeluaran };
}

function hitungStatKehadiran(list) {
  var hadir = 0, izin = 0, sakit = 0, cuti = 0, alpa = 0;
  for (var i = 0; i < list.length; i++) {
    var s = list[i].status;
    if (s === "Hadir") hadir++;
    else if (s === "Izin") izin++;
    else if (s === "Sakit") sakit++;
    else if (s === "Cuti") cuti++;
    else alpa++;
  }
  var total = list.length;
  var persentase = total === 0 ? 0 : Math.round(((hadir + izin + sakit + cuti) / total) * 100);
  return { hadir: hadir, izin: izin, sakit: sakit, cuti: cuti, alpa: alpa, total: total, persentase: persentase };
}

function getNamaAnggota(idAnggota) {
  var cfg = getSheetConfig("ANGGOTA");
  var rows = readRows(cfg);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(idAnggota)) return rows[i].nama;
  }
  return "";
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboard() {
  var anggota = getAnggota();
  var absensi = getAbsensi();
  var total = anggota.length;
  var aktif = 0, cuti = 0;
  for (var i = 0; i < anggota.length; i++) {
    if (anggota[i].status === "Aktif") aktif++;
    else if (anggota[i].status === "Cuti") cuti++;
  }
  return {
    anggota: { total: total, aktif: aktif, cuti: cuti, tidakAktif: total - aktif - cuti },
    absensi: hitungStatKehadiran(absensi),
    keuanganChondro: hitungSaldo(getKeuanganChondro()),
    keuanganMedia: hitungSaldo(getKeuanganMedia())
  };
}

// ============================================================
// ANGGOTA
// ============================================================

function getAnggota() {
  var cfg = getSheetConfig("ANGGOTA");
  var sheet = getOrCreateSheet(cfg);
  ensureAnggotaStructure(sheet);
  return readRows(cfg);
}

function normalizeStatusAnggota(status) {
  var s = String(status || "").trim().toLowerCase();
  if (s === "cuti" || s === "leave") return "Cuti";
  if (
    s === "tidak aktif" ||
    s === "tidakaktif" ||
    s === "tidak_aktif" ||
    s === "nonaktif" ||
    s === "non-aktif" ||
    s === "non_aktif" ||
    s === "inactive"
  ) {
    return "Tidak Aktif";
  }
  return "Aktif";
}

function validateAnggota(data) {
  if (!data.nama || !String(data.nama).trim()) throw new Error("Nama lengkap wajib diisi.");
  // Otomatis normalisasi status ke salah satu dari ['Aktif', 'Cuti', 'Tidak Aktif']
  data.status = normalizeStatusAnggota(data.status);
  if (!data.tanggalBergabung || !String(data.tanggalBergabung).trim()) {
    data.tanggalBergabung = formatDate(new Date());
  }
}

function addAnggota(data) {
  validateAnggota(data);
  var cfg = getSheetConfig("ANGGOTA");
  var sheet = getOrCreateSheet(cfg);
  ensureAnggotaStructure(sheet);

  var id = generateId(cfg);
  data.id = id;

  var row = buildRowArray(sheet, cfg, data);
  sheet.appendRow(row);

  return {
    id: id,
    nama: String(data.nama || "").trim(),
    namaPanggilan: String(data.namaPanggilan || "").trim(),
    divisi: String(data.divisi || "").trim(),
    jabatan: String(data.jabatan || "").trim(),
    noHp: String(data.noHp || "").trim(),
    status: String(data.status || "Aktif"),
    tanggalBergabung: String(data.tanggalBergabung || ""),
    keterangan: String(data.keterangan || "").trim(),
    foto: String(data.foto || "").trim(),
    message: "Data berhasil disimpan."
  };
}

function updateAnggota(data) {
  if (!data.id) throw new Error("ID anggota tidak ditemukan.");
  validateAnggota(data);
  var cfg = getSheetConfig("ANGGOTA");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Anggota tidak ditemukan.");

  var sheet = getOrCreateSheet(cfg);
  ensureAnggotaStructure(sheet);

  var row = buildRowArray(sheet, cfg, data);
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

  return {
    id: data.id,
    nama: String(data.nama || "").trim(),
    namaPanggilan: String(data.namaPanggilan || "").trim(),
    divisi: String(data.divisi || "").trim(),
    jabatan: String(data.jabatan || "").trim(),
    noHp: String(data.noHp || "").trim(),
    status: String(data.status || "Aktif"),
    tanggalBergabung: String(data.tanggalBergabung || ""),
    keterangan: String(data.keterangan || "").trim(),
    foto: String(data.foto || "").trim(),
    message: "Data berhasil disimpan."
  };
}

/**
 * Otomatis mendeteksi dan memperbaiki baris data anggota yang bergeser akibat bug versi sebelumnya.
 * Dapat dipanggil via Web App URL (?action=repairDataAnggota) atau langsung dijalankan di Apps Script Editor.
 */
function repairDataAnggota() {
  var cfg = getSheetConfig("ANGGOTA");
  var sheet = getOrCreateSheet(cfg);
  ensureAnggotaStructure(sheet);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { success: true, message: "Sheet kosong atau belum ada data.", fixedCount: 0 };
  }

  var headerMap = getHeaderIndexMap(sheet);
  var namaIdx = resolveColumnIndex(headerMap, "nama", "Nama Lengkap");
  var panggilanIdx = resolveColumnIndex(headerMap, "namapanggilan", "Nama Panggilan");
  var divisiIdx = resolveColumnIndex(headerMap, "divisi", "Divisi");
  var jabatanIdx = resolveColumnIndex(headerMap, "jabatan", "Jabatan");
  var noHpIdx = resolveColumnIndex(headerMap, "nohp", "No. HP");
  var statusIdx = resolveColumnIndex(headerMap, "status", "Status");
  var tglIdx = resolveColumnIndex(headerMap, "tanggalbergabung", "Tanggal Bergabung");
  var ketIdx = resolveColumnIndex(headerMap, "keterangan", "Keterangan");

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var fixedCount = 0;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var valStatus = String(row[statusIdx] || "").trim();
    var valTgl = String(row[tglIdx] || "").trim();

    // Deteksi shift: Jika kolom "Tanggal Bergabung" berisi status ("Aktif", "Cuti", "Tidak Aktif"),
    // dan kolom "Status" berisi no HP, berarti baris ini tergeser satu kolom ke kanan akibat bug appendRow sebelumnya!
    var statusWords = ["Aktif", "Cuti", "Tidak Aktif"];
    var isTglActuallyStatus = statusWords.indexOf(valTgl) !== -1;

    if (isTglActuallyStatus) {
      // Unshift data yang tergeser:
      var shiftedPanggilan = row[divisiIdx];
      var shiftedDivisi = row[jabatanIdx];
      var shiftedJabatan = row[noHpIdx];
      var shiftedNoHp = row[statusIdx];
      var shiftedStatus = row[tglIdx];
      var shiftedTgl = row[ketIdx];

      row[panggilanIdx] = shiftedPanggilan;
      row[divisiIdx] = shiftedDivisi;
      row[jabatanIdx] = shiftedJabatan;
      row[noHpIdx] = shiftedNoHp;
      row[statusIdx] = shiftedStatus;
      row[tglIdx] = shiftedTgl instanceof Date ? formatDate(shiftedTgl) : shiftedTgl;
      if (ketIdx !== -1 && ketIdx < row.length) {
        row[ketIdx] = "";
      }
      fixedCount++;
    }

    // Pastikan nomor HP pada baris tidak kehilangan angka 0 di depan
    if (noHpIdx !== -1 && noHpIdx < row.length) {
      var rawHp = String(row[noHpIdx] || "").trim();
      if (rawHp.startsWith("'")) rawHp = rawHp.slice(1);
      if (/^8\d{6,14}$/.test(rawHp)) {
        row[noHpIdx] = "'0" + rawHp;
        fixedCount++;
      } else if (rawHp.startsWith("0")) {
        row[noHpIdx] = "'" + rawHp;
      }
    }
  }

  if (fixedCount > 0) {
    sheet.getRange(2, 1, values.length, lastCol).setValues(values);
  }

  return {
    success: true,
    message: "Pemeriksaan selesai. Berhasil memperbaiki " + fixedCount + " baris data yang tergeser.",
    fixedCount: fixedCount
  };
}

function deleteAnggota(data) {
  if (!data.id) throw new Error("ID anggota tidak ditemukan.");
  var cfg = getSheetConfig("ANGGOTA");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Anggota tidak ditemukan.");
  var ss = getSpreadsheet();
  ss.getSheetByName(cfg.name).deleteRow(rowIndex);
  return { message: "Data berhasil dihapus." };
}

// ============================================================
// ABSENSI
// ============================================================

function getAbsensi() {
  return readRows(getSheetConfig("ABSENSI"));
}

function validateAbsensi(data) {
  if (!data.idAnggota) throw new Error("Anggota wajib dipilih.");
  if (!data.tanggal) throw new Error("Tanggal wajib diisi.");
  if (!data.kegiatan || !String(data.kegiatan).trim()) throw new Error("Kegiatan wajib diisi.");
  if (!data.status) throw new Error("Status kehadiran wajib dipilih.");
  if (!data.waktu) throw new Error("Waktu absensi wajib dipilih.");
  
  var statusNorm = String(data.status).trim().toLowerCase();
  var validStatus = {
    "hadir": "Hadir",
    "izin": "Izin",
    "sakit": "Sakit",
    "cuti": "Cuti",
    "alpa": "Alpa"
  };
  var matchedStatus = validStatus[statusNorm];
  if (!matchedStatus) {
    throw new Error("Status kehadiran tidak valid: " + data.status);
  }
  data.status = matchedStatus;

  var waktuNorm = String(data.waktu).trim().toLowerCase();
  var validWaktu = {
    "pagi": "Pagi",
    "siang": "Siang",
    "malam": "Malam"
  };
  var matchedWaktu = validWaktu[waktuNorm];
  if (!matchedWaktu) {
    throw new Error("Waktu absensi tidak valid: " + data.waktu);
  }
  data.waktu = matchedWaktu;
}

function addAbsensi(data) {
  validateAbsensi(data);
  var cfg = getSheetConfig("ABSENSI");
  var id = generateId(cfg);
  var nama = getNamaAnggota(data.idAnggota);
  var sheet = getOrCreateSheet(cfg);
  var row = [
    id,
    String(data.idAnggota),
    nama,
    String(data.tanggal || ""),
    String(data.kegiatan || "").trim(),
    String(data.status || "Hadir"),
    String(data.keterangan || "").trim(),
    String(data.waktu || "")
  ];
  sheet.appendRow(row);
  return {
    id: id,
    idAnggota: row[1],
    nama: nama,
    tanggal: row[3],
    kegiatan: row[4],
    status: row[5],
    keterangan: row[6],
    waktu: row[7],
    message: "Data berhasil disimpan."
  };
}

function updateAbsensi(data) {
  if (!data.id) throw new Error("ID absensi tidak ditemukan.");
  validateAbsensi(data);
  var cfg = getSheetConfig("ABSENSI");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Absensi tidak ditemukan.");
  var nama = getNamaAnggota(data.idAnggota);
  var sheet = getOrCreateSheet(cfg);
  var row = [
    data.id,
    String(data.idAnggota),
    nama,
    String(data.tanggal || ""),
    String(data.kegiatan || "").trim(),
    String(data.status || "Hadir"),
    String(data.keterangan || "").trim(),
    String(data.waktu || "")
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: data.id,
    idAnggota: row[1],
    nama: nama,
    tanggal: row[3],
    kegiatan: row[4],
    status: row[5],
    keterangan: row[6],
    waktu: row[7],
    message: "Data berhasil disimpan."
  };
}

function deleteAbsensi(data) {
  if (!data.id) throw new Error("ID absensi tidak ditemukan.");
  var cfg = getSheetConfig("ABSENSI");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Absensi tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  sheet.deleteRow(rowIndex);
  return { message: "Data berhasil dihapus." };
}

/**
 * Simpan banyak catatan absensi dalam SATU request (realtime).
 * Semua baris ditulis sekaligus dengan satu setValues, bukan appendRow per anggota.
 */
function saveAbsensiBatch(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Data absensi kosong.");
  var cfg = getSheetConfig("ABSENSI");
  var sheet = getOrCreateSheet(cfg);

  // Peta nama anggota dibaca sekali saja (bukan per baris).
  var namaByAnggota = {};
  var daftarAnggota = readRows(getSheetConfig("ANGGOTA"));
  for (var i = 0; i < daftarAnggota.length; i++) {
    namaByAnggota[String(daftarAnggota[i].id)] = daftarAnggota[i].nama;
  }

  // Nomor ID terakhir dihitung sekali, lalu dinaikkan berurutan.
  var lastRow = sheet.getLastRow();
  var maxNum = 0;
  if (lastRow >= 1) {
    var ids = sheet.getRange(1, cfg.idCol + 1, lastRow, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var s = String(ids[i][0]);
      var m = s.match(/(\d+)$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }

  var rows = [];
  var hasil = [];
  for (var i = 0; i < items.length; i++) {
    var data = items[i];
    validateAbsensi(data);
    var id = cfg.idPrefix + String(++maxNum).padStart(3, "0");
    var idAnggota = String(data.idAnggota);
    var nama = namaByAnggota[idAnggota] || "";
    var tanggal = String(data.tanggal || "");
    var kegiatan = String(data.kegiatan || "").trim();
    var status = String(data.status || "Hadir");
    var keterangan = String(data.keterangan || "").trim();
    var waktu = String(data.waktu || "");
    rows.push([id, idAnggota, nama, tanggal, kegiatan, status, keterangan, waktu]);
    hasil.push({
      id: id,
      idAnggota: idAnggota,
      nama: nama,
      tanggal: tanggal,
      kegiatan: kegiatan,
      status: status,
      keterangan: keterangan,
      waktu: waktu,
      message: "Data berhasil disimpan."
    });
  }

  var startRow = Math.max(lastRow + 1, 2);
  sheet.getRange(startRow, 1, rows.length, cfg.keys.length).setValues(rows);
  return hasil;
}

/** Perbarui banyak catatan absensi dalam SATU request, dengan satu setValues. */
function updateAbsensiBatch(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Data absensi kosong.");
  var cfg = getSheetConfig("ABSENSI");
  var sheet = getOrCreateSheet(cfg);
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error("Tidak ada data absensi.");

  var namaByAnggota = {};
  var daftarAnggota = readRows(getSheetConfig("ANGGOTA"));
  for (var i = 0; i < daftarAnggota.length; i++) {
    namaByAnggota[String(daftarAnggota[i].id)] = daftarAnggota[i].nama;
  }

  // Baca seluruh sheet sekali, lalu ubah hanya baris yang cocok.
  var dataAll = sheet.getRange(1, 1, lastRow, cfg.keys.length).getValues();
  var indexById = {};
  for (var r = 0; r < dataAll.length; r++) {
    var idCell = String(dataAll[r][cfg.idCol]);
    if (idCell !== "") indexById[idCell] = r;
  }

  var hasil = [];
  for (var i = 0; i < items.length; i++) {
    var data = items[i];
    if (!data.id) throw new Error("ID absensi tidak ditemukan.");
    validateAbsensi(data);
    var key = String(data.id);
    if (indexById[key] === undefined) throw new Error("Absensi tidak ditemukan.");
    var idAnggota = String(data.idAnggota);
    var nama = namaByAnggota[idAnggota] || "";
    var tanggal = String(data.tanggal || "");
    var kegiatan = String(data.kegiatan || "").trim();
    var status = String(data.status || "Hadir");
    var keterangan = String(data.keterangan || "").trim();
    var waktu = String(data.waktu || "");
    dataAll[indexById[key]] = [key, idAnggota, nama, tanggal, kegiatan, status, keterangan, waktu];
    hasil.push({
      id: key,
      idAnggota: idAnggota,
      nama: nama,
      tanggal: tanggal,
      kegiatan: kegiatan,
      status: status,
      keterangan: keterangan,
      waktu: waktu,
      message: "Data berhasil disimpan."
    });
  }

  sheet.getRange(1, 1, lastRow, cfg.keys.length).setValues(dataAll);
  return hasil;
}

/** Hapus banyak catatan absensi dalam SATU request (per sesi). */
function deleteAbsensiBatch(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error("Data absensi kosong.");
  var cfg = getSheetConfig("ABSENSI");
  var sheet = getOrCreateSheet(cfg);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { message: "Sheet kosong.", jumlah: 0 };

  var targetSet = {};
  for (var k = 0; k < ids.length; k++) {
    var rawId = String(ids[k] || "").trim().toLowerCase();
    if (rawId) targetSet[rawId] = true;
  }

  var headerMap = getHeaderIndexMap(sheet);
  var idColIdx = headerMap["id"] !== undefined ? headerMap["id"] : (headerMap["id absensi"] !== undefined ? headerMap["id absensi"] : 0);

  var allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var keepRows = [];
  var deletedCount = 0;

  for (var r = 0; r < allRows.length; r++) {
    var rowId = String(allRows[r][idColIdx] || "").trim().toLowerCase();
    if (targetSet[rowId]) {
      deletedCount++;
    } else {
      keepRows.push(allRows[r]);
    }
  }

  sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  if (keepRows.length > 0) {
    sheet.getRange(2, 1, keepRows.length, lastCol).setValues(keepRows);
  }

  return { message: "Data berhasil dihapus.", jumlah: deletedCount };
}

// ============================================================
// KEUANGAN (dipakai untuk Chondro & Media)
// ============================================================

function getKeuangan(sheetKey) {
  return readRows(getSheetConfig(sheetKey));
}

function validateKeuangan(data) {
  if (!data.tanggal) throw new Error("Tanggal wajib diisi.");
  if (!data.jenis) throw new Error("Jenis transaksi wajib dipilih.");
  var jenis = String(data.jenis);
  if (["Pemasukan", "Pengeluaran"].indexOf(jenis) === -1) {
    throw new Error("Jenis transaksi tidak valid.");
  }
  var nominal = Number(data.nominal);
  if (isNaN(nominal)) throw new Error("Nominal harus berupa angka.");
  if (nominal < 0) throw new Error("Nominal tidak boleh negatif.");
}

function addKeuangan(sheetKey, data) {
  validateKeuangan(data);
  var cfg = getSheetConfig(sheetKey);
  var id = generateId(cfg);
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var row = [
    id,
    String(data.tanggal || ""),
    String(data.jenis || ""),
    String(data.kategori || "").trim(),
    String(data.keterangan || "").trim(),
    Number(data.nominal) || 0,
    String(data.penanggungJawab || "").trim()
  ];
  sheet.appendRow(row);
  return {
    id: id,
    tanggal: row[1],
    jenis: row[2],
    kategori: row[3],
    keterangan: row[4],
    nominal: row[5],
    penanggungJawab: row[6],
    message: "Data berhasil disimpan."
  };
}

function updateKeuangan(sheetKey, data) {
  if (!data.id) throw new Error("ID transaksi tidak ditemukan.");
  validateKeuangan(data);
  var cfg = getSheetConfig(sheetKey);
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Transaksi tidak ditemukan.");
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var row = [
    data.id,
    String(data.tanggal || ""),
    String(data.jenis || ""),
    String(data.kategori || "").trim(),
    String(data.keterangan || "").trim(),
    Number(data.nominal) || 0,
    String(data.penanggungJawab || "").trim()
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: data.id,
    tanggal: row[1],
    jenis: row[2],
    kategori: row[3],
    keterangan: row[4],
    nominal: row[5],
    penanggungJawab: row[6],
    message: "Data berhasil disimpan."
  };
}

function deleteKeuangan(sheetKey, data) {
  if (!data.id) throw new Error("ID transaksi tidak ditemukan.");
  var cfg = getSheetConfig(sheetKey);
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Transaksi tidak ditemukan.");
  var ss = getSpreadsheet();
  ss.getSheetByName(cfg.name).deleteRow(rowIndex);
  return { message: "Data berhasil dihapus." };
}

// Wrapper sesuai nama action
function getKeuanganChondro() { return getKeuangan("KEUANGAN_CHONDRO"); }
function addKeuanganChondro(data) { return addKeuangan("KEUANGAN_CHONDRO", data); }
function updateKeuanganChondro(data) { return updateKeuangan("KEUANGAN_CHONDRO", data); }
function deleteKeuanganChondro(data) { return deleteKeuangan("KEUANGAN_CHONDRO", data); }

function getKeuanganMedia() { return getKeuangan("KEUANGAN_MEDIA"); }
function addKeuanganMedia(data) { return addKeuangan("KEUANGAN_MEDIA", data); }
function updateKeuanganMedia(data) { return updateKeuangan("KEUANGAN_MEDIA", data); }
function deleteKeuanganMedia(data) { return deleteKeuangan("KEUANGAN_MEDIA", data); }

// ============================================================
// TRANSAKSI GROUP & DETAIL
// ============================================================

function getTransaksiGroup() {
  var groups = readRows(getSheetConfig("TRANSAKSI_GROUP"));
  var details = readRows(getSheetConfig("TRANSAKSI_DETAIL"));

  var statsByGroupId = {};
  for (var i = 0; i < details.length; i++) {
    var d = details[i];
    var gid = String(d.transaksiGroupId);
    if (!statsByGroupId[gid]) {
      statsByGroupId[gid] = { count: 0, pemasukan: 0, pengeluaran: 0 };
    }
    var nom = Number(d.nominal) || 0;
    statsByGroupId[gid].count++;
    if (d.jenis === "Pemasukan") {
      statsByGroupId[gid].pemasukan += nom;
    } else {
      statsByGroupId[gid].pengeluaran += nom;
    }
  }

  for (var j = 0; j < groups.length; j++) {
    var g = groups[j];
    var st = statsByGroupId[String(g.id)] || { count: 0, pemasukan: 0, pengeluaran: 0 };
    g.totalTransaksi = st.count;
    g.totalPemasukan = st.pemasukan;
    g.totalPengeluaran = st.pengeluaran;
    g.saldo = st.pemasukan - st.pengeluaran;
  }
  return groups;
}

function addTransaksiGroup(data) {
  if (!data.judul || !String(data.judul).trim()) throw new Error("Judul transaksi wajib diisi.");
  var cfg = getSheetConfig("TRANSAKSI_GROUP");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var sheet = getOrCreateSheet(cfg);
  var row = [
    id,
    String(data.judul || "").trim(),
    String(data.tanggal || formatDate(new Date())),
    String(data.keterangan || "").trim(),
    now,
    now
  ];
  sheet.appendRow(row);
  return {
    id: id,
    judul: row[1],
    tanggal: row[2],
    keterangan: row[3],
    createdAt: row[4],
    updatedAt: row[5],
    totalTransaksi: 0,
    totalPemasukan: 0,
    totalPengeluaran: 0,
    saldo: 0,
    message: "Data berhasil disimpan."
  };
}

function updateTransaksiGroup(data) {
  if (!data.id) throw new Error("ID transaksi group tidak ditemukan.");
  if (!data.judul || !String(data.judul).trim()) throw new Error("Judul transaksi wajib diisi.");
  var cfg = getSheetConfig("TRANSAKSI_GROUP");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Transaksi group tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  var existingRow = sheet.getRange(rowIndex, 1, 1, cfg.keys.length).getValues()[0];
  var createdAt = existingRow[4] || new Date().toISOString();
  var now = new Date().toISOString();
  var row = [
    data.id,
    String(data.judul || "").trim(),
    String(data.tanggal || existingRow[2] || ""),
    String(data.keterangan || "").trim(),
    createdAt,
    now
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: data.id,
    judul: row[1],
    tanggal: row[2],
    keterangan: row[3],
    createdAt: row[4],
    updatedAt: row[5],
    message: "Data berhasil disimpan."
  };
}

function deleteTransaksiGroup(data) {
  if (!data.id) throw new Error("ID transaksi group tidak ditemukan.");
  var cfg = getSheetConfig("TRANSAKSI_GROUP");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Transaksi group tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  sheet.deleteRow(rowIndex);

  // Hapus semua detail yang terkait
  var detailCfg = getSheetConfig("TRANSAKSI_DETAIL");
  var detailSheet = getOrCreateSheet(detailCfg);
  var lastRow = detailSheet.getLastRow();
  if (lastRow > 1) {
    var detailRows = detailSheet.getRange(2, 1, lastRow - 1, detailCfg.keys.length).getValues();
    for (var r = detailRows.length - 1; r >= 0; r--) {
      if (String(detailRows[r][1]) === String(data.id)) {
        detailSheet.deleteRow(r + 2);
      }
    }
  }
  return { message: "Data berhasil dihapus." };
}

// ---------------- TRANSAKSI DETAIL ----------------

function getTransaksiDetail(transaksiGroupId) {
  var rows = readRows(getSheetConfig("TRANSAKSI_DETAIL"));
  if (!transaksiGroupId) return rows;
  return rows.filter(function (r) {
    return String(r.transaksiGroupId) === String(transaksiGroupId);
  });
}

function validateTransaksiDetail(data) {
  if (!data.transaksiGroupId) throw new Error("ID group transaksi wajib diisi.");
  if (!data.tanggal) throw new Error("Tanggal wajib diisi.");
  if (!data.jenis) throw new Error("Jenis transaksi wajib dipilih.");
  var jenis = String(data.jenis);
  if (["Pemasukan", "Pengeluaran"].indexOf(jenis) === -1) {
    throw new Error("Jenis transaksi tidak valid.");
  }
  var nominal = Number(data.nominal);
  if (isNaN(nominal)) throw new Error("Nominal harus berupa angka.");
  if (nominal < 0) throw new Error("Nominal tidak boleh negatif.");
}

function addTransaksiDetail(data) {
  validateTransaksiDetail(data);
  var cfg = getSheetConfig("TRANSAKSI_DETAIL");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var sheet = getOrCreateSheet(cfg);
  var row = [
    id,
    String(data.transaksiGroupId),
    String(data.tanggal || ""),
    String(data.jenis || ""),
    String(data.kategori || "").trim(),
    Number(data.nominal) || 0,
    String(data.keterangan || "").trim(),
    now,
    now
  ];
  sheet.appendRow(row);
  return {
    id: id,
    transaksiGroupId: row[1],
    tanggal: row[2],
    jenis: row[3],
    kategori: row[4],
    nominal: row[5],
    keterangan: row[6],
    createdAt: row[7],
    updatedAt: row[8],
    message: "Data berhasil disimpan."
  };
}

function updateTransaksiDetail(data) {
  if (!data.id) throw new Error("ID detail transaksi tidak ditemukan.");
  validateTransaksiDetail(data);
  var cfg = getSheetConfig("TRANSAKSI_DETAIL");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Detail transaksi tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  var existingRow = sheet.getRange(rowIndex, 1, 1, cfg.keys.length).getValues()[0];
  var createdAt = existingRow[7] || new Date().toISOString();
  var now = new Date().toISOString();
  var row = [
    data.id,
    String(data.transaksiGroupId || existingRow[1]),
    String(data.tanggal || ""),
    String(data.jenis || ""),
    String(data.kategori || "").trim(),
    Number(data.nominal) || 0,
    String(data.keterangan || "").trim(),
    createdAt,
    now
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: data.id,
    transaksiGroupId: row[1],
    tanggal: row[2],
    jenis: row[3],
    kategori: row[4],
    nominal: row[5],
    keterangan: row[6],
    createdAt: row[7],
    updatedAt: row[8],
    message: "Data berhasil disimpan."
  };
}

function deleteTransaksiDetail(data) {
  if (!data.id) throw new Error("ID detail transaksi tidak ditemukan.");
  var cfg = getSheetConfig("TRANSAKSI_DETAIL");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Detail transaksi tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);
  sheet.deleteRow(rowIndex);
  return { message: "Data berhasil dihapus." };
}

// ============================================================
// REKRUITMEN (FORM, FIELDS, SUBMISSIONS, ANSWERS)
// ============================================================

function getRekrutmenForm() {
  var rows = readRows(getSheetConfig("REKRUITMEN_FORM"));
  if (rows.length === 0) {
    return null;
  }
  return rows[rows.length - 1];
}

function addRekrutmenForm(data) {
  if (!data.title || !String(data.title).trim()) throw new Error("Judul formulir wajib diisi.");
  var cfg = getSheetConfig("REKRUITMEN_FORM");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var row = [
    id,
    String(data.title || "").trim(),
    String(data.description || "").trim(),
    String(data.status || "dibuka"),
    now,
    now
  ];
  sheet.appendRow(row);
  return {
    id: id,
    title: row[1],
    description: row[2],
    status: row[3],
    createdAt: row[4],
    updatedAt: row[5],
    message: "Formulir berhasil dibuat."
  };
}

function updateRekrutmenForm(data) {
  if (!data.id) throw new Error("ID formulir tidak ditemukan.");
  if (!data.title || !String(data.title).trim()) throw new Error("Judul formulir wajib diisi.");
  var cfg = getSheetConfig("REKRUITMEN_FORM");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Formulir tidak ditemukan.");
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var existingRow = sheet.getRange(rowIndex, 1, 1, cfg.keys.length).getValues()[0];
  var createdAt = existingRow[4] || new Date().toISOString();
  var now = new Date().toISOString();
  var row = [
    data.id,
    String(data.title || "").trim(),
    String(data.description || "").trim(),
    String(data.status || existingRow[3] || "dibuka"),
    createdAt,
    now
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: data.id,
    title: row[1],
    description: row[2],
    status: row[3],
    createdAt: row[4],
    updatedAt: row[5],
    message: "Formulir berhasil diperbarui."
  };
}

function deleteRekrutmenForm(data) {
  if (!data.id) throw new Error("ID formulir tidak ditemukan.");
  var cfg = getSheetConfig("REKRUITMEN_FORM");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Formulir tidak ditemukan.");
  var ss = getSpreadsheet();
  ss.getSheetByName(cfg.name).deleteRow(rowIndex);

  // Hapus semua fields terkait
  var fldCfg = getSheetConfig("REKRUITMEN_FIELDS");
  var fldSheet = ss.getSheetByName(fldCfg.name);
  var fldLast = fldSheet.getLastRow();
  if (fldLast > 1) {
    var fldRows = fldSheet.getRange(2, 1, fldLast - 1, fldCfg.keys.length).getValues();
    for (var r = fldRows.length - 1; r >= 0; r--) {
      if (String(fldRows[r][1]) === String(data.id)) {
        fldSheet.deleteRow(r + 2);
      }
    }
  }

  // Hapus submissions dan answers terkait
  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var subSheet = ss.getSheetByName(subCfg.name);
  var subLast = subSheet.getLastRow();
  var deletedSubIds = {};
  if (subLast > 1) {
    var subRows = subSheet.getRange(2, 1, subLast - 1, subCfg.keys.length).getValues();
    for (var s = subRows.length - 1; s >= 0; s--) {
      if (String(subRows[s][1]) === String(data.id)) {
        deletedSubIds[String(subRows[s][0])] = true;
        subSheet.deleteRow(s + 2);
      }
    }
  }

  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var ansSheet = ss.getSheetByName(ansCfg.name);
  var ansLast = ansSheet.getLastRow();
  if (ansLast > 1) {
    var ansRows = ansSheet.getRange(2, 1, ansLast - 1, ansCfg.keys.length).getValues();
    for (var a = ansRows.length - 1; a >= 0; a--) {
      if (deletedSubIds[String(ansRows[a][1])]) {
        ansSheet.deleteRow(a + 2);
      }
    }
  }

  return { message: "Formulir berhasil dihapus." };
}

// ---------------- REKRUITMEN FIELDS ----------------

function getRekrutmenFields(formId) {
  var rows = readRows(getSheetConfig("REKRUITMEN_FIELDS"));
  var filtered = rows;
  if (formId) {
    filtered = rows.filter(function (f) {
      return String(f.formId) === String(formId);
    });
  }
  filtered.sort(function (a, b) {
    return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  });
  return filtered;
}

function addRekrutmenField(data) {
  if (!data.formId) throw new Error("ID formulir wajib diisi.");
  if (!data.label || !String(data.label).trim()) throw new Error("Label pertanyaan wajib diisi.");
  var cfg = getSheetConfig("REKRUITMEN_FIELDS");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var sheet = getOrCreateSheet(cfg);

  var sortOrder = data.sortOrder;
  if (sortOrder === undefined || sortOrder === null) {
    var currentFields = getRekrutmenFields(data.formId);
    sortOrder = currentFields.length;
  }

  var isUpload = data.fieldType === "image" || data.fieldType === "file";
  var exampleImageUrl = String(data.exampleImageUrl || "").trim();
  if (exampleImageUrl.length > 48000) {
    exampleImageUrl = exampleImageUrl.substring(0, 48000);
  }
  var exampleImageTitle = String(data.exampleImageTitle || "").trim();
  var maxFileSize = isUpload ? (Number(data.maxFileSize) || (data.fieldType === "image" ? 2 : 5)) : 0;

  var fieldObj = {
    id: id,
    formId: String(data.formId),
    label: String(data.label || "").trim(),
    description: String(data.description || "").trim(),
    fieldType: String(data.fieldType || "text"),
    required: Boolean(data.required),
    options: typeof data.options === "string" ? data.options : JSON.stringify(data.options || []),
    sortOrder: Number(sortOrder) || 0,
    placeholder: String(data.placeholder || "").trim(),
    exampleImageUrl: exampleImageUrl,
    exampleImageTitle: exampleImageTitle,
    maxFileSize: maxFileSize,
    allowedFileTypes: typeof data.allowedFileTypes === "string" ? data.allowedFileTypes : JSON.stringify(data.allowedFileTypes || []),
    createdAt: now,
    updatedAt: now
  };

  var row = buildRowArray(sheet, cfg, fieldObj);
  sheet.appendRow(row);

  fieldObj.message = "Pertanyaan berhasil ditambahkan.";
  return fieldObj;
}

function updateRekrutmenField(data) {
  if (!data.id) throw new Error("ID pertanyaan tidak ditemukan.");
  var cfg = getSheetConfig("REKRUITMEN_FIELDS");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Pertanyaan tidak ditemukan.");
  var sheet = getOrCreateSheet(cfg);

  var allExisting = readRows(cfg);
  var existing = null;
  for (var i = 0; i < allExisting.length; i++) {
    if (String(allExisting[i].id) === String(data.id)) {
      existing = allExisting[i];
      break;
    }
  }
  var createdAt = (existing && existing.createdAt) || new Date().toISOString();
  var now = new Date().toISOString();

  var fType = data.fieldType || (existing && existing.fieldType) || "text";
  var isUpload = fType === "image" || fType === "file";
  var exampleImageUrl = data.exampleImageUrl !== undefined ? String(data.exampleImageUrl).trim() : (existing && existing.exampleImageUrl ? String(existing.exampleImageUrl).trim() : "");
  if (exampleImageUrl.length > 48000) {
    exampleImageUrl = exampleImageUrl.substring(0, 48000);
  }
  var exampleImageTitle = data.exampleImageTitle !== undefined ? String(data.exampleImageTitle).trim() : (existing && existing.exampleImageTitle ? String(existing.exampleImageTitle).trim() : "");
  var maxFileSize = isUpload ? (data.maxFileSize !== undefined ? Number(data.maxFileSize) : (existing && existing.maxFileSize ? Number(existing.maxFileSize) : 2)) : 0;

  var fieldObj = {
    id: data.id,
    formId: String(data.formId || (existing && existing.formId) || ""),
    label: String(data.label !== undefined ? data.label : (existing && existing.label) || "").trim(),
    description: String(data.description !== undefined ? data.description : (existing && existing.description) || "").trim(),
    fieldType: String(fType),
    required: data.required !== undefined ? Boolean(data.required) : Boolean(existing && existing.required),
    options: data.options !== undefined ? (typeof data.options === "string" ? data.options : JSON.stringify(data.options)) : (existing && existing.options ? (typeof existing.options === "string" ? existing.options : JSON.stringify(existing.options)) : "[]"),
    sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : Number((existing && existing.sortOrder) || 0),
    placeholder: data.placeholder !== undefined ? String(data.placeholder).trim() : String((existing && existing.placeholder) || ""),
    exampleImageUrl: exampleImageUrl,
    exampleImageTitle: exampleImageTitle,
    maxFileSize: maxFileSize,
    allowedFileTypes: data.allowedFileTypes !== undefined ? (typeof data.allowedFileTypes === "string" ? data.allowedFileTypes : JSON.stringify(data.allowedFileTypes)) : (existing && existing.allowedFileTypes ? (typeof existing.allowedFileTypes === "string" ? existing.allowedFileTypes : JSON.stringify(existing.allowedFileTypes)) : "[]"),
    createdAt: createdAt,
    updatedAt: now
  };

  var row = buildRowArray(sheet, cfg, fieldObj);
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

  fieldObj.message = "Pertanyaan berhasil diperbarui.";
  return fieldObj;
}

function deleteRekrutmenField(data) {
  if (!data.id) throw new Error("ID pertanyaan tidak ditemukan.");
  var cfg = getSheetConfig("REKRUITMEN_FIELDS");
  var rowIndex = findRowIndex(cfg, data.id);
  if (rowIndex === -1) throw new Error("Pertanyaan tidak ditemukan.");
  var ss = getSpreadsheet();
  ss.getSheetByName(cfg.name).deleteRow(rowIndex);
  return { message: "Pertanyaan berhasil dihapus." };
}

function reorderRekrutmenFields(formId, fieldOrders) {
  if (!Array.isArray(fieldOrders) || fieldOrders.length === 0) {
    return { message: "Tidak ada data urutan." };
  }
  var cfg = getSheetConfig("REKRUITMEN_FIELDS");
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { message: "Sheet kosong." };

  var headerMap = getHeaderIndexMap(sheet);
  var sortOrderColIdx = headerMap["sortorder"] !== undefined ? headerMap["sortorder"] : 7;
  var updatedAtColIdx = headerMap["updatedat"] !== undefined ? headerMap["updatedat"] : (lastCol - 1);
  var idColIdx = headerMap["id"] !== undefined ? headerMap["id"] : 0;

  var orderMap = {};
  for (var i = 0; i < fieldOrders.length; i++) {
    orderMap[String(fieldOrders[i].id)] = Number(fieldOrders[i].sortOrder);
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var r = 0; r < rows.length; r++) {
    var id = String(rows[r][idColIdx]);
    if (orderMap[id] !== undefined) {
      rows[r][sortOrderColIdx] = orderMap[id];
      if (updatedAtColIdx >= 0 && updatedAtColIdx < lastCol) {
        rows[r][updatedAtColIdx] = new Date().toISOString();
      }
    }
  }

  sheet.getRange(2, 1, lastRow - 1, lastCol).setValues(rows);
  return { message: "Urutan berhasil diperbarui." };
}

function uploadRekrutmenImage(data) {
  if (!data || !data.base64) throw new Error("Data gambar wajib dikirim.");
  var rawBase64 = String(data.base64);
  var mimeType = "image/jpeg";
  var fileName = data.fileName || ("panduan_" + new Date().getTime() + ".jpg");

  if (rawBase64.indexOf("data:") === 0) {
    var parts = rawBase64.split(",");
    var match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
    rawBase64 = parts[1];
  }

  var bytes = Utilities.base64Decode(rawBase64);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);

  var folderName = "mbc sistem Rekrutmen Assets";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();

  var directUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600";

  return {
    fileId: fileId,
    url: directUrl,
    name: fileName,
    message: "Foto berhasil diunggah ke Google Drive dengan kualitas penuh."
  };
}

// ---------------- REKRUITMEN SUBMISSIONS & ANSWERS ----------------

/**
 * Otomatis mengonversi URL Google Drive / berkas foto lama menjadi Base64 Data URL
 * agar selalu tampil 100% jernih dan tidak terblokir izin Google Drive di browser.
 */
function resolveCandidateAnswerPhoto(ans) {
  if (!ans) return ans;
  var fileUrl = String(ans.fileUrl || "");
  var valueStr = String(ans.value || "");
  var fileName = String(ans.fileName || "");

  // 1. Jika sudah berupa Data URL Base64 yang valid
  if (fileUrl.indexOf("data:image/") === 0 && fileUrl.length > 500) {
    return ans;
  }
  if (valueStr.indexOf("data:image/") === 0 && valueStr.length > 500) {
    ans.fileUrl = valueStr;
    return ans;
  }

  // 2. Jika fileUrl adalah HTTP URL (misal Google Drive thumbnail/lh3)
  if (fileUrl.indexOf("http") === 0) {
    return ans;
  }
  if (valueStr.indexOf("http") === 0) {
    ans.fileUrl = valueStr;
    return ans;
  }

  return ans;
}

function getRekrutmenImageBase64(data) {
  if (!data) throw new Error("Data permintaan gambar tidak lengkap.");
  var fileId = data.fileId || "";
  var fileName = data.fileName || "";

  if (fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      if (file) {
        var blob = file.getBlob();
        return {
          success: true,
          base64: "data:" + (blob.getContentType() || "image/jpeg") + ";base64," + Utilities.base64Encode(blob.getBytes()),
          name: file.getName()
        };
      }
    } catch (e) {}
  }

  var nameCandidates = [];
  if (fileName) nameCandidates.push(fileName);

  for (var n = 0; n < nameCandidates.length; n++) {
    var targetName = nameCandidates[n];
    try {
      var folders = DriveApp.getFoldersByName("mbc sistem Berkas Pendaftar");
      while (folders.hasNext()) {
        var folder = folders.next();
        var files = folder.getFilesByName(targetName);
        if (files.hasNext()) {
          var targetFile = files.next();
          var blob2 = targetFile.getBlob();
          return {
            success: true,
            base64: "data:" + (blob2.getContentType() || "image/jpeg") + ";base64," + Utilities.base64Encode(blob2.getBytes()),
            name: targetFile.getName()
          };
        }
      }

      var globalFiles = DriveApp.getFilesByName(targetName);
      if (globalFiles.hasNext()) {
        var gFile = globalFiles.next();
        var gBlob = gFile.getBlob();
        return {
          success: true,
          base64: "data:" + (gBlob.getContentType() || "image/jpeg") + ";base64," + Utilities.base64Encode(gBlob.getBytes()),
          name: gFile.getName()
        };
      }
    } catch (e2) {}
  }

  return { success: false, message: "File gambar tidak ditemukan di Google Drive." };
}

function getRekrutmenSubmissions(formId) {
  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var allSubs = readRows(subCfg);
  var subs = allSubs;
  if (formId) {
    subs = allSubs.filter(function (s) {
      return String(s.formId) === String(formId);
    });
  }

  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var allAnswers = readRows(ansCfg);
  var fldCfg = getSheetConfig("REKRUITMEN_FIELDS");
  var allFields = readRows(fldCfg);
  var fieldMap = {};
  for (var f = 0; f < allFields.length; f++) {
    fieldMap[String(allFields[f].id)] = allFields[f];
  }

  var answersBySubId = {};
  for (var a = 0; a < allAnswers.length; a++) {
    var ans = allAnswers[a];
    var sid = String(ans.submissionId);
    if (!answersBySubId[sid]) answersBySubId[sid] = [];
    var fieldObj = fieldMap[String(ans.fieldId)] || { id: ans.fieldId, label: "", fieldType: "text" };
    ans.field = fieldObj;
    ans = resolveCandidateAnswerPhoto(ans);
    answersBySubId[sid].push(ans);
  }

  for (var s = 0; s < subs.length; s++) {
    subs[s].answers = answersBySubId[String(subs[s].id)] || [];
  }
  return subs;
}

function getRekrutmenSubmissionDetail(submissionId) {
  if (!submissionId) throw new Error("ID pendaftaran tidak ditemukan.");
  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var subs = readRows(subCfg);
  var sub = null;
  for (var i = 0; i < subs.length; i++) {
    if (String(subs[i].id) === String(submissionId)) {
      sub = subs[i];
      break;
    }
  }
  if (!sub) throw new Error("Data pendaftaran tidak ditemukan.");

  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var answers = readRows(ansCfg).filter(function (a) {
    return String(a.submissionId) === String(submissionId);
  });

  var fldCfg = getSheetConfig("REKRUITMEN_FIELDS");
  var fields = readRows(fldCfg);
  var fieldMap = {};
  for (var f = 0; f < fields.length; f++) {
    fieldMap[String(fields[f].id)] = fields[f];
  }

  for (var j = 0; j < answers.length; j++) {
    answers[j].field = fieldMap[String(answers[j].fieldId)] || { id: answers[j].fieldId, label: "", fieldType: "text" };
    answers[j] = resolveCandidateAnswerPhoto(answers[j]);
  }
  sub.answers = answers;
  return sub;
}

function getRekrutmenAnswers(submissionId) {
  if (!submissionId) return [];
  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var allAnswers = readRows(ansCfg);
  var fldCfg = getSheetConfig("REKRUITMEN_FIELDS");
  var allFields = readRows(fldCfg);
  var fieldMap = {};
  for (var f = 0; f < allFields.length; f++) {
    fieldMap[String(allFields[f].id)] = allFields[f];
  }

  var filtered = allAnswers.filter(function (a) {
    return String(a.submissionId) === String(submissionId);
  });
  for (var i = 0; i < filtered.length; i++) {
    filtered[i].field = fieldMap[String(filtered[i].fieldId)] || { id: filtered[i].fieldId, label: "", fieldType: "text" };
    filtered[i] = resolveCandidateAnswerPhoto(filtered[i]);
  }
  return filtered;
}

function updateRekrutmenAnswerPhoto(data) {
  if (!data || !data.answerId) throw new Error("ID Jawaban tidak ditemukan.");
  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var rowIdx = findRowIndex(ansCfg, data.answerId);
  if (rowIdx < 0) throw new Error("Data jawaban pendaftar tidak ditemukan.");

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(ansCfg.name);
  var headerMap = getHeaderIndexMap(sheet);

  var fileUrl = String(data.fileUrl || data.fileBase64 || "");
  var fileName = String(data.fileName || "foto_calon.jpg");

  if (headerMap["fileurl"] !== undefined) {
    sheet.getRange(rowIdx, headerMap["fileurl"] + 1).setValue(fileUrl);
  }
  if (headerMap["filename"] !== undefined) {
    sheet.getRange(rowIdx, headerMap["filename"] + 1).setValue(fileName);
  }
  if (headerMap["value"] !== undefined) {
    sheet.getRange(rowIdx, headerMap["value"] + 1).setValue(fileName);
  }

  return { success: true, answerId: data.answerId, fileUrl: fileUrl, fileName: fileName };
}

function addRekrutmenSubmission(data) {
  if (!data.formId) throw new Error("ID formulir wajib diisi.");

  // Validasi status formulir aktif / tidak aktif
  var formCfg = getSheetConfig("REKRUITMEN_FORM");
  var forms = readRows(formCfg);
  var targetForm = null;
  for (var f = 0; f < forms.length; f++) {
    if (String(forms[f].id) === String(data.formId)) {
      targetForm = forms[f];
      break;
    }
  }
  if (!targetForm && forms.length > 0) {
    targetForm = forms[forms.length - 1];
  }
  if (targetForm && String(targetForm.status).toLowerCase() !== "dibuka") {
    throw new Error("Formulir pendaftaran saat ini sedang tidak aktif atau ditutup. Pendaftaran baru tidak dapat diproses.");
  }

  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var subId = generateId(subCfg);
  var now = new Date().toISOString();
  var ss = getSpreadsheet();
  var subSheet = ss.getSheetByName(subCfg.name);

  var subRow = [
    subId,
    String(data.formId),
    String(data.status || "menunggu"),
    String(data.adminNote || "").trim(),
    now,
    "",
    ""
  ];
  subSheet.appendRow(subRow);

  // Simpan answers jika disertakan
  var answers = data.answers;
  if (Array.isArray(answers) && answers.length > 0) {
    var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
    var ansSheet = ss.getSheetByName(ansCfg.name);
    var driveFolder = null;

    for (var i = 0; i < answers.length; i++) {
      var item = answers[i];
      var ansId = generateId(ansCfg);
      var fileUrl = String(item.fileUrl || item.fileBase64 || "");

      // Jika file berupa Base64 (upload foto/dokumen calon anggota)
      if (fileUrl.indexOf("data:") === 0) {
        var isImage = fileUrl.indexOf("data:image/") === 0;
        var isSmallSafe = fileUrl.length <= 48000;

        // Jika dokumen besar atau PDF, wajib simpan ke Google Drive
        if (!isImage || !isSmallSafe) {
          try {
            if (!driveFolder) {
              var fName = "mbc sistem Berkas Pendaftar";
              var fList = DriveApp.getFoldersByName(fName);
              driveFolder = fList.hasNext() ? fList.next() : DriveApp.createFolder(fName);
            }
            var parts = fileUrl.split(",");
            var mime = "application/octet-stream";
            var mMatch = parts[0].match(/:(.*?);/);
            if (mMatch) mime = mMatch[1];
            var fBytes = Utilities.base64Decode(parts[1]);
            var fBlob = Utilities.newBlob(fBytes, mime, String(item.fileName || ("berkas_" + ansId + ".jpg")));
            var dFile = driveFolder.createFile(fBlob);
            dFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileUrl = "https://drive.google.com/thumbnail?id=" + dFile.getId() + "&sz=w1600";
          } catch (e) {
            if (fileUrl.length > 48000) fileUrl = "";
          }
        } else {
          // Untuk foto gambar berukuran aman (<= 48k karakter), simpan langsung sebagai Data URL mandiri
          // Ini menjamin 100% foto selalu tampil seketika & tidak pernah terblokir oleh izin Google Drive
          try {
            if (!driveFolder) {
              var fName2 = "mbc sistem Berkas Pendaftar";
              var fList2 = DriveApp.getFoldersByName(fName2);
              driveFolder = fList2.hasNext() ? fList2.next() : DriveApp.createFolder(fName2);
            }
            var parts2 = fileUrl.split(",");
            var mime2 = "image/jpeg";
            var mMatch2 = parts2[0].match(/:(.*?);/);
            if (mMatch2) mime2 = mMatch2[1];
            var fBytes2 = Utilities.base64Decode(parts2[1]);
            var fBlob2 = Utilities.newBlob(fBytes2, mime2, String(item.fileName || ("foto_" + ansId + ".jpg")));
            var dFile2 = driveFolder.createFile(fBlob2);
            dFile2.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (e2) {}
        }
      }

      var rawVal = String(item.value || "").trim();
      // Jika nomor telepon / WhatsApp berawalan 0 atau format angka panjang, pastikan tersimpan sebagai teks agar angka 0 tidak hilang
      if (/^08\d{7,13}$/.test(rawVal) || /^\+?628\d{7,13}$/.test(rawVal)) {
        if (rawVal.indexOf("'") !== 0) {
          rawVal = "'" + rawVal;
        }
      }

      var ansObj = {
        id: ansId,
        submissionId: subId,
        fieldId: String(item.fieldId || ""),
        value: rawVal,
        fileUrl: fileUrl,
        fileName: String(item.fileName || ""),
        fileType: String(item.fileType || ""),
        fileSize: Number(item.fileSize) || 0,
        createdAt: now
      };
      var ansRow = buildRowArray(ansSheet, ansCfg, ansObj);
      ansSheet.appendRow(ansRow);
    }
  }

  return {
    id: subId,
    formId: subRow[1],
    status: subRow[2],
    adminNote: subRow[3],
    submittedAt: subRow[4],
    reviewedAt: null,
    reviewedBy: null,
    message: "Pendaftaran berhasil dikirim."
  };
}

function updateRekrutmenSubmission(id, data) {
  if (!id) throw new Error("ID pendaftaran tidak ditemukan.");
  var cfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var rowIndex = findRowIndex(cfg, id);
  if (rowIndex === -1) throw new Error("Data pendaftaran tidak ditemukan.");
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(cfg.name);
  var existingRow = sheet.getRange(rowIndex, 1, 1, cfg.keys.length).getValues()[0];

  var newStatus = data.status !== undefined ? String(data.status) : existingRow[2];
  var adminNote = data.adminNote !== undefined ? String(data.adminNote).trim() : existingRow[3];
  var reviewedAt = (newStatus !== "menunggu" && !existingRow[5]) ? new Date().toISOString() : existingRow[5];
  var reviewedBy = data.reviewedBy !== undefined ? String(data.reviewedBy) : existingRow[6];

  var row = [
    id,
    existingRow[1],
    newStatus,
    adminNote,
    existingRow[4],
    reviewedAt,
    reviewedBy
  ];
  sheet.getRange(rowIndex, 1, 1, cfg.keys.length).setValues([row]);
  return {
    id: id,
    formId: row[1],
    status: row[2],
    adminNote: row[3],
    submittedAt: row[4],
    reviewedAt: row[5] || null,
    reviewedBy: row[6] || null,
    message: "Status pendaftaran berhasil diperbarui."
  };
}

function deleteRekrutmenSubmission(data) {
  if (!data.id) throw new Error("ID pendaftaran tidak ditemukan.");
  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var rowIndex = findRowIndex(subCfg, data.id);
  if (rowIndex === -1) throw new Error("Data pendaftaran tidak ditemukan.");
  var ss = getSpreadsheet();
  ss.getSheetByName(subCfg.name).deleteRow(rowIndex);

  // Hapus semua answers terkait
  var ansCfg = getSheetConfig("REKRUITMEN_ANSWERS");
  var ansSheet = ss.getSheetByName(ansCfg.name);
  var ansLast = ansSheet.getLastRow();
  if (ansLast > 1) {
    var ansRows = ansSheet.getRange(2, 1, ansLast - 1, ansCfg.keys.length).getValues();
    for (var a = ansRows.length - 1; a >= 0; a--) {
      if (String(ansRows[a][1]) === String(data.id)) {
        ansSheet.deleteRow(a + 2);
      }
    }
  }
  return { message: "Data pendaftaran berhasil dihapus." };
}

function getRekrutmenStats(formId) {
  var subCfg = getSheetConfig("REKRUITMEN_SUBMISSIONS");
  var allSubs = readRows(subCfg);
  var subs = allSubs;
  if (formId) {
    subs = allSubs.filter(function (s) {
      return String(s.formId) === String(formId);
    });
  }

  var total = subs.length;
  var menunggu = 0, lolos = 0, tidakLolos = 0;
  for (var i = 0; i < subs.length; i++) {
    var st = subs[i].status;
    if (st === "lolos") lolos++;
    else if (st === "tidak_lolos") tidakLolos++;
    else menunggu++;
  }
  return {
    total: total,
    menunggu: menunggu,
    lolos: lolos,
    tidakLolos: tidakLolos
  };
}

// ============================================================
// MODUL USERS & AUTENTIKASI
// ============================================================

function loginUser(username, password) {
  if (!username || !password) {
    throw new Error("Username dan password wajib diisi.");
  }

  var cfg = getSheetConfig("USERS");
  var sheet = getOrCreateSheet(cfg);

  // Pastikan akun admin default dibuat jika sheet masih kosong
  if (sheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    sheet.appendRow(["USR-001", "admin", "admin", "Administrator mbc sistem", "admin", "Aktif", now, now]);
  }

  var users = readRows(cfg);
  var found = null;

  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (
      String(u.username || "").trim().toLowerCase() === String(username).trim().toLowerCase() &&
      String(u.password || "").trim() === String(password).trim()
    ) {
      found = u;
      break;
    }
  }

  if (!found) {
    throw new Error("Username atau password salah.");
  }

  if (String(found.status || "").toLowerCase() !== "aktif") {
    throw new Error("Akun ini berstatus tidak aktif. Hubungi administrator.");
  }

  var tokenPayload = found.id + ":" + found.username + ":" + new Date().getTime();
  var token = Utilities.base64Encode(tokenPayload);

  return {
    id: found.id,
    username: found.username,
    nama: found.nama || found.username,
    role: found.role || "admin",
    status: found.status || "Aktif",
    token: token
  };
}

function getUsers() {
  var cfg = getSheetConfig("USERS");
  var users = readRows(cfg);
  return users.map(function(u) {
    return {
      id: u.id,
      username: u.username,
      nama: u.nama,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  });
}

function addUser(data) {
  if (!data.username || !data.password) {
    throw new Error("Username dan password wajib diisi.");
  }
  var cfg = getSheetConfig("USERS");
  var users = readRows(cfg);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).toLowerCase() === String(data.username).toLowerCase()) {
      throw new Error("Username '" + data.username + "' sudah digunakan.");
    }
  }
  var now = new Date().toISOString();
  var item = {
    username: String(data.username).trim(),
    password: String(data.password).trim(),
    nama: data.nama || data.username,
    role: data.role || "admin",
    status: data.status || "Aktif",
    createdAt: now,
    updatedAt: now
  };
  return createRow(cfg, item);
}

function updateUser(data) {
  if (!data.id) throw new Error("ID Pengguna tidak ditemukan.");
  var cfg = getSheetConfig("USERS");
  data.updatedAt = new Date().toISOString();
  return updateRow(cfg, data.id, data);
}

function deleteUser(data) {
  if (!data.id) throw new Error("ID Pengguna tidak ditemukan.");
  var cfg = getSheetConfig("USERS");
  return deleteRow(cfg, data.id);
}

// ============================================================
// KELOLA PESANAN (ORDER MANAGEMENT) FUNCTIONS
// ============================================================

function getOrderForms() {
  var rows = readRows(getSheetConfig("ORDER_FORM"));
  var fieldsRows = readRows(getSheetConfig("ORDER_FIELDS"));
  var ordersRows = readRows(getSheetConfig("ORDERS"));

  return rows.map(function(form) {
    var flds = fieldsRows.filter(function(f) {
      return String(f.formId) === String(form.id);
    }).sort(function(a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    }).map(function(f) {
      var options = [];
      try {
        if (typeof f.options === "string" && f.options) options = JSON.parse(f.options);
        else if (Array.isArray(f.options)) options = f.options;
      } catch (e) {
        options = [];
      }
      return {
        id: String(f.id),
        formId: String(f.formId),
        label: String(f.label),
        description: String(f.description || ""),
        fieldType: String(f.fieldType || "text"),
        required: Boolean(f.required === true || f.required === "true"),
        options: options,
        sortOrder: Number(f.sortOrder || 0),
        placeholder: f.placeholder ? String(f.placeholder) : "",
        maxFileSize: f.maxFileSize ? Number(f.maxFileSize) : 5,
        imageUrl: f.imageUrl ? String(f.imageUrl) : "",
        imageTitle: f.imageTitle ? String(f.imageTitle) : "",
        infoText: f.infoText ? String(f.infoText) : "",
        exampleImageUrl: f.exampleImageUrl ? String(f.exampleImageUrl) : "",
        price: f.price ? Number(f.price) : undefined,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      };
    });

    var count = ordersRows.filter(function(o) {
      return String(o.formId) === String(form.id);
    }).length;

    return {
      id: String(form.id),
      title: String(form.title),
      description: String(form.description || ""),
      status: String(form.status || "aktif"),
      publicLink: String(form.publicLink || ("/order/form/" + form.id)),
      bannerImageUrl: form.bannerImageUrl ? String(form.bannerImageUrl) : "",
      bannerImageTitle: form.bannerImageTitle ? String(form.bannerImageTitle) : "",
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      fields: flds,
      responseCount: count
    };
  });
}

function getOrderForm(id) {
  var forms = getOrderForms();
  if (!id) {
    return forms.length > 0 ? forms[0] : null;
  }
  for (var i = 0; i < forms.length; i++) {
    if (String(forms[i].id) === String(id)) return forms[i];
  }
  return forms.length > 0 ? forms[0] : null;
}

function addOrderForm(data) {
  if (!data.title || !String(data.title).trim()) throw new Error("Judul formulir pesanan wajib diisi.");
  var cfg = getSheetConfig("ORDER_FORM");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var pubLink = "/order/form/" + id;

  var bannerUrl = String(data.bannerImageUrl || "").trim();
  if (bannerUrl.indexOf("data:image/") === 0 && bannerUrl.length > 500) {
    try {
      var upB = uploadOrderImage({ base64: bannerUrl, fileName: "banner_" + new Date().getTime() + ".jpg" });
      if (upB && upB.url) bannerUrl = upB.url;
    } catch (e) {}
  }

  var item = {
    id: id,
    title: String(data.title).trim(),
    description: String(data.description || "").trim(),
    status: String(data.status || "aktif"),
    publicLink: pubLink,
    bannerImageUrl: bannerUrl,
    bannerImageTitle: String(data.bannerImageTitle || "").trim(),
    createdAt: now,
    updatedAt: now
  };
  createRow(cfg, item);

  // Jika ada fields disertakan
  if (Array.isArray(data.fields) && data.fields.length > 0) {
    var fldCfg = getSheetConfig("ORDER_FIELDS");
    for (var i = 0; i < data.fields.length; i++) {
      var f = data.fields[i];
      var fId = generateId(fldCfg);

      var imgUrl = String(f.imageUrl || "").trim();
      if (imgUrl.indexOf("data:image/") === 0 && imgUrl.length > 500) {
        try {
          var upF = uploadOrderImage({ base64: imgUrl, fileName: "fld_img_" + new Date().getTime() + ".jpg" });
          if (upF && upF.url) imgUrl = upF.url;
        } catch (e) {}
      }

      createRow(fldCfg, {
        id: fId,
        formId: id,
        label: String(f.label || "").trim(),
        description: String(f.description || "").trim(),
        fieldType: String(f.fieldType || "text"),
        required: Boolean(f.required),
        options: JSON.stringify(f.options || []),
        sortOrder: i,
        placeholder: String(f.placeholder || "").trim(),
        maxFileSize: f.maxFileSize ? Number(f.maxFileSize) : 5,
        imageUrl: imgUrl,
        imageTitle: String(f.imageTitle || "").trim(),
        infoText: String(f.infoText || "").trim(),
        exampleImageUrl: String(f.exampleImageUrl || "").trim(),
        price: f.price ? Number(f.price) : 0,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  return getOrderForm(id);
}

function updateOrderForm(data) {
  if (!data.id) throw new Error("ID formulir pesanan tidak ditemukan.");
  var cfg = getSheetConfig("ORDER_FORM");
  var now = new Date().toISOString();

  var bannerUrl = String(data.bannerImageUrl || "").trim();
  if (bannerUrl.indexOf("data:image/") === 0 && bannerUrl.length > 500) {
    try {
      var upB = uploadOrderImage({ base64: bannerUrl, fileName: "banner_" + new Date().getTime() + ".jpg" });
      if (upB && upB.url) bannerUrl = upB.url;
    } catch (e) {}
  }

  var item = {
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    status: String(data.status || "aktif"),
    publicLink: String(data.publicLink || ("/order/form/" + data.id)),
    bannerImageUrl: bannerUrl,
    bannerImageTitle: String(data.bannerImageTitle || "").trim(),
    updatedAt: now
  };
  updateRow(cfg, data.id, item);

  // Jika update fields
  if (Array.isArray(data.fields)) {
    var fldCfg = getSheetConfig("ORDER_FIELDS");
    // Hapus fields lama
    var existingFlds = readRows(fldCfg).filter(function(f) { return String(f.formId) === String(data.id); });
    for (var j = 0; j < existingFlds.length; j++) {
      deleteRow(fldCfg, existingFlds[j].id);
    }
    // Tambah fields baru
    for (var i = 0; i < data.fields.length; i++) {
      var f = data.fields[i];
      var fId = f.id || generateId(fldCfg);

      var imgUrl = String(f.imageUrl || "").trim();
      if (imgUrl.indexOf("data:image/") === 0 && imgUrl.length > 500) {
        try {
          var upF = uploadOrderImage({ base64: imgUrl, fileName: "fld_img_" + new Date().getTime() + ".jpg" });
          if (upF && upF.url) imgUrl = upF.url;
        } catch (e) {}
      }

      createRow(fldCfg, {
        id: fId,
        formId: data.id,
        label: String(f.label || "").trim(),
        description: String(f.description || "").trim(),
        fieldType: String(f.fieldType || "text"),
        required: Boolean(f.required),
        options: typeof f.options === "string" ? f.options : JSON.stringify(f.options || []),
        sortOrder: i,
        placeholder: String(f.placeholder || "").trim(),
        maxFileSize: f.maxFileSize ? Number(f.maxFileSize) : 5,
        imageUrl: imgUrl,
        imageTitle: String(f.imageTitle || "").trim(),
        infoText: String(f.infoText || "").trim(),
        exampleImageUrl: String(f.exampleImageUrl || "").trim(),
        price: f.price ? Number(f.price) : 0,
        createdAt: f.createdAt || now,
        updatedAt: now
      });
    }
  }

  return getOrderForm(data.id);
}

function deleteOrderForm(data) {
  if (!data.id) throw new Error("ID formulir pesanan tidak ditemukan.");
  var cfg = getSheetConfig("ORDER_FORM");
  deleteRow(cfg, data.id);

  // Hapus child fields & orders & answers
  var fldCfg = getSheetConfig("ORDER_FIELDS");
  var flds = readRows(fldCfg).filter(function(f) { return String(f.formId) === String(data.id); });
  for (var i = 0; i < flds.length; i++) deleteRow(fldCfg, flds[i].id);

  var ordCfg = getSheetConfig("ORDERS");
  var ords = readRows(ordCfg).filter(function(o) { return String(o.formId) === String(data.id); });
  var ansCfg = getSheetConfig("ORDER_ANSWERS");
  for (var j = 0; j < ords.length; j++) {
    var orderId = ords[j].id;
    deleteRow(ordCfg, orderId);
    var ans = readRows(ansCfg).filter(function(a) { return String(a.orderId) === String(orderId); });
    for (var k = 0; k < ans.length; k++) deleteRow(ansCfg, ans[k].id);
  }

  return { success: true };
}

function getOrderFields(formId) {
  var rows = readRows(getSheetConfig("ORDER_FIELDS"));
  return rows.filter(function(f) {
    return !formId || String(f.formId) === String(formId);
  }).sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function addOrderField(data) {
  var cfg = getSheetConfig("ORDER_FIELDS");
  var id = generateId(cfg);
  var now = new Date().toISOString();
  var item = {
    id: id,
    formId: String(data.formId),
    label: String(data.label || "").trim(),
    description: String(data.description || "").trim(),
    fieldType: String(data.fieldType || "text"),
    required: Boolean(data.required),
    options: typeof data.options === "string" ? data.options : JSON.stringify(data.options || []),
    sortOrder: Number(data.sortOrder || 0),
    placeholder: String(data.placeholder || "").trim(),
    maxFileSize: data.maxFileSize ? Number(data.maxFileSize) : 5,
    createdAt: now,
    updatedAt: now
  };
  return createRow(cfg, item);
}

function updateOrderField(data) {
  if (!data.id) throw new Error("ID Pertanyaan tidak ditemukan.");
  var cfg = getSheetConfig("ORDER_FIELDS");
  data.updatedAt = new Date().toISOString();
  if (data.options && typeof data.options !== "string") {
    data.options = JSON.stringify(data.options);
  }
  return updateRow(cfg, data.id, data);
}

function deleteOrderField(data) {
  if (!data.id) throw new Error("ID Pertanyaan tidak ditemukan.");
  var cfg = getSheetConfig("ORDER_FIELDS");
  return deleteRow(cfg, data.id);
}

function reorderOrderFields(formId, fieldOrders) {
  if (!Array.isArray(fieldOrders)) return { success: true };
  var cfg = getSheetConfig("ORDER_FIELDS");
  var now = new Date().toISOString();
  for (var i = 0; i < fieldOrders.length; i++) {
    updateRow(cfg, fieldOrders[i].id, {
      sortOrder: Number(fieldOrders[i].sortOrder),
      updatedAt: now
    });
  }
  return { success: true };
}

// ---------------- ORDERS ----------------

function getOrders(formId) {
  var ordRows = readRows(getSheetConfig("ORDERS"));
  var ansRows = readRows(getSheetConfig("ORDER_ANSWERS"));
  var formRows = readRows(getSheetConfig("ORDER_FORM"));

  var formMap = {};
  for (var f = 0; f < formRows.length; f++) {
    formMap[formRows[f].id] = formRows[f];
  }

  var filtered = ordRows.filter(function(o) {
    return !formId || String(o.formId) === String(formId);
  });

  return filtered.map(function(order) {
    var myAnswers = ansRows.filter(function(a) {
      return String(a.orderId) === String(order.id);
    });

    return {
      id: String(order.id),
      formId: String(order.formId),
      customerName: String(order.customerName || ""),
      whatsapp: String(order.whatsapp || ""),
      status: String(order.status || "masuk"),
      adminNote: String(order.adminNote || ""),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      answers: myAnswers,
      form: formMap[order.formId] || null
    };
  }); // Terlama ke terbaru
}

function addOrder(data) {
  if (!data.formId) throw new Error("Formulir pesanan wajib dipilih.");

  var form = getOrderForm(data.formId);
  if (form && String(form.status).toLowerCase() === "nonaktif") {
    throw new Error("Formulir pemesanan ini saat ini dinonaktifkan dan tidak menerima pesanan baru.");
  }

  var ordCfg = getSheetConfig("ORDERS");
  var allOrders = readRows(ordCfg);
  var nextNum = allOrders.length + 1;
  var randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  var ordId = "ORD-" + ("000" + nextNum).slice(-4) + "-" + randomStr; // e.g. ORD-0001-A1B2

  var now = new Date().toISOString();
  var customerName = String(data.customerName || "").trim();
  var whatsapp = String(data.whatsapp || "").trim();

  // Jika customerName/whatsapp belum diekstrak langsung, coba ambil dari answers
  if (Array.isArray(data.answers)) {
    for (var a = 0; a < data.answers.length; a++) {
      var ansItem = data.answers[a];
      var lbl = String(ansItem.label || "").toLowerCase();
      if (!customerName && (lbl.includes("nama") || lbl.includes("customer") || lbl.includes("lengkap"))) {
        customerName = String(ansItem.value || "").trim();
      }
      if (!whatsapp && (lbl.includes("wa") || lbl.includes("whatsapp") || lbl.includes("hp") || lbl.includes("telepon") || lbl.includes("phone"))) {
        whatsapp = String(ansItem.value || "").trim();
      }
    }
  }

  var item = {
    id: ordId,
    formId: String(data.formId),
    customerName: customerName || "Customer",
    whatsapp: whatsapp,
    status: "masuk",
    adminNote: String(data.adminNote || ""),
    createdAt: now,
    updatedAt: now
  };
  createRow(ordCfg, item);

  // Simpan answers
  if (Array.isArray(data.answers) && data.answers.length > 0) {
    var ansCfg = getSheetConfig("ORDER_ANSWERS");
    for (var i = 0; i < data.answers.length; i++) {
      var itemAns = data.answers[i];
      var fileUrlStr = String(itemAns.fileUrl || "").trim();

      if (fileUrlStr.indexOf("data:image/") === 0 && fileUrlStr.length > 500) {
        try {
          var upRes = uploadOrderImage({
            base64: fileUrlStr,
            fileName: itemAns.fileName || ("order_upload_" + new Date().getTime() + ".jpg")
          });
          if (upRes && upRes.url) {
            fileUrlStr = upRes.url;
          }
        } catch (e) {
          console.warn("Gagal auto upload base64 ke drive:", e);
        }
      }

      var ansId = generateId(ansCfg);
      createRow(ansCfg, {
        id: ansId,
        orderId: ordId,
        fieldId: String(itemAns.fieldId || ""),
        label: String(itemAns.label || ""),
        value: String(itemAns.value || ""),
        fileUrl: fileUrlStr,
        fileName: String(itemAns.fileName || ""),
        fileType: String(itemAns.fileType || ""),
        fileSize: itemAns.fileSize ? Number(itemAns.fileSize) : 0,
        createdAt: now
      });
    }
  }

  return {
    id: ordId,
    orderId: ordId,
    status: "masuk",
    customerName: customerName,
    whatsapp: whatsapp,
    createdAt: now,
    message: "Pesanan berhasil dikirim."
  };
}

function uploadOrderImage(data) {
  if (!data || !data.base64) throw new Error("Data gambar wajib dikirim.");
  var rawBase64 = String(data.base64);
  var mimeType = "image/jpeg";
  var fileName = data.fileName || ("order_file_" + new Date().getTime() + ".jpg");

  if (rawBase64.indexOf("data:") === 0) {
    var parts = rawBase64.split(",");
    var match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
    rawBase64 = parts[1];
  }

  var bytes = Utilities.base64Decode(rawBase64);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);

  var folderName = "mbc sistem Order Assets";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();

  var directUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600";

  return {
    fileId: fileId,
    url: directUrl,
    name: fileName,
    message: "Foto berhasil diunggah ke Google Drive dengan kualitas penuh."
  };
}

function updateOrderStatus(data) {
  if (!data.id) throw new Error("ID Pesanan tidak ditemukan.");
  var cfg = getSheetConfig("ORDERS");
  var now = new Date().toISOString();
  var updatePayload = {
    status: String(data.status || "masuk"),
    updatedAt: now
  };
  if (data.adminNote !== undefined) {
    updatePayload.adminNote = String(data.adminNote || "");
  }
  updateRow(cfg, data.id, updatePayload);
  return { success: true, id: data.id, status: data.status };
}

function deleteOrder(data) {
  if (!data.id) throw new Error("ID Pesanan tidak ditemukan.");
  var cfg = getSheetConfig("ORDERS");
  deleteRow(cfg, data.id);

  var ansCfg = getSheetConfig("ORDER_ANSWERS");
  var answers = readRows(ansCfg).filter(function(a) { return String(a.orderId) === String(data.id); });
  for (var i = 0; i < answers.length; i++) {
    deleteRow(ansCfg, answers[i].id);
  }
  return { success: true };
}

function getOrderStats(formId) {
  var orders = readRows(getSheetConfig("ORDERS"));
  var filtered = orders.filter(function(o) {
    return !formId || String(o.formId) === String(formId);
  });

  var total = filtered.length;
  var masuk = 0;
  var diproses = 0;
  var selesai = 0;

  for (var i = 0; i < filtered.length; i++) {
    var st = String(filtered[i].status || "").toLowerCase();
    if (st === "masuk") masuk++;
    else if (st === "diproses") diproses++;
    else if (st === "selesai") selesai++;
  }

  return {
    total: total,
    masuk: masuk,
    diproses: diproses,
    selesai: selesai
  };
}

// ============================================================
// KUPON LOCATIONS
// ============================================================

function getCouponLocations(activeOnly) {
  var cfg = getSheetConfig("KUPON_LOCATIONS");
  var rows = readRows(cfg);
  if (activeOnly) {
    return rows.filter(function(r) {
      return String(r.status || "").toLowerCase() === "aktif";
    });
  }
  return rows;
}

function addCouponLocation(data) {
  if (!data.name || !String(data.name).trim()) throw new Error("Nama lokasi / kupon wajib diisi.");
  var cfg = getSheetConfig("KUPON_LOCATIONS");
  var now = new Date().toISOString();
  var item = {
    id: generateId(cfg),
    name: String(data.name || "").trim(),
    picName: String(data.picName || "").trim(),
    whatsapp: String(data.whatsapp || "").trim(),
    latitude: Number(data.latitude || 0),
    longitude: Number(data.longitude || 0),
    address: String(data.address || "").trim(),
    description: String(data.description || "").trim(),
    photoUrl: String(data.photoUrl || "").trim(),
    status: String(data.status || "aktif").toLowerCase() === "nonaktif" ? "nonaktif" : "aktif",
    createdAt: now,
    updatedAt: now
  };
  return createRow(cfg, item);
}

function updateCouponLocation(data) {
  if (!data.id) throw new Error("ID lokasi kupon tidak ditemukan.");
  var cfg = getSheetConfig("KUPON_LOCATIONS");
  data.updatedAt = new Date().toISOString();
  if (data.status) {
    data.status = String(data.status).toLowerCase() === "nonaktif" ? "nonaktif" : "aktif";
  }
  return updateRow(cfg, data.id, data);
}

function deleteCouponLocation(data) {
  if (!data.id) throw new Error("ID lokasi kupon tidak ditemukan.");
  var cfg = getSheetConfig("KUPON_LOCATIONS");
  return deleteRow(cfg, data.id);
}