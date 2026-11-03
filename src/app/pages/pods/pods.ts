import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { ago, bytes, cores, percent } from '../../core/format';
import { Pod } from '../../core/models';
import { poll } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { UpdatedAt } from '../../shared/updated-at';

interface Group {
  namespace: string;
  pods: Pod[];
  problems: number;
  memory: number;
}

/** Reinicios acima disso viram aviso (reboots da VPS explicam os menores). */
const RESTARTS_WARN = 100;

@Component({
  selector: 'app-pods',
  imports: [UpdatedAt, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Pods / k3s</h1>
        <app-updated-at [at]="res.updatedAt()" [loading]="res.loading()" (refresh)="res.refresh()" />
      </header>

      @if (res.error(); as e) {
        <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />{{ e }}</div>
      }

      <div class="row wrap">
        <span class="status good">{{ summary().ok }} ok</span>
        @if (summary().problems) {
          <span class="status crit">{{ summary().problems }} com problema</span>
        }
        <span class="muted small">{{ summary().total }} pods em {{ groups().length }} namespaces</span>
        <span class="spacer"></span>
        <label class="row small secondary">
          <input type="checkbox" [checked]="onlyProblems()" (change)="onlyProblems.set(!onlyProblems())" /> só com problema
        </label>
      </div>

      @for (g of groups(); track g.namespace) {
        @if (!onlyProblems() || g.problems) {
          <div class="card">
            <div class="row ns-head">
              <h2 class="mono">{{ g.namespace }}</h2>
              @if (g.problems) { <span class="status crit">{{ g.problems }} com problema</span> }
              <span class="spacer"></span>
              <span class="muted small num">{{ g.pods.length }} pod(s) · {{ size(g.memory) }}</span>
            </div>
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr><th>Pod</th><th>Estado</th><th class="r">Reinícios</th><th class="r">CPU</th><th class="r">RAM</th><th class="r">Limite</th><th class="r">Desde</th></tr>
                </thead>
                <tbody>
                  @for (p of g.pods; track p.name) {
                    @if (!onlyProblems() || problem(p)) {
                      <tr>
                        <td class="mono pod">{{ p.name }}</td>
                        <td><span class="status" [class]="stateClass(p)">{{ stateText(p) }}</span></td>
                        <td class="r" [class.warn-txt]="p.restarts >= restartsWarn">{{ p.restarts }}</td>
                        <td class="r">{{ cpu(p.cpuCores) }}</td>
                        <td class="r">{{ size(p.memoryBytes) }}
                          @if (memShare(p) != null) { <span class="muted">({{ pct(memShare(p)!, 0) }})</span> }
                        </td>
                        <td class="r muted">{{ p.memoryLimitBytes ? size(p.memoryLimitBytes) : 'sem' }}</td>
                        <td class="r muted">{{ since(p.startedAt) }}</td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      } @empty {
        <div class="empty">{{ res.loading() ? 'Carregando…' : 'Nenhum pod' }}</div>
      }
    </section>
  `,
  styles: `
    .small { font-size: 0.85rem; }
    .ns-head { margin-bottom: 8px; gap: 10px; }
    .pod { font-size: 0.8rem; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .warn-txt { color: var(--warning); font-weight: 600; }
    input[type='checkbox'] { accent-color: var(--brand-blue); width: 16px; height: 16px; }
  `,
})
export class PodsPage {
  private readonly api = inject(ApiService);

  protected readonly res = poll(() => this.api.pods(), 15_000);
  protected readonly onlyProblems = signal(false);
  protected readonly restartsWarn = RESTARTS_WARN;

  protected readonly groups = computed<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const p of this.res.data()?.pods ?? []) {
      const g = map.get(p.namespace) ?? { namespace: p.namespace, pods: [], problems: 0, memory: 0 };
      g.pods.push(p);
      if (this.problem(p)) g.problems++;
      g.memory += p.memoryBytes ?? 0;
      map.set(p.namespace, g);
    }
    return [...map.values()].sort((a, b) => b.problems - a.problems || a.namespace.localeCompare(b.namespace));
  });

  protected readonly summary = computed(() => {
    const pods = this.res.data()?.pods ?? [];
    const problems = pods.filter((p) => this.problem(p)).length;
    return { total: pods.length, problems, ok: pods.length - problems };
  });

  protected problem(p: Pod): boolean {
    if (p.phase === 'Succeeded') return false;
    return p.phase !== 'Running' || !p.ready || p.waitingReason != null;
  }

  protected stateText(p: Pod): string {
    if (p.waitingReason) return p.waitingReason;
    if (p.phase === 'Succeeded') return 'concluído';
    if (p.phase === 'Running') return p.ready ? 'rodando' : 'não pronto';
    return p.phase;
  }

  protected stateClass(p: Pod): string {
    if (p.phase === 'Succeeded') return 'status muted';
    return this.problem(p) ? 'status crit' : 'status good';
  }

  protected memShare(p: Pod): number | null {
    return p.memoryLimitBytes && p.memoryBytes != null ? p.memoryBytes / p.memoryLimitBytes : null;
  }

  protected since(epoch: number | null): string {
    return ago(epoch).replace('há ', '');
  }

  protected size = bytes;
  protected cpu = cores;
  protected pct = percent;
}
