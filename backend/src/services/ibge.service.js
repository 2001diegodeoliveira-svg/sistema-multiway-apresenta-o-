const logger = require("../utils/logger");

const BASE = "https://servicodados.ibge.gov.br/api";
const cache = new Map();
const TTL = 1000 * 60 * 60 * 24; // 24h

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { ts: Date.now(), value });
  return value;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE ${res.status} ${res.statusText} (${url})`);
  return res.json();
}

function clearCache() {
  cache.clear();
  logger.info("Cache IBGE limpo");
}

const IBGE = {
  async municipiosMT() {
    return cached("mun-mt", () =>
      fetchJson(`${BASE}/v1/localidades/estados/51/municipios`)
    );
  },
  async municipio(id) {
    return cached(`mun-${id}`, () =>
      fetchJson(`${BASE}/v1/localidades/municipios/${id}`)
    );
  },
  async malhaEstado(uf, qualidade = "minima", intrarregiao = "") {
    const key = `malha-uf-${uf}-${qualidade}-${intrarregiao || "estado"}`;
    return cached(key, () => {
      const qs = new URLSearchParams({
        formato: "application/vnd.geo+json",
        qualidade,
      });
      if (intrarregiao) qs.set("intrarregiao", intrarregiao);
      return fetchJson(`${BASE}/v3/malhas/estados/${uf}?${qs.toString()}`);
    });
  },
  async malhaMunicipio(id, qualidade = "minima") {
    return cached(`malha-mun-${id}-${qualidade}`, () =>
      fetchJson(
        `${BASE}/v3/malhas/municipios/${id}?formato=application/vnd.geo+json&qualidade=${qualidade}`
      )
    );
  },
  async estados() {
    return cached("estados", () => fetchJson(`${BASE}/v1/localidades/estados`));
  },
};

IBGE.clearCache = clearCache;
module.exports = IBGE;