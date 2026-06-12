const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.API_PORT || 3000;

// ---------------------------------------------------------------------------
// Database pool
// ---------------------------------------------------------------------------
const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || "bpad_absensi",
  user: process.env.PG_USER || "bpad",
  password: process.env.PG_PASSWORD || "",
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error", err);
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------------------
// Basic Auth middleware
// ---------------------------------------------------------------------------
const API_USER = process.env.API_USER || "bpad";
const API_PASS = process.env.API_PASS || "";

function basicAuth(req, res, next) {
  // Skip auth for health and login endpoints
  if (req.path === "/api/health" || req.path === "/api/auth/login") return next();

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="BPAD API"');
    return res.status(401).json({ ok: false, error: "Authentication required." });
  }

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
  const [user, pass] = decoded.split(":");
  if (user !== API_USER || pass !== API_PASS) {
    res.setHeader("WWW-Authenticate", 'Basic realm="BPAD API"');
    return res.status(401).json({ ok: false, error: "Invalid credentials." });
  }

  next();
}

app.use(basicAuth);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Attendance records
// ---------------------------------------------------------------------------

/**
 * POST /api/attendance/upsert
 * Body: { date, scope, admin, attendance, createdAt, updatedAt }
 */
app.post("/api/attendance/upsert", async (req, res) => {
  try {
    const { date, scope, admin, attendance, createdAt, updatedAt } = req.body;
    if (!date || !scope) {
      return res.status(400).json({ ok: false, error: "date and scope are required" });
    }

    const sql = `
      insert into absen_attendance_records (date, scope, admin, attendance, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (date, scope)
      do update set admin = $3, attendance = $4, updated_at = $6
    `;
    await pool.query(sql, [
      date,
      scope,
      admin || "",
      JSON.stringify(attendance || {}),
      createdAt || new Date().toISOString(),
      updatedAt || new Date().toISOString()
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("upsert attendance error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/attendance?date=YYYY-MM-DD&scope=...
 * Returns attendance records filtered by date (and optionally scope).
 */
app.get("/api/attendance", async (req, res) => {
  try {
    const { date, scope } = req.query;
    if (!date) {
      return res.status(400).json({ ok: false, error: "date query param is required" });
    }

    let sql = "select * from absen_attendance_records where date = $1";
    const params = [date];

    if (scope && scope !== "ALL") {
      sql += " and scope in ($2, 'ALL')";
      params.push(scope);
    }

    sql += " order by scope";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("get attendance error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/attendance/month?scope=...&month=YYYY-MM
 * Returns attendance records for a whole month.
 */
app.get("/api/attendance/month", async (req, res) => {
  try {
    const { scope, month } = req.query;
    if (!month) {
      return res.status(400).json({ ok: false, error: "month query param is required (YYYY-MM)" });
    }

    const [yearText, monthText] = String(month).split("-");
    const year = Number(yearText);
    const monthNum = Number(monthText);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ ok: false, error: "Invalid month format. Use YYYY-MM." });
    }

    const fromDate = `${yearText}-${monthText}-01`;
    const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const toDate = `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`;

    let sql = "select * from absen_attendance_records where date >= $1 and date <= $2";
    const params = [fromDate, toDate];

    if (scope && scope !== "ALL") {
      sql += " and scope in ($3, 'ALL')";
      params.push(scope);
    }

    sql += " order by date, scope";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("get monthly attendance error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Daily reports
// ---------------------------------------------------------------------------

/**
 * POST /api/reports/upsert
 * Body: { date, scope, admin, summary, rows, notes, savedAt, updatedAt }
 */
app.post("/api/reports/upsert", async (req, res) => {
  try {
    const { date, scope, admin, summary, rows, notes, savedAt, updatedAt } = req.body;
    if (!date || !scope) {
      return res.status(400).json({ ok: false, error: "date and scope are required" });
    }

    const sql = `
      insert into absen_daily_reports (date, scope, admin, summary, rows, notes, saved_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (date, scope)
      do update set admin = $3, summary = $4, rows = $5, notes = $6, updated_at = $8
    `;
    await pool.query(sql, [
      date,
      scope,
      admin || "",
      JSON.stringify(summary || {}),
      JSON.stringify(rows || []),
      JSON.stringify(notes || []),
      savedAt || new Date().toISOString(),
      updatedAt || new Date().toISOString()
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("upsert report error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/reports?scope=...
 * Returns reports ordered by date descending.
 */
app.get("/api/reports", async (req, res) => {
  try {
    const { scope } = req.query;

    let sql = "select * from absen_daily_reports";
    const params = [];

    if (scope && scope !== "ALL") {
      sql += " where scope in ($1, 'ALL')";
      params.push(scope);
    }

    sql += " order by date desc, scope";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("get reports error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Combined date data (attendance + reports)
// ---------------------------------------------------------------------------

/**
 * GET /api/data/:date?scope=...
 * Returns both attendance records and reports for a given date.
 */
app.get("/api/data/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { scope } = req.query;

    let attendSql = "select * from absen_attendance_records where date = $1";
    let reportSql = "select * from absen_daily_reports where date = $1";
    const attendParams = [date];
    const reportParams = [date];

    if (scope && scope !== "ALL") {
      attendSql += " and scope in ($2, 'ALL')";
      reportSql += " and scope in ($2, 'ALL')";
      attendParams.push(scope);
      reportParams.push(scope);
    }

    const [attendResult, reportResult] = await Promise.all([
      pool.query(attendSql + " order by scope", attendParams),
      pool.query(reportSql + " order by scope", reportParams)
    ]);

    res.json({
      ok: true,
      attendances: attendResult.rows,
      reports: reportResult.rows
    });
  } catch (err) {
    console.error("get date data error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Delete data for a date + scope
// ---------------------------------------------------------------------------

/**
 * DELETE /api/data/:date/:scope
 * Deletes both attendance and report for a specific date and scope.
 */
app.delete("/api/data/:date/:scope", async (req, res) => {
  try {
    const { date, scope } = req.params;

    await Promise.all([
      pool.query("delete from absen_daily_reports where date = $1 and scope = $2", [date, scope]),
      pool.query("delete from absen_attendance_records where date = $1 and scope = $2", [date, scope])
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("delete data error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Password hashing (crypto.scrypt — Node.js built-in, no dependency)
// ---------------------------------------------------------------------------
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login  (exempt from Basic Auth)
 * Body: { username, password }
 * Returns: { ok, user: { username, scope } }
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Username dan password wajib diisi." });
    }

    const cleanUsername = String(username).trim().toUpperCase();
    const { rows } = await pool.query(
      "select scope, username, password_hash, salt from absen_users where username = $1",
      [cleanUsername]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Akun tidak terdaftar." });
    }

    const user = rows[0];
    if (!verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ ok: false, error: "Password tidak sesuai." });
    }

    res.json({ ok: true, user: { username: user.username, scope: user.scope } });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/auth/change-password  (requires Basic Auth)
 * Body: { scope, oldPassword, newPassword }
 */
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { scope, oldPassword, newPassword } = req.body;
    if (!scope || !oldPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "Semua field wajib diisi." });
    }
    if (String(newPassword).trim().length < 4) {
      return res.status(400).json({ ok: false, error: "Password baru minimal 4 karakter." });
    }

    const { rows } = await pool.query(
      "select password_hash, salt from absen_users where scope = $1",
      [scope]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Akun tidak ditemukan." });
    }

    if (!verifyPassword(oldPassword, rows[0].password_hash, rows[0].salt)) {
      return res.status(401).json({ ok: false, error: "Password lama tidak sesuai." });
    }

    const { hash, salt } = hashPassword(String(newPassword).trim());
    await pool.query(
      "update absen_users set password_hash = $1, salt = $2, updated_at = now() where scope = $3",
      [hash, salt, scope]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("change-password error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/auth/users  (requires Basic Auth)
 * Returns list of all users (without passwords).
 */
app.get("/api/auth/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "select scope, username, updated_at from absen_users order by scope"
    );
    res.json({ ok: true, users: rows });
  } catch (err) {
    console.error("get users error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Seed default users on first startup
// ---------------------------------------------------------------------------
const DEFAULT_USERS = [
  { scope: "ALL", username: "BADAN PENDAPATAN DAN ASET DAERAH", password: "bpad1" },
  { scope: "SEKRETARIAT", username: "SEKRETARIAT", password: "sekretariat1" },
  { scope: "PENDAPATAN 1", username: "PENDAPATAN 1", password: "pendapatan1" },
  { scope: "PENDAPATAN 2", username: "PENDAPATAN 2", password: "pendapatan2" },
  { scope: "ASET 1", username: "ASET 1", password: "aset1" },
  { scope: "ASET 2", username: "ASET 2", password: "aset2" }
];

async function seedUsers() {
  for (const u of DEFAULT_USERS) {
    const { rows } = await pool.query("select scope from absen_users where scope = $1", [u.scope]);
    if (rows.length === 0) {
      const { hash, salt } = hashPassword(u.password);
      await pool.query(
        "insert into absen_users (scope, username, password_hash, salt) values ($1, $2, $3, $4)",
        [u.scope, u.username, hash, salt]
      );
      console.log(`Seeded user: ${u.username} (${u.scope})`);
    }
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`BPAD Absensi API listening on port ${PORT}`);
  try {
    await seedUsers();
    console.log("User seeding complete.");
  } catch (err) {
    console.error("User seeding failed:", err.message);
  }
});
