# Vigia Mais MT – Sistema de Exibição (Full Stack)

Sistema de monitoramento de câmeras do Mato Grosso (demonstração simulada), composto por:

- **Backend** (`backend/`): API REST + WebSocket em tempo real (Node.js/Express/Socket.IO), persistência em SQLite (`node:sqlite`).
- **Frontend** (`frontend/`): painel de exibição (React + Vite + TypeScript), com mapa, KPIs, municípios, atenção e ocorrências.
- **Mobile** (legado): `Vigia Mais MT - App Mobile.html` (UI mobile de referência).
- **Legado desktop**: `index.html.html` (versão estática original do painel).

## Estrutura

```
.
├── backend/
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/env.js
│   │   ├── db/ (connection, migrations, seed)
│   │   ├── models/ (Municipio, Camera, Occurrence, Alert)
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/ (realtime, simulator)
│   │   └── middlewares/
│   └── package.json
├── frontend/
│   ├── src/ (React + Vite)
│   └── package.json
├── database/schema.sql
├── .env.example
└── README.md
```

## Como rodar

### Backend
```bash
cd backend
cp ../.env.example .env   # ajuste se necessário
npm install
npm run dev               # http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

O frontend usa proxy para `/api` e `/socket.io` apontando para o backend.

## API (prefixo `/api`)

- `GET /health`
- `POST /auth/login` `{ username, password }` → `{ token, user }` (demo: admin / vigia123)
- `GET /auth/me` (Bearer)
- `GET /municipios`, `GET /municipios/:id`, `GET /municipios/kpis`
- `PATCH /municipios/:id` (auth) `{ cameras_on, cameras_off, cameras_man }`
- `GET /cameras?status=&municipio=&q=`, `GET /cameras/:id`, `GET /cameras/stats`
- `POST /cameras` (auth), `PATCH /cameras/:id/status`, `DELETE /cameras/:id` (auth)
- `GET /occurrences?limit=`, `POST /occurrences` (auth), `DELETE /occurrences/:id` (auth)
- `POST /occurrences/sync` (auth) `{ source? }` — sincroniza ocorrências a partir de um arquivo JSON ou URL (substitui a lista)
- `POST /ibge/cache/clear` — limpa o cache em memória do IBGE
- `GET /alerts?limit=`

## Integração IBGE

O backend atua como proxy (com cache de 24h) da API de dados do IBGE:

- `GET /api/ibge/estados` — lista de UF
- `GET /api/ibge/municipios` — 142 municípios de MT (código IBGE)
- `GET /api/ibge/municipios/:id` — detalhe de um município
- `GET /api/ibge/malhas/estados/:uf?qualidade=minima|intermediaria|maxima` — malha GeoJSON do estado
- `GET /api/ibge/malhas/municipios/:id?qualidade=...` — malha GeoJSON do município

O frontend usa a malha real de MT (GeoJSON → SVG), desenha os contornos de todos os 141 municípios e, ao clicar em um dos monitorados, sobrepõe sua malha municipal via IBGE.

## Sincronização de ocorrências

- Fonte padrão: `backend/data/occurrences.real.json` (ocorrências reais compiladas de notícias do Vigia Mais MT).
- Variáveis: `OCCURRENCES_SOURCE`, `OCCURRENCES_AUTO_SYNC` (default true), `OCCURRENCES_SYNC_INTERVAL_MS` (default 300000).
- Auto-sync no startup e periodicamente; broadcast `occurrences:refresh` atualiza o painel em tempo real.

## Eventos WebSocket:

- `camera:update` `{ camera, municipio }`
- `occurrence:new` `Occurrence`
- `alert:new` `Alert`
- `kpis:update` `Kpis`

## Simulador

O backend inclui um simulador que, a cada 7s altera status de câmeras e a cada 28s cria novas ocorrências, transmitindo em tempo real.

## Banco de dados

SQLite em `backend/data/vigia.db` (ignorado pelo git). Migrações em `backend/src/db/migrations`. Schema também em `database/schema.sql`.