require("dotenv").config();
const path = require("path");

const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  dbPath:
    process.env.DB_PATH ||
    (process.env.VERCEL ? "/tmp/vigia.db" : "./data/vigia.db"),
  corsOrigin: process.env.CORS_ORIGIN || "*",
};

env.dbPath = path.resolve(process.cwd(), env.dbPath);

module.exports = env;