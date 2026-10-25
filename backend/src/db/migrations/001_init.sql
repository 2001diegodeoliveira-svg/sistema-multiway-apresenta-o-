CREATE TABLE IF NOT EXISTS municipios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  lon REAL NOT NULL,
  lat REAL NOT NULL,
  cameras_on INTEGER NOT NULL DEFAULT 0,
  cameras_off INTEGER NOT NULL DEFAULT 0,
  cameras_man INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  municipio_id INTEGER NOT NULL REFERENCES municipios(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('on','off','man')),
  detalhe TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  quando TEXT NOT NULL,
  local TEXT NOT NULL,
  descricao TEXT NOT NULL,
  municipio_id INTEGER REFERENCES municipios(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id TEXT REFERENCES cameras(id) ON DELETE CASCADE,
  municipio_id INTEGER REFERENCES municipios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cameras_municipio ON cameras(municipio_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE INDEX IF NOT EXISTS idx_occurrences_created ON occurrences(created_at);

-- Seed municipios
INSERT OR IGNORE INTO municipios (nome, lon, lat, cameras_on, cameras_off, cameras_man) VALUES
('Cuiabá',-56.15,-15.55,412,38,21),
('Várzea Grande',-55.98,-15.72,268,24,14),
('Rondonópolis',-54.64,-16.47,196,17,9),
('Sinop',-55.5,-11.86,154,12,8),
('Tangará da Serra',-57.49,-14.62,121,9,6),
('Cáceres',-57.68,-16.07,98,11,5),
('Sorriso',-55.71,-12.54,87,6,4),
('Lucas do Rio Verde',-55.91,-13.05,79,5,3),
('Primavera do Leste',-54.3,-15.55,72,7,4),
('Barra do Garças',-52.26,-15.89,58,8,3);

-- Seed cameras (amostra)
INSERT OR IGNORE INTO cameras (id,nome,municipio_id,status,detalhe) VALUES
('0412','Praça Alencastro',(SELECT id FROM municipios WHERE nome='Cuiabá'),'off','há 3 h'),
('0391','Rodoviária',(SELECT id FROM municipios WHERE nome='Cuiabá'),'man','volta amanhã'),
('0455','Av. do CPA',(SELECT id FROM municipios WHERE nome='Cuiabá'),'on','agora'),
('0460','Parque Mãe Bonifácia',(SELECT id FROM municipios WHERE nome='Cuiabá'),'on','agora'),
('0877','Av. Júlio Campos',(SELECT id FROM municipios WHERE nome='Várzea Grande'),'off','há 50 min'),
('0880','Shopping Popular',(SELECT id FROM municipios WHERE nome='Várzea Grande'),'on','agora'),
('1203','Terminal Urbano',(SELECT id FROM municipios WHERE nome='Rondonópolis'),'man','volta hoje 18h'),
('1210','Av. Lions',(SELECT id FROM municipios WHERE nome='Rondonópolis'),'on','agora'),
('0654','Centro',(SELECT id FROM municipios WHERE nome='Cáceres'),'off','há 1 dia'),
('0702','Orla do Rio Paraguai',(SELECT id FROM municipios WHERE nome='Cáceres'),'on','agora'),
('1301','Av. dos Ingás',(SELECT id FROM municipios WHERE nome='Sinop'),'on','agora'),
('1355','Rodovia BR-163',(SELECT id FROM municipios WHERE nome='Sorriso'),'on','agora'),
('1402','Praça Central',(SELECT id FROM municipios WHERE nome='Tangará da Serra'),'on','agora'),
('1509','Av. Brasil',(SELECT id FROM municipios WHERE nome='Lucas do Rio Verde'),'off','há 20 min');

-- Seed occurrences
INSERT OR IGNORE INTO occurrences (tipo,quando,local,descricao,municipio_id) VALUES
('Veículo recuperado','há 18 min','Cuiabá · CPA','Placa identificada por câmera de leitura; viatura interceptou em 12 min.',(SELECT id FROM municipios WHERE nome='Cuiabá')),
('Pessoa localizada','há 1 h','Várzea Grande','Imagens do trajeto ajudaram a localizar idoso desaparecido em 40 min.',(SELECT id FROM municipios WHERE nome='Várzea Grande')),
('Prisão em flagrante','há 2 h','Rondonópolis','Furto filmado e transmitido à central em tempo real.',(SELECT id FROM municipios WHERE nome='Rondonópolis')),
('Suspeito identificado','há 3 h','Sinop','Imagens usadas para identificar autor de roubo a comércio.',(SELECT id FROM municipios WHERE nome='Sinop')),
('Apoio a acidente','há 5 h','Cuiabá · Av. do CPA','Câmera confirmou a dinâmica e agilizou o socorro.',(SELECT id FROM municipios WHERE nome='Cuiabá'));