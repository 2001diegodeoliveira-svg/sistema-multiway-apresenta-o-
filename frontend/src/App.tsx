import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { useSocket } from "./hooks/useSocket";
import CamerasView from "./components/CamerasView";
import { EM_ADESAO, NAO_ADERIRAM, RESUMO_OFICIAL, isVigiaAderido } from "./data/vigiaMais";
import type { Municipio, Kpis, Occurrence, Alert, Camera as CamInfo } from "./types";
import type { Noticia } from "./api/client";
import {
  LayoutDashboard, Map as MapIcon, Building2, AlertTriangle, FileText, Video,
  RefreshCw, Mic, Maximize, Minimize, Radio, CheckCircle2, Siren,
} from "lucide-react";

const OUT = [[-61.6,-13.6],[-60.8,-11.9],[-60,-10.3],[-59.4,-9],[-58.4,-7.4],[-57,-8.2],[-55.8,-9],[-54.3,-9.9],[-52.5,-9.6],[-50.7,-9.2],[-50.2,-11],[-51,-12.6],[-51.8,-14],[-52.4,-15.6],[-53,-16.9],[-53.6,-17.8],[-55,-17.7],[-56.4,-17.4],[-57.6,-17.5],[-58.4,-16.3],[-60.2,-16.2],[-60,-15.1],[-61.4,-14.9]];

const SEQ = ["geral", "mapa", "municipios", "atencao", "ocorrencias", "cameras"];

const GRID: Record<string, string> = {
  geral: "xl:grid-cols-[1fr_1.25fr_1fr]",
  municipios: "xl:grid-cols-[2.2fr_0.8fr_0.8fr]",
  mapa: "xl:grid-cols-[0.8fr_2.2fr_0.8fr]",
  atencao: "xl:grid-cols-[0.8fr_2.2fr_0.8fr]",
  ocorrencias: "xl:grid-cols-[0.8fr_0.8fr_2.2fr]",
};

const STATUS_RANK: Record<string, number> = { off: 0, man: 1 };

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function tempoRelativo(iso: string, agora: Date): string {
  const seg = Math.round((new Date(iso).getTime() - agora.getTime()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return rtf.format(seg, "second");
  if (abs < 3600) return rtf.format(Math.round(seg / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), "hour");
  return rtf.format(Math.round(seg / 86400), "day");
}

function sortAttention(list: CamInfo[]): CamInfo[] {
  return list
    .filter((c) => c.status !== "on")
    .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.municipio.localeCompare(b.municipio));
}

const px = (lo: number) => ((lo + 61.8) * 10).toFixed(1);
const py = (la: number) => ((-7.2 - la) * 10).toFixed(1);

function geomToPath(geom: any): string {
  if (!geom) return "";
  const rings: number[][][] = [];
  if (geom.type === "Polygon") rings.push(...geom.coordinates);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly: any) => rings.push(...poly));
  return rings
    .map((ring) =>
      ring.map((c: number[], i: number) => `${i === 0 ? "M" : "L"} ${px(c[0])} ${py(c[1])}`).join(" ") + " Z"
    )
    .join(" ");
}

function geomCenter(geom: any): [number, number] {
  if (!geom) return [0, 0];
  const pts: number[][] = [];
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates || [];
  polys.forEach((poly: number[][][]) => poly.forEach((ring) => ring.forEach((p) => pts.push(p))));
  if (!pts.length) return [0, 0];
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  return [Number(px(lon)), Number(py(lat))];
}

const SIDE: Record<string, "l" | "r"> = {
  "Cuiabá": "l",
  "Várzea Grande": "r",
  "Rondonópolis": "r",
  "Sinop": "r",
  "Tangará da Serra": "l",
  "Cáceres": "l",
  "Sorriso": "r",
  "Lucas do Rio Verde": "l",
  "Primavera do Leste": "r",
  "Barra do Garças": "l",
};

