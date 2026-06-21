// Ensure PEGAWAI array exists even before API loads (data.js removed from production)
window.PEGAWAI = window.PEGAWAI || [];

(function () {
  const {
    STATUS_CONFIG,
    STORAGE,
    attendanceKey,
    calculateSummary,
    escapeHtml,
    formatDate,
    formatDateTime,
    formatMonth,
    normalizeText,
    reportKey,
    sessionGet,
    sessionRemove,
    sessionSet,
    storageGet,
    storageKey,
    storageLength,
    storageRemove,
    storageSet,
    thisMonthInputValue,
    todayInputValue
  } = window.AppUtils;

  const ACCOUNTS = [
    { username: "BADAN PENDAPATAN DAN ASET DAERAH", scope: "ALL" },
    { username: "SEKRETARIAT", scope: "SEKRETARIAT" },
    { username: "PENDAPATAN 1", scope: "PENDAPATAN 1" },
    { username: "PENDAPATAN 2", scope: "PENDAPATAN 2" },
    { username: "ASET 1", scope: "ASET 1" },
    { username: "ASET 2", scope: "ASET 2" }
  ];

  const ALL_BIDANGS = ACCOUNTS.filter((account) => account.scope !== "ALL").map((account) => account.scope);
  const SESSION_USER_KEY = "absensi_session_user";

  const state = {
    currentDate: todayInputValue(),
    currentMonth: thisMonthInputValue(),
    attendanceRecord: null,
    search: "",
    field: "ALL",
    activeTab: "attendance",
    currentUser: null
  };

  const dom = {};
  let persistAttendanceTimer = null;
  let supabaseAttendanceSyncTimer = null;
  let syncErrorToastAt = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    cacheDom();
    hydrateInputs();
    bindEvents();

    const restoredUser = readSessionUser();
    if (restoredUser) {
      state.currentUser = restoredUser;
      void showApp();
      return;
    }
    showLogin();
  }

  function cacheDom() {
    Object.assign(dom, {
      loginScreen: document.getElementById("loginScreen"),
      appShell: document.getElementById("appShell"),
      loginForm: document.getElementById("loginForm"),
      adminName: document.getElementById("adminName"),
      pinInput: document.getElementById("pinInput"),
      loginError: document.getElementById("loginError"),
      headerMeta: document.getElementById("headerMeta"),
      logoutBtn: document.getElementById("logoutBtn"),
      changePinBtn: document.getElementById("changePinBtn"),
      tabButtons: [...document.querySelectorAll(".tab-btn")],
      views: {
        attendance: document.getElementById("attendanceView"),
        daily: document.getElementById("dailyView"),
        monthly: document.getElementById("monthlyView"),
        monthlyDetail: document.getElementById("monthlyDetailView"),
        pegawai: document.getElementById("pegawaiView"),
        history: document.getElementById("historyView")
      },
      attendanceDate: document.getElementById("attendanceDate"),
      startAttendanceBtn: document.getElementById("startAttendanceBtn"),
      saveReportBtn: document.getElementById("saveReportBtn"),
      deleteDateDataBtn: document.getElementById("deleteDateDataBtn"),
      attendanceSummary: document.getElementById("attendanceSummary"),
      scopeSubmitStatus: document.getElementById("scopeSubmitStatus"),
      searchInput: document.getElementById("searchInput"),
      fieldFilter: document.getElementById("fieldFilter"),
      employeeList: document.getElementById("employeeList"),
      dailyTitle: document.getElementById("dailyTitle"),
      dailyMeta: document.getElementById("dailyMeta"),
      dailySummary: document.getElementById("dailySummary"),
      dailyAbsentList: document.getElementById("dailyAbsentList"),
      dailyNoteCount: document.getElementById("dailyNoteCount"),
      exportDailyExcelBtn: document.getElementById("exportDailyExcelBtn"),
      exportDailyPdfBtn: document.getElementById("exportDailyPdfBtn"),
      monthlyInput: document.getElementById("monthlyInput"),
      monthlyMeta: document.getElementById("monthlyMeta"),
      monthlyTable: document.getElementById("monthlyTable"),
      monthlyDetailInput: document.getElementById("monthlyDetailInput"),
      monthlyDetailMeta: document.getElementById("monthlyDetailMeta"),
      monthlyDetailContent: document.getElementById("monthlyDetailContent"),
      exportMonthlyExcelBtn: document.getElementById("exportMonthlyExcelBtn"),
      exportMonthlyPdfBtn: document.getElementById("exportMonthlyPdfBtn"),
      exportDetailExcelBtn: document.getElementById("exportDetailExcelBtn"),
      exportDetailPdfBtn: document.getElementById("exportDetailPdfBtn"),
      addPegawaiBtn: document.getElementById("addPegawaiBtn"),
      pegawaiFormCard: document.getElementById("pegawaiFormCard"),
      pegawaiFormTitle: document.getElementById("pegawaiFormTitle"),
      pegawaiNama: document.getElementById("pegawaiNama"),
      pegawaiBidang: document.getElementById("pegawaiBidang"),
      pegawaiJenis: document.getElementById("pegawaiJenis"),
      savePegawaiBtn: document.getElementById("savePegawaiBtn"),
      cancelPegawaiBtn: document.getElementById("cancelPegawaiBtn"),
      pegawaiEditId: document.getElementById("pegawaiEditId"),
      pegawaiSearchInput: document.getElementById("pegawaiSearchInput"),
      pegawaiBidangFilter: document.getElementById("pegawaiBidangFilter"),
      pegawaiMeta: document.getElementById("pegawaiMeta"),
      pegawaiList: document.getElementById("pegawaiList"),
      historyList: document.getElementById("historyList"),
      toast: document.getElementById("toast")
    });
  }

  function hydrateInputs() {
    dom.adminName.value = "";
    dom.attendanceDate.value = state.currentDate;
    dom.monthlyInput.value = state.currentMonth;
    dom.monthlyDetailInput.value = state.currentMonth;
  }

  function bindEvents() {
    dom.loginForm.addEventListener("submit", handleLogin);
    dom.logoutBtn.addEventListener("click", handleLogout);
    dom.changePinBtn.addEventListener("click", handleChangePin);

    dom.tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    dom.attendanceDate.addEventListener("change", () => {
      state.currentDate = dom.attendanceDate.value || todayInputValue();
      loadCurrentAttendance();
      renderAll();
      void hydrateScopedDataFromSupabase(state.currentDate, { silent: true });
    });

    dom.monthlyInput.addEventListener("change", () => {
      state.currentMonth = dom.monthlyInput.value || thisMonthInputValue();
      renderMonthly();
    });

    dom.monthlyDetailInput.addEventListener("change", () => {
      state.currentMonth = dom.monthlyDetailInput.value || thisMonthInputValue();
      dom.monthlyInput.value = state.currentMonth;
      renderMonthlyDetail();
    });

    dom.startAttendanceBtn.addEventListener("click", handleStartAttendance);
    dom.saveReportBtn.addEventListener("click", handleSaveReport);
    dom.deleteDateDataBtn.addEventListener("click", handleDeleteDateData);

    dom.searchInput.addEventListener("input", () => {
      state.search = dom.searchInput.value;
      renderEmployees();
    });

    dom.fieldFilter.addEventListener("change", () => {
      state.field = dom.fieldFilter.value;
      renderEmployees();
    });

    dom.employeeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-status][data-employee-id]");
      if (!button) return;
      setEmployeeStatus(button.dataset.employeeId, button.dataset.status, button);
    });

    dom.exportDailyExcelBtn.addEventListener("click", () => exportDaily("excel"));
    dom.exportDailyPdfBtn.addEventListener("click", () => exportDaily("pdf"));
    dom.exportMonthlyExcelBtn.addEventListener("click", () => exportMonthly("excel"));
    dom.exportMonthlyPdfBtn.addEventListener("click", () => exportMonthly("pdf"));
    dom.exportDetailExcelBtn.addEventListener("click", () => exportDetailMonthly("excel"));
    dom.exportDetailPdfBtn.addEventListener("click", () => exportDetailMonthly("pdf"));

    dom.addPegawaiBtn.addEventListener("click", handleShowAddPegawai);
    dom.savePegawaiBtn.addEventListener("click", handleSavePegawai);
    dom.cancelPegawaiBtn.addEventListener("click", handleCancelPegawaiForm);
    dom.pegawaiSearchInput.addEventListener("input", () => renderPegawai());
    dom.pegawaiBidangFilter.addEventListener("change", () => renderPegawai());
    dom.pegawaiList.addEventListener("click", handlePegawaiListClick);

    dom.historyList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-report]");
      if (!button) return;
      openReportDate(button.dataset.openReport);
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = String(dom.adminName.value || "").trim().toUpperCase();
    const account = ACCOUNTS.find((item) => item.username === username);

    if (!account) {
      dom.loginError.textContent = "Akun tidak terdaftar. Gunakan nama bidang resmi.";
      return;
    }

    const password = dom.pinInput.value.trim();
    if (!password) {
      dom.loginError.textContent = "Password wajib diisi.";
      return;
    }

    const sync = getSupabaseSync();
    if (!sync || typeof sync.login !== "function") {
      dom.loginError.textContent = "Server tidak tersedia.";
      return;
    }

    dom.loginError.textContent = "Memverifikasi...";
    const result = await sync.login(username, password);

    if (!result.ok) {
      dom.loginError.textContent = result.error || "Login gagal.";
      dom.pinInput.select();
      return;
    }

    state.currentUser = {
      username: result.user.username,
      scope: result.user.scope
    };
    writeSessionUser(state.currentUser);
    sessionSet(STORAGE.session, "active");
    dom.pinInput.value = "";
    dom.loginError.textContent = "";
    void showApp();
  }

  function handleLogout() {
    sessionRemove(STORAGE.session);
    sessionRemove(SESSION_USER_KEY);
    state.currentUser = null;
    showLogin();
  }

  async function handleChangePin() {
    if (!state.currentUser) return;
    const currentPin = window.prompt("Masukkan password lama:");
    if (currentPin === null) return;

    const nextPin = window.prompt("Masukkan password baru minimal 4 karakter:");
    if (nextPin === null) return;
    const cleanPin = nextPin.trim();
    if (cleanPin.length < 4) {
      showToast("Password baru minimal 4 karakter.");
      return;
    }

    const sync = getSupabaseSync();
    if (!sync || typeof sync.changePassword !== "function") {
      showToast("Server tidak tersedia.");
      return;
    }

    const result = await sync.changePassword(state.currentUser.scope, currentPin.trim(), cleanPin);
    if (!result.ok) {
      showToast(result.error || "Gagal mengubah password.");
      return;
    }

    showToast("Password akun berhasil diganti.");
  }

  function getSupabaseSync() {
    return window.SupabaseSync || null;
  }

  function hasSupabaseSync() {
    const sync = getSupabaseSync();
    return !!(sync && typeof sync.isConfigured === "function");
  }

  function isSupabaseConfigured() {
    if (!hasSupabaseSync()) return false;
    return !!getSupabaseSync().isConfigured();
  }

  function shouldReplaceLocalByRemote(localIso, remoteIso) {
    if (!remoteIso) return false;
    if (!localIso) return true;
    return String(remoteIso) > String(localIso);
  }

  function normalizeRemoteAttendanceRecord(remote) {
    return {
      date: String(remote.date || ""),
      scope: String(remote.scope || ""),
      admin: String(remote.admin || ""),
      attendance: remote.attendance || {},
      createdAt: remote.created_at || new Date().toISOString(),
      updatedAt: remote.updated_at || remote.created_at || new Date().toISOString()
    };
  }

  function normalizeRemoteReport(remote) {
    return {
      date: String(remote.date || ""),
      scope: String(remote.scope || ""),
      admin: String(remote.admin || ""),
      summary: remote.summary || {},
      rows: Array.isArray(remote.rows) ? remote.rows : [],
      notes: Array.isArray(remote.notes) ? remote.notes : [],
      savedAt: remote.saved_at || remote.updated_at || new Date().toISOString(),
      updatedAt: remote.updated_at || remote.saved_at || new Date().toISOString()
    };
  }

  function mergeRemoteAttendances(attendances) {
    let changed = false;
    attendances.forEach((remote) => {
      const normalized = normalizeRemoteAttendanceRecord(remote);
      if (!normalized.date || !normalized.scope) return;

      const key = attendanceKey(scopedDateKey(normalized.date, normalized.scope));
      const existing = parseJson(storageGet(key), null);
      const existingUpdatedAt = existing?.updatedAt || existing?.createdAt || "";
      if (!existing || shouldReplaceLocalByRemote(existingUpdatedAt, normalized.updatedAt)) {
        storageSet(key, JSON.stringify(normalized));
        changed = true;
      }
    });
    return changed;
  }

  function mergeRemoteReports(reports) {
    let changed = false;
    reports.forEach((remote) => {
      const normalized = normalizeRemoteReport(remote);
      if (!normalized.date || !normalized.scope) return;

      const key = reportKey(scopedDateKey(normalized.date, normalized.scope));
      const existing = parseJson(storageGet(key), null);
      const existingUpdatedAt = existing?.updatedAt || existing?.savedAt || "";
      if (!existing || shouldReplaceLocalByRemote(existingUpdatedAt, normalized.updatedAt)) {
        storageSet(key, JSON.stringify(normalized));
        changed = true;
      }
    });
    return changed;
  }

  async function hydrateScopedDataFromSupabase(date, options = {}) {
    if (!isSupabaseConfigured()) return;
    const sync = getSupabaseSync();

    try {
      const [dateData, reportData] = await Promise.all([
        sync.pullDateData(date),
        sync.pullReports(currentScope())
      ]);

      if (!dateData.ok && !dateData.skipped) {
        if (!options.silent) showToast(`Sync gagal: ${dateData.error}`);
        return;
      }
      if (!reportData.ok && !reportData.skipped) {
        if (!options.silent) showToast(`Sync gagal: ${reportData.error}`);
        return;
      }

      const changedAttendance = mergeRemoteAttendances(dateData.attendances || []);
      const changedReportsFromDate = mergeRemoteReports(dateData.reports || []);
      const changedReportsFromHistory = mergeRemoteReports(reportData.reports || []);
      const changed = changedAttendance || changedReportsFromDate || changedReportsFromHistory;

      if (changed || options.forceRender) {
        if (date === state.currentDate) loadCurrentAttendance();
        renderAll();
      }

      if (!options.silent) {
        showToast(changed ? "Data server berhasil ditarik." : "Data sudah paling baru.");
      }
    } catch (error) {
      if (!options.silent) showToast(`Sync gagal: ${error.message}`);
    }
  }

  function showSupabaseSyncError(message) {
    const now = Date.now();
    if (now - syncErrorToastAt < 5000) return;
    syncErrorToastAt = now;
    showToast(`Server: ${message}`);
  }

  function queueAttendanceSync(record) {
    if (!isSupabaseConfigured()) return;
    const sync = getSupabaseSync();
    const payload = {
      ...record,
      date: record.date || state.currentDate,
      scope: record.scope || currentScope(),
      admin: record.admin || getAdminName(),
      updatedAt: new Date().toISOString()
    };

    window.clearTimeout(supabaseAttendanceSyncTimer);
    supabaseAttendanceSyncTimer = window.setTimeout(async () => {
      try {
        const result = await sync.upsertAttendance(payload);
        if (!result.ok && !result.skipped) {
          showSupabaseSyncError(result.error || "gagal sync attendance.");
        }
      } catch (error) {
        showSupabaseSyncError(error.message || "gagal sync attendance.");
      }
    }, 300);
  }

  function showLogin() {
    dom.loginScreen.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
  }

  async function showApp() {
    dom.loginScreen.classList.add("hidden");
    dom.appShell.classList.remove("hidden");
    state.search = "";
    state.field = "ALL";
    dom.searchInput.value = "";

    await loadPegawaiFromServer();
    populateFieldFilter();
    loadCurrentAttendance();
    renderAll();
    updatePegawaiTabVisibility();
    void hydrateScopedDataFromSupabase(state.currentDate, { silent: true });
  }

  async function loadPegawaiFromServer() {
    const sync = getSupabaseSync();
    if (!sync || typeof sync.getPegawai !== "function") return;

    try {
      const result = await sync.getPegawai(null, false);
      if (result.ok && Array.isArray(result.data) && result.data.length) {
        window.PEGAWAI = result.data.map((p) => ({
          id: p.id,
          nama: p.nama,
          bidang: p.bidang,
          jenis: p.jenis || "ASN",
          is_active: p.is_active !== undefined ? p.is_active : true
        }));
      }
    } catch (error) {
      console.warn("Failed to load pegawai from server:", error);
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    dom.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    Object.entries(dom.views).forEach(([key, view]) => {
      view.classList.toggle("hidden", key !== tab);
    });

    if (tab === "daily") renderDaily();
    if (tab === "monthly") renderMonthly();
    if (tab === "monthlyDetail") renderMonthlyDetail();
    if (tab === "pegawai") renderPegawai();
    if (tab === "history") {
      renderHistory();
      void hydrateScopedDataFromSupabase(state.currentDate, { silent: true });
    }
  }

  function populateFieldFilter() {
    const fields = [...new Set(getScopedEmployees().map((employee) => employee.bidang))];
    dom.fieldFilter.innerHTML = [
      '<option value="ALL">Semua bidang</option>',
      ...fields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`)
    ].join("");
    dom.fieldFilter.value = "ALL";
    dom.fieldFilter.disabled = fields.length <= 1;
  }

  function loadCurrentAttendance() {
    state.attendanceRecord = readScopedAttendance(state.currentDate);
  }

  function ensureAttendanceStarted() {
    if (isDateLocked()) return;
    if (!state.attendanceRecord) {
      const employees = getScopedEmployees();
      state.attendanceRecord = {
        date: state.currentDate,
        scope: currentScope(),
        admin: getAdminName(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attendance: Object.fromEntries(employees.map((employee) => [employee.id, "Hadir"]))
      };
      saveScopedAttendance(state.currentDate, state.attendanceRecord);
    }
  }

  function handleStartAttendance() {
    if (isDateLocked()) {
      showToast(lockMessage());
      return;
    }

    if (state.attendanceRecord && !window.confirm("Data absensi sudah ada. Mulai ulang dan set semua pegawai jadi Hadir?")) {
      return;
    }

    const employees = getScopedEmployees();
    state.attendanceRecord = {
      date: state.currentDate,
      scope: currentScope(),
      admin: getAdminName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendance: Object.fromEntries(employees.map((employee) => [employee.id, "Hadir"]))
    };
    saveScopedAttendance(state.currentDate, state.attendanceRecord);
    renderAll();
    scrollToEmployeeList();
    showToast("Absensi dimulai.");
  }

  function setEmployeeStatus(employeeId, status, triggerButton) {
    if (isDateLocked()) {
      showToast(lockMessage());
      return;
    }

    ensureAttendanceStarted();
    if (!state.attendanceRecord) return;
    state.attendanceRecord.attendance[employeeId] = status;
    state.attendanceRecord.admin = getAdminName();

    updateEmployeeCardUi(triggerButton, status);
    renderAttendanceSummary();
    schedulePersistAttendance();

    if (state.activeTab === "daily") renderDaily();
    if (state.activeTab === "monthly") renderMonthly();
    if (state.activeTab === "history") renderHistory();
  }

  function schedulePersistAttendance() {
    window.clearTimeout(persistAttendanceTimer);
    persistAttendanceTimer = window.setTimeout(() => {
      if (!state.attendanceRecord) return;
      saveScopedAttendance(state.currentDate, state.attendanceRecord);
    }, 220);
  }

  function updateEmployeeCardUi(triggerButton, status) {
    if (!triggerButton) return;
    const row = triggerButton.closest(".employee-row");
    if (!row) return;

    const buttons = row.querySelectorAll(".status-btn");
    buttons.forEach((button) => {
      const isActive = button.dataset.status === status;
      button.classList.toggle("active", isActive);
    });
  }

  function handleSaveReport() {
    if (isDateLocked()) {
      showToast(lockMessage());
      return;
    }

    if (state.attendanceRecord) {
      window.clearTimeout(persistAttendanceTimer);
      saveScopedAttendance(state.currentDate, state.attendanceRecord);
    }

    const daily = getDailyData();
    if (!daily.record) {
      showToast("Mulai absensi terlebih dahulu.");
      return;
    }

    const summaryText = [
      `Tanggal: ${daily.dateLabel}`,
      `Bidang: ${currentScope()}`,
      `Admin: ${daily.admin || "-"}`,
      "",
      `Total Pegawai: ${daily.summary.Total}`,
      `Kurang: ${daily.summary.Kurang}`,
      `Hadir: ${daily.summary.Hadir}`,
      `Sakit: ${daily.summary.Sakit}`,
      `Izin: ${daily.summary.Izin}`,
      `Cuti: ${daily.summary.Cuti}`,
      `Terlambat: ${daily.summary.Terlambat}`,
      `Tugas: ${daily.summary.Tugas}`,
      `Tubel: ${daily.summary.Tubel}`
    ].join("\n");

    const confirmed = window.confirm(`Konfirmasi Simpan Laporan\n\n${summaryText}\n\nSimpan ke perangkat sekarang? (akan sync ke server jika aktif)`);
    if (!confirmed) {
      showToast("Penyimpanan dibatalkan.");
      return;
    }

    const report = {
      date: state.currentDate,
      scope: currentScope(),
      admin: getAdminName(),
      savedAt: new Date().toISOString(),
      summary: daily.summary,
      rows: daily.rows,
      notes: daily.notedRows
    };

    saveScopedReport(state.currentDate, report);
    renderLockState();
    renderSubmitStatus();
    renderHistory();
    showToast("Laporan harian tersimpan dan dikunci.");
  }

  function handleDeleteDateData() {
    if (!hasOwnScopedData(state.currentDate)) {
      showToast(deleteBlockedMessage());
      return;
    }

    const confirmed = window.confirm(`Hapus data bidang ${currentScope()} pada ${formatDate(state.currentDate)}?`);
    if (!confirmed) return;

    deleteScopedDateData(state.currentDate);
    state.attendanceRecord = null;
    window.clearTimeout(persistAttendanceTimer);
    renderAll();
    showToast("Data tanggal ini berhasil dihapus.");
  }

  function renderAll() {
    loadCurrentAttendance();
    renderHeader();
    renderLockState();
    renderSubmitStatus();
    renderAttendanceSummary();
    renderEmployees();
    renderDaily();
    renderMonthly();
    renderHistory();
  }

  function renderLockState() {
    const locked = isDateLocked();
    const alreadyStarted = !!state.attendanceRecord;
    dom.startAttendanceBtn.disabled = locked || alreadyStarted;
    dom.saveReportBtn.disabled = locked;
    dom.startAttendanceBtn.textContent = locked ? "Tanggal Terkunci" : alreadyStarted ? "Absensi Sudah Dimulai" : "Mulai Absen";
  }

  function renderSubmitStatus() {
    const bodyReportSaved = !!readScopedReportForScope(state.currentDate, "ALL");
    const summary = ALL_BIDANGS.map((bidang) => {
      const saved = bodyReportSaved || !!readScopedReportForScope(state.currentDate, bidang);
      return `
        <div class="status-row">
          <div>
            <strong>${escapeHtml(bidang)}</strong>
            <span>${escapeHtml(formatDate(state.currentDate, { weekday: undefined }))}</span>
          </div>
          <span class="status-badge ${saved ? "present" : "neutral"}">${saved ? "Sudah Submit" : "Belum Submit"}</span>
        </div>
      `;
    }).join("");
    dom.scopeSubmitStatus.innerHTML = summary;
  }

  function renderHeader() {
    dom.headerMeta.textContent = `${formatDate(state.currentDate)} | Akun: ${getAdminName()} | Scope: ${currentScope()} | Pegawai: ${getScopedEmployees().length}`;
  }

  function renderAttendanceSummary() {
    const rows = rowsFromScopedAttendance(state.attendanceRecord);
    const summary = calculateSummary(rows);
    dom.attendanceSummary.innerHTML = summaryCards(summary);
  }

  function renderEmployees() {
    const locked = isDateLocked();
    const rows = rowsFromScopedAttendance(state.attendanceRecord);
    const query = normalizeText(state.search);
    const filteredRows = rows.filter((row) => {
      const matchesSearch = !query || normalizeText(row.nama).includes(query) || normalizeText(row.bidang).includes(query);
      const matchesField = state.field === "ALL" || row.bidang === state.field;
      return matchesSearch && matchesField;
    });

    if (!filteredRows.length) {
      dom.employeeList.innerHTML = emptyState("Tidak ada pegawai.");
      return;
    }

    dom.employeeList.innerHTML = filteredRows
      .map((employee, idx) => {
        const statusButtons = STATUS_CONFIG.map((status) => {
          const active = employee.status === status.key ? "active" : "";
          const disabled = locked ? "disabled" : "";
          return `
            <button class="status-btn ${status.tone} ${active}" type="button" data-employee-id="${escapeHtml(employee.id)}" data-status="${escapeHtml(status.key)}" ${disabled}>
              <span class="btn-full">${escapeHtml(status.label)}</span>
              <span class="btn-short">${escapeHtml(status.short)}</span>
            </button>
          `;
        }).join("");

        return `
          <article class="employee-row">
            <div class="row-info">
              <span class="row-num">${idx + 1}</span>
              <div class="row-name">
                <strong>${escapeHtml(employee.nama)}</strong>
                <span class="row-meta">${escapeHtml(employee.bidang)}${employee.jenis === "PPPK" ? " · PPPK" : ""}</span>
              </div>
            </div>
            <div class="row-actions">
              ${statusButtons}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderDaily() {
    const daily = getDailyData();
    dom.dailyTitle.textContent = `${formatDate(state.currentDate)} - ${currentScope()}`;
    dom.dailyMeta.textContent = daily.record
      ? `Terakhir diperbarui ${formatDateTime(daily.record.updatedAt || daily.record.savedAt)}`
      : "Belum ada data absensi untuk bidang ini.";
    dom.dailySummary.innerHTML = summaryCards(daily.summary);
    dom.dailyNoteCount.textContent = `${daily.notedRows.length} catatan`;

    if (!daily.record) {
      dom.dailyAbsentList.innerHTML = emptyState("Belum ada data.");
      return;
    }

    if (!daily.notedRows.length) {
      dom.dailyAbsentList.innerHTML = emptyState("Tidak ada pegawai yang tidak hadir atau terlambat.");
      return;
    }

    dom.dailyAbsentList.innerHTML = daily.notedRows
      .map((row) => `
        <div class="status-row">
          <div>
            <strong>${escapeHtml(displayName(row))}</strong>
            <span>${escapeHtml(row.bidang)}</span>
          </div>
          <span class="status-badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>
        </div>
      `)
      .join("");
  }

  function renderMonthly() {
    const monthly = buildScopedMonthlyRows(state.currentMonth);
    dom.monthlyMeta.textContent = `${monthly.monthLabel} | ${currentScope()} | ${monthly.totalDays} hari absensi`;

    const headers = ["No", "Nama", "Bidang", "Hadir", "Sakit", "Izin", "Cuti", "Terlambat", "Tugas", "Tubel", "Total Tidak Hadir"];
    dom.monthlyTable.querySelector("thead").innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
    dom.monthlyTable.querySelector("tbody").innerHTML = monthly.rows
      .map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.nama)}</td>
          <td>${escapeHtml(row.bidang)}</td>
          <td>${row.Hadir}</td>
          <td>${row.Sakit}</td>
          <td>${row.Izin}</td>
          <td>${row.Cuti}</td>
          <td>${row.Terlambat}</td>
          <td>${row.Tugas}</td>
          <td>${row.Tubel}</td>
          <td><strong>${row.TotalTidakHadir}</strong></td>
        </tr>
      `)
      .join("");
  }

  function renderMonthlyDetail() {
    const employees = getScopedEmployees();
    const dates = enumerateMonthDates(state.currentMonth);
    const datesWithData = dates.filter((date) => hasMonthlyDataForScope(date));

    dom.monthlyDetailMeta.textContent = `${formatMonth(state.currentMonth)} | ${currentScope()} | ${datesWithData.length} hari absensi`;

    if (!datesWithData.length) {
      dom.monthlyDetailContent.innerHTML = emptyState("Belum ada data absensi pada bulan ini.");
      return;
    }

    const toneMap = Object.fromEntries(STATUS_CONFIG.map((s) => [s.key, s.tone]));

    // Build a card per day (newest first)
    const dayCards = [...datesWithData].reverse().map((date) => {
      const rows = employees.map((employee) => ({
        ...employee,
        status: getMonthlyStatusForEmployee(date, employee) || "Belum Diabsen"
      }));

      const summary = calculateSummary(rows);
      const absentRows = rows.filter((row) => row.status !== "Hadir" && row.status !== "Belum Diabsen");

      const summaryBadges = [
        `<span class="mini-badge badge-present">Hadir ${summary.Hadir}</span>`,
        `<span class="mini-badge badge-absent">Kurang ${summary.Kurang}</span>`
      ].join("");

      const absentList = absentRows.length
        ? absentRows.map((row) => `
          <div class="status-row compact-row">
            <div>
              <strong>${escapeHtml(displayName(row))}</strong>
            </div>
            <span class="status-badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>
          </div>
        `).join("")
        : `<p class="muted" style="padding:6px 0;font-size:0.82rem">Semua hadir.</p>`;

      return `
        <div class="day-card">
          <div class="day-card-header">
            <h3>${escapeHtml(formatDate(date))}</h3>
            <div class="day-card-badges">${summaryBadges}</div>
          </div>
          <div class="day-card-body">
            ${absentList}
          </div>
        </div>
      `;
    });

    dom.monthlyDetailContent.innerHTML = dayCards.join("");
  }

  function renderHistory() {
    const reports = getScopedSavedReports();
    if (!reports.length) {
      dom.historyList.innerHTML = emptyState("Belum ada laporan bidang ini.");
      return;
    }

    dom.historyList.innerHTML = reports
      .map((report) => `
        <article class="history-card">
          <div>
            <h3>${escapeHtml(formatDate(report.date))}</h3>
            <p>Bidang ${escapeHtml(report.scope)} | Disimpan ${escapeHtml(formatDateTime(report.savedAt))}</p>
            <div class="mini-summary">
              <span>Hadir ${report.summary?.Hadir ?? 0}</span>
              <span>Kurang ${report.summary?.Kurang ?? 0}</span>
              <span>Terlambat ${report.summary?.Terlambat ?? 0}</span>
            </div>
          </div>
          <button class="secondary-btn" type="button" data-open-report="${escapeHtml(report.date)}">Buka</button>
        </article>
      `)
      .join("");
  }

  function openReportDate(date) {
    state.currentDate = date;
    dom.attendanceDate.value = date;
    loadCurrentAttendance();
    switchTab("daily");
    renderAll();
  }

  function getDailyData() {
    const daily = resolveDailyData(state.currentDate);
    const record = daily.record;
    const rows = daily.rows;
    const summary = rows.length ? calculateSummary(rows) : calculateSummary([]);
    const notedRows = rows.filter((row) => row.status !== "Hadir" && row.status !== "Belum Diabsen");

    return {
      record,
      rows,
      summary,
      notedRows,
      dateLabel: formatDate(state.currentDate),
      admin: record?.admin || daily.admin || getAdminName()
    };
  }

  function isDateLocked() {
    const scope = currentScope();
    if (scope === "ALL") {
      return !!readReportForScope(state.currentDate, "ALL") || hasAnyFieldModeData(state.currentDate);
    }
    return !!readReportForScope(state.currentDate, scope) || hasAllModeData(state.currentDate);
  }

  async function exportDaily(type) {
    const daily = getDailyData();
    if (!daily.record) {
      showToast("Tidak ada data harian untuk diexport.");
      return;
    }

    try {
      const payload = {
        date: state.currentDate,
        dateLabel: `${daily.dateLabel} - ${currentScope()}`,
        admin: daily.admin,
        rows: daily.rows,
        summary: daily.summary
      };

      if (type === "excel") {
        window.ReportExporter.exportDailyExcel(payload);
      } else {
        await window.ReportExporter.exportDailyPdf(payload);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  async function exportMonthly(type) {
    const monthly = buildScopedMonthlyRows(state.currentMonth);
    if (!monthly.totalDays) {
      showToast("Belum ada data absensi pada bulan ini.");
      return;
    }

    try {
      if (type === "excel") {
        window.ReportExporter.exportMonthlyExcel(monthly);
      } else {
        await window.ReportExporter.exportMonthlyPdf(monthly);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  function buildDetailMonthlyData() {
    const employees = getScopedEmployees();
    const dates = enumerateMonthDates(state.currentMonth);
    const datesWithData = dates.filter((date) => hasMonthlyDataForScope(date));

    const days = datesWithData.map((date) => {
      const rows = employees.map((employee) => ({
        ...employee,
        displayName: displayName(employee),
        status: getMonthlyStatusForEmployee(date, employee) || "Belum Diabsen"
      }));
      const summary = calculateSummary(rows);
      const absentRows = rows.filter((row) => row.status !== "Hadir" && row.status !== "Belum Diabsen");
      return {
        date,
        dateLabel: formatDate(date),
        summary,
        absentRows
      };
    });

    return {
      month: state.currentMonth,
      monthLabel: formatMonth(state.currentMonth),
      scope: currentScope(),
      totalDays: datesWithData.length,
      days
    };
  }

  async function exportDetailMonthly(type) {
    const data = buildDetailMonthlyData();
    if (!data.totalDays) {
      showToast("Belum ada data absensi pada bulan ini.");
      return;
    }

    try {
      if (type === "excel") {
        window.ReportExporter.exportDetailMonthlyExcel(data);
      } else {
        await window.ReportExporter.exportDetailMonthlyPdf(data);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  function summaryCards(summary) {
    const cards = [
      ["Total", summary.Total, "total"],
      ["Kurang", summary.Kurang, "absent"],
      ["Hadir", summary.Hadir, "present"],
      ["Sakit", summary.Sakit, "sick"],
      ["Izin", summary.Izin, "permit"],
      ["Cuti", summary.Cuti, "leave"],
      ["Terlambat", summary.Terlambat, "late"],
      ["Tugas", summary.Tugas, "duty"],
      ["Tubel", summary.Tubel, "study"]
    ];

    return cards
      .map(([label, value, tone]) => `
        <article class="summary-card ${tone}">
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
        </article>
      `)
      .join("");
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function statusTone(status) {
    return STATUS_CONFIG.find((item) => item.key === status)?.tone || "neutral";
  }

  function currentScope() {
    return state.currentUser?.scope || "SEKRETARIAT";
  }

  function getAdminName() {
    return state.currentUser?.username || "SEKRETARIAT";
  }

  function getScopedEmployees() {
    return getEmployeesForScope(currentScope());
  }

  const BIDANG_ORDER = { "SEKRETARIAT": 0, "PENDAPATAN 1": 1, "PENDAPATAN 2": 2, "ASET 1": 3, "ASET 2": 4 };
  const JENIS_ORDER = { "ASN": 0, "PPPK": 1, "Honorer": 2 };

  function getEmployeesForScope(scope) {
    const active = (window.PEGAWAI || []).filter((p) => p.is_active !== false && p.is_active !== 0);
    const filtered = scope === "ALL" ? active : active.filter((employee) => employee.bidang === scope);
    return filtered.sort((a, b) => {
      const bidangDiff = (BIDANG_ORDER[a.bidang] ?? 99) - (BIDANG_ORDER[b.bidang] ?? 99);
      if (bidangDiff !== 0) return bidangDiff;
      return (JENIS_ORDER[a.jenis] ?? 99) - (JENIS_ORDER[b.jenis] ?? 99);
    });
  }

  function displayName(employee) {
    return `${employee.nama}${employee.jenis === "PPPK" ? " (PPPK)" : ""}`;
  }

  function rowsFromScopedAttendance(record) {
    return rowsFromAttendanceForScope(record, currentScope());
  }

  function rowsFromAttendanceForScope(record, scope) {
    const attendance = record?.attendance || {};
    return getEmployeesForScope(scope).map((employee) => ({
      ...employee,
      displayName: displayName(employee),
      status: attendance[employee.id] || "Belum Diabsen"
    }));
  }

  function rowsFromReportForScope(report, scope) {
    if (!report?.rows?.length) return [];
    return report.rows
      .filter((row) => scope === "ALL" || row.bidang === scope)
      .map((row) => ({
        ...row,
        displayName: row.displayName || displayName(row)
      }));
  }

  function resolveDailyData(date) {
    const scope = currentScope();
    const ownAttendance = state.attendanceRecord || readAttendanceForScope(date, scope);
    const ownReport = readReportForScope(date, scope);

    if (ownAttendance) {
      return {
        record: ownAttendance,
        rows: rowsFromAttendanceForScope(ownAttendance, scope),
        admin: ownAttendance.admin
      };
    }

    if (ownReport) {
      return {
        record: ownReport,
        rows: rowsFromReportForScope(ownReport, scope),
        admin: ownReport.admin
      };
    }

    if (scope === "ALL") {
      return resolveCombinedFieldDailyData(date);
    }

    const bodyAttendance = readAttendanceForScope(date, "ALL");
    const bodyReport = readReportForScope(date, "ALL");
    if (bodyAttendance) {
      return {
        record: bodyAttendance,
        rows: rowsFromAttendanceForScope(bodyAttendance, scope),
        admin: bodyAttendance.admin
      };
    }
    if (bodyReport) {
      return {
        record: bodyReport,
        rows: rowsFromReportForScope(bodyReport, scope),
        admin: bodyReport.admin
      };
    }

    return { record: null, rows: [], admin: "" };
  }

  function resolveCombinedFieldDailyData(date) {
    let latestRecord = null;
    const rows = ALL_BIDANGS.flatMap((scope) => {
      const report = readReportForScope(date, scope);
      const attendance = readAttendanceForScope(date, scope);
      const record = report || attendance;
      if (record && (!latestRecord || String(record.savedAt || record.updatedAt || "") > String(latestRecord.savedAt || latestRecord.updatedAt || ""))) {
        latestRecord = record;
      }
      if (report) return rowsFromReportForScope(report, scope);
      if (attendance) return rowsFromAttendanceForScope(attendance, scope);
      return getEmployeesForScope(scope).map((employee) => ({
        ...employee,
        displayName: displayName(employee),
        status: "Belum Diabsen"
      }));
    });

    const hasAnyData = ALL_BIDANGS.some((scope) => readReportForScope(date, scope) || readAttendanceForScope(date, scope));
    return {
      record: hasAnyData ? latestRecord || { date, scope: "ALL", admin: "Gabungan Bidang" } : null,
      rows: hasAnyData ? rows : [],
      admin: latestRecord?.admin || "Gabungan Bidang"
    };
  }

  function scopeKey(scope) {
    return String(scope).replaceAll(" ", "_");
  }

  function scopedDateKey(date, scope) {
    return `${date}__${scopeKey(scope)}`;
  }

  function parseJson(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readScopedAttendance(date) {
    return readAttendanceForScope(date, currentScope());
  }

  function saveScopedAttendance(date, record) {
    const key = attendanceKey(scopedDateKey(date, currentScope()));
    const nextRecord = {
      ...record,
      date,
      scope: currentScope(),
      admin: getAdminName(),
      updatedAt: new Date().toISOString()
    };
    storageSet(key, JSON.stringify(nextRecord));
    state.attendanceRecord = nextRecord;
    queueAttendanceSync(nextRecord);
    return nextRecord;
  }

  function readScopedReport(date) {
    return readReportForScope(date, currentScope());
  }

  function readScopedReportForScope(date, scope) {
    return readReportForScope(date, scope);
  }

  function readAttendanceForScope(date, scope) {
    const scopedRecord = readExactAttendanceForScope(date, scope);
    if (scopedRecord) return scopedRecord;

    const legacyRecord = parseJson(storageGet(attendanceKey(date)), null);
    if (!legacyRecord) return null;
    return {
      ...legacyRecord,
      scope: legacyRecord.scope || "ALL"
    };
  }

  function readReportForScope(date, scope) {
    const scopedReport = readExactReportForScope(date, scope);
    if (scopedReport) return scopedReport;

    const legacyKey = reportKey(date);
    const legacyReport = parseJson(storageGet(legacyKey), null);
    if (!legacyReport) return null;

    const legacyScope = legacyReport.scope || inferReportScope(legacyReport, legacyKey);
    if (scope === "ALL" && legacyScope !== "ALL") return null;
    if (scope !== "ALL" && legacyScope !== scope && legacyScope !== "ALL") return null;

    return {
      ...legacyReport,
      scope: legacyScope
    };
  }

  function readExactAttendanceForScope(date, scope) {
    const key = attendanceKey(scopedDateKey(date, scope));
    return parseJson(storageGet(key), null);
  }

  function readExactReportForScope(date, scope) {
    const key = reportKey(scopedDateKey(date, scope));
    return parseJson(storageGet(key), null);
  }

  function hasAllModeData(date) {
    return !!readAttendanceForScope(date, "ALL") || !!readReportForScope(date, "ALL");
  }

  function hasAnyFieldModeData(date) {
    return ALL_BIDANGS.some((scope) => readExactAttendanceForScope(date, scope) || readExactReportForScope(date, scope)) || hasLegacyFieldReport(date);
  }

  function hasLegacyFieldReport(date) {
    const legacyKey = reportKey(date);
    const legacyReport = parseJson(storageGet(legacyKey), null);
    if (!legacyReport) return false;
    const legacyScope = legacyReport.scope || inferReportScope(legacyReport, legacyKey);
    return legacyScope !== "ALL";
  }

  function lockMessage() {
    const scope = currentScope();
    if (scope === "ALL" && hasAnyFieldModeData(state.currentDate)) {
      return "Tanggal ini sudah dipakai mode bidang. Hapus data dari akun bidang terkait dulu.";
    }
    if (scope !== "ALL" && hasAllModeData(state.currentDate)) {
      return "Tanggal ini sudah dipakai akun badan. Hapus data akun badan dulu.";
    }
    return "Tanggal ini sudah terkunci.";
  }

  function deleteBlockedMessage() {
    const scope = currentScope();
    if (scope === "ALL" && hasAnyFieldModeData(state.currentDate)) {
      return "Data tanggal ini berasal dari akun bidang. Hapus lewat akun bidang masing-masing.";
    }
    if (scope !== "ALL" && hasAllModeData(state.currentDate)) {
      return "Data tanggal ini berasal dari akun badan. Hapus lewat akun badan.";
    }
    return "Tidak ada data pada tanggal ini.";
  }

  function saveScopedReport(date, report) {
    const key = reportKey(scopedDateKey(date, currentScope()));
    const nextReport = {
      ...report,
      date,
      scope: currentScope(),
      admin: report.admin || getAdminName(),
      updatedAt: new Date().toISOString()
    };
    storageSet(key, JSON.stringify(nextReport));
    if (isSupabaseConfigured()) {
      getSupabaseSync()
        .upsertReport(nextReport)
        .then((result) => {
          if (!result.ok && !result.skipped) {
            showSupabaseSyncError(result.error || "gagal sync laporan.");
          }
        })
        .catch((error) => {
          showSupabaseSyncError(error.message || "gagal sync laporan.");
        });
    }
  }

  function deleteScopedDateData(date) {
    const scope = currentScope();
    const attendanceStorageKey = attendanceKey(scopedDateKey(date, currentScope()));
    const reportStorageKey = reportKey(scopedDateKey(date, currentScope()));
    storageRemove(attendanceStorageKey);
    storageRemove(reportStorageKey);

    if (hasOwnLegacyAttendance(date)) storageRemove(attendanceKey(date));
    if (hasOwnLegacyReport(date)) storageRemove(reportKey(date));

    if (isSupabaseConfigured()) {
      getSupabaseSync()
        .deleteScopeDateData(date, scope)
        .then((result) => {
          if (!result.ok && !result.skipped) {
            showSupabaseSyncError(result.error || "gagal hapus data remote.");
          }
        })
        .catch((error) => {
          showSupabaseSyncError(error.message || "gagal hapus data remote.");
        });
    }
  }

  function hasOwnScopedData(date) {
    return (
      !!readExactAttendanceForScope(date, currentScope()) ||
      !!readExactReportForScope(date, currentScope()) ||
      hasOwnLegacyAttendance(date) ||
      hasOwnLegacyReport(date)
    );
  }

  function hasOwnLegacyAttendance(date) {
    const record = parseJson(storageGet(attendanceKey(date)), null);
    if (!record) return false;
    if (record.scope) return record.scope === currentScope();
    return currentScope() === "ALL";
  }

  function hasOwnLegacyReport(date) {
    const legacyKey = reportKey(date);
    const report = parseJson(storageGet(legacyKey), null);
    if (!report) return false;
    const legacyScope = report.scope || inferReportScope(report, legacyKey);
    return legacyScope === currentScope();
  }

  function getScopedSavedReports() {
    const scopedReports = [];
    const prefix = "laporan_";
    const activeScope = currentScope();

    for (let index = 0; index < storageLength(); index += 1) {
      const key = storageKey(index);
      if (!key || !key.startsWith(prefix)) continue;
      const report = parseJson(storageGet(key), null);
      if (!report) continue;

      const reportScope = report.scope || inferReportScope(report, key);
      if (activeScope !== "ALL" && reportScope !== activeScope && reportScope !== "ALL") continue;

      scopedReports.push({
        ...report,
        scope: reportScope
      });
    }

    return scopedReports.sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      if (byDate !== 0) return byDate;
      return String(a.scope).localeCompare(String(b.scope));
    });
  }

  function inferReportScope(report, key) {
    const scopeFromKey = key.includes("__") ? key.split("__").pop().replaceAll("_", " ") : "";
    if (scopeFromKey) return scopeFromKey;

    const bidangSet = new Set((report.rows || []).map((row) => row.bidang).filter(Boolean));
    if (bidangSet.size === 1) return [...bidangSet][0];
    return "ALL";
  }

  function buildScopedMonthlyRows(monthString) {
    const employees = getScopedEmployees();
    const dates = enumerateMonthDates(monthString);
    const datesWithData = dates.filter((date) => hasMonthlyDataForScope(date));

    const rows = employees.map((employee) => {
      const base = {
        id: employee.id,
        nama: displayName(employee),
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

      datesWithData.forEach((date) => {
        const status = getMonthlyStatusForEmployee(date, employee);
        if (base[status] !== undefined) base[status] += 1;
      });
      base.TotalTidakHadir = base.Sakit + base.Izin + base.Cuti + base.Tugas + base.Tubel;
      return base;
    });

    return {
      month: monthString,
      monthLabel: formatMonth(monthString),
      totalDays: datesWithData.length,
      rows
    };
  }

  function hasMonthlyDataForScope(date) {
    const scope = currentScope();
    if (scope === "ALL") {
      return hasAllModeData(date) || hasAnyFieldModeData(date);
    }
    return !!readAttendanceForScope(date, scope) || !!readReportForScope(date, scope) || hasAllModeData(date);
  }

  function getMonthlyStatusForEmployee(date, employee) {
    const scope = currentScope();
    if (scope === "ALL") {
      const bodyRecord = readAttendanceForScope(date, "ALL");
      if (bodyRecord?.attendance?.[employee.id]) return bodyRecord.attendance[employee.id];
      const bodyReportStatus = getStatusFromReport(date, "ALL", employee.id);
      if (bodyReportStatus) return bodyReportStatus;
      const fieldRecord = readAttendanceForScope(date, employee.bidang);
      if (fieldRecord?.attendance?.[employee.id]) return fieldRecord.attendance[employee.id];
      return getStatusFromReport(date, employee.bidang, employee.id);
    }

    const scopedRecord = readAttendanceForScope(date, scope);
    if (scopedRecord?.attendance?.[employee.id]) return scopedRecord.attendance[employee.id];
    const scopedReportStatus = getStatusFromReport(date, scope, employee.id);
    if (scopedReportStatus) return scopedReportStatus;
    const bodyRecord = readAttendanceForScope(date, "ALL");
    if (bodyRecord?.attendance?.[employee.id]) return bodyRecord.attendance[employee.id];
    return getStatusFromReport(date, "ALL", employee.id);
  }

  function getStatusFromReport(date, scope, employeeId) {
    const report = readReportForScope(date, scope);
    return report?.rows?.find((row) => row.id === employeeId)?.status;
  }

  function enumerateMonthDates(monthString) {
    const [yearText, monthText] = monthString.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return [];

    const dates = [];
    const current = new Date(year, month - 1, 1);
    while (current.getMonth() === month - 1) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function writeSessionUser(user) {
    sessionSet(SESSION_USER_KEY, JSON.stringify(user));
  }

  function readSessionUser() {
    const value = sessionGet(SESSION_USER_KEY);
    const parsed = parseJson(value, null);
    if (!parsed) return null;
    const account = ACCOUNTS.find((item) => item.scope === parsed.scope && item.username === parsed.username);
    return account ? parsed : null;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => {
      dom.toast.classList.remove("show");
    }, 2200);
  }

  function scrollToEmployeeList() {
    if (!dom.employeeList) return;
    const firstRow = dom.employeeList.querySelector(".employee-row");
    const target = firstRow || dom.employeeList;
    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ─────────────────────────────────────────────
  // Pegawai management (admin ALL only)
  // ─────────────────────────────────────────────

  function updatePegawaiTabVisibility() {
    const pegawaiTabBtn = dom.tabButtons.find((btn) => btn.dataset.tab === "pegawai");
    if (!pegawaiTabBtn) return;
    const isAdmin = currentScope() === "ALL";
    pegawaiTabBtn.classList.toggle("hidden", !isAdmin);
  }

  function renderPegawai() {
    if (currentScope() !== "ALL") return;
    const allPegawai = window.PEGAWAI || [];
    const query = normalizeText(dom.pegawaiSearchInput.value || "");
    const bidangFilter = dom.pegawaiBidangFilter.value;

    const filtered = allPegawai.filter((p) => {
      const matchesSearch = !query || normalizeText(p.nama).includes(query) || normalizeText(p.bidang).includes(query);
      const matchesBidang = bidangFilter === "ALL" || p.bidang === bidangFilter;
      return matchesSearch && matchesBidang;
    });

    dom.pegawaiMeta.textContent = `${filtered.length} dari ${allPegawai.length} pegawai`;

    if (!filtered.length) {
      dom.pegawaiList.innerHTML = emptyState("Tidak ada pegawai ditemukan.");
      return;
    }

    const bidangOrder = ["SEKRETARIAT", "PENDAPATAN 1", "PENDAPATAN 2", "ASET 1", "ASET 2"];
    const grouped = {};
    filtered.forEach((p) => {
      const b = p.bidang || "Lainnya";
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(p);
    });

    const sortedBidangs = Object.keys(grouped).sort((a, b) => {
      const ai = bidangOrder.indexOf(a);
      const bi = bidangOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    function cardHtml(p) {
      const isActive = p.is_active !== false && p.is_active !== 0;
      const activeBadge = isActive
        ? `<span class="status-badge present">Aktif</span>`
        : `<span class="status-badge inactive-badge">Nonaktif</span>`;
      return `
        <article class="employee-card">
          <div class="employee-main">
            <div>
              <h3>${escapeHtml(p.nama)}</h3>
              <p>${escapeHtml(p.jenis || "ASN")}</p>
            </div>
            ${activeBadge}
          </div>
          <div class="pegawai-card-actions">
            <button class="secondary-btn" type="button" data-pegawai-edit="${escapeHtml(String(p.id))}">Edit</button>
            <button class="ghost-btn ${isActive ? "danger" : ""}" type="button" data-pegawai-toggle="${escapeHtml(String(p.id))}">
              ${isActive ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        </article>
      `;
    }

    const sections = sortedBidangs.map((bidang) => {
      const members = grouped[bidang];
      const asn = members.filter((p) => (p.jenis || "ASN") === "ASN");
      const pppk = members.filter((p) => p.jenis === "PPPK");
      const lainnya = members.filter((p) => p.jenis !== "PPPK" && (p.jenis || "ASN") !== "ASN");

      let subSections = "";
      if (asn.length) {
        subSections += `
          <div class="pegawai-jenis-group">
            <h4 class="pegawai-jenis-label" data-jenis="ASN">ASN (${asn.length})</h4>
            <div class="employee-list">${asn.map(cardHtml).join("")}</div>
          </div>`;
      }
      if (pppk.length) {
        subSections += `
          <div class="pegawai-jenis-group">
            <h4 class="pegawai-jenis-label" data-jenis="PPPK">PPPK (${pppk.length})</h4>
            <div class="employee-list">${pppk.map(cardHtml).join("")}</div>
          </div>`;
      }
      if (lainnya.length) {
        subSections += `
          <div class="pegawai-jenis-group">
            <h4 class="pegawai-jenis-label" data-jenis="Lainnya">Lainnya (${lainnya.length})</h4>
            <div class="employee-list">${lainnya.map(cardHtml).join("")}</div>
          </div>`;
      }

      return `
        <div class="pegawai-bidang-section">
          <h3 class="pegawai-bidang-title" data-bidang="${escapeHtml(bidang)}">${escapeHtml(bidang)} <span class="muted">(${members.length})</span></h3>
          ${subSections}
        </div>`;
    });

    dom.pegawaiList.innerHTML = sections.join("");
  }

  function handleShowAddPegawai() {
    dom.pegawaiFormCard.classList.remove("hidden");
    dom.pegawaiFormTitle.textContent = "Tambah Pegawai";
    dom.pegawaiNama.value = "";
    dom.pegawaiBidang.value = "SEKRETARIAT";
    dom.pegawaiJenis.value = "ASN";
    dom.pegawaiEditId.value = "";
    dom.pegawaiNama.focus();
  }

  function handleShowEditPegawai(id) {
    const pegawai = (window.PEGAWAI || []).find((p) => String(p.id) === String(id));
    if (!pegawai) return;
    dom.pegawaiFormCard.classList.remove("hidden");
    dom.pegawaiFormTitle.textContent = "Edit Pegawai";
    dom.pegawaiNama.value = pegawai.nama || "";
    dom.pegawaiBidang.value = pegawai.bidang || "SEKRETARIAT";
    dom.pegawaiJenis.value = pegawai.jenis || "ASN";
    dom.pegawaiEditId.value = String(pegawai.id);
    dom.pegawaiNama.focus();
  }

  function handleCancelPegawaiForm() {
    dom.pegawaiFormCard.classList.add("hidden");
    dom.pegawaiEditId.value = "";
  }

  async function handleSavePegawai() {
    const nama = (dom.pegawaiNama.value || "").trim();
    const bidang = dom.pegawaiBidang.value;
    const jenis = dom.pegawaiJenis.value;
    const editId = dom.pegawaiEditId.value;

    if (!nama) {
      showToast("Nama wajib diisi.");
      return;
    }

    const sync = getSupabaseSync();
    if (!sync) {
      showToast("Server tidak tersedia.");
      return;
    }

    try {
      if (editId) {
        const result = await sync.updatePegawai(editId, { nama, bidang, jenis });
        if (!result.ok) {
          showToast(result.error || "Gagal memperbarui pegawai.");
          return;
        }
        showToast("Pegawai berhasil diperbarui.");
      } else {
        const result = await sync.addPegawai({ nama, bidang, jenis });
        if (!result.ok) {
          showToast(result.error || "Gagal menambah pegawai.");
          return;
        }
        showToast("Pegawai berhasil ditambahkan.");
      }

      handleCancelPegawaiForm();
      await loadPegawaiFromServer();
      renderPegawai();
      populateFieldFilter();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleTogglePegawai(id) {
    const pegawai = (window.PEGAWAI || []).find((p) => String(p.id) === String(id));
    if (!pegawai) return;

    const isActive = pegawai.is_active !== false && pegawai.is_active !== 0;
    const action = isActive ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${pegawai.nama}?`)) return;

    const sync = getSupabaseSync();
    if (!sync) {
      showToast("Server tidak tersedia.");
      return;
    }

    try {
      const result = await sync.updatePegawai(id, { is_active: !isActive });
      if (!result.ok) {
        showToast(result.error || "Gagal mengubah status pegawai.");
        return;
      }
      showToast(`Pegawai berhasil ${isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      await loadPegawaiFromServer();
      renderPegawai();
    } catch (error) {
      showToast(error.message);
    }
  }

  function handlePegawaiListClick(event) {
    const editBtn = event.target.closest("[data-pegawai-edit]");
    if (editBtn) {
      handleShowEditPegawai(editBtn.dataset.pegawaiEdit);
      return;
    }
    const toggleBtn = event.target.closest("[data-pegawai-toggle]");
    if (toggleBtn) {
      handleTogglePegawai(toggleBtn.dataset.pegawaiToggle);
    }
  }
})();
