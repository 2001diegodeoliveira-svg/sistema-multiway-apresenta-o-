function errorHandler(err, req, res, _next) {
  console.error(err);
  if (err && err.code === "SQLITE_CONSTRAINT") {
    return res.status(409).json({ error: "Conflito de dados", detail: err.message });
  }
  res.status(err.status || 500).json({ error: err.message || "Erro interno" });
}

function notFound(req, res) {
  res.status(404).json({ error: "Rota não encontrada", path: req.path });
}

module.exports = { errorHandler, notFound };