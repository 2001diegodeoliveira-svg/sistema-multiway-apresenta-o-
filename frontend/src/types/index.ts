export interface Municipio {
  id: number;
  nome: string;
  lon: number;
  lat: number;
  cameras: { on: number; off: number; man: number };
  total: number;
  disponibilidade: number;
}

export interface Camera {
  id: string;
  nome: string;
  municipioId: number;
  municipio: string;
  status: "on" | "off" | "man";
  detalhe: string;
  updatedAt: string;
}

export interface Occurrence {
  id: number;
  tipo: string;
  quando: string;
  local: string;
  descricao: string;
  municipioId: number | null;
  municipio: string | null;
  createdAt: string;
}

export interface Alert {
  id: number;
  cameraId: string | null;
  municipioId: number | null;
  municipio: string | null;
  tipo: string;
  mensagem: string;
  createdAt: string;
}

export interface Kpis {
  totalCameras: number;
  online: number;
  offline: number;
  manutencao: number;
  municipios: number;
  disponibilidade: number;
}