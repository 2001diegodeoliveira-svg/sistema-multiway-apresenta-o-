import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { useSocket } from "./hooks/useSocket";
import type { Municipio, Kpis, Occurrence, Alert } from "./types";
import {
  Video, LayoutDashboard, Map as MapIcon, Building2, AlertTriangle, FileText,
  RefreshCw, Mic, Maximize, Minimize, Radio, Camera, CheckCircle2, Siren,
} from "lucide-react";

const OUT = [[-61.6,-13.6],[-60.8,-11.9],[-60,-10.3],[-59.4,-9],[-58.4,-7.4],[-57,-8.2],[-55.8,-9],[-54.3,-9.9],[-52.5,-9.6],[-50.7,-9.2],[-50.2,-11],[-51,-12.6],[-51.8,-14],[-52.4,-15.6],[-53,-16.9],[-53.6,-17.8],[-55,-17.7],[-56.4,-17.4],[-57.6,-17.5],[-58.4,-16.3],[-60.2,-16.2],[-60,-15.1],[-61.4,-14.9]];

const SEQ = ["geral", "mapa", "municipios", "atencao", "ocorrencias"];

const px = (lo: number) => ((lo + 61.8) * 10).toFixed(1);
const py = (la: number) => ((-7.2 - la) * 10).toFixed(1);

