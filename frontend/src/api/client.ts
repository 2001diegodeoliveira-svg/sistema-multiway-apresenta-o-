const BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  kpis: () => request<import("../types").Kpis>("/api/municipios/kpis"),
  municipios: () => request<import("../types").Municipio[]>("/api/municipios"),
  cameras: (params?: { status?: string; municipio?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.municipio) qs.set("municipio", params.municipio);
    if (params?.q) qs.set("q", params.q);
    const s = qs.toString();
    return request<import("../types").Camera[]>(`/api/cameras${s ? "?" + s : ""}`);
  },
  occurrences: (limit = 50) => request<import("../types").Occurrence[]>(`/api/occurrences?limit=${limit}`),
  alerts: (limit = 50) => request<import("../types").Alert[]>(`/api/alerts?limit=${limit}`),
  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string; role: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  updateCameraStatus: (id: string, status: "on" | "off" | "man", detalhe?: string) =>
    request<import("../types").Camera>(`/api/cameras/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, detalhe }),
    }),
};