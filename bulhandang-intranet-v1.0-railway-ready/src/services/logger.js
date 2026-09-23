const db = require("../config/db");

async function log(req, action, detail = "") {
  try {
    await db.query(
      "INSERT INTO activity_logs (user_id, action, detail, ip_address) VALUES ($1,$2,$3,$4)",
      [req.session.user?.id || null, action, detail, req.ip]
    );
  } catch (err) {
    console.error("activity log error:", err.message);
  }
}

module.exports = { log };
