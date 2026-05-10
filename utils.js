(function () {
  const STATUS_CONFIG = [
    { key: "Hadir", label: "Hadir", short: "H", tone: "present" },
    { key: "Sakit", label: "Sakit", short: "S", tone: "sick" },
    { key: "Izin", label: "Izin", short: "I", tone: "permit" },
    { key: "Cuti", label: "Cuti", short: "C", tone: "leave" },
    { key: "Terlambat", label: "Terlambat", short: "T", tone: "late" },
    { key: "Tugas", label: "Tugas", short: "TG", tone: "duty" },
    { key: "Tubel", label: "Tubel", short: "TB", tone: "study" }
  ];

  const STATUS_KEYS = STATUS_CONFIG.map((status) => status.key);
  const ABSENT_STATUS_KEYS = ["Sakit", "Izin", "Cuti", "Tugas", "Tubel"];

  const STORAGE = {
    pin: "pin",
    adminName: "admin_name",
    session: "absensi_session"
  };

  const memoryLocalStorage = {};
  const memorySessionStorage = {};
  const localStore = getStorageBackend("localStorage");
  const sessionStore = getStorageBackend("sessionStorage");

  const attendanceKey = (date) => `absensi_${date}`;
  const reportKey = (date) => `laporan_${date}`;

  function getStorageBackend(name) {
    try {
      const storage = window[name];
      const testKey = "__absensi_storage_test__";
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function storageGet(key) {
    if (localStore) return localStore.getItem(key);
    return memoryLocalStorage[key] ?? null;
  }

  function storageSet(key, value) {
    if (localStore) {
      localStore.setItem(key, String(value));
      return;
    }
    memoryLocalStorage[key] = String(value);
  }

  function storageRemove(key) {
    if (localStore) {
      localStore.removeItem(key);
      return;
    }
    delete memoryLocalStorage[key];
  }

  function storageKey(index) {
    if (localStore) return localStore.key(index);
    return Object.keys(memoryLocalStorage)[index] ?? null;
  }

  function storageLength() {
    if (localStore) return localStore.length;
    return Object.keys(memoryLocalStorage).length;
  }

  function sessionGet(key) {
    if (sessionStore) return sessionStore.getItem(key);
    return memorySessionStorage[key] ?? null;
  }

  function sessionSet(key, value) {
    if (sessionStore) {
      sessionStore.setItem(key, String(value));
      return;
    }
    memorySessionStorage[key] = String(value);
  }

  function sessionRemove(key) {
    if (sessionStore) {
      sessionStore.removeItem(key);
      return;
    }
    delete memorySessionStorage[key];
  }

  function ensureDefaultPin() {
    if (!storageGet(STORAGE.pin)) {
      storageSet(STORAGE.pin, "1234");
    }
  }

  function todayInputValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function thisMonthInputValue() {
    return todayInputValue().slice(0, 7);
  }

  function formatDate(dateString, options) {
    if (!dateString) return "-";
    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat("id-ID", {
      weekday: options?.weekday ?? "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatMonth(monthString) {
    if (!monthString) return "-";
    const date = new Date(`${monthString}-01T00:00:00`);
    return new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(isoString) {
    if (!isoString) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(isoString));
  }

  function parseJson(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Data localStorage tidak dapat dibaca:", error);
      return fallback;
    }
  }

  function saveJson(key, value) {
    storageSet(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "").toLowerCase().trim();
  }

  function employeeDisplayName(employee) {
    return `${employee.nama}${employee.jenis === "PPPK" ? " (PPPK)" : ""}`;
  }

  function createDefaultAttendance(date, adminName) {
    return {
      date,
      admin: adminName || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendance: Object.fromEntries(window.PEGAWAI.map((employee) => [employee.id, "Hadir"]))
    };
  }

  function rowsFromAttendance(record) {
    const attendance = record?.attendance || {};
    return window.PEGAWAI.map((employee) => ({
      ...employee,
      displayName: employeeDisplayName(employee),
      status: attendance[employee.id] || "Belum Diabsen"
    }));
  }

  function calculateSummary(rows) {
    const summary = {
      Total: rows.length,
      Hadir: 0,
      Sakit: 0,
      Izin: 0,
      Cuti: 0,
      Terlambat: 0,
      Tugas: 0,
      Tubel: 0,
      Kurang: 0,
      Belum: 0
    };

    rows.forEach((row) => {
      if (STATUS_KEYS.includes(row.status)) {
        summary[row.status] += 1;
      } else {
        summary.Belum += 1;
      }
    });

    summary.Kurang = ABSENT_STATUS_KEYS.reduce((total, status) => total + summary[status], 0);
    return summary;
  }

  function readAttendance(date) {
    return parseJson(storageGet(attendanceKey(date)), null);
  }

  function saveAttendance(record) {
    const nextRecord = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    saveJson(attendanceKey(nextRecord.date), nextRecord);
    return nextRecord;
  }

  function readSavedReport(date) {
    return parseJson(storageGet(reportKey(date)), null);
  }

  function saveSavedReport(date, report) {
    saveJson(reportKey(date), report);
  }

  function deleteDateData(date) {
    storageRemove(attendanceKey(date));
    storageRemove(reportKey(date));
  }

  function getAllSavedReports() {
    const reports = [];

    for (let index = 0; index < storageLength(); index += 1) {
      const key = storageKey(index);
      if (!key || !key.startsWith("laporan_")) continue;
      const report = parseJson(storageGet(key), null);
      if (report) reports.push(report);
    }

    return reports.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function getAttendanceRecordsForMonth(monthString) {
    const records = [];

    for (let index = 0; index < storageLength(); index += 1) {
      const key = storageKey(index);
      if (!key || !key.startsWith(`absensi_${monthString}`)) continue;
      const record = parseJson(storageGet(key), null);
      if (record) records.push(record);
    }

    return records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function buildMonthlyRows(monthString) {
    const records = getAttendanceRecordsForMonth(monthString);

    const rows = window.PEGAWAI.map((employee) => {
      const base = {
        id: employee.id,
        nama: employeeDisplayName(employee),
        bidang: employee.bidang,
        jenis: employee.jenis,
        Hadir: 0,
        Sakit: 0,
        Izin: 0,
        Cuti: 0,
        Terlambat: 0,
        Tugas: 0,
        Tubel: 0,
        TotalTidakHadir: 0
      };

      records.forEach((record) => {
        const status = record.attendance?.[employee.id];
        if (STATUS_KEYS.includes(status)) {
          base[status] += 1;
        }
      });

      base.TotalTidakHadir = ABSENT_STATUS_KEYS.reduce((total, status) => total + base[status], 0);
      return base;
    });

    return {
      month: monthString,
      monthLabel: formatMonth(monthString),
      totalDays: records.length,
      dates: records.map((record) => record.date),
      rows
    };
  }

  window.AppUtils = {
    ABSENT_STATUS_KEYS,
    STATUS_CONFIG,
    STATUS_KEYS,
    STORAGE,
    attendanceKey,
    buildMonthlyRows,
    calculateSummary,
    createDefaultAttendance,
    employeeDisplayName,
    ensureDefaultPin,
    escapeHtml,
    formatDate,
    formatDateTime,
    formatMonth,
    getAllSavedReports,
    normalizeText,
    readAttendance,
    readSavedReport,
    reportKey,
    rowsFromAttendance,
    saveAttendance,
    saveSavedReport,
    sessionGet,
    sessionRemove,
    sessionSet,
    storageRemove,
    storageGet,
    storageKey,
    storageLength,
    storageSet,
    deleteDateData,
    thisMonthInputValue,
    todayInputValue
  };
})();
