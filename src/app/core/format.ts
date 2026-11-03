const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const DASH = '—';

/** 1536 -> "1,5 KiB". Base 1024, como o sistema mostra RAM. */
export function bytes(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return DASH;
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let n = Math.abs(v);
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 100 || i === 0 ? nf0.format(n) : nf1.format(n)} ${units[i]}`;
}

export function rate(v: number | null | undefined): string {
  return v == null ? DASH : `${bytes(v)}/s`;
}

/** 0.4231 -> "42,3%". */
export function percent(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return DASH;
  const p = v * 100;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: p < 10 ? digits : Math.min(digits, 1) }).format(p)}%`;
}

export function celsius(v: number | null | undefined): string {
  return v == null ? DASH : `${nf0.format(v)} °C`;
}

/** Nucleos de CPU: 0.012 -> "12 m" (milicores), 1.5 -> "1,5". */
export function cores(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return DASH;
  if (v < 1) return `${nf0.format(v * 1000)}m`;
  return nf1.format(v);
}

export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return DASH;
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${nf0.format(s)}s`;
}

export function ms(seconds: number | null | undefined): string {
  return seconds == null ? DASH : `${nf0.format(seconds * 1000)} ms`;
}

/** Quanto tempo atras (epoch em segundos ou ISO). */
export function ago(value: number | string | null | undefined): string {
  if (value == null) return DASH;
  const t = typeof value === 'number' ? value * 1000 : Date.parse(value);
  if (!isFinite(t)) return DASH;
  return `há ${duration((Date.now() - t) / 1000)}`;
}

export function number(v: number | null | undefined): string {
  return v == null ? DASH : nf1.format(v);
}

/** Nivel de severidade para medidores: ok < 75%, atencao < 90%, critico. */
export type Level = 'ok' | 'warn' | 'crit';

export function level(fraction: number | null | undefined, warn = 0.75, crit = 0.9): Level {
  if (fraction == null) return 'ok';
  return fraction >= crit ? 'crit' : fraction >= warn ? 'warn' : 'ok';
}
