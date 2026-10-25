const Occurrence = require("../models/Occurrence");
const Municipio = require("../models/Municipio");
const syncService = require("../services/occurrences.sync");

const list = (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    res.json(Occurrence.findAll(limit));
  } catch (e) {
    next(e);
  }
};

const create = (req, res, next) => {
  try {
    const { tipo, quando, local, descricao, municipio } = req.body;
    let municipioId = null;
    if (municipio) {
      const m = Municipio.findByName(municipio);
      municipioId = m ? m.id : null;
    }
    const occ = Occurrence.create({ tipo, quando: quando || "agora", local, descricao, municipioId });
    res.status(201).json(occ);
  } catch (e) {
    next(e);
  }
};

const remove = (req, res, next) => {
  try {
    const ok = Occurrence.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Ocorrência não encontrada" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

const sync = async (req, res, next) => {
  try {
    const source = req.body?.source || process.env.OCCURRENCES_SOURCE || require("path").resolve(__dirname, "..", "..", "data", "occurrences.real.json");
    const list = await syncService.sync(source);
    res.json({ synced: list.length, occurrences: list });
  } catch (e) {
    next(e);
  }
};

module.exports = { list, create, remove, sync };