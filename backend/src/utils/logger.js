const logger = {
  info: (...a) => console.log("[info]", ...a),
  warn: (...a) => console.warn("[warn]", ...a),
  error: (...a) => console.error("[error]", ...a),
  debug: (...a) => {
    if (process.env.NODE_ENV !== "production") console.log("[debug]", ...a);
  },
};
module.exports = logger;