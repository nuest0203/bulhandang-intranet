function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render("error", {
        title: "접근 거부",
        message: "이 기능에 접근할 권한이 없습니다."
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
