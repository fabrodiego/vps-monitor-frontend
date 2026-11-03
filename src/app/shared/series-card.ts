import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { ApiService } from '../core/api.service';
import { celsius, percent, rate } from '../core/format';
import { SeriesMetric, SeriesRange, SeriesUnit } from '../core/models';
import { poll } from '../core/poll';
import { ChartLine, LineChart } from './line-chart';

const FORMATS: Record<SeriesUnit, (v: number) => string> = {
  fraction: (v) => percent(v, 0),
  celsius: (v) => celsius(v),
  bytes_per_sec: (v) => rate(v),
};

/** Card com um grafico no tempo; rebusca quando o periodo muda e a cada 30 s. */
@Component({
  selector: 'app-series-card',
  imports: [LineChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="card-title">{{ title() }}</h2>
    @if (series.error(); as e) {
      <p class="muted small">{{ e }}</p>
    }
    <app-line-chart [lines]="lines()" [format]="format()" [yMax]="yMax()" [loading]="series.loading()" [height]="170"
                    [binary]="series.data()?.unit === 'bytes_per_sec'" />
  `,
  styles: `
    :host { display: block; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; min-width: 0; }
    .small { font-size: 0.8rem; margin: 0 0 6px; }
  `,
})
export class SeriesCard {
  private readonly api = inject(ApiService);

  readonly metric = input.required<SeriesMetric>();
  readonly range = input.required<SeriesRange>();
  readonly title = input.required<string>();

  protected readonly series = poll(() => this.api.series(this.metric(), this.range()), 30_000, true);

  protected readonly lines = computed<ChartLine[]>(() => this.series.data()?.lines ?? []);
  protected readonly format = computed(() => FORMATS[this.series.data()?.unit ?? 'fraction']);
  protected readonly yMax = computed(() => (this.series.data()?.unit === 'fraction' ? 1 : null));

  constructor() {
    effect(() => {
      this.metric();
      this.range();
      untracked(() => this.series.refresh());
    });
  }
}
