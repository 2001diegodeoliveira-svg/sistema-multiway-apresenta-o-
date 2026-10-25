const jwt = require("jsonwebtoken");
const env = require("../config/env");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token ausente" });
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, env.jwtSecret);
    } catch (e) {
      req.user = null;
    }
  }
  next();
}

module.exports = { auth, optionalAuth };