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

  const filters: [Filter, string][] = [
    ["all", "Todas"],
    ["online", "Ao vivo"],
    ["offline", "Offline"],
  ];

  return (
    <section className="card flex min-h-0 flex-1 flex-col gap-3 border border-base-content/10 bg-base-200/70 p-4 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-base-content/60">
            Câmeras SINFRA · Obras ao Vivo
          </h2>
          <p className="text-sm text-base-content/70">
            {data
              ? `${data.total} câmeras · ${data.online} ao vivo · ${data.offline} offline · ${
                  data.source === "live" ? "fonte: SINFRA-MT" : "snapshot local (SINFRA indisponível)"
                }`
              : "carregando câmeras…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="input input-sm w-56"
            placeholder="Buscar município, local ou obra"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="join">
            {filters.map(([v, label]) => (
              <button
                key={v}
                className={`btn btn-sm join-item ${filter === v ? "btn-primary" : "btn-ghost border-base-content/15"}`}
                onClick={() => setFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="join">
            <button
              className={`btn btn-sm join-item ${view === "mosaic" ? "btn-primary" : "btn-ghost border-base-content/15"}`}
              onClick={() => setView("mosaic")}
            >
              <LayoutGrid size={14} strokeWidth={2.2} /> Mosaico
            </button>
            <button
              className={`btn btn-sm join-item ${view === "list" ? "btn-primary" : "btn-ghost border-base-content/15"}`}
              onClick={() => setView("list")}
            >
              <List size={14} strokeWidth={2.2} /> Lista
            </button>
          </div>
          <button
            className="btn btn-sm btn-ghost border-base-content/15"
            onClick={() => load(true)}
            disabled={loading}
            title="Atualizar"
          >
            <RefreshCw size={15} strokeWidth={2.2} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="alert alert-error">Não foi possível carregar as câmeras agora.</div>
      )}

      {view === "mosaic" ? (
        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 overflow-y-auto">
          {mosaic.map((c) => (
            <div key={c.slug} className="relative aspect-video overflow-hidden rounded-xl border border-base-content/10 bg-black">
              <iframe
                src={c.link}
                title={c.localizacao || c.slug}
                loading="lazy"
                allow="autoplay; fullscreen"
                className="block h-full w-full border-0 bg-black"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 text-white">
                <span className="badge badge-success badge-sm gap-1 font-bold">
                  <Video size={12} strokeWidth={2.4} /> AO VIVO
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{c.localizacao || c.slug}</b>
                  <small className="truncate text-xs opacity-75">{c.municipio}</small>
                </div>
                <button
                  className="btn btn-xs pointer-events-auto border-white/25 bg-black/50 text-white hover:bg-black/70"
                  onClick={() => setSelected(c)}
                  title="Ampliar"
                >
                  <Maximize2 size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))}
          {data && mosaic.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-base-content/60">
              Nenhuma câmera ao vivo com esse filtro.
            </p>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 overflow-y-auto">
          {visible.map((c) => (
            <button
              key={c.slug}
              onClick={() => setSelected(c)}
              className={`card flex flex-col items-start gap-2 border-l-4 bg-base-100/60 p-4 text-left transition hover:bg-base-300/60 ${
                c.online ? "border-success" : "border-error"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={`badge badge-sm gap-1 font-bold ${c.online ? "badge-success" : "badge-error"}`}>
                  {c.online ? <Video size={12} strokeWidth={2.4} /> : <VideoOff size={12} strokeWidth={2.4} />}
                  {c.online ? "AO VIVO" : "OFFLINE"}
                </span>
                {c.placa != null && <span className="text-xs text-base-content/50">Placa {c.placa}</span>}
              </div>
              <b className="text-sm leading-tight">{c.localizacao || c.slug}</b>
              <small className="flex items-center gap-1 text-xs text-base-content/70">
                <MapPin size={12} strokeWidth={2.2} /> {c.municipio || "MT"}
              </small>
              {c.obra && <small className="line-clamp-2 text-xs text-base-content/50">{c.obra}</small>}
            </button>
          ))}
          {data && visible.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-base-content/60">
              Nenhuma câmera encontrada com esse filtro.
            </p>
          )}
        </div>
      )}

      {selected && (
        <div className="modal modal-open" role="dialog" onClick={() => setSelected(null)}>
          <div className="modal-box max-w-5xl bg-base-200 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <b className="block text-lg">{selected.localizacao || selected.slug}</b>
                <small className="text-sm text-base-content/60">
                  {selected.municipio}
                  {selected.endereco ? ` · ${selected.endereco}` : ""}
                </small>
              </div>
              <button className="btn btn-sm btn-ghost btn-square" onClick={() => setSelected(null)} title="Fechar">
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            <iframe
              src={selected.link}
              title={selected.localizacao}
              allow="autoplay; fullscreen"
              className="mt-3 aspect-video w-full rounded-xl border-0 bg-black"
            />
            <div className="modal-action mt-3 justify-start">
              <a href={selected.link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                <ExternalLink size={14} strokeWidth={2.2} /> Abrir monitor em nova aba
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
