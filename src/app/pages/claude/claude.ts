import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ago, bytes, cores, level, percent, tokens } from '../../core/format';
import { ClaudeSession } from '../../core/models';
import { poll } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { MeterTile } from '../../shared/meter-tile';
import { UpdatedAt } from '../../shared/updated-at';

@Component({
  selector: 'app-claude',
  imports: [UpdatedAt, Icon, MeterTile, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <a routerLink="/servicos" class="back muted small">← Serviços</a>
          <h1>Claude</h1>
        </div>
        <app-updated-at [at]="claude.updatedAt()" [loading]="claude.loading()" (refresh)="claude.refresh()" />
      </header>

      @if (claude.error(); as e) {
        <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />{{ e }}</div>
      }

      @if (claude.data(); as d) {
        @if (!d.exporterUp) {
          <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />
            Exportador do Claude fora: os dados abaixo podem estar vazios ou velhos.</div>
        }

        <div class="grid grid-4">
          <app-meter-tile label="Remote Control" [value]="d.remoteControlUp ? 'no ar' : 'parado'"
                          [sub]="d.remoteControlUp ? 'celular conectado à VPS' : 'o watchdog tenta religar a cada 5 min'" />
          <app-meter-tile label="Sessões abertas" [value]="'' + d.sessionsOpen" [sub]="busyText()" />
          <app-meter-tile label="RAM do Claude" [value]="size(d.memoryBytes)" [fraction]="d.memoryHostShare"
                          [sub]="pct(d.memoryHostShare) + ' da VPS · CPU ' + cpu(d.cpuCores)" />
          <app-meter-tile label="Tokens 24h" [value]="tok(d.tokens24h.fresh)"
                          [sub]="'cache lido ' + tok(d.tokens24h.cacheRead) + ' · saída ' + tok(d.tokens24h.output)" />
        </div>

        <div class="card">
          <h2 class="card-title">Sessões</h2>
          <div class="table-wrap wide">
            <table class="data">
              <thead>
                <tr>
                  <th>Sessão</th><th>Estado</th><th>Contexto</th>
                  <th class="r">Tokens novos</th><th class="r">Subagentes</th><th class="r">RAM</th><th class="r">CPU</th><th class="r">Aberta</th>
                </tr>
              </thead>
              <tbody>
                @for (s of d.sessions; track s.id) {
                  <tr>
                    <td class="name">
                      <b>{{ s.name || '⚠ sem nome' }}</b>
                      <div class="muted xs mono">{{ originText(s.origin) }} · {{ s.model || '—' }}</div>
                    </td>
                    <td><span class="status" [class.good]="s.status === 'busy'" [class.muted]="s.status !== 'busy'">
                      {{ s.status === 'busy' ? 'trabalhando' : 'parada' }}</span></td>
                    <td class="ctx">
                      <div class="meter" [class]="ctxLevel(s)" role="meter" aria-valuemin="0" aria-valuemax="100"
                           [attr.aria-valuenow]="((s.contextUsage ?? 0) * 100).toFixed(0)" aria-label="Uso do contexto">
                        <span [style.width.%]="(s.contextUsage ?? 0) * 100"></span>
                      </div>
                      <div class="xs secondary num">{{ tok(s.contextTokens) }} / {{ tok(s.contextLimit) }} est. ({{ pct(s.contextUsage, 0) }})</div>
                    </td>
                    <td class="r num" [title]="tokenTitle(s)">{{ tok(s.tokens.fresh) }}<div class="muted xs">+ {{ tok(s.tokens.cacheRead) }} cache</div></td>
                    <td class="r num">{{ tok(s.subagentTokens) }}</td>
                    <td class="r num">{{ size(s.memoryBytes) }}</td>
                    <td class="r num">{{ cpu(s.cpuCores) }}</td>
                    <td class="r muted small">{{ since(s.startedAt) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="empty">Nenhuma sessão aberta</td></tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="cards">
            @for (s of d.sessions; track s.id) {
              <li>
                <div class="row">
                  <b class="grow">{{ s.name || '⚠ sem nome' }}</b>
                  <span class="status" [class.good]="s.status === 'busy'" [class.muted]="s.status !== 'busy'">
                    {{ s.status === 'busy' ? 'trabalhando' : 'parada' }}</span>
                </div>
                <div class="muted xs mono">{{ originText(s.origin) }} · {{ s.model || '—' }} · aberta {{ since(s.startedAt) }}</div>
                <div class="meter" [class]="ctxLevel(s)" role="meter" aria-valuemin="0" aria-valuemax="100"
                     [attr.aria-valuenow]="((s.contextUsage ?? 0) * 100).toFixed(0)" aria-label="Uso do contexto">
                  <span [style.width.%]="(s.contextUsage ?? 0) * 100"></span>
                </div>
                <div class="xs secondary num">contexto {{ tok(s.contextTokens) }} / {{ tok(s.contextLimit) }} est. ({{ pct(s.contextUsage, 0) }})</div>
                <div class="row wrap stats small secondary num">
                  <span [title]="tokenTitle(s)">tokens novos <b>{{ tok(s.tokens.fresh) }}</b> <span class="muted xs extra">+ {{ tok(s.tokens.cacheRead) }} cache</span></span>
                  <span>subagentes <b>{{ tok(s.subagentTokens) }}</b></span>
                  <span>RAM <b>{{ size(s.memoryBytes) }}</b></span>
                  <span>CPU <b>{{ cpu(s.cpuCores) }}</b></span>
                </div>
              </li>
            } @empty {
              <li class="muted">Nenhuma sessão aberta</li>
            }
          </ul>
          <p class="muted xs note">
            Tokens novos = entrada + saída + cache gravado, incluindo os subagentes. Cache lido é o contexto relido a cada resposta e custa bem menos. O limite do contexto é uma estimativa feita pelo modelo.
          </p>
        </div>
      } @else if (claude.loading()) {
        <div class="card muted">Carregando…</div>
      }
    </section>
  `,
  styles: `
    .small { font-size: 0.85rem; }
    .xs { font-size: 0.75rem; }
    .back { display: inline-block; margin-bottom: 4px; }
    .name b { display: block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ctx { min-width: 150px; }
    .meter { height: 6px; border-radius: 999px; background: rgb(59 130 246 / 0.18); overflow: hidden; margin-bottom: 4px; }
    .meter span { display: block; height: 100%; border-radius: 999px; background: var(--brand-blue); transition: width 0.4s; }
    .meter.warn { background: rgb(250 178 25 / 0.18); }
    .meter.warn span { background: var(--warning); }
    .meter.crit { background: rgb(208 59 59 / 0.2); }
    .meter.crit span { background: var(--critical); }
    .note { margin: 12px 0 0; }
    .cards { display: none; list-style: none; margin: 0; padding: 0; }
    .cards li { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px 0; border-bottom: 1px solid var(--grid); }
    .cards li:last-child { border-bottom: 0; }
    .cards .meter { margin: 4px 0 0; }
    .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stats { gap: 14px; }
    .stats b { color: var(--text-primary); }
    .extra { margin-left: 6px; }
    @media (max-width: 720px) {
      .wide { display: none; }
      .cards { display: block; }
    }
  `,
})
export class ClaudePage {
  private readonly api = inject(ApiService);

  protected readonly claude = poll(() => this.api.claude(), 15_000);

  protected readonly busyText = computed(() => {
    const s = this.claude.data()?.sessions ?? [];
    const busy = s.filter((x) => x.status === 'busy').length;
    return `${busy} trabalhando · ${s.length - busy} parada${s.length - busy === 1 ? '' : 's'}`;
  });

  protected ctxLevel(s: ClaudeSession): string {
    return level(s.contextUsage, 0.6, 0.85);
  }

  protected originText(o: string): string {
    return o === 'celular' ? 'celular' : o === 'claude-desktop' ? 'app desktop' : o || '—';
  }

  protected tokenTitle(s: ClaudeSession): string {
    const t = s.tokens;
    return `entrada ${tokens(t.input)} · saída ${tokens(t.output)} · cache lido ${tokens(t.cacheRead)} · cache gravado ${tokens(t.cacheWrite)}`;
  }

  protected since(epoch: number | null): string {
    return ago(epoch).replace('há ', '');
  }

  protected size = bytes;
  protected cpu = cores;
  protected pct = percent;
  protected tok = tokens;
}
