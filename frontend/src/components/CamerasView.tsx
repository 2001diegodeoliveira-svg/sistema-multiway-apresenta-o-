import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, LayoutGrid, List, Maximize2, MapPin, RefreshCw, Video, VideoOff, X } from "lucide-react";

export interface SinfraCamera {
  id: number | string | null;
  codigo: string | null;
  placa: number | null;
  obra: string;
  municipio: string;
  endereco: string;
  localizacao: string;
  lat: number;
  lng: number;
  link: string;
  slug: string;
  online: boolean;
}

interface SinfraResponse {
  source: "live" | "snapshot";
  updatedAt: string;
  total: number;
  online: number;
  offline: number;
  cameras: SinfraCamera[];
}

type Filter = "all" | "online" | "offline";
type View = "mosaic" | "list";

const REFRESH_MS = 2 * 60 * 1000;

export default function CamerasView() {
  const [data, setData] = useState<SinfraResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("mosaic");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SinfraCamera | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sinfra/cameras${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(() => load(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.cameras ?? []).filter((c) => {
      if (filter === "online" && !c.online) return false;
      if (filter === "offline" && c.online) return false;
      if (!q) return true;
      return [c.municipio, c.localizacao, c.obra, c.endereco, c.codigo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, filter, query]);

  const mosaic = useMemo(() => visible.filter((c) => c.online), [visible]);

  return (
    <section className="cams-view">
      <div className="cams-head">
        <div>
          <h2>Câmeras SINFRA · Obras ao Vivo</h2>
          <small>
            {data
              ? `${data.total} câmeras · ${data.online} ao vivo · ${data.offline} offline · ${
                  data.source === "live" ? "fonte: SINFRA-MT" : "snapshot local (SINFRA indisponível)"
                }`
              : "carregando câmeras…"}
          </small>
        </div>
        <div className="cams-tools">
          <input
            type="search"
            placeholder="Buscar município, local ou obra"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cams-filter">
            {(
              [
                ["all", "Todas"],
                ["online", "Ao vivo"],
                ["offline", "Offline"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="cams-filter">
            <button className={view === "mosaic" ? "active" : ""} onClick={() => setView("mosaic")} title="Mosaico">
              <LayoutGrid size={14} strokeWidth={2.2} /> Mosaico
            </button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title="Lista">
              <List size={14} strokeWidth={2.2} /> Lista
            </button>
          </div>
          <button className="cams-refresh" onClick={() => load(true)} disabled={loading} title="Atualizar">
            <RefreshCw size={15} strokeWidth={2.2} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && !data && <div className="cams-empty">Não foi possível carregar as câmeras agora.</div>}

      {view === "mosaic" ? (
        <div className="mosaic">
          {mosaic.map((c) => (
            <div className="mosaic-tile" key={c.slug}>
              <iframe src={c.link} title={c.localizacao || c.slug} loading="lazy" allow="autoplay; fullscreen" />
              <div className="mosaic-label">
                <span className="cam-status">
                  <Video size={12} strokeWidth={2.4} /> AO VIVO
                </span>
                <div className="mosaic-text">
                  <b>{c.localizacao || c.slug}</b>
                  <small>{c.municipio}</small>
                </div>
                <button onClick={() => setSelected(c)} title="Ampliar">
                  <Maximize2 size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))}
          {data && mosaic.length === 0 && (
            <div className="cams-empty">Nenhuma câmera ao vivo com esse filtro.</div>
          )}
        </div>
      ) : (
        <div className="cams-grid">
          {visible.map((c) => (
            <button key={c.slug} className={`cam-card ${c.online ? "is-on" : "is-off"}`} onClick={() => setSelected(c)}>
              <div className="cam-card-top">
                <span className="cam-status">
                  {c.online ? <Video size={14} strokeWidth={2.4} /> : <VideoOff size={14} strokeWidth={2.4} />}
                  {c.online ? "AO VIVO" : "OFFLINE"}
                </span>
                {c.placa != null && <span className="cam-placa">Placa {c.placa}</span>}
              </div>
              <b>{c.localizacao || c.slug}</b>
              <small className="cam-muni">
                <MapPin size={12} strokeWidth={2.2} /> {c.municipio || "MT"}
              </small>
              {c.obra && <small className="cam-obra">{c.obra}</small>}
            </button>
          ))}
          {data && visible.length === 0 && <div className="cams-empty">Nenhuma câmera encontrada com esse filtro.</div>}
        </div>
      )}

      {selected && (
        <div className="cam-modal" onClick={() => setSelected(null)}>
          <div className="cam-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cam-modal-head">
              <div>
                <b>{selected.localizacao || selected.slug}</b>
                <small>
                  {selected.municipio}
                  {selected.endereco ? ` · ${selected.endereco}` : ""}
                </small>
              </div>
              <button onClick={() => setSelected(null)} title="Fechar">
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            <iframe src={selected.link} title={selected.localizacao} allow="autoplay; fullscreen" />
            <a href={selected.link} target="_blank" rel="noopener noreferrer" className="cam-open">
              <ExternalLink size={14} strokeWidth={2.2} /> Abrir monitor em nova aba
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
