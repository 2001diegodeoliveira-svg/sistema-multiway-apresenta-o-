const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const routes = require("./routes");
const { errorHandler, notFound } = require("./middlewares/errorHandler");
// Auto-sync de ocorrências (funciona tanto em server.js quanto como handler serverless)
try {
  require("./services/occurrences.sync").startAutoSync();
} catch (e) {
  console.warn("Auto-sync init falhou:", e.message);
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use("/api", routes);

// static frontend (optional)
const path = require("path");
const fs = require("fs");
const frontendDist = path.resolve(process.cwd(), "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;