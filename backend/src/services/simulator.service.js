const Camera = require("../models/Camera");
const Municipio = require("../models/Municipio");
const Occurrence = require("../models/Occurrence");
const Alert = require("../models/Alert");
const realtime = require("./realtime.service");
const logger = require("../utils/logger");

const POOL = [
  ["Veículo recuperado", "Sorriso", "Câmera de leitura localizou veículo furtado na saída da cidade."],
  ["Prisão em flagrante", "Tangará da Serra", "Tentativa de roubo registrada e equipe acionada em 6 min."],
  ["Pessoa localizada", "Cáceres", "Criança perdida identificada por câmeras da praça central."],
  ["Suspeito identificado", "Lucas do Rio Verde", "Imagens permitiram identificar autor de furto em loja."],
  ["Apoio a acidente", "Barra do Garças", "Colisão confirmada por câmera; SAMU acionado de imediato."],
];

let pi = 0;
let timers = [];

function randomMunicipio() {
  const list = Municipio.findAll();
  return list[Math.floor(Math.random() * list.length)];
}

function simCamera() {
  const mun = randomMunicipio();
  // pick a camera in that municipio from DB (sample) OR simulate aggregate
  const cams = Camera.findAll({ municipio: mun.nome });
  if (cams.length === 0) return;
  const c = cams[Math.floor(Math.random() * cams.length)];
  const r = Math.random();
  let newStatus = c.status;
  if (r < 0.45 && c.status === "on" && mun.cameras.on > 5) newStatus = "off";
  else if (r < 0.75 && c.status === "off") newStatus = "on";
  else if (c.status === "man") newStatus = "on";
  else return;

  if (newStatus === c.status) return;

  // update aggregate
  Municipio.adjustCount(mun.id, c.status, -1);
  Municipio.adjustCount(mun.id, newStatus, +1);

  const updated = Camera.updateStatus(c.id, newStatus, "agora");
  const alert = Alert.create({
    cameraId: updated.id,
    municipioId: mun.id,
    tipo: newStatus === "off" ? "offline" : newStatus === "man" ? "manutencao" : "restabelecida",
    mensagem:
      newStatus === "off"
        ? `⚠ Câmera offline em ${mun.nome}`
        : newStatus === "man"
        ? `🔧 Câmera em manutenção em ${mun.nome}`
        : `✔ Câmera restabelecida em ${mun.nome}`,
  });

  realtime.broadcast("camera:update", { camera: updated, municipio: Municipio.findById(mun.id) });
  realtime.broadcast("alert:new", alert);
  realtime.broadcast("kpis:update", Municipio.kpis());
  logger.debug("sim camera", updated.id, updated.status);
}

function newOccurrence() {
  const p = POOL[pi++ % POOL.length];
  const m = Municipio.findByName(p[1]);
  const occ = Occurrence.create({
    tipo: p[0],
    quando: "agora",
    local: p[1],
    descricao: p[2],
    municipioId: m ? m.id : null,
  });
  realtime.broadcast("occurrence:new", occ);
  realtime.broadcast("alert:new", Alert.create({
    municipioId: m ? m.id : null,
    tipo: "ocorrencia",
    mensagem: `🚨 Nova ocorrência apoiada: ${p[0]}`,
  }));
}

function start() {
  timers.push(setInterval(simCamera, 7000));
  timers.push(setInterval(newOccurrence, 28000));
  logger.info("Simulador iniciado");
}

function stop() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = { start, stop };