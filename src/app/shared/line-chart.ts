import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, signal, DestroyRef } from '@angular/core';

export interface ChartLine {
  name: string;
  points: [number, number][];
}

const COLORS = ['var(--series-1)', 'var(--series-2)'];
const PAD = { top: 12, right: 14, bottom: 24 };

/**
 * Grafico de linha em SVG (ate 2 series; uma escala so).
 * Linhas de 2px, lavagem de 10% com uma serie, ponto final com anel, cursor + tooltip no hover.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lines().length > 1) {
      <ul class="legend">
        @for (l of lines(); track l.name; let i = $index) {
          <li><span class="key" [style.background]="color(i)"></span>{{ l.name }}
            <span class="num secondary">{{ last(l) }}</span></li>
        }
      </ul>
    }
    <div class="plot" [style.height.px]="height()">
      @if (hasData()) {
        <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()">
          @for (t of yTicks(); track t.v) {
            <line class="grid" [attr.x1]="padLeft()" [attr.x2]="width() - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="tick" [attr.x]="padLeft() - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.label }}</text>
          }
          <line class="axis" [attr.x1]="padLeft()" [attr.x2]="width() - pad.right" [attr.y1]="baseY()" [attr.y2]="baseY()" />
          @for (t of xTicks(); track t.x) {
            <text class="tick" [attr.x]="t.x" [attr.y]="height() - 6" text-anchor="middle">{{ t.label }}</text>
          }
          @if (lines().length === 1 && paths()[0]) {
            <path class="wash" [attr.d]="paths()[0].area" [attr.fill]="color(0)" />
          }
          @for (p of paths(); track $index; let i = $index) {
            <path class="line" [attr.d]="p.line" [attr.stroke]="color(i)" />
            @if (p.end) {
              <circle class="end" [attr.cx]="p.end[0]" [attr.cy]="p.end[1]" r="4" [attr.fill]="color(i)" />
            }
          }
          @if (hover(); as h) {
            <line class="cross" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="pad.top" [attr.y2]="baseY()" />
            @for (v of h.values; track $index; let i = $index) {
              @if (v.y != null) {
                <circle class="end" [attr.cx]="h.x" [attr.cy]="v.y" r="4" [attr.fill]="color(i)" />
              }
            }
          }
          <rect class="hit" [attr.x]="padLeft()" [attr.y]="0" [attr.width]="plotW()" [attr.height]="height()"
                (pointermove)="onMove($event)" (pointerleave)="hover.set(null)" />
        </svg>
        @if (hover(); as h) {
          <div class="tip" [style.left.px]="h.tipX" [class.left]="h.flip">
            <div class="muted">{{ h.time }}</div>
            @for (v of h.values; track $index; let i = $index) {
              <div class="tip-row"><span class="key" [style.background]="color(i)"></span>{{ v.name }}
                <b class="num">{{ v.label }}</b></div>
            }
          </div>
        }
      } @else {
        <div class="empty">{{ loading() ? 'Carregando…' : 'Sem dados no período' }}</div>
      }
    </div>
  `,
  styles: `
    :host { display: block; position: relative; }
    .plot { position: relative; }
    svg { display: block; overflow: visible; }
    .grid { stroke: var(--grid); stroke-width: 1; }
    .axis { stroke: var(--axis); stroke-width: 1; }
    .tick { fill: var(--text-muted); font-size: 11px; font-family: var(--mono); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .wash { opacity: 0.1; }
    .end { stroke: var(--surface-1); stroke-width: 2; }
    .cross { stroke: var(--text-muted); stroke-width: 1; }
    .hit { fill: transparent; cursor: crosshair; touch-action: pan-y; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 8px; padding: 0; list-style: none; font-size: 0.8rem; color: var(--text-secondary); }
    .legend li { display: inline-flex; align-items: center; gap: 6px; }
    .key { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
    .tip {
      position: absolute; top: 4px; transform: translateX(12px); pointer-events: none; z-index: 2;
      background: var(--surface-3); border: 1px solid var(--axis); border-radius: 8px; padding: 6px 10px;
      font-size: 0.78rem; white-space: nowrap; box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
    }
    .tip.left { transform: translateX(calc(-100% - 12px)); }
    .tip-row { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
    .tip-row b { color: var(--text-primary); margin-left: auto; padding-left: 12px; }
    .empty { height: 100%; display: grid; place-items: center; color: var(--text-muted); font-size: 0.9rem; }
  `,
})
export class LineChart {
  readonly lines = input.required<ChartLine[]>();
  readonly format = input.required<(v: number) => string>();
  /** Teto fixo do eixo Y (ex.: 1 para fracoes). Sem ele, arredonda o maximo dos dados. */
  readonly yMax = input<number | null>(null);
  readonly height = input(180);
  readonly loading = input(false);
  /** Escala em potencias de 1024 (bytes): 512 KiB em vez de 488 KiB. */
  readonly binary = input(false);

  /** Margem esquerda acompanha o maior rotulo do eixo Y. */
  protected readonly pad = PAD;
  protected readonly padLeft = computed(() => {
    const top = this.yTop();
    const fmt = this.format();
    const longest = Math.max(...[0, 0.5, 1].map((f) => fmt(f * top).length));
    return Math.max(36, Math.round(longest * 6.8) + 12);
  });
  protected readonly width = signal(600);
  protected readonly hover = signal<Hover | null>(null);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver((entries) => this.width.set(Math.max(240, entries[0].contentRect.width)));
      ro.observe(host);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected readonly hasData = computed(() => this.lines().some((l) => l.points.length > 1));
  protected readonly plotW = computed(() => this.width() - this.padLeft() - PAD.right);
  protected readonly baseY = computed(() => this.height() - PAD.bottom);

  private readonly xDomain = computed(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const l of this.lines()) {
      if (l.points.length) {
        min = Math.min(min, l.points[0][0]);
        max = Math.max(max, l.points[l.points.length - 1][0]);
      }
    }
    return [min, max === min ? min + 1 : max] as const;
  });

  private readonly yTop = computed(() => {
    const fixed = this.yMax();
    let max = 0;
    for (const l of this.lines()) for (const p of l.points) max = Math.max(max, p[1]);
    if (fixed != null) return Math.max(fixed, max);
    return niceCeil(max || 1, this.binary());
  });

  private x(t: number): number {
    const [a, b] = this.xDomain();
    return this.padLeft() + ((t - a) / (b - a)) * this.plotW();
  }

  private y(v: number): number {
    return this.baseY() - (v / this.yTop()) * (this.baseY() - PAD.top);
  }

  protected readonly paths = computed(() =>
    this.lines().map((l) => {
      if (l.points.length < 2) return null as unknown as PathSet;
      let d = '';
      l.points.forEach(([t, v], i) => (d += `${i ? 'L' : 'M'}${this.x(t).toFixed(1)},${this.y(v).toFixed(1)}`));
      const first = l.points[0];
      const lastP = l.points[l.points.length - 1];
      const area = `${d}L${this.x(lastP[0]).toFixed(1)},${this.baseY()}L${this.x(first[0]).toFixed(1)},${this.baseY()}Z`;
      return { line: d, area, end: [this.x(lastP[0]), this.y(lastP[1])] as [number, number] };
    }),
  );

  protected readonly yTicks = computed(() => {
    const top = this.yTop();
    const fmt = this.format();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: f * top, y: this.y(f * top), label: fmt(f * top) }));
  });

  protected readonly xTicks = computed(() => {
    const [a, b] = this.xDomain();
    const n = this.width() < 420 ? 3 : 5;
    const long = b - a > 2 * 86400;
    return Array.from({ length: n }, (_, i) => {
      const t = a + ((b - a) * i) / (n - 1);
      return { x: this.x(t), label: timeLabel(t, long) };
    }).slice(1, -1);
  });

  protected readonly ariaLabel = computed(() =>
    this.lines().map((l) => `${l.name}: atual ${this.last(l)}`).join('; '),
  );

  protected color(i: number): string {
    return COLORS[i] ?? COLORS[0];
  }

  protected last(l: ChartLine): string {
    const p = l.points[l.points.length - 1];
    return p ? this.format()(p[1]) : '—';
  }

  protected onMove(ev: PointerEvent): void {
    const svg = (ev.currentTarget as SVGRectElement).ownerSVGElement!;
    const px = ev.clientX - svg.getBoundingClientRect().left;
    const [a, b] = this.xDomain();
    const t = a + ((px - this.padLeft()) / this.plotW()) * (b - a);
    const ref = this.lines().find((l) => l.points.length) ?? this.lines()[0];
    const near = nearest(ref.points, t);
    if (!near) return;
    const x = this.x(near[0]);
    const values = this.lines().map((l) => {
      const p = nearest(l.points, near[0]);
      return { name: l.name, y: p ? this.y(p[1]) : null, label: p ? this.format()(p[1]) : '—' };
    });
    const long = b - a > 2 * 86400;
    this.hover.set({ x, tipX: x, flip: x > this.width() * 0.6, values, time: timeLabel(near[0], long, true) });
  }
}

interface PathSet {
  line: string;
  area: string;
  end: [number, number];
}

interface Hover {
  x: number;
  tipX: number;
  flip: boolean;
  time: string;
  values: { name: string; y: number | null; label: string }[];
}

function nearest(points: [number, number][], t: number): [number, number] | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] < t) lo = mid;
    else hi = mid;
  }
  return Math.abs(points[lo][0] - t) <= Math.abs(points[hi][0] - t) ? points[lo] : points[hi];
}

/** Arredonda para cima num numero "limpo": 1, 2, 2.5, 5, 10 x 10^n (em bytes, x 1024^k). */
function niceCeil(v: number, binary = false): number {
  if (binary) {
    let unit = 1;
    while (v / unit >= 1024) unit *= 1024;
    return niceCeil(v / unit) * unit;
  }
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fullFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function timeLabel(epochSeconds: number, long: boolean, full = false): string {
  const d = new Date(epochSeconds * 1000);
  if (full) return fullFmt.format(d);
  return long ? dayFmt.format(d) : timeFmt.format(d);
}
