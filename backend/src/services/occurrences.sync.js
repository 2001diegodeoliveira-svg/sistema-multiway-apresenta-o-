const fs = require("fs");
const path = require("path");
const Occurrence = require("../models/Occurrence");
const Municipio = require("../models/Municipio");
const realtime = require("./realtime.service");
const logger = require("../utils/logger");

async function loadSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Fonte HTTP ${res.status}`);
    return res.json();
  }
  const filePath = path.resolve(process.cwd(), source);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

const DEFAULT_SOURCE = path.resolve(__dirname, "..", "..", "data", "occurrences.real.json");

async function sync(source) {
  const src = source || DEFAULT_SOURCE;
  const data = await loadSource(src);
  if (!Array.isArray(data)) throw new Error("Fonte deve ser um array JSON de ocorrências");
  const db = require("../db/connection").getDb();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM occurrences").run();
    for (const o of data) {
      let municipioId = null;
      if (o.municipio) {
        const m = Municipio.findByName(o.municipio);
        municipioId = m ? m.id : null;
      }
      Occurrence.create({
        tipo: o.tipo,
        quando: o.quando || "agora",
        local: o.local,
        descricao: o.descricao,
        municipioId,
      });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const list = Occurrence.findAll(100);
  realtime.broadcast("occurrences:refresh", list);
  logger.info(`Sync de ocorrências: ${list.length} registros`);
  return list;
}

function startAutoSync() {
  const source = process.env.OCCURRENCES_SOURCE || DEFAULT_SOURCE;
  const interval = Number(process.env.OCCURRENCES_SYNC_INTERVAL_MS || 0);
  const enabled = process.env.OCCURRENCES_AUTO_SYNC !== "false";
  if (!enabled) return;
  sync(source).catch((e) => logger.warn("Sync inicial falhou:", e.message));
  if (interval > 0 && !process.env.VERCEL) {
    setInterval(() => {
      sync(source).catch((e) => logger.warn("Sync periódico falhou:", e.message));
    }, interval);
    logger.info(`Auto-sync de ocorrências a cada ${interval}ms`);
  }
}

module.exports = { sync, startAutoSync, loadSource };