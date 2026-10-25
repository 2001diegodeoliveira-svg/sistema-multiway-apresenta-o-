const { getDb } = require("./connection");
const db = getDb();
console.log("Banco inicializado. Municípios:", db.prepare("SELECT COUNT(*) c FROM municipios").get().c);
console.log("Câmeras:", db.prepare("SELECT COUNT(*) c FROM cameras").get().c);
console.log("Ocorrências:", db.prepare("SELECT COUNT(*) c FROM occurrences").get().c);