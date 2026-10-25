const express = require("express");
const cameras = require("../controllers/cameras.controller");
const municipios = require("../controllers/municipios.controller");
const occurrences = require("../controllers/occurrences.controller");
const alerts = require("../controllers/alerts.controller");
const auth = require("../controllers/auth.controller");
const ibge = require("../controllers/ibge.controller");
const sinfra = require("../controllers/sinfra.controller");
const { auth: authMw } = require("../middlewares/auth");

const router = express.Router();

router.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

router.post("/auth/login", auth.login);
router.get("/auth/me", authMw, auth.me);

router.get("/municipios", municipios.list);
router.get("/municipios/kpis", municipios.kpis);
router.get("/municipios/:id", municipios.get);
router.patch("/municipios/:id", authMw, municipios.updateCounts);

router.get("/cameras", cameras.list);
router.get("/cameras/stats", cameras.stats);
router.get("/cameras/:id", cameras.get);
router.post("/cameras", authMw, cameras.create);
router.patch("/cameras/:id/status", cameras.updateStatus);
router.delete("/cameras/:id", authMw, cameras.remove);

router.get("/occurrences", occurrences.list);
router.post("/occurrences", authMw, occurrences.create);
router.delete("/occurrences/:id", authMw, occurrences.remove);

router.get("/alerts", alerts.list);

router.post("/ibge/cache/clear", ibge.clearCache);

// Câmeras SINFRA (Obras ao Vivo)
router.get("/sinfra/cameras", sinfra.list);
router.post("/occurrences/sync", authMw, occurrences.sync);

// IBGE (proxy + cache)
router.get("/ibge/estados", ibge.estados);
router.get("/ibge/municipios", ibge.municipios);
router.get("/ibge/municipios/:id", ibge.municipio);
router.get("/ibge/malhas/estados/:uf?", ibge.malhaEstado);
router.get("/ibge/malhas/municipios/:id", ibge.malhaMunicipio);

module.exports = router;