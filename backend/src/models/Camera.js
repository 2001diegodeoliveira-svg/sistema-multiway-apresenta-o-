const { getDb } = require("../db/connection");

function rowToCamera(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    municipioId: r.municipio_id,
    municipio: r.municipio_nome,
    status: r.status,
    detalhe: r.detalhe,
    updatedAt: r.updated_at,
  };
}

const Camera = {
  findAll({ status, municipio, q } = {}) {
    const db = getDb();
    const where = [];
    const params = [];
    if (status && status !== "all") {
      where.push("c.status = ?");
      params.push(status);
    }
    if (municipio) {
      where.push("m.nome = ?");
      params.push(municipio);
    }
    if (q) {
      where.push("(c.id LIKE ? OR c.nome LIKE ? OR m.nome LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const sql = `
      SELECT c.*, m.nome AS municipio_nome
      FROM cameras c JOIN municipios m ON m.id = c.municipio_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.id`;
    return db.prepare(sql).all(...params).map(rowToCamera);
  },
  findById(id) {
    const db = getDb();
    return rowToCamera(
      db
        .prepare(
          "SELECT c.*, m.nome AS municipio_nome FROM cameras c JOIN municipios m ON m.id=c.municipio_id WHERE c.id=?"
        )
        .get(id)
    );
  },
  create({ id, nome, municipioId, status = "on", detalhe = "agora" }) {
    const db = getDb();
    db.prepare(
      "INSERT INTO cameras (id,nome,municipio_id,status,detalhe) VALUES (?,?,?,?,?)"
    ).run(id, nome, municipioId, status, detalhe);
    return this.findById(id);
  },
  updateStatus(id, status, detalhe) {
    const db = getDb();
    db.prepare(
      "UPDATE cameras SET status=?, detalhe=?, updated_at=datetime('now') WHERE id=?"
    ).run(status, detalhe, id);
    return this.findById(id);
  },
  delete(id) {
    const db = getDb();
    return db.prepare("DELETE FROM cameras WHERE id=?").run(id).changes > 0;
  },
  countByStatus() {
    const db = getDb();
    const rows = db.prepare("SELECT status, COUNT(*) n FROM cameras GROUP BY status").all();
    const out = { on: 0, off: 0, man: 0 };
    rows.forEach((r) => (out[r.status] = r.n));
    return out;
  },
};

module.exports = Camera;