const Municipio = require("../models/Municipio");

const list = (_req, res, next) => {
  try {
    res.json(Municipio.findAll());
  } catch (e) {
    next(e);
  }
};

const get = (req, res, next) => {
  try {
    const m = Municipio.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Município não encontrado" });
    res.json(m);
  } catch (e) {
    next(e);
  }
};

const kpis = (_req, res, next) => {
  try {
    res.json(Municipio.kpis());
  } catch (e) {
    next(e);
  }
};

const updateCounts = (req, res, next) => {
  try {
    const m = Municipio.updateCounts(req.params.id, req.body);
    if (!m) return res.status(404).json({ error: "Município não encontrado" });
    res.json(m);
  } catch (e) {
    next(e);
  }
};

module.exports = { list, get, kpis, updateCounts };