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
    session: "absensi_session"
  };

  const memorySessionStorage = {};
  const sessionStore = getStorageBackend("sessionStorage");

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

    summary.Kurang = summary.Total - summary.Hadir;
    return summary;
  }

  window.AppUtils = {
    ABSENT_STATUS_KEYS,
    STATUS_CONFIG,
    STATUS_KEYS,
    STORAGE,
    calculateSummary,
    escapeHtml,
    formatDate,
    formatDateTime,
    formatMonth,
    normalizeText,
    sessionGet,
    sessionRemove,
    sessionSet,
    thisMonthInputValue,
    todayInputValue
  };
})();
