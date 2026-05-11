(function () {
  const DEFAULT_CONFIG = {
    url: "https://ndnvmtilzzsbacncbiqi.supabase.co",
    anonKey: "sb_publishable_yXhpaLAuolFB9IU7MFJd8g_W_0hDQcP"
  };

  const CONFIG_KEYS = {
    url: "supabase_url",
    anonKey: "supabase_anon_key"
  };

  function getAppStorageApi() {
    const utils = window.AppUtils;
    if (!utils) return null;
    if (
      typeof utils.storageGet === "function" &&
      typeof utils.storageSet === "function" &&
      typeof utils.storageRemove === "function"
    ) {
      return utils;
    }
    return null;
  }

  function safeGet(key) {
    try {
      const appStorage = getAppStorageApi();
      if (appStorage) return appStorage.storageGet(key);
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      const appStorage = getAppStorageApi();
      if (appStorage) {
        appStorage.storageSet(key, value);
        return true;
      }
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      const appStorage = getAppStorageApi();
      if (appStorage) {
        appStorage.storageRemove(key);
        return true;
      }
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getConfig() {
    const runtimeConfig = window.__BPAD_SUPABASE_CONFIG || {};
    const url = safeGet(CONFIG_KEYS.url) || runtimeConfig.url || DEFAULT_CONFIG.url || "";
    const anonKey = safeGet(CONFIG_KEYS.anonKey) || runtimeConfig.anonKey || DEFAULT_CONFIG.anonKey || "";
    return { url, anonKey };
  }

  function isConfigured() {
    const { url, anonKey } = getConfig();
    return !!url && !!anonKey;
  }

  function setConfig(url, anonKey) {
    const cleanUrl = String(url || "").trim();
    const cleanAnonKey = String(anonKey || "").trim();
    if (!cleanUrl || !cleanAnonKey) return false;

    const okUrl = safeSet(CONFIG_KEYS.url, cleanUrl);
    const okKey = safeSet(CONFIG_KEYS.anonKey, cleanAnonKey);
    return okUrl && okKey;
  }

  function clearConfig() {
    safeRemove(CONFIG_KEYS.url);
    safeRemove(CONFIG_KEYS.anonKey);
    client = null;
  }

  function getMaskedConfig() {
    const { url, anonKey } = getConfig();
    const maskedKey = anonKey ? `${anonKey.slice(0, 6)}...${anonKey.slice(-4)}` : "";
    return {
      url,
      anonKey: maskedKey
    };
  }

  let client = null;

  function getClient() {
    if (client) return client;
    if (!isConfigured()) return null;

    const factory = window.supabase && window.supabase.createClient;
    if (!factory) return null;

    const { url, anonKey } = getConfig();
    client = factory(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return client;
  }

  async function ping() {
    const supabase = getClient();
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };

    const { error } = await supabase.from("daily_reports").select("date", { head: true, count: "exact" }).limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function upsertAttendance(record) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, error: "Supabase belum dikonfigurasi." };

    const payload = {
      date: record.date,
      scope: record.scope,
      admin: record.admin || "",
      attendance: record.attendance || {},
      created_at: record.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "date,scope" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function upsertReport(report) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, error: "Supabase belum dikonfigurasi." };

    const payload = {
      date: report.date,
      scope: report.scope,
      admin: report.admin || "",
      summary: report.summary || {},
      rows: report.rows || [],
      notes: report.notes || [],
      saved_at: report.savedAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("daily_reports").upsert(payload, { onConflict: "date,scope" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function deleteScopeDateData(date, scope) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, error: "Supabase belum dikonfigurasi." };

    const { error: reportError } = await supabase.from("daily_reports").delete().eq("date", date).eq("scope", scope);
    if (reportError) return { ok: false, error: reportError.message };

    const { error: attendanceError } = await supabase.from("attendance_records").delete().eq("date", date).eq("scope", scope);
    if (attendanceError) return { ok: false, error: attendanceError.message };

    return { ok: true };
  }

  async function pullDateData(date) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, attendances: [], reports: [] };

    const attendanceQuery = await supabase.from("attendance_records").select("*").eq("date", date);
    if (attendanceQuery.error) return { ok: false, error: attendanceQuery.error.message, attendances: [], reports: [] };

    const reportQuery = await supabase.from("daily_reports").select("*").eq("date", date);
    if (reportQuery.error) return { ok: false, error: reportQuery.error.message, attendances: [], reports: [] };

    return {
      ok: true,
      attendances: attendanceQuery.data || [],
      reports: reportQuery.data || []
    };
  }

  async function pullReports(scope) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, reports: [] };

    let query = supabase.from("daily_reports").select("*").order("date", { ascending: false });
    if (scope && scope !== "ALL") {
      query = query.in("scope", [scope, "ALL"]);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, reports: [] };
    return { ok: true, reports: data || [] };
  }

  async function pullAttendancesForMonth(scope, monthPrefix) {
    const supabase = getClient();
    if (!supabase) return { ok: false, skipped: true, attendances: [] };

    const [yearText, monthText] = String(monthPrefix || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month || month < 1 || month > 12) {
      return { ok: false, error: "Format bulan tidak valid.", attendances: [] };
    }

    const fromDate = `${yearText}-${monthText}-01`;
    const monthEndDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = `${yearText}-${monthText}-${String(monthEndDate).padStart(2, "0")}`;

    let query = supabase
      .from("attendance_records")
      .select("*")
      .gte("date", fromDate)
      .lte("date", toDate);

    if (scope && scope !== "ALL") {
      query = query.in("scope", [scope, "ALL"]);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, attendances: [] };
    return { ok: true, attendances: data || [] };
  }

  window.SupabaseSync = {
    clearConfig,
    deleteScopeDateData,
    getConfig,
    getMaskedConfig,
    isConfigured,
    ping,
    pullAttendancesForMonth,
    pullDateData,
    pullReports,
    setConfig,
    upsertAttendance,
    upsertReport
  };
})();
