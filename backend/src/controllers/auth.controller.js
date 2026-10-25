const jwt = require("jsonwebtoken");
const env = require("../config/env");

const DEMO_USER = { id: 1, username: "admin", password: "vigia123", role: "admin" };

const login = (req, res) => {
  const { username, password } = req.body || {};
  if (username !== DEMO_USER.username || password !== DEMO_USER.password) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = jwt.sign(
    { sub: DEMO_USER.id, username: DEMO_USER.username, role: DEMO_USER.role },
    env.jwtSecret,
    { expiresIn: "8h" }
  );
  res.json({ token, user: { username: DEMO_USER.username, role: DEMO_USER.role } });
};

const me = (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, me };