const http = require("http");
const env = require("./config/env");
const app = require("./app");
const { getDb } = require("./db/connection");
const realtime = require("./services/realtime.service");
const simulator = require("./services/simulator.service");
const occSync = require("./services/occurrences.sync");
const noticias = require("./services/noticias.service");
const logger = require("./utils/logger");

// ensure db initialized
getDb();

const server = http.createServer(app);
realtime.attach(server, env.corsOrigin);

const PORT = env.port;
server.listen(PORT, () => {
  logger.info(`API rodando em http://localhost:${PORT}`);
  logger.info(`WebSocket pronto`);
  if (env.nodeEnv !== "test" && !process.env.VERCEL && process.env.SIMULATOR_ENABLED !== "false") simulator.start();
  noticias.startAutoRefresh();
});

process.on("SIGINT", () => {
  simulator.stop();
  server.close(() => process.exit(0));
});