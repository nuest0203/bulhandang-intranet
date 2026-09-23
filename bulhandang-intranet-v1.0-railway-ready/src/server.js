require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const db = require("./config/db");
const session = require("./config/session");
const { requireAuth, requireRole } = require("./middleware/auth");
const { log } = require("./services/logger");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(session);

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});


async function ensureSchema() {
  const schemaPath = path.join(__dirname, "../db/init.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await db.query(schemaSql);
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const found = await db.query("SELECT id FROM users WHERE email=$1", [email]);
  if (found.rowCount === 0) {
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      "INSERT INTO users (email,password_hash,name,role) VALUES ($1,$2,$3,'ADMIN')",
      [email, hash, "관리자"]
    );
    console.log(`Initial admin created: ${email}`);
  }
}

app.get("/", requireAuth, async (req, res) => {
  const [notice, members, attendance, strike, food] = await Promise.all([
    db.query("SELECT n.*, u.name AS author_name FROM notices n LEFT JOIN users u ON u.id=n.author_id ORDER BY n.created_at DESC LIMIT 5"),
    db.query("SELECT COUNT(*)::int AS count FROM users WHERE active=true"),
    db.query("SELECT COUNT(*)::int AS count FROM attendance WHERE attendance_date=CURRENT_DATE AND status='PRESENT'"),
    db.query("SELECT COUNT(*)::int AS count FROM strike_team WHERE status <> 'DONE'"),
    db.query("SELECT COUNT(*)::int AS count FROM late_night_food WHERE menu_date=CURRENT_DATE")
  ]);
  res.render("dashboard", {
    title: "대시보드",
    notices: notice.rows,
    stats: {
      members: members.rows[0].count,
      attendance: attendance.rows[0].count,
      strike: strike.rows[0].count,
      food: food.rows[0].count
    }
  });
});

app.get("/login", (req,res) => res.render("login", { title: "로그인" }));

app.post("/login", async (req,res) => {
  const { email, password } = req.body;
  const result = await db.query("SELECT * FROM users WHERE email=$1 AND active=true", [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).render("login", { title: "로그인", error: "이메일 또는 비밀번호가 올바르지 않습니다." });
  }

  req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  await log(req, "LOGIN");
  res.redirect("/");
});

app.post("/logout", requireAuth, async (req,res) => {
  await log(req, "LOGOUT");
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/members", requireRole("ADMIN","LEADER"), async (req,res) => {
  const result = await db.query("SELECT id,email,name,role,active,created_at FROM users ORDER BY created_at DESC");
  res.render("members", { title: "조직원 관리", members: result.rows });
});

app.post("/members", requireRole("ADMIN"), async (req,res) => {
  const { email, password, name, role } = req.body;
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await db.query(
      "INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,$4) RETURNING id",
      [email,hash,name,role]
    );
    await log(req,"CREATE_MEMBER",`member_id=${result.rows[0].id}`);
    res.redirect("/members");
  } catch {
    res.status(400).render("error",{title:"등록 실패",message:"이메일이 이미 존재하거나 입력값이 올바르지 않습니다."});
  }
});

app.post("/members/:id/toggle", requireRole("ADMIN"), async (req,res) => {
  await db.query("UPDATE users SET active=NOT active WHERE id=$1",[req.params.id]);
  await log(req,"TOGGLE_MEMBER",`member_id=${req.params.id}`);
  res.redirect("/members");
});

app.get("/notices", requireAuth, async (req,res) => {
  const result = await db.query("SELECT n.*,u.name AS author_name FROM notices n LEFT JOIN users u ON u.id=n.author_id ORDER BY n.created_at DESC");
  res.render("notices",{title:"공지사항",notices:result.rows});
});

app.post("/notices", requireRole("ADMIN","LEADER"), async (req,res) => {
  await db.query("INSERT INTO notices(title,content,author_id) VALUES($1,$2,$3)",[req.body.title,req.body.content,req.session.user.id]);
  await log(req,"CREATE_NOTICE",req.body.title);
  res.redirect("/notices");
});

app.post("/notices/:id/delete", requireRole("ADMIN","LEADER"), async (req,res) => {
  await db.query("DELETE FROM notices WHERE id=$1",[req.params.id]);
  await log(req,"DELETE_NOTICE",`notice_id=${req.params.id}`);
  res.redirect("/notices");
});

app.get("/attendance", requireAuth, async (req,res) => {
  const result = await db.query(`
    SELECT a.*,u.name,u.email
    FROM attendance a JOIN users u ON u.id=a.user_id
    WHERE a.attendance_date=CURRENT_DATE
    ORDER BY a.created_at DESC
  `);
  res.render("attendance",{title:"출석",records:result.rows});
});

app.post("/attendance", requireAuth, async (req,res) => {
  await db.query(`
    INSERT INTO attendance(user_id,attendance_date,status)
    VALUES($1,CURRENT_DATE,$2)
    ON CONFLICT(user_id,attendance_date)
    DO UPDATE SET status=EXCLUDED.status
  `,[req.session.user.id,req.body.status || "PRESENT"]);
  await log(req,"ATTENDANCE",req.body.status || "PRESENT");
  res.redirect("/attendance");
});

app.get("/logs", requireRole("ADMIN"), async (req,res) => {
  const result = await db.query(`
    SELECT l.*,u.name
    FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id
    ORDER BY l.created_at DESC LIMIT 200
  `);
  res.render("logs",{title:"활동 로그",logs:result.rows});
});

app.get("/strike", requireAuth, async (req,res) => {
  const result = await db.query(`
    SELECT s.*,u.name AS assignee_name
    FROM strike_team s LEFT JOIN users u ON u.id=s.assignee_id
    ORDER BY s.created_at DESC
  `);
  res.render("strike",{title:"기동타격대",items:result.rows});
});

app.post("/strike", requireRole("ADMIN","LEADER"), async (req,res) => {
  await db.query("INSERT INTO strike_team(title,description,status,assignee_id) VALUES($1,$2,$3,$4)",
    [req.body.title,req.body.description,req.body.status || "OPEN",req.body.assignee_id || null]);
  await log(req,"CREATE_STRIKE",req.body.title);
  res.redirect("/strike");
});

app.post("/strike/:id/status", requireRole("ADMIN","LEADER"), async (req,res) => {
  await db.query("UPDATE strike_team SET status=$1,updated_at=NOW() WHERE id=$2",[req.body.status,req.params.id]);
  res.redirect("/strike");
});

app.get("/food", requireAuth, async (req,res) => {
  const result = await db.query(`
    SELECT f.*,u.name AS creator_name
    FROM late_night_food f LEFT JOIN users u ON u.id=f.created_by
    ORDER BY f.menu_date DESC,f.created_at DESC
  `);
  res.render("food",{title:"불야식",items:result.rows});
});

app.post("/food", requireAuth, async (req,res) => {
  await db.query("INSERT INTO late_night_food(title,description,menu_date,created_by) VALUES($1,$2,$3,$4)",
    [req.body.title,req.body.description,req.body.menu_date || new Date().toISOString().slice(0,10),req.session.user.id]);
  await log(req,"CREATE_FOOD",req.body.title);
  res.redirect("/food");
});

app.use((req,res) => res.status(404).render("error",{title:"404",message:"페이지를 찾을 수 없습니다."}));

app.use((err,req,res,next) => {
  console.error(err);
  res.status(500).render("error",{title:"오류",message:"서버에서 오류가 발생했습니다."});
});

(async () => {
  try {
    await db.query("SELECT 1");
    await ensureSchema();
    await ensureAdmin();
    app.listen(PORT, () => console.log(`Bulhandang intranet running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
})();
