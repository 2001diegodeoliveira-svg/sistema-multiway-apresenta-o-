const { getDb } = require("../db/connection");

function rowToAlert(r) {
  if (!r) return null;
  return {
    id: r.id,
    cameraId: r.camera_id,
    municipioId: r.municipio_id,
    municipio: r.municipio_nome,
    tipo: r.tipo,
    mensagem: r.mensagem,
    createdAt: r.created_at,
  };
}

const Alert = {
  findAll(limit = 50) {
    const db = getDb();
    return db
      .prepare(
        `SELECT a.*, m.nome AS municipio_nome FROM alerts a
         LEFT JOIN municipios m ON m.id=a.municipio_id
         ORDER BY a.id DESC LIMIT ?`
      )
      .all(limit)
      .map(rowToAlert);
  },
  create({ cameraId = null, municipioId = null, tipo, mensagem }) {
    const db = getDb();
    const info = db
      .prepare(
        "INSERT INTO alerts (camera_id,municipio_id,tipo,mensagem) VALUES (?,?,?,?)"
      )
      .run(cameraId, municipioId, tipo, mensagem);
    return rowToAlert(
      db
        .prepare(
          "SELECT a.*, m.nome AS municipio_nome FROM alerts a LEFT JOIN municipios m ON m.id=a.municipio_id WHERE a.id=?"
        )
        .get(info.lastInsertRowid)
    );
  },
};

module.exports = Alert;