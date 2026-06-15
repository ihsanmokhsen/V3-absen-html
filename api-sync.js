/**
 * api-sync.js — REST API sync layer replacing supabase-sync.js.
 *
 * Exposes the same window.SupabaseSync interface so app.js needs no changes.
 * All operations go through a self-hosted Node.js/Express API backed by PostgreSQL.
 */
(function () {
  var DEFAULT_CONFIG = {
    url: "/api",
    user: "bpad",
    pass: ""
  };

  var CONFIG_KEYS = {
    url: "api_url",
    user: "api_user",
    pass: "api_pass"
  };

  // -------------------------------------------------------------------------
  // Storage helpers (same as supabase-sync.js)
  // -------------------------------------------------------------------------
  function getAppStorageApi() {
    var utils = window.AppUtils;
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
      var appStorage = getAppStorageApi();
      if (appStorage) return appStorage.storageGet(key);
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      var appStorage = getAppStorageApi();
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
      var appStorage = getAppStorageApi();
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

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------
  function getConfig() {
    var runtimeConfig = window.__BPAD_API_CONFIG || {};
    var url = safeGet(CONFIG_KEYS.url) || runtimeConfig.url || DEFAULT_CONFIG.url || "";
    var user = safeGet(CONFIG_KEYS.user) || runtimeConfig.user || DEFAULT_CONFIG.user || "";
    var pass = safeGet(CONFIG_KEYS.pass) || runtimeConfig.pass || DEFAULT_CONFIG.pass || "";
    return { url: url, user: user, pass: pass };
  }

  function isConfigured() {
    return !!getConfig().url;
  }

  function setConfig(url, user, pass) {
    var cleanUrl = String(url || "").trim();
    if (!cleanUrl) return false;
    safeSet(CONFIG_KEYS.user, String(user || "").trim());
    safeSet(CONFIG_KEYS.pass, String(pass || "").trim());
    return safeSet(CONFIG_KEYS.url, cleanUrl);
  }

  function clearConfig() {
    safeRemove(CONFIG_KEYS.url);
    safeRemove(CONFIG_KEYS.user);
    safeRemove(CONFIG_KEYS.pass);
  }

  function getMaskedConfig() {
    var cfg = getConfig();
    return { url: cfg.url, user: cfg.user, pass: cfg.pass ? "****" : "" };
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------
  function baseUrl() {
    return getConfig().url.replace(/\/+$/, "");
  }

  function authHeaders() {
    var cfg = getConfig();
    if (!cfg.user && !cfg.pass) return {};
    var token = btoa(cfg.user + ":" + cfg.pass);
    return { Authorization: "Basic " + token };
  }

  async function apiGet(path, params) {
    var url = baseUrl() + path;
    if (params) {
      var qs = new URLSearchParams();
      Object.keys(params).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null) {
          qs.set(key, params[key]);
        }
      });
      var qsStr = qs.toString();
      if (qsStr) url += "?" + qsStr;
    }

    var resp = await fetch(url, {
      method: "GET",
      headers: Object.assign({ Accept: "application/json" }, authHeaders())
    });
    if (!resp.ok) {
      var text = await resp.text();
      throw new Error("HTTP " + resp.status + ": " + text);
    }
    return resp.json();
  }

  async function apiPost(path, body) {
    var resp = await fetch(baseUrl() + path, {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json", Accept: "application/json" },
        authHeaders()
      ),
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      var text = await resp.text();
      throw new Error("HTTP " + resp.status + ": " + text);
    }
    return resp.json();
  }

  async function apiDelete(path) {
    var resp = await fetch(baseUrl() + path, {
      method: "DELETE",
      headers: Object.assign({ Accept: "application/json" }, authHeaders())
    });
    if (!resp.ok) {
      var text = await resp.text();
      throw new Error("HTTP " + resp.status + ": " + text);
    }
    return resp.json();
  }

  // -------------------------------------------------------------------------
  // Public API (mirrors old SupabaseSync interface)
  // -------------------------------------------------------------------------

  async function ping() {
    try {
      var result = await apiGet("/health");
      if (result.ok) return { ok: true };
      return { ok: false, error: result.error || "API not reachable." };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function upsertAttendance(record) {
    try {
      var result = await apiPost("/attendance/upsert", {
        date: record.date,
        scope: record.scope,
        admin: record.admin || "",
        attendance: record.attendance || {},
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function upsertReport(report) {
    try {
      var result = await apiPost("/reports/upsert", {
        date: report.date,
        scope: report.scope,
        admin: report.admin || "",
        summary: report.summary || {},
        rows: report.rows || [],
        notes: report.notes || [],
        savedAt: report.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function deleteScopeDateData(date, scope) {
    try {
      var result = await apiDelete("/data/" + encodeURIComponent(date) + "/" + encodeURIComponent(scope));
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function pullDateData(date) {
    try {
      var result = await apiGet("/data/" + encodeURIComponent(date));
      return {
        ok: !!result.ok,
        error: result.error,
        attendances: result.attendances || [],
        reports: result.reports || []
      };
    } catch (error) {
      return { ok: false, error: error.message, attendances: [], reports: [] };
    }
  }

  async function pullReports(scope) {
    try {
      var result = await apiGet("/reports", { scope: scope });
      return {
        ok: !!result.ok,
        error: result.error,
        reports: result.data || []
      };
    } catch (error) {
      return { ok: false, error: error.message, reports: [] };
    }
  }

  async function pullAttendancesForMonth(scope, monthPrefix) {
    try {
      var result = await apiGet("/attendance/month", { scope: scope, month: monthPrefix });
      return {
        ok: !!result.ok,
        error: result.error,
        attendances: result.data || []
      };
    } catch (error) {
      return { ok: false, error: error.message, attendances: [] };
    }
  }

  // -------------------------------------------------------------------------
  // Auth (login does NOT need Basic Auth)
  // -------------------------------------------------------------------------

  async function login(username, password) {
    try {
      var resp = await fetch(baseUrl() + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: username, password: password })
      });
      var result = await resp.json();
      return {
        ok: !!result.ok,
        error: result.error,
        user: result.user || null
      };
    } catch (error) {
      return { ok: false, error: error.message, user: null };
    }
  }

  async function changePassword(scope, oldPassword, newPassword) {
    try {
      var result = await apiPost("/auth/change-password", {
        scope: scope,
        oldPassword: oldPassword,
        newPassword: newPassword
      });
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // Pegawai (employee master data)
  // -------------------------------------------------------------------------

  async function getPegawai(bidang) {
    try {
      var params = {};
      if (bidang) params.bidang = bidang;
      var result = await apiGet("/pegawai", params);
      return { ok: !!result.ok, error: result.error, data: result.data || [] };
    } catch (error) {
      return { ok: false, error: error.message, data: [] };
    }
  }

  async function addPegawai(pegawai) {
    try {
      var result = await apiPost("/pegawai", pegawai);
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function updatePegawai(id, changes) {
    try {
      var resp = await fetch(baseUrl() + "/pegawai/" + encodeURIComponent(id), {
        method: "PUT",
        headers: Object.assign(
          { "Content-Type": "application/json", Accept: "application/json" },
          authHeaders()
        ),
        body: JSON.stringify(changes)
      });
      var result = await resp.json();
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function deletePegawai(id, hard) {
    try {
      var url = baseUrl() + "/pegawai/" + encodeURIComponent(id);
      if (hard) url += "?hard=true";
      var resp = await fetch(url, {
        method: "DELETE",
        headers: Object.assign({ Accept: "application/json" }, authHeaders())
      });
      var result = await resp.json();
      return { ok: !!result.ok, error: result.error };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // Expose as window.SupabaseSync for backward compatibility with app.js
  // -------------------------------------------------------------------------
  window.SupabaseSync = {
    addPegawai: addPegawai,
    changePassword: changePassword,
    clearConfig: clearConfig,
    deletePegawai: deletePegawai,
    deleteScopeDateData: deleteScopeDateData,
    getConfig: getConfig,
    getMaskedConfig: getMaskedConfig,
    getPegawai: getPegawai,
    isConfigured: isConfigured,
    login: login,
    ping: ping,
    pullAttendancesForMonth: pullAttendancesForMonth,
    pullDateData: pullDateData,
    pullReports: pullReports,
    setConfig: setConfig,
    updatePegawai: updatePegawai,
    upsertAttendance: upsertAttendance,
    upsertReport: upsertReport
  };
})();
