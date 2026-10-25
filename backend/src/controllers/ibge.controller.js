const IBGE = require("../services/ibge.service");

const municipios = async (req, res, next) => {
  try {
    const data = await IBGE.municipiosMT();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const municipio = async (req, res, next) => {
  try {
    const data = await IBGE.municipio(req.params.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const malhaEstado = async (req, res, next) => {
  try {
    const uf = req.params.uf || "51";
    const q = req.query.qualidade || "minima";
    const intrarregiao = req.query.intrarregiao || "";
    const data = await IBGE.malhaEstado(uf, q, intrarregiao);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const malhaMunicipio = async (req, res, next) => {
  try {
    const q = req.query.qualidade || "minima";
    const data = await IBGE.malhaMunicipio(req.params.id, q);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const estados = async (req, res, next) => {
  try {
    const data = await IBGE.estados();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const clearCache = (req, res) => {
  IBGE.clearCache();
  res.json({ cleared: true });
};

module.exports = { municipios, municipio, malhaEstado, malhaMunicipio, estados, clearCache };