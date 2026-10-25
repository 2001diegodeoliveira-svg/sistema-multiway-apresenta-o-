const { Server } = require("socket.io");
const logger = require("../utils/logger");

let io = null;

function attach(server, corsOrigin) {
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ["GET", "POST"] },
  });
  io.on("connection", (socket) => {
    logger.debug("socket conectado", socket.id);
    socket.on("disconnect", () => logger.debug("socket desconectado", socket.id));
  });
  return io;
}

function broadcast(event, payload) {
  if (io) io.emit(event, payload);
}

function getIO() {
  return io;
}

module.exports = { attach, broadcast, getIO };