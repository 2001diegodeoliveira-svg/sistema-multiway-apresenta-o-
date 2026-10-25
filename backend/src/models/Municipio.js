const { getDb } = require("../db/connection");

function rowToMunicipio(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    lon: r.lon,
    lat: r.lat,
    cameras: { on: r.cameras_on, off: r.cameras_off, man: r.cameras_man },
    total: r.cameras_on + r.cameras_off + r.cameras_man,
    disponibilidade:
      r.cameras_on + r.cameras_off + r.cameras_man > 0
        ? (r.cameras_on / (r.cameras_on + r.cameras_off + r.cameras_man)) * 100
        : 0,
    createdAt: r.created_at,
  };
}

const Municipio = {
  findAll() {
    const db = getDb();
    return db
      .prepare("SELECT * FROM municipios ORDER BY nome")
      .all()
      .map(rowToMunicipio);
  },
  findById(id) {
    const db = getDb();
    return rowToMunicipio(db.prepare("SELECT * FROM municipios WHERE id=?").get(id));
  },
  findByName(nome) {
    const db = getDb();
    return rowToMunicipio(db.prepare("SELECT * FROM municipios WHERE nome=?").get(nome));
  },
  create({ nome, lon, lat, cameras_on = 0, cameras_off = 0, cameras_man = 0 }) {
    const db = getDb();
    const info = db
      .prepare(
        "INSERT INTO municipios (nome,lon,lat,cameras_on,cameras_off,cameras_man) VALUES (?,?,?,?,?,?)"
      )
      .run(nome, lon, lat, cameras_on, cameras_off, cameras_man);
    return this.findById(info.lastInsertRowid);
  },
  updateCounts(id, { on, off, man }) {
    const db = getDb();
    db.prepare(
      "UPDATE municipios SET cameras_on=?, cameras_off=?, cameras_man=?, created_at=created_at WHERE id=?"
    ).run(on, off, man, id);
    return this.findById(id);
  },
  adjustCount(id, field, delta) {
    const db = getDb();
    const col =
      field === "on" ? "cameras_on" : field === "off" ? "cameras_off" : "cameras_man";
    db.prepare(`UPDATE municipios SET ${col} = ${col} + ? WHERE id=?`).run(delta, id);
    return this.findById(id);
  },
  kpis() {
    const db = getDb();
    const r = db
      .prepare(
        "SELECT COALESCE(SUM(cameras_on),0) onn, COALESCE(SUM(cameras_off),0) offn, COALESCE(SUM(cameras_man),0) mann, COUNT(*) mun FROM municipios"
      )
      .get();
    const total = r.onn + r.offn + r.mann;
    return {
      totalCameras: total,
      online: r.onn,
      offline: r.offn,
      manutencao: r.mann,
      municipios: r.mun,
      disponibilidade: total ? (r.onn / total) * 100 : 0,
    };
  },
};

module.exports = Municipio;