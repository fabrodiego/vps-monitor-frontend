// Espelha os DTOs da API. Valores ausentes vem como null. Fracoes de 0 a 1.

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface Me {
  username: string;
}

export interface Overview {
  cpu: { usage: number | null; cores: number | null; load1: number | null; load5: number | null; load15: number | null; tempCelsius: number | null };
  memory: { totalBytes: number | null; usedBytes: number | null; usage: number | null; swapTotalBytes: number | null; swapUsedBytes: number | null };
  disk: { mountpoint: string; totalBytes: number | null; usedBytes: number | null; usage: number | null };
  gpu: { usage: number | null; vramUsedBytes: number | null; vramTotalBytes: number | null; tempCelsius: number | null };
  network: { rxBytesPerSec: number | null; txBytesPerSec: number | null };
  counts: {
    podsRunning: number | null;
    podsTotal: number | null;
    sitesUp: number | null;
    sitesTotal: number | null;
    alertsFiring: number | null;
    unnamedApps: number | null;
  };
  uptimeSeconds: number | null;
}

export type SeriesMetric = 'cpu' | 'ram' | 'disk' | 'gpu' | 'temp' | 'net';
export type SeriesRange = '1h' | '6h' | '24h' | '7d';
export type SeriesUnit = 'fraction' | 'celsius' | 'bytes_per_sec';

export interface SeriesResponse {
  metric: SeriesMetric;
  range: SeriesRange;
  stepSeconds: number;
  unit: SeriesUnit;
  lines: { name: string; points: [number, number][] }[];
}

export type AppKind = 'POD' | 'SERVICO' | 'SISTEMA' | 'SEM_NOME';

export interface App {
  name: string;
  kind: AppKind;
  detail: string;
  cpuCores: number | null;
  memoryBytes: number | null;
  processes: number | null;
  commands: string[];
  warning: boolean;
}

export interface AppsResponse {
  memoryTotalBytes: number | null;
  cpuCores: number | null;
  apps: App[];
}

export interface Pod {
  namespace: string;
  name: string;
  phase: string;
  ready: boolean;
  waitingReason: string | null;
  restarts: number;
  cpuCores: number | null;
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
  startedAt: number | null;
}

export interface Site {
  url: string;
  up: boolean;
  httpStatus: number | null;
  durationSeconds: number | null;
  certExpiresInDays: number | null;
  uptime24h: number | null;
  module: string;
}

export interface DatabaseResponse {
  up: boolean;
  maxConnections: number | null;
  databases: { name: string; sizeBytes: number; connections: number }[];
}

export interface Alert {
  name: string;
  state: 'firing' | 'pending' | string;
  severity: 'critical' | 'warning' | 'info' | string;
  summary: string | null;
  description: string | null;
  activeAt: string | null;
  namespace: string | null;
  target: string | null;
}

export interface PodsResponse {
  pods: Pod[];
}
