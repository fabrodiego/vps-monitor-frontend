import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { bytes, cores, percent } from '../../core/format';
import { App, AppKind } from '../../core/models';
import { poll } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { UpdatedAt } from '../../shared/updated-at';

type Filter = 'TODOS' | AppKind;
type Sort = 'mem' | 'cpu';

const KIND_LABEL: Record<AppKind, string> = {
  POD: 'k3s',
  SERVICO: 'serviço',
  SISTEMA: 'sistema',
  SEM_NOME: 'sem nome',
};

@Component({
  selector: 'app-apps',
  imports: [UpdatedAt, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Apps e processos</h1>
        <app-updated-at [at]="res.updatedAt()" [loading]="res.loading()" (refresh)="res.refresh()" />
      </header>

      @if (res.error(); as e) {
        <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />{{ e }}</div>
      }

      @if (unnamed().length) {
        <div class="card warn-card">
          <h2 class="card-title">⚠ Processos sem nome ({{ unnamed().length }})</h2>
          <p class="secondary small">
            Rodam soltos numa sessão de usuário (fora de um serviço systemd ou do k3s), então não dá para saber de qual
            projeto são. Para dar nome, rode como serviço systemd ou dentro do k3s.
          </p>
          <ul class="plain">
            @for (a of unnamed(); track a.name + a.detail) {
              <li><b class="mono">{{ a.name }}</b> <span class="muted">— {{ a.detail }} · {{ size(a.memoryBytes) }} · CPU {{ cpu(a.cpuCores) }}</span></li>
            }
          </ul>
        </div>
      }

      <div class="row wrap">
        <div class="segmented" role="group" aria-label="Filtrar por tipo">
          @for (f of filters; track f.value) {
            <button type="button" [attr.aria-pressed]="filter() === f.value" (click)="filter.set(f.value)">
              {{ f.label }} <span class="muted">{{ count(f.value) }}</span>
            </button>
          }
        </div>
        <span class="spacer"></span>
        <div class="segmented" role="group" aria-label="Ordenar por">
          <button type="button" [attr.aria-pressed]="sort() === 'mem'" (click)="sort.set('mem')">RAM</button>
          <button type="button" [attr.aria-pressed]="sort() === 'cpu'" (click)="sort.set('cpu')">CPU</button>
        </div>
      </div>

      <div class="card">
        <div class="legend secondary">
          Barra = parte da {{ sort() === 'mem' ? 'RAM total (' + size(res.data()?.memoryTotalBytes) + ')' : 'CPU total (' + (res.data()?.cpuCores ?? '—') + ' núcleos)' }}
        </div>
        @for (a of rows(); track a.kind + a.name + a.detail) {
          <div class="app-row" [class.warn]="a.warning">
            <div class="who">
              <div class="name">
                <span class="mono">{{ a.name }}</span>
                <span class="badge" [class.warn]="a.kind === 'SEM_NOME'">{{ kindLabel(a.kind) }}</span>
              </div>
              <div class="detail muted">{{ a.detail }}@if (a.commands.length > 1 || (a.commands.length === 1 && a.commands[0] !== a.name)) { · {{ a.commands.join(', ') }} }</div>
            </div>
            <div class="bar-cell">
              <div class="bar" [style.width.%]="share(a) * 100"></div>
            </div>
            <div class="vals num">
              <span [class.strong]="sort() === 'mem'">{{ size(a.memoryBytes) }}</span>
              <span [class.strong]="sort() === 'cpu'">{{ cpu(a.cpuCores) }} CPU</span>
            </div>
          </div>
        } @empty {
          <div class="empty">{{ res.loading() ? 'Carregando…' : 'Nada aqui' }}</div>
        }
        @if (hiddenSmall() > 0 || showSmall()) {
          <button type="button" class="btn btn-ghost btn-sm more" (click)="showSmall.set(!showSmall())">
            {{ showSmall() ? 'esconder os pequenos' : 'mostrar mais ' + hiddenSmall() + ' pequenos (< 5 MiB e quase sem CPU)' }}
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .small { font-size: 0.85rem; margin: 0 0 8px; }
    .warn-card { border-color: rgb(250 178 25 / 0.45); background: linear-gradient(0deg, var(--warning-bg), var(--surface-1)); }
    .plain { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 0.875rem; }
    .legend { font-size: 0.78rem; margin-bottom: 8px; }
    .more { margin-top: 8px; color: var(--text-secondary); }
    .app-row {
      display: grid; grid-template-columns: minmax(160px, 1.1fr) minmax(80px, 1fr) 130px; gap: 14px; align-items: center;
      padding: 9px 0; border-bottom: 1px solid var(--grid);
    }
    .app-row:last-child { border-bottom: 0; }
    .who { min-width: 0; }
    .name { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .name .mono { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
    .detail { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-cell { height: 14px; display: flex; align-items: center; }
    .bar { height: 12px; min-width: 2px; background: var(--series-2); border-radius: 0 4px 4px 0; }
    .app-row.warn .bar { background: var(--warning); }
    .vals { display: grid; justify-items: end; font-size: 0.8rem; color: var(--text-muted); }
    .vals .strong { color: var(--text-primary); font-weight: 600; font-size: 0.875rem; }
    @media (max-width: 640px) {
      .app-row { grid-template-columns: 1fr 96px; }
      .bar-cell { grid-column: 1 / -1; grid-row: 2; }
    }
  `,
})
export class AppsPage {
  private readonly api = inject(ApiService);

  protected readonly res = poll(() => this.api.apps(), 15_000);
  protected readonly filter = signal<Filter>('TODOS');
  protected readonly sort = signal<Sort>('mem');
  protected readonly showSmall = signal(false);

  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'POD', label: 'k3s' },
    { value: 'SERVICO', label: 'Serviços' },
    { value: 'SEM_NOME', label: 'Sem nome' },
    { value: 'SISTEMA', label: 'Sistema' },
  ];

  private readonly all = computed(() => this.res.data()?.apps ?? []);
  protected readonly unnamed = computed(() => this.all().filter((a) => a.warning));

  private readonly filtered = computed(() => {
    const f = this.filter();
    const key = this.sort() === 'mem' ? 'memoryBytes' : 'cpuCores';
    return this.all()
      .filter((a) => f === 'TODOS' || a.kind === f)
      .slice()
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  });
  protected readonly rows = computed(() => (this.showSmall() ? this.filtered() : this.filtered().filter((a) => !isSmall(a))));
  protected readonly hiddenSmall = computed(() => (this.showSmall() ? 0 : this.filtered().length - this.rows().length));

  protected count(f: Filter): number {
    return f === 'TODOS' ? this.all().length : this.all().filter((a) => a.kind === f).length;
  }

  protected share(a: App): number {
    const d = this.res.data();
    if (!d) return 0;
    const v = this.sort() === 'mem' ? (a.memoryBytes ?? 0) / (d.memoryTotalBytes || 1) : (a.cpuCores ?? 0) / (d.cpuCores || 1);
    return Math.min(1, v);
  }

  protected kindLabel(k: AppKind): string {
    return KIND_LABEL[k];
  }

  protected size = bytes;
  protected cpu = cores;
  protected pct = percent;
}

/** Processo minusculo: fica escondido por padrao para a lista nao virar ruido. */
function isSmall(a: App): boolean {
  return !a.warning && (a.memoryBytes ?? 0) < 5 * 1024 * 1024 && (a.cpuCores ?? 0) < 0.005;
}
