const { XMLParser } = require("fast-xml-parser");
const logger = require("../utils/logger");

const FEED_URL =
  "https://news.google.com/rss/search?q=%22Vigia+Mais+MT%22+when:14d&hl=pt-BR&gl=BR&ceid=BR:pt-419";
const TTL_MS = 10 * 60 * 1000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

let cache = null;

function texto(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v["#text"] ?? "");
  return String(v);
}

// O Google Notícias põe "título - Fonte" no fim do título; separa os dois.
function separar(titulo, fonte) {
  const sufixo = fonte ? ` - ${fonte}` : "";
  const limpo = sufixo && titulo.endsWith(sufixo) ? titulo.slice(0, -sufixo.length) : titulo;
  return { titulo: limpo.trim(), fonte: fonte || "" };
}

function parse(xml) {
  const json = parser.parse(xml);
  const itens = json?.rss?.channel?.item;
  const lista = Array.isArray(itens) ? itens : itens ? [itens] : [];
  const vistos = new Set();
  const noticias = [];
  for (const it of lista) {
    const fonte = texto(it.source);
    const { titulo, fonte: f } = separar(texto(it.title), fonte);
    const chave = titulo.toLowerCase().replace(/\W+/g, " ").trim();
    if (!titulo || vistos.has(chave)) continue;
    vistos.add(chave);
    const data = new Date(texto(it.pubDate));
    noticias.push({
      id: texto(it.guid) || texto(it.link) || chave,
      titulo,
      fonte: f,
      link: texto(it.link),
      publicadoEm: Number.isNaN(data.getTime()) ? null : data.toISOString(),
    });
  }
  return noticias.sort((a, b) => (b.publicadoEm || "").localeCompare(a.publicadoEm || ""));
}

async function buscar() {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  return parse(await res.text());
}

async function noticias({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.ts < TTL_MS) return cache.value;
  try {
    const items = await buscar();
    const value = { updatedAt: new Date().toISOString(), total: items.length, items };
    cache = { ts: Date.now(), value };
    return value;
  } catch (e) {
    logger.warn("Notícias indisponíveis:", e.message);
    if (cache) return cache.value;
    throw e;
  }
}

// Atualização em segundo plano (servidor local/contínuo). Na Vercel o cache é por requisição.
function startAutoRefresh() {
  if (process.env.VERCEL) return;
  setInterval(() => noticias({ force: true }).catch(() => {}), TTL_MS);
  noticias({ force: true }).catch(() => {});
}

module.exports = { noticias, startAutoRefresh, parse };
