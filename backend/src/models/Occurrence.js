const { getDb } = require("../db/connection");

function rowToOccurrence(r) {
  if (!r) return null;
  return {
    id: r.id,
    tipo: r.tipo,
    quando: r.quando,
    local: r.local,
    descricao: r.descricao,
    municipioId: r.municipio_id,
    municipio: r.municipio_nome,
    createdAt: r.created_at,
  };
}

const Occurrence = {
  findAll(limit = 50) {
    const db = getDb();
    return db
      .prepare(
        `SELECT o.*, m.nome AS municipio_nome FROM occurrences o
         LEFT JOIN municipios m ON m.id=o.municipio_id
         ORDER BY o.id DESC LIMIT ?`
      )
      .all(limit)
      .map(rowToOccurrence);
  },
  create({ tipo, quando, local, descricao, municipioId = null }) {
    const db = getDb();
    const info = db
      .prepare(
        "INSERT INTO occurrences (tipo,quando,local,descricao,municipio_id) VALUES (?,?,?,?,?)"
      )
      .run(tipo, quando, local, descricao, municipioId);
    return rowToOccurrence(
      db
        .prepare(
          "SELECT o.*, m.nome AS municipio_nome FROM occurrences o LEFT JOIN municipios m ON m.id=o.municipio_id WHERE o.id=?"
        )
        .get(info.lastInsertRowid)
    );
  },
  delete(id) {
    const db = getDb();
    return db.prepare("DELETE FROM occurrences WHERE id=?").run(id).changes > 0;
  },
};

module.exports = Occurrence;