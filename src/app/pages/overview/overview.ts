import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { bytes, celsius, duration, number, rate } from '../../core/format';
import { SeriesRange } from '../../core/models';
import { poll } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { MeterTile } from '../../shared/meter-tile';
import { SeriesCard } from '../../shared/series-card';
import { UpdatedAt } from '../../shared/updated-at';

const RANGES: SeriesRange[] = ['1h', '6h', '24h', '7d'];
const RANGE_KEY = 'vps.range';

@Component({
  selector: 'app-overview',
  imports: [MeterTile, SeriesCard, UpdatedAt, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Visão geral</h1>
        <app-updated-at [at]="ov.updatedAt()" [loading]="ov.loading()" (refresh)="ov.refresh()" />
      </header>

      @if (ov.error(); as e) {
        <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />{{ e }}</div>
      }

      @let o = ov.data();
      <div class="grid grid-4">
        <app-meter-tile label="CPU" [fraction]="o?.cpu?.usage ?? null"
          [sub]="(o?.cpu?.cores ?? '—') + ' núcleos · carga ' + num(o?.cpu?.load1) + ' · ' + temp(o?.cpu?.tempCelsius)" />
        <app-meter-tile label="RAM" [fraction]="o?.memory?.usage ?? null"
          [sub]="size(o?.memory?.usedBytes) + ' de ' + size(o?.memory?.totalBytes)" />
        <app-meter-tile label="Disco /" [fraction]="o?.disk?.usage ?? null" [warnAt]="0.8" [critAt]="0.9"
          [sub]="size(o?.disk?.usedBytes) + ' de ' + size(o?.disk?.totalBytes)" />
        <app-meter-tile label="GPU" [fraction]="o?.gpu?.usage ?? null"
          [sub]="'VRAM ' + size(o?.gpu?.vramUsedBytes) + ' de ' + size(o?.gpu?.vramTotalBytes) + ' · ' + temp(o?.gpu?.tempCelsius)" />
      </div>

      <div class="stats">
        <div class="stat"><span class="k">ligada há</span><span class="v">{{ dur(o?.uptimeSeconds) }}</span></div>
        <div class="stat"><span class="k">rede ↓ / ↑</span><span class="v num">{{ net(o?.network?.rxBytesPerSec) }} / {{ net(o?.network?.txBytesPerSec) }}</span></div>
        <div class="stat"><span class="k">swap</span><span class="v">{{ size(o?.memory?.swapUsedBytes) }} de {{ size(o?.memory?.swapTotalBytes) }}</span></div>
        <a class="stat" routerLink="/pods">
          <span class="k">pods rodando</span><span class="v">{{ o?.counts?.podsRunning ?? '—' }} / {{ o?.counts?.podsTotal ?? '—' }}</span>
        </a>
        <a class="stat" routerLink="/servicos">
          <span class="k">sites no ar</span>
          <span class="v" [class.bad]="sitesDown()">
            {{ o?.counts?.sitesUp ?? '—' }} / {{ o?.counts?.sitesTotal ?? '—' }}
            @if (sitesDown()) { <span class="status crit">fora</span> }
          </span>
        </a>
        <a class="stat" routerLink="/servicos">
          <span class="k">alertas</span>
          <span class="v">
            @if (o?.counts?.alertsFiring) {
              <span class="status crit">{{ o?.counts?.alertsFiring }} disparado(s)</span>
            } @else if (o) {
              <span class="status good">nenhum</span>
            } @else { — }
          </span>
        </a>
        <a class="stat" routerLink="/apps">
          <span class="k">processos sem nome</span>
          <span class="v">
            @if (o?.counts?.unnamedApps) {
              <span class="status warn">⚠ {{ o?.counts?.unnamedApps }} para nomear</span>
            } @else if (o) {
              <span class="status good">todos nomeados</span>
            } @else { — }
          </span>
        </a>
      </div>

      <div class="row wrap charts-head">
        <h2>Histórico</h2>
        <span class="spacer"></span>
        <div class="segmented" role="group" aria-label="Período">
          @for (r of ranges; track r) {
            <button type="button" [attr.aria-pressed]="range() === r" (click)="setRange(r)">{{ r }}</button>
          }
        </div>
      </div>
      <div class="grid grid-2">
        <app-series-card title="CPU" metric="cpu" [range]="range()" />
        <app-series-card title="RAM" metric="ram" [range]="range()" />
        <app-series-card title="GPU e VRAM" metric="gpu" [range]="range()" />
        <app-series-card title="Temperatura" metric="temp" [range]="range()" />
        <app-series-card title="Rede" metric="net" [range]="range()" />
        <app-series-card title="Disco /" metric="disk" [range]="range()" />
      </div>
    </section>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .stat {
      display: grid; gap: 2px; padding: 10px 14px; background: var(--surface-1); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: inherit; text-decoration: none; min-width: 0;
    }
    a.stat:hover { border-color: var(--axis); text-decoration: none; background: var(--surface-2); }
    .k { font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .v { font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .charts-head { margin-top: 4px; }
  `,
})
export class OverviewPage {
  private readonly api = inject(ApiService);

  protected readonly ranges = RANGES;
  protected readonly range = signal<SeriesRange>(restoreRange());
  protected readonly ov = poll(() => this.api.overview(), 15_000);

  protected readonly sitesDown = computed(() => {
    const c = this.ov.data()?.counts;
    return c?.sitesUp != null && c.sitesTotal != null && c.sitesUp < c.sitesTotal;
  });

  protected setRange(r: SeriesRange): void {
    this.range.set(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* ignore */
    }
  }

  protected size = bytes;
  protected temp = celsius;
  protected dur = duration;
  protected net = rate;
  protected num = number;
}

function restoreRange(): SeriesRange {
  try {
    const r = localStorage.getItem(RANGE_KEY) as SeriesRange | null;
    return r && RANGES.includes(r) ? r : '1h';
  } catch {
    return '1h';
  }
}
