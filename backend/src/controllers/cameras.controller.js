const Camera = require("../models/Camera");
const Municipio = require("../models/Municipio");
const Alert = require("../models/Alert");

const list = (req, res, next) => {
  try {
    const { status, municipio, q } = req.query;
    res.json(Camera.findAll({ status, municipio, q }));
  } catch (e) {
    next(e);
  }
};

const get = (req, res, next) => {
  try {
    const c = Camera.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Câmera não encontrada" });
    res.json(c);
  } catch (e) {
    next(e);
  }
};

const create = (req, res, next) => {
  try {
    const c = Camera.create(req.body);
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
};

const updateStatus = (req, res, next) => {
  try {
    const { status, detalhe } = req.body;
    const before = Camera.findById(req.params.id);
    if (!before) return res.status(404).json({ error: "Câmera não encontrada" });
    const updated = Camera.updateStatus(req.params.id, status, detalhe || "agora");
    // keep municipio aggregate counts in sync
    if (before.status !== status) {
      const m = Municipio.findByName(before.municipio);
      if (m) {
        Municipio.adjustCount(m.id, before.status, -1);
        Municipio.adjustCount(m.id, status, +1);
      }
      Alert.create({
        cameraId: updated.id,
        municipioId: m ? m.id : null,
        tipo: status === "off" ? "offline" : status === "man" ? "manutencao" : "restabelecida",
        mensagem:
          status === "off"
            ? `Câmera ${updated.id} offline em ${updated.municipio}`
            : status === "man"
            ? `Câmera ${updated.id} em manutenção em ${updated.municipio}`
            : `Câmera ${updated.id} restabelecida em ${updated.municipio}`,
      });
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

const remove = (req, res, next) => {
  try {
    const ok = Camera.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Câmera não encontrada" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

const stats = (_req, res, next) => {
  try {
    res.json(Camera.countByStatus());
  } catch (e) {
    next(e);
  }
};

module.exports = { list, get, create, updateStatus, remove, stats };