const CAMERA_PATH = "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z";

type AlertKind = "warn" | "ok" | "alert";

export default function App() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attention, setAttention] = useState<CamInfo[]>([]);
  const [ping, setPing] = useState<string | null>(null);
  const [cur, setCur] = useState("geral");
  const [auto, setAuto] = useState(true);
  const [outlinePath, setOutlinePath] = useState<string>("");
  const [ibgeCodes, setIbgeCodes] = useState<Record<string, number>>({});
  const [ibgeNames, setIbgeNames] = useState<Record<number, string>>({});
  const [munBoundary, setMunBoundary] = useState<string>("");
  const [allMunPaths, setAllMunPaths] = useState<{ code: string; d: string; c: [number, number] }[]>([]);
  const [alertMsg, setAlertMsg] = useState<{ text: string; kind: AlertKind } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [news, setNews] = useState<{ updatedAt: string; items: Noticia[] }>({ updatedAt: "", items: [] });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seenNews = useRef<Set<string> | null>(null);

  const alertTimer = useRef<number | null>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const munsRef = useRef<HTMLDivElement>(null);

  // Rolagem automática da lista de municípios (pausa ao passar o mouse)
  useEffect(() => {
    const el = munsRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let pos = 0;
    let paused = false;
    const step = () => {
      if (paused) {
        pos = el.scrollTop;
      } else {
        const fim = el.scrollHeight - el.clientHeight;
        pos = pos >= fim - 1 ? 0 : pos + 0.35;
        el.scrollTop = pos;
      }
      raf = requestAnimationFrame(step);
    };
    const pausar = () => (paused = true);
    const retomar = () => (paused = false);
    el.addEventListener("mouseenter", pausar);
    el.addEventListener("mouseleave", retomar);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mouseenter", pausar);
      el.removeEventListener("mouseleave", retomar);
    };
  }, []);

  const vigiaRows = Object.values(ibgeNames)
    .map((nome) => ({
      nome,
      status: NAO_ADERIRAM.includes(nome) ? ("nao" as const) : EM_ADESAO.includes(nome) ? ("adesao" as const) : ("aderido" as const),
    }))
    .sort((a, b) => {
      const ordem = { aderido: 0, adesao: 1, nao: 2 };
      return ordem[a.status] - ordem[b.status] || a.nome.localeCompare(b.nome, "pt-BR");
    });
  const vigiaCodes = new Set(
    Object.entries(ibgeNames)
      .filter(([, nome]) => isVigiaAderido(nome))
      .map(([code]) => Number(code))
  );

  const showAlert = useCallback((text: string, kind: AlertKind = "ok") => {
    setAlertMsg({ text, kind });
    if (alertTimer.current) window.clearTimeout(alertTimer.current);
    alertTimer.current = window.setTimeout(() => setAlertMsg(null), 4500);
  }, []);

  const say = useCallback((t: string) => {
    setHeard(t);
    window.setTimeout(() => setHeard(null), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    const [m, k, o, a, c] = await Promise.all([
      api.municipios(),
      api.kpis(),
      api.occurrences(6),
      api.alerts(6),
      api.cameras(),
    ]);
    setMunicipios(m);
    setKpis(k);
    setOccurrences(o);
    setAlerts(a);
    setAttention(sortAttention(c));
  }, []);

  useEffect(() => {
    loadAll().catch(console.error);
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [loadAll]);

  const IBGE = "https://servicodados.ibge.gov.br/api";
  // IBGE: dados do mapa direto no navegador (o backend serverless não alcança o IBGE)
  useEffect(() => {
    fetch(`${IBGE}/v3/malhas/estados/51?formato=application/vnd.geo+json&qualidade=minima`)
      .then((r) => r.json())
      .then((gj) => {
        const coords = gj?.features?.[0]?.geometry?.coordinates?.[0];
        if (!coords) return;
        const d = coords
          .map((c: number[], i: number) => `${i === 0 ? "M" : "L"} ${px(c[0])} ${py(c[1])}`)
          .join(" ") + " Z";
        setOutlinePath(d);
      })
      .catch(() => {});

    fetch(`${IBGE}/v1/localidades/estados/51/municipios`)
      .then((r) => r.json())
      .then((list) => {
        const map: Record<string, number> = {};
        (list || []).forEach((m: any) => {
          map[m.nome] = m.id;
        });
        setIbgeCodes(map);
        setIbgeNames(Object.fromEntries((list || []).map((m: any) => [m.id, m.nome])));
      })
      .catch(() => {});

    fetch(`${IBGE}/v3/malhas/estados/51?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`)
      .then((r) => r.json())
      .then((gj) => {
        const paths = (gj?.features || []).map((f: any) => ({
          code: f.properties?.codarea,
          d: geomToPath(f.geometry),
          c: geomCenter(f.geometry),
        }));
        setAllMunPaths(paths);
      })
      .catch(() => {});
  }, []);

  // Notícias: atualiza a cada 60 s e destaca as que chegaram desde a última leitura
  useEffect(() => {
    let ativo = true;
    const carregar = () =>
      api
        .noticias()
        .then((r) => {
          if (!ativo) return;
          const ids = new Set(r.items.map((n) => n.id));
          if (seenNews.current) {
            const seen = seenNews.current;
            setNewIds(new Set([...ids].filter((id) => !seen.has(id))));
          }
          seenNews.current = ids;
          setNews(r);
        })
        .catch(() => {});
    carregar();
    const t = window.setInterval(carregar, 60000);
    return () => {
      ativo = false;
      window.clearInterval(t);
    };
  }, []);

  const isVercel = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");

  useSocket(
    {
      "camera:update": (p: { camera: any; municipio: Municipio }) => {
        setMunicipios((prev) => prev.map((m) => (m.id === p.municipio.id ? p.municipio : m)));
        setPing(p.municipio.nome);
        window.setTimeout(() => setPing(null), 4000);
        setAttention((prev) => sortAttention([...prev.filter((c) => c.id !== p.camera.id), p.camera]));
      },
      "occurrence:new": (occ: Occurrence) => {
        setOccurrences((prev) => [occ, ...prev].slice(0, 6));
      },
      "occurrences:refresh": (list: Occurrence[]) => {
        setOccurrences(list.slice(0, 6));
      },
      "alert:new": (a: Alert) => {
        setAlerts((prev) => [a, ...prev].slice(0, 6));
        if (a.mensagem.startsWith("⚠")) showAlert(a.mensagem.replace(/^⚠\s*/, ""), "warn");
        else if (a.mensagem.startsWith("✔")) showAlert(a.mensagem.replace(/^✔\s*/, ""), "ok");
        else if (a.mensagem.startsWith("🚨")) showAlert(a.mensagem.replace(/^🚨\s*/, ""), "alert");
        else showAlert(a.mensagem, "ok");
      },
      "kpis:update": (k: Kpis) => setKpis(k),
    },
    !isVercel
  );

  // No Vercel (serverless), usa polling REST em vez de WebSocket
  useEffect(() => {
    if (!isVercel) return;
    const t = window.setInterval(() => {
      loadAll().catch(() => {});
    }, 60000);
    return () => window.clearInterval(t);
  }, [isVercel, loadAll]);

  // rotação automática
  useEffect(() => {
    if (!auto) return;
    const b = progRef.current;
    if (b) {
      b.style.animation = "none";
      void b.offsetWidth;
      b.style.animation = "prog 15s linear forwards";
    }
    const t = window.setTimeout(() => {
      setCur((c) => SEQ[(SEQ.indexOf(c) + 1) % SEQ.length]);
    }, 15000);
    return () => window.clearTimeout(t);
  }, [auto, cur]);

  const show = useCallback((v: string) => {
    setCur(v);
    setAuto(false);
  }, []);

  const toggleAuto = () => {
    setAuto((a) => !a);
    say(auto ? "Rotação automática desligada" : "Rotação automática ligada");
  };

  const toneOf = (kind: AlertKind) =>
    kind === "warn" ? "alert-warning" : kind === "alert" ? "alert-error" : "alert-success";

  const focus = (name: string) =>
    cur === "geral" || cur === name ? "" : "opacity-60";
  const focused = (name: string) =>
    cur === name ? "ring-2 ring-primary/70 shadow-primary/20" : "";

  const navItems = [
    ["geral", "Geral", LayoutDashboard],
    ["mapa", "Mapa", MapIcon],
    ["municipios", "Municípios", Building2],
    ["atencao", "Atenção", AlertTriangle],
    ["ocorrencias", "Ocorrências", FileText],
    ["cameras", "Câmeras", Video],
  ] as const;

  const onOff = (n: number, total: number) => (total ? (n / total) * 100 : 0);

  return (
    <div className="flex h-dvh flex-col gap-3 overflow-y-auto p-3 xl:overflow-hidden xl:p-4">
      <div id="prog" ref={progRef} className="fixed inset-x-0 top-0 z-50 h-1 origin-left scale-x-0 bg-primary" />

      {alertMsg && (
        <div className="toast toast-top toast-center z-50">
          <div className={`alert ${toneOf(alertMsg.kind)} shadow-lg font-semibold`}>
            {alertMsg.kind === "warn" && <AlertTriangle size={20} strokeWidth={2.4} className="ico-alert" />}
            {alertMsg.kind === "ok" && <CheckCircle2 size={20} strokeWidth={2.4} className="ico-pop" />}
            {alertMsg.kind === "alert" && <Siren size={20} strokeWidth={2.4} className="ico-siren" />}
            <span>{alertMsg.text}</span>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-center gap-3">
        <img src="/logo-vigia.png" alt="Vigia Mais MT" className="h-12 w-12 object-contain" />
        <h1 className="text-xl font-extrabold leading-none">Vigia Mais MT</h1>
        <span className="badge badge-success badge-outline gap-2 font-bold tracking-widest">
          <Radio size={14} strokeWidth={2.5} className="live-icon" /> AO VIVO
        </span>

        <nav className="join ml-auto flex-wrap">
          {navItems.map(([v, label, Icon]) => (
            <button
              key={v}
              data-v={v}
              className={`btn btn-sm join-item ${cur === v ? "btn-primary" : "btn-ghost border-base-content/15"}`}
              onClick={() => show(v)}
            >
              <Icon
                size={15}
                strokeWidth={2.2}
                className={v === "atencao" && attention.length > 0 ? "ico-alert" : "nav-ico"}
              />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
          <button
            id="auto"
            className={`btn btn-sm join-item ${auto ? "btn-primary" : "btn-ghost border-base-content/15"}`}
            onClick={toggleAuto}
          >
            <RefreshCw size={15} strokeWidth={2.2} className={auto ? "spin" : ""} />
            <span className="hidden xl:inline">Auto</span>
          </button>
          <button id="mic" className="btn btn-sm btn-ghost join-item border-base-content/15">
            <Mic size={15} strokeWidth={2.2} className="ico-mic" />
          </button>
          <button
            id="fs"
            className="btn btn-sm btn-ghost join-item border-base-content/15"
            onClick={() =>
              document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
            }
          >
            {document.fullscreenElement ? <Minimize size={15} strokeWidth={2.2} /> : <Maximize size={15} strokeWidth={2.2} />}
          </button>
        </nav>

        <img src="/logo-multiway.png" alt="MultiWay" className="h-auto w-[120px] object-contain opacity-90" />

        <div className="text-right tabular-nums">
          <b className="block text-2xl leading-none">{now.toLocaleTimeString("pt-BR")}</b>
          <span className="text-xs capitalize text-base-content/60">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </span>
        </div>
      </header>

      <section className="stats stats-horizontal w-full overflow-x-auto border border-base-content/10 bg-base-200/70 shadow">
        <div className="stat">
          <div className="stat-title">Câmeras entregues</div>
          <div className="stat-value text-primary">{RESUMO_OFICIAL.camerasEntregues.toLocaleString("pt-BR")}</div>
          <div className="stat-desc">SESP-MT · {RESUMO_OFICIAL.atualizadoEm}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Em operação (Ciosp)</div>
          <div className="stat-value text-success">{RESUMO_OFICIAL.camerasEmOperacao.toLocaleString("pt-BR")}</div>
          <div className="stat-desc">monitoradas em tempo real</div>
        </div>
        <div className="stat">
          <div className="stat-title">Municípios aderidos</div>
          <div className="stat-value text-info">{RESUMO_OFICIAL.municipiosAderidos}</div>
          <div className="stat-desc">de 142 em Mato Grosso</div>
        </div>
        <div className="stat">
          <div className="stat-title">Taxa em operação</div>
          <div className="stat-value text-warning">
            {((RESUMO_OFICIAL.camerasEmOperacao / RESUMO_OFICIAL.camerasEntregues) * 100).toFixed(1)}%
          </div>
          <div className="stat-desc">das câmeras entregues</div>
        </div>
      </section>

      {cur !== "cameras" && (
        <main className={`grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-rows-[1fr] ${GRID[cur] ?? GRID.geral}`} style={{ minHeight: 0, height: "100%" }}>
          <div className="flex min-h-0 flex-col gap-3" style={{ minHeight: "60vh", height: "100%", flex: "1 1 0%", overflow: "hidden", display: "flex", alignItems: "stretch" }}>
            <div className={`card min-h-[60vh] flex-1 border border-base-content/10 bg-base-200/70 shadow-xl transition xl:min-h-0 ${focus("municipios")} ${focused("municipios")}`} id="c-mun">
              <div className="card-body min-h-0 gap-2 p-4">
                <h2 className="flex justify-between text-xs font-bold uppercase tracking-widest text-base-content/60">
                  Municípios com câmeras
                  <em className="not-italic text-primary">
                    {vigiaRows.filter((r) => r.status === "aderido").length} aderidos
                  </em>
                </h2>
                <div ref={munsRef} className="min-h-[40vh] flex-1 divide-y divide-base-content/10 overflow-y-auto xl:min-h-0" id="muns" style={{ flex: "1 1 0%", minHeight: 0, height: "100%" }}>
                  {vigiaRows.map((r) => (
                    <div key={r.nome} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className="truncate">{r.nome}</span>
                      <span
                        className={`badge badge-sm badge-outline whitespace-nowrap ${
                          r.status === "aderido" ? "badge-success" : r.status === "adesao" ? "badge-warning" : "badge-error"
                        }`}
                      >
                        {r.status === "aderido" ? "aderido" : r.status === "adesao" ? "em adesão" : "não aderiu"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-base-content/50">
                  Fonte: SESP-MT · adesão ao Vigia Mais MT (contagem por município não é publicada)
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className={`card min-h-0 flex-[1.6] border border-base-content/10 bg-base-200/70 shadow-xl transition ${focus("mapa")} ${focused("mapa")}`} id="c-map">
              <div className="card-body min-h-0 gap-2 p-4">
                <h2 className="flex justify-between text-xs font-bold uppercase tracking-widest text-base-content/60">
                  Mato Grosso · cobertura
                  <em className="not-italic text-primary">tamanho = nº de câmeras</em>
                </h2>
                <div className="relative min-h-[280px] flex-1">
                  <svg id="map" viewBox="0 0 118 107" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
                    <defs>
                      <pattern id="g" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M10 0H0V10" fill="none" stroke="var(--line)" strokeWidth=".2" />
                      </pattern>
                    </defs>
                    <rect width="118" height="107" fill="url(#g)" opacity=".6" />
                    {outlinePath ? (
                      <path d={outlinePath} fill="var(--glow)" stroke="var(--acc)" strokeWidth=".5" strokeLinejoin="round" />
                    ) : (
                      <polygon
                        points={OUT.map((p) => `${px(p[0])},${py(p[1])}`).join(" ")}
                        fill="var(--glow)"
                        stroke="var(--acc)"
                        strokeWidth=".5"
                        strokeLinejoin="round"
                      />
                    )}
                    {allMunPaths.length > 0 && (
                      <g pointerEvents="none">
                        {allMunPaths.map((m) => {
                          const isMon = vigiaCodes.has(Number(m.code));
                          return (
                            <path
                              key={m.code}
                              d={m.d}
                              fill={isMon ? "var(--acc)" : "none"}
                              fillOpacity={isMon ? 0.18 : 0}
                              stroke={isMon ? "var(--acc)" : "var(--line)"}
                              strokeWidth={isMon ? 0.45 : 0.22}
                              opacity={isMon ? 0.9 : 0.55}
                            />
                          );
                        })}
                      </g>
                    )}
                    {allMunPaths.length > 0 && (
                      <g pointerEvents="none">
                        {allMunPaths
                          .filter((m) => vigiaCodes.has(Number(m.code)) && !municipios.some((x) => x.nome === ibgeNames[Number(m.code)]))
                          .map((m) => {
                            const nome = ibgeNames[Number(m.code)] || "";
                            const [cx, cy] = m.c;
                            return (
                              <g key={`cam-${m.code}`} style={{ color: "var(--acc)" }}>
                                <g transform={`translate(${(cx - 1.44).toFixed(2)}, ${(cy - 1.44).toFixed(2)}) scale(0.12)`}>
                                  <path d={CAMERA_PATH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                                </g>
                                <text x={cx} y={cy + 1.5} textAnchor="middle" style={{ fontSize: "1.9px" }}>
                                  {nome}
                                </text>
                              </g>
                            );
                          })}
                      </g>
                    )}
                    {munBoundary && (
                      <path d={munBoundary} fill="var(--acc)" fillOpacity=".12" stroke="var(--acc)" strokeWidth=".6" />
                    )}
                    {municipios.filter((m) => isVigiaAderido(m.nome)).map((m) => {
                      const t = m.total;
                      const a = onOff(m.cameras.on, t);
                      const c = a >= 90 ? "var(--on)" : a >= 86 ? "var(--man)" : "var(--off)";
                      const r = 1.5 + Math.sqrt(t) / 9;
                      const x = px(m.lon);
                      const y = py(m.lat);
                      return (
                        <g
                          key={m.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            const code = ibgeCodes[m.nome];
                            if (!code) return;
                            fetch(`${IBGE}/v3/malhas/municipios/${code}?formato=application/vnd.geo+json&qualidade=minima`)
                              .then((r) => r.json())
                              .then((gj) => {
                                const coords = gj?.features?.[0]?.geometry?.coordinates;
                                if (!coords) return;
                                const ring = Array.isArray(coords[0][0]) ? coords[0][0] : coords[0];
                                const d = ring
                                  .map((c: number[], i: number) => `${i === 0 ? "M" : "L"} ${px(c[0])} ${py(c[1])}`)
                                  .join(" ") + " Z";
                                setMunBoundary(d);
                              })
                              .catch(() => {});
                          }}
                        >
                          {m.nome === ping && <circle className="ping" cx={x} cy={y} r={r + 1} stroke={c} />}
                          <circle cx={x} cy={y} r="1.1" fill={c} fillOpacity=".95" stroke="var(--bg)" strokeWidth=".3" />
                          <g transform={`translate(${Number(x) - 2.1}, ${Number(y) - 2.1}) scale(0.175)`} style={{ pointerEvents: "none", color: "var(--tx)" }}>
                            <path d={CAMERA_PATH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                          </g>
                          <text
                            x={SIDE[m.nome] === "l" ? Number(x) - r - 1 : Number(x) + r + 1}
                            y={Number(y) + 1.1}
                            textAnchor={SIDE[m.nome] === "l" ? "end" : "start"}
                          >
                            {m.nome}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <p className="text-xs text-base-content/50">
                  Malha real via IBGE · 128 municípios aderidos ao Vigia Mais MT destacados (SESP) · clique para ver contorno
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
                  <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full bg-success" />≥ 90% online</span>
                  <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full bg-warning" />86–90%</span>
                  <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full bg-error" />&lt; 86%</span>
                  <span>contorno simplificado</span>
                </div>
              </div>
            </div>

            <div className={`card min-h-0 flex-1 border border-base-content/10 bg-base-200/70 shadow-xl transition ${focus("atencao")} ${focused("atencao")}`} id="c-att">
              <div className="card-body min-h-0 gap-2 p-4">
                <h2 className="flex justify-between text-xs font-bold uppercase tracking-widest text-base-content/60">
                  Precisam de atenção
                  <em className="not-italic text-primary">
                    {attention.length} {attention.length === 1 ? "câmera" : "câmeras"}
                  </em>
                </h2>
                <div className="min-h-0 flex-1 divide-y divide-base-content/10 overflow-y-auto" id="atts">
                  {attention.length === 0 && (
                    <div className="alert alert-success my-2">
                      <CheckCircle2 size={18} strokeWidth={2.2} className="ico-pop" />
                      <span>Todas as câmeras estão online</span>
                    </div>
                  )}
                  {attention.slice(0, 8).map((c) => {
                    const off = c.status === "off";
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <b className="block truncate text-sm">Câm. {c.id} · {c.nome}</b>
                          <small className="block truncate text-xs text-base-content/60">
                            {c.municipio} · {c.detalhe}
                          </small>
                        </div>
                        <span className={`badge badge-sm shrink-0 ${off ? "badge-error" : "badge-warning"}`}>
                          {off ? "offline" : "manutenção"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className={`card min-h-0 flex-1 border border-base-content/10 bg-base-200/70 shadow-xl transition ${focus("ocorrencias")} ${focused("ocorrencias")}`} id="c-occ">
              <div className="card-body min-h-0 gap-2 p-4">
                <h2 className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-base-content/60">
                  Notícias · Vigia Mais MT
                  <span className="flex items-center gap-1.5 normal-case tracking-normal text-success">
                    <span className="size-2 animate-pulse rounded-full bg-success" />
                    {news.updatedAt ? `atualizado ${tempoRelativo(news.updatedAt, now)}` : "carregando…"}
                  </span>
                </h2>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" id="news">
                  {news.items.length === 0 && (
                    <p className="py-6 text-center text-sm text-base-content/60">
                      {news.updatedAt ? "Nenhuma notícia encontrada." : "Buscando notícias…"}
                    </p>
                  )}
                  {news.items.slice(0, 30).map((n) => (
                    <a
                      key={n.id}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block rounded-r-xl border-l-4 bg-gradient-to-r from-primary/10 to-transparent p-3 text-sm transition hover:from-primary/20 ${
                        newIds.has(n.id) ? "border-success ico-pop" : "border-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-base-content/60">
                        <span className="truncate font-semibold text-primary">{n.fonte || "Notícia"}</span>
                        <time className="shrink-0">{n.publicadoEm ? tempoRelativo(n.publicadoEm, now) : ""}</time>
                      </div>
                      <b className="mt-1 block leading-snug">{n.titulo}</b>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {cur === "cameras" && <CamerasView />}

      {heard && (
        <div className="toast toast-bottom toast-center z-40">
          <div className="alert alert-info py-2 text-sm">{heard}</div>
        </div>
      )}
    </div>
  );
}