function geomToPath(geom: any): string {
  if (!geom) return "";
  const rings: number[][][] = [];
  if (geom.type === "Polygon") rings.push(...geom.coordinates);
  else if (geom.type === "MultiPolygon")
    geom.coordinates.forEach((poly: any) => rings.push(...poly));
  return rings
    .map((ring) =>
      ring
        .map((c: number[], i: number) => `${i === 0 ? "M" : "L"} ${px(c[0])} ${py(c[1])}`)
        .join(" ") + " Z"
    )
    .join(" ");
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

export default function App() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [ping, setPing] = useState<string | null>(null);
  const [cur, setCur] = useState("geral");
  const [outlinePath, setOutlinePath] = useState<string>("");
  const [ibgeCodes, setIbgeCodes] = useState<Record<string, number>>({});
  const [munBoundary, setMunBoundary] = useState<string>("");
  const [allMunPaths, setAllMunPaths] = useState<{ code: string; d: string }[]>([]);
  const monitoredCodes = new Set(municipios.map((m) => ibgeCodes[m.nome]).filter(Boolean));
  const [auto, setAuto] = useState(true);
  const [alertMsg, setAlertMsg] = useState<{ text: string; color: string; kind: "warn" | "ok" | "alert" } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const alertTimer = useRef<number | null>(null);

  const showAlert = useCallback((text: string, color: string, kind: "warn" | "ok" | "alert" = "ok") => {
    setAlertMsg({ text, color, kind });
    if (alertTimer.current) window.clearTimeout(alertTimer.current);
    alertTimer.current = window.setTimeout(() => setAlertMsg(null), 4500);
  }, []);

  const say = useCallback((t: string) => {
    setHeard(t);
    window.setTimeout(() => setHeard(null), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    const [m, k, o, a] = await Promise.all([
      api.municipios(),
      api.kpis(),
      api.occurrences(6),
      api.alerts(6),
    ]);
    setMunicipios(m);
    setKpis(k);
    setOccurrences(o);
    setAlerts(a);
  }, []);

  useEffect(() => {
    loadAll().catch(console.error);
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [loadAll]);

  const IBGE = "https://servicodados.ibge.gov.br/api";
  // IBGE: malha real do estado de MT (direto no navegador, evita proxy/serverless)
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
    // IBGE: lista de municípios (para malhas sob demanda)
    fetch(`${IBGE}/v1/localidades/estados/51/municipios`)
      .then((r) => r.json())
      .then((list) => {
        const map: Record<string, number> = {};
        (list || []).forEach((m: any) => {
          map[m.nome] = m.id;
        });
        setIbgeCodes(map);
      })
      .catch(() => {});

    // IBGE: malha de todos os municípios de MT (intrarregiao=municipio)
    fetch(`${IBGE}/v3/malhas/estados/51?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`)
      .then((r) => r.json())
      .then((gj) => {
        const paths = (gj?.features || []).map((f: any) => ({
          code: f.properties?.codarea,
          d: geomToPath(f.geometry),
        }));
        setAllMunPaths(paths);
      })
      .catch(() => {});
  }, []);

  useSocket({
    "camera:update": (p: { camera: any; municipio: Municipio }) => {
      setMunicipios((prev) =>
        prev.map((m) => (m.id === p.municipio.id ? p.municipio : m))
      );
      setPing(p.municipio.nome);
      window.setTimeout(() => setPing(null), 4000);
    },
    "occurrence:new": (occ: Occurrence) => {
      setOccurrences((prev) => [occ, ...prev].slice(0, 6));
    },
    "occurrences:refresh": (list: Occurrence[]) => {
      setOccurrences(list.slice(0, 6));
    },
    "alert:new": (a: Alert) => {
      setAlerts((prev) => [a, ...prev].slice(0, 6));
      if (a.mensagem.startsWith("⚠")) showAlert(a.mensagem.replace(/^⚠\s*/, ""), "var(--off)", "warn");
      else if (a.mensagem.startsWith("✔")) showAlert(a.mensagem.replace(/^✔\s*/, ""), "var(--on)", "ok");
      else if (a.mensagem.startsWith("🚨")) showAlert(a.mensagem.replace(/^🚨\s*/, ""), "var(--on)", "alert");
      else showAlert(a.mensagem, "var(--acc)", "ok");
    },
    "kpis:update": (k: Kpis) => setKpis(k),
  });

  // auto rotation
  const progRef = useRef<HTMLDivElement>(null);
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

  const show = useCallback(
    (v: string, fromAuto = false) => {
      setCur(v);
      if (!fromAuto) {
        setAuto(false);
      }
    },
    []
  );

  const toggleAuto = () => {
    setAuto((a) => !a);
    say(auto ? "Rotação automática desligada" : "Rotação automática ligada");
  };

  const total = kpis
    ? kpis.totalCameras
    : municipios.reduce((a, m) => a + m.total, 0);
  const on = kpis ? kpis.online : municipios.reduce((a, m) => a + m.cameras.on, 0);
  const off = kpis ? kpis.offline : municipios.reduce((a, m) => a + m.cameras.off, 0);
  const man = kpis ? kpis.manutencao : municipios.reduce((a, m) => a + m.cameras.man, 0);

  const C = { on: "var(--on)", off: "var(--off)", man: "var(--man)" };

  const mainClass = cur === "geral" ? "" : `data-f="${cur}"`;

  return (
    <div className="app">
      <div id="prog" ref={progRef} />
      {alertMsg && (
        <div id="alert" className="show" style={{ "--c": alertMsg.color } as any}>
          {alertMsg.kind === "warn" && <AlertTriangle size={20} strokeWidth={2.4} />}
          {alertMsg.kind === "ok" && <CheckCircle2 size={20} strokeWidth={2.4} />}
          {alertMsg.kind === "alert" && <Siren size={20} strokeWidth={2.4} />}
          <span>{alertMsg.text}</span>
        </div>
      )}
      <header>
        <div className="logo"><Video size={24} strokeWidth={2.2} /></div>
        <h1>
          Vigia Mais MT<small>Central de monitoramento · demonstração simulada</small>
        </h1>
        <div className="live">
          <Radio size={14} strokeWidth={2.5} className="live-icon" /> AO VIVO
        </div>
        <nav>
          {([
            ["geral", "Geral", LayoutDashboard],
            ["mapa", "Mapa", MapIcon],
            ["municipios", "Municípios", Building2],
            ["atencao", "Atenção", AlertTriangle],
            ["ocorrencias", "Ocorrências", FileText],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              data-v={v}
              className={cur === v ? "active" : ""}
              onClick={() => show(v)}
            >
              <Icon size={15} strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          ))}
          <button id="auto" className={auto ? "active" : ""} onClick={toggleAuto}>
            <RefreshCw size={15} strokeWidth={2.2} className={auto ? "spin" : ""} />
            <span>Auto</span>
          </button>
          <button id="mic">
            <Mic size={15} strokeWidth={2.2} />
          </button>
          <button id="fs" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
            {document.fullscreenElement ? <Minimize size={15} strokeWidth={2.2} /> : <Maximize size={15} strokeWidth={2.2} />}
          </button>
        </nav>
        <div className="clock">
          <b>{now.toLocaleTimeString("pt-BR")}</b>
          <span>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
        </div>
      </header>

      <section className="kpis" id="kpis">
        {[
          ["Total de câmeras", total, "var(--acc)"],
          ["Online", on, C.on],
          ["Offline", off, C.off],
          ["Em manutenção", man, C.man],
          ["Disponibilidade", total ? (on / total * 100).toFixed(1) + "%" : "0%", "var(--acc)"],
        ].map(([label, val, color]) => (
          <div className="kpi" key={String(label)} style={{ "--c": color } as any}>
            <b>{val}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <main id="main" data-f={cur === "geral" ? undefined : cur}>
        <div className="col">
          <div className="card" id="c-mun">
            <h2>
              Câmeras por município <em>{municipios.length} municípios</em>
            </h2>
            <div className="muns" id="muns">
              {municipios.map((m) => {
                const t = m.total;
                return (
                  <div
                    key={m.id}
                    className={`mun${m.nome === "Cuiabá" ? " cb" : ""}${m.nome === ping ? " ping" : ""}`}
                  >
                    <span>{m.nome}</span>
                    <div className="stack">
                      <i style={{ width: `${(m.cameras.on / t) * 100}%`, background: "var(--on)" }} />
                      <i style={{ width: `${(m.cameras.off / t) * 100}%`, background: "var(--off)" }} />
                      <i style={{ width: `${(m.cameras.man / t) * 100}%`, background: "var(--man)" }} />
                    </div>
                    <em>{t}</em>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span>
                <i className="dot" style={{ background: "var(--on)" }} />Online
              </span>
              <span>
                <i className="dot" style={{ background: "var(--off)" }} />Offline
              </span>
              <span>
                <i className="dot" style={{ background: "var(--man)" }} />Manutenção
              </span>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card" id="c-map">
            <h2>
              Mato Grosso · cobertura <em>tamanho = nº de câmeras</em>
            </h2>
            <svg id="map" viewBox="0 0 118 107" preserveAspectRatio="xMidYMid meet">
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
                    const isMon = monitoredCodes.has(Number(m.code));
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
              {munBoundary && (
                <path d={munBoundary} fill="var(--acc)" fillOpacity=".12" stroke="var(--acc)" strokeWidth=".6" />
              )}
              {municipios.map((m) => {
                const t = m.total;
                const a = m.cameras.on / t * 100;
                const c = a >= 90 ? C.on : a >= 86 ? C.man : C.off;
                const r = 1.5 + Math.sqrt(t) / 9;
                const x = px(m.lon);
                const y = py(m.lat);
                return (
                  <g key={m.id} style={{ cursor: "pointer" }} onClick={() => {
                    const code = ibgeCodes[m.nome];
                    if (!code) return;
                    fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${code}?formato=application/vnd.geo+json&qualidade=minima`)
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
                  }}>
                    {m.nome === ping && (
                      <circle className="ping" cx={x} cy={y} r={r + 1} stroke={c} />
                    )}
                    <circle cx={x} cy={y} r="1.1" fill={c} fillOpacity=".95" stroke="var(--bg)" strokeWidth=".3" />
                    <g transform={`translate(${Number(x) - 2.1}, ${Number(y) - 2.1}) scale(0.175)`} style={{ pointerEvents: "none", color: "var(--tx)" }}>
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    </g>
                    <text x={SIDE[m.nome] === "l" ? Number(x) - r - 1 : Number(x) + r + 1} y={Number(y) + 1.1} textAnchor={SIDE[m.nome] === "l" ? "end" : "start"}>
                      {m.nome}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div style={{ fontSize: "1.05vh", color: "var(--mut)", marginTop: ".4vh" }}>
              Malha real via IBGE · municípios com câmeras Vigia Mais MT destacados · clique para ver contorno
            </div>
            <div className="legend">
              <span>
                <i className="dot" style={{ background: "var(--on)" }} />≥ 90% online
              </span>
              <span>
                <i className="dot" style={{ background: "var(--man)" }} />86–90%
              </span>
              <span>
                <i className="dot" style={{ background: "var(--off)" }} />&lt; 86%
              </span>
              <span>contorno simplificado</span>
            </div>
          </div>
          <div className="card" id="c-att">
            <h2>Precisam de atenção <em>5 mais recentes</em></h2>
            <div className="atts" id="atts">
              {alerts.slice(0, 5).map((a) => (
                <div className="cam" key={a.id}>
                  <div>
                    {a.mensagem}
                    <small>{a.municipio ? `${a.municipio} · agora` : ""}</small>
                  </div>
                  <span className="pill" style={{ background: a.tipo === "offline" ? C.off : C.man }}>
                    {a.tipo === "offline" ? "offline" : a.tipo === "manutencao" ? "manutenção" : a.tipo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card" id="c-occ">
            <h2>Ocorrências apoiadas pelo Vigia <em>hoje</em></h2>
            <div className="occs" id="occs">
              {occurrences.slice(0, 5).map((o, i) => (
                <div className={`occ${i === 0 ? " fresh" : ""}`} key={o.id}>
                  <time>{o.quando}</time>
                  <span className="tag">{o.tipo}</span>
                  <b>{o.local}</b>
                  <p>{o.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {heard && <div id="heard" className="show">{heard}</div>}
    </div>
  );
}