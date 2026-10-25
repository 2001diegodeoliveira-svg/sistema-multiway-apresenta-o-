const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const QUERY_URL =
  "https://mapas.sinfra.mt.gov.br/server/rest/services/monitoramento_cameras/FeatureServer/0/query" +
  "?where=1%3D1&outFields=codigo,n_placa,tipoobra,municipio,endereco,localizacao,latitude,longitude,linkvideomonitoramento" +
  "&returnGeometry=false&orderByFields=n_placa&f=pjson";
const STREAM_BASE = "https://obrasaovivo.sinfra.mt.gov.br/streams";
const SNAPSHOT = path.resolve(__dirname, "..", "..", "data", "cameras_sinfra.json");
const TTL_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 5000;

let cache = null;

function slugOf(link) {
  try {
    return new URL(link).pathname.split("/").pop().replace(/\.html?$/i, "");
  } catch {
    return "";
  }
}

function normalize(list) {
  return list
    .map((c) => ({
      id: c.id ?? c.codigo ?? null,
      codigo: c.codigo || null,
      placa: c.placa ?? null,
      obra: String(c.obra || "").trim(),
      municipio: String(c.municipio || "").trim(),
      endereco: String(c.endereco || "").trim(),
      localizacao: String(c.localizacao || "").trim(),
      lat: Number(c.lat),
      lng: Number(c.lng),
      link: c.link || null,
      slug: slugOf(c.link),
    }))
    .filter((c) => c.link && c.slug && Number.isFinite(c.lat) && Number.isFinite(c.lng));
}

async function fetchLive() {
  const res = await fetch(QUERY_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SINFRA HTTP ${res.status}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.features)) throw new Error("SINFRA sem features");
  return normalize(
    json.features.map((f, i) => {
      const a = f.attributes || {};
      return {
        id: a.objectid ?? i,
        codigo: a.codigo,
        placa: a.n_placa,
        obra: a.tipoobra,
        municipio: a.municipio,
        endereco: a.endereco,
        localizacao: a.localizacao,
        lat: a.latitude,
        lng: a.longitude,
        link: String(a.linkvideomonitoramento || "").trim() || null,
      };
    })
  );
}

function loadSnapshot() {
  const raw = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  return normalize(raw);
}

async function probe(cam) {
  try {
    const r = await fetch(`${STREAM_BASE}/${cam.slug}/index.m3u8`, {
      method: "HEAD",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function withStatus(list) {
  const online = await Promise.all(list.map(probe));
  return list.map((c, i) => ({ ...c, online: online[i] }));
}

async function cameras({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.ts < TTL_MS) return cache.value;
  let source = "live";
  let list;
  try {
    list = await fetchLive();
    if (!list.length) throw new Error("lista vazia");
  } catch (e) {
    logger.warn("SINFRA ao vivo indisponível, usando snapshot:", e.message);
    source = "snapshot";
    list = loadSnapshot();
  }
  const cams = await withStatus(list);
  const value = {
    source,
    updatedAt: new Date().toISOString(),
    total: cams.length,
    online: cams.filter((c) => c.online).length,
    offline: cams.filter((c) => !c.online).length,
    cameras: cams,
  };
  cache = { ts: Date.now(), value };
  return value;
}

module.exports = { cameras };
