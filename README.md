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

## Tela piscando / flicker na TV (modo TV)

O painel roda em navegador na TV/stick — o **Roku OS é fechado** e não pode ser "patchado" por rede. O que dá para corrigir é o pipeline de renderização do painel. Foram aplicadas estas mudanças:

- Removida a animação de `filter: drop-shadow` nos ícones do mapa (`camGlow`) — filtro animado força repaint a cada frame.
- Pulso dos municípios mudou de `fill-opacity` contínuo para `opacity` em `steps()` (~8 repaints por ciclo em vez de 60/s).
- Borda do card do mapa deixou de animar `background-position` + `mask-composite` (agora estática).
- Removido `filter: drop-shadow` do `<svg>` inteiro (ficava sobre ~142 paths).
- O relógio foi isolado em `<Clock />`: antes o `now` re-renderizava o app todo a 1 Hz.
- Rolagem automática da lista: ~30 fps, para com a aba oculta e só escreve `scrollTop` quando o valor arredondado muda.
- Cards usam `transition-opacity` (não `transition` de todas as propriedades).
- Logos otimizados: `logo-vigia-opt.png` (73 KB, era 2 MB) e `logo-multiway-opt.png` (114 KB, era 1,3 MB).

### Modo TV

Botão **TV** no cabeçalho (ou `?lowfx=1` na URL) desliga o que resta de animação cara. A preferência fica no `localStorage`. Também liga sozinho se o sistema pedir `prefers-reduced-motion`.

### Checklist na TV (fora do código)

1. **Configurações → Exibição → Ajuste automático da taxa de atualização** → **desligado**. É a causa mais comum de "piscadas"/tela preta curta quando o conteúdo muda.
2. Desligar HDR/“HDR sempre ativo” se o painel não for HDR.
3. Testar outro cabo HDMI e outra porta; evitar cabos longos/baratos.
4. **Configurações → Sistema → Atualização do sistema** → verificar atualização.
5. Se piscar só dentro de um app, enviar `Home` (`scripts/tv-doctor.ps1 -HomeKey`). Se piscar no menu da TV também, é painel/cabo/fonte (hardware).

### Diagnóstico remoto (ECP, porta 8060)

```powershell
# somente leitura: modelo, Roku OS, energia, app atual, modo ECP
.\scripts\tv-doctor.ps1 -TV 192.168.1.24

# volta ao menu (tira app travado do pipeline de vídeo)
.\scripts\tv-doctor.ps1 -TV 192.168.1.24 -HomeKey
```

Limites do ECP: **não** existe comando de reset de fábrica, limpeza de cache ou reboot confiável via rede. Reset de fábrica só pelo menu da TV (**Configurações → Sistema → Configurações avançadas do sistema → Redefinição de fábrica**) e apaga contas/ajustes — não resolve bug de renderização do painel web.

### Teste de tela (isolar hardware de software)

Abra na TV: **`/tv-test.html`** (ex.: `http://<ip-do-pc>:5173/tv-test.html`).

A página mostra cor sólida (vermelho/verde/azul/branco/preto/cinza), gradiente, barras e movimento.

- **Cor sólida pisca/treme** → defeito de painel, cabo HDMI, fonte ou porta. Nenhum código resolve; acione a garantia/assistência.
- **Só o painel Vigia pisca, o teste não** → problema de software/renderização (tratado pelas correções acima).
- **Teste também pisca, mas só em uma entrada HDMI** → cabo/porta ou o aparelho de origem (Fire TV/PC).

Correções adicionais de estabilidade nesta rodada:

- Aba **Câmeras**: o mosaico montava um `<iframe>` de vídeo por câmera online (até 23). Agora limita a **6** e só monta o player quando o card está visível (`IntersectionObserver`) — evita estourar o decodificador da TV.
- `useSocket`: handlers atualizados via `ref` (antes ficavam presos na primeira renderização).
- Timers de `ping`/aviso e estado de tela cheia agora são limpos/reativos.