import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { RouterLink } from '@angular/router';
import { ago, bytes, ms, number, percent, tokens } from '../../core/format';
import { Alert, Site } from '../../core/models';
import { poll } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { UpdatedAt } from '../../shared/updated-at';

@Component({
  selector: 'app-services',
  imports: [UpdatedAt, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Sites, banco, Claude e alertas</h1>
        <app-updated-at [at]="sites.updatedAt()" [loading]="sites.loading() || db.loading() || alerts.loading()" (refresh)="refreshAll()" />
      </header>

      @if (sites.error() || db.error() || alerts.error(); as e) {
        <div class="error-bar" role="alert"><app-icon name="alert" [size]="18" />{{ e }}</div>
      }

      <a class="card claude-card" routerLink="/servicos/claude" aria-label="Ver detalhes do Claude">
        <div class="row claude-head">
          <app-icon name="terminal" [size]="18" />
          <h2 class="card-title">Claude</h2>
          <span class="spacer"></span>
          @if (claude.data(); as c) {
            <span class="status" [class.good]="c.remoteControlUp && c.exporterUp" [class.crit]="!c.remoteControlUp || !c.exporterUp">
              {{ !c.exporterUp ? 'sem dados' : c.remoteControlUp ? 'celular no ar' : 'celular parado' }}</span>
          }
        </div>
        @if (claude.data(); as c) {
          <div class="row wrap claude-stats secondary small num">
            <span><b>{{ c.sessionsOpen }}</b> sessões</span>
            <span>RAM <b>{{ size(c.memoryBytes) }}</b></span>
            <span>tokens 24h <b>{{ tok(c.tokens24h.fresh) }}</b></span>
            <span class="spacer"></span>
            <span class="muted">detalhes →</span>
          </div>
        } @else {
          <div class="muted small">{{ claude.error() ?? 'Carregando…' }}</div>
        }
      </a>

      <div class="card">
        <h2 class="card-title">Alertas</h2>
        @for (a of alerts.data() ?? []; track a.name + (a.target ?? '') + (a.namespace ?? '')) {
          <div class="alert-row">
            <span class="status" [class]="alertClass(a)">{{ a.state === 'firing' ? sevText(a.severity) : 'pendente' }}</span>
            <div class="alert-body">
              <b class="mono">{{ a.name }}</b>
              <div class="secondary small">{{ a.summary ?? a.description ?? '' }}</div>
              <div class="muted xs">
                {{ a.namespace ? 'ns ' + a.namespace + ' · ' : '' }}{{ a.target ? a.target + ' · ' : '' }}desde {{ since(a.activeAt) }}
              </div>
            </div>
          </div>
        } @empty {
          <div class="row ok-line"><span class="status good">nenhum alerta ativo</span>
            <span class="muted small">os alertas aparecem só aqui (envio para o Discord desligado)</span></div>
        }
      </div>

      <div class="card">
        <h2 class="card-title">Sites (testados por fora, a cada 60 s)</h2>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Site</th><th>Estado</th><th class="r">HTTP</th><th class="r">Tempo</th><th class="r">No ar 24h</th><th class="r">Certificado</th></tr>
            </thead>
            <tbody>
              @for (s of sites.data() ?? []; track s.url) {
                <tr>
                  <td class="mono url"><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ host(s.url) }}</a><span class="muted">{{ path(s.url) }}</span></td>
                  <td><span class="status" [class.good]="s.up" [class.crit]="!s.up">{{ s.up ? 'no ar' : 'fora' }}</span></td>
                  <td class="r">{{ s.httpStatus ?? '—' }}@if (s.module === 'sites-protegidos') { <span class="muted lock" title="Exige login: 401/403 contam como no ar"><app-icon name="lock" [size]="13" /></span> }</td>
                  <td class="r" [class.warn-txt]="(s.durationSeconds ?? 0) > 2">{{ time(s.durationSeconds) }}</td>
                  <td class="r" [class.warn-txt]="(s.uptime24h ?? 1) < 0.99">{{ pct(s.uptime24h, 2) }}</td>
                  <td class="r" [class.warn-txt]="(s.certExpiresInDays ?? 99) < 14">{{ certText(s) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty">{{ sites.loading() ? 'Carregando…' : 'Nenhum site' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="row db-head">
          <h2 class="card-title">PostgreSQL do host</h2>
          <span class="spacer"></span>
          @if (db.data(); as d) {
            <span class="status" [class.good]="d.up" [class.crit]="!d.up">{{ d.up ? 'no ar' : 'fora' }}</span>
            <span class="muted small num">{{ totalConn() }} / {{ d.maxConnections ?? '—' }} conexões</span>
          }
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Banco</th><th class="r">Tamanho</th><th class="r">Conexões</th></tr></thead>
            <tbody>
              @for (b of db.data()?.databases ?? []; track b.name) {
                <tr><td class="mono">{{ b.name }}</td><td class="r">{{ size(b.sizeBytes) }}</td><td class="r">{{ b.connections }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
  styles: `
    .small { font-size: 0.85rem; }
    .xs { font-size: 0.75rem; }
    .alert-row { display: flex; gap: 14px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--grid); }
    .alert-row:last-child { border-bottom: 0; }
    .alert-row .status { min-width: 72px; padding-top: 2px; }
    .alert-body { min-width: 0; }
    .ok-line { flex-wrap: wrap; gap: 12px; }
    .url { font-size: 0.82rem; white-space: nowrap; }
    .url a { color: var(--text-primary); }
    .warn-txt { color: var(--warning); font-weight: 600; }
    .lock { display: inline-flex; vertical-align: -2px; margin-left: 4px; }
    .db-head { margin-bottom: 4px; gap: 10px; }
    .claude-card { display: block; color: inherit; text-decoration: none; transition: border-color 0.2s, box-shadow 0.2s; }
    .claude-card:hover, .claude-card:focus-visible { border-color: var(--brand-blue); box-shadow: var(--glow); }
    .claude-head { gap: 10px; margin-bottom: 8px; color: var(--brand-cyan); }
    .claude-head .card-title { margin: 0; color: var(--text-primary); }
    .claude-stats { gap: 16px; }
    .claude-stats b { color: var(--text-primary); }
    .db-head .card-title { margin: 0; }
  `,
})
export class ServicesPage {
  private readonly api = inject(ApiService);

  protected readonly sites = poll(() => this.api.sites(), 30_000);
  protected readonly db = poll(() => this.api.database(), 30_000);
  protected readonly alerts = poll(() => this.api.alerts(), 15_000);
  protected readonly claude = poll(() => this.api.claude(), 30_000);

  protected readonly totalConn = computed(() => (this.db.data()?.databases ?? []).reduce((s, b) => s + b.connections, 0));

  protected refreshAll(): void {
    this.sites.refresh();
    this.db.refresh();
    this.alerts.refresh();
    this.claude.refresh();
  }

  protected alertClass(a: Alert): string {
    if (a.state !== 'firing') return 'status muted';
    return a.severity === 'critical' ? 'status crit' : 'status warn';
  }

  protected sevText(s: string): string {
    return s === 'critical' ? 'crítico' : s === 'warning' ? 'atenção' : s;
  }

  protected certText(s: Site): string {
    const d = s.certExpiresInDays;
    return d == null ? '—' : `${number(Math.floor(d))} dias`;
  }

  protected host(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  protected path(url: string): string {
    try {
      const p = new URL(url).pathname;
      return p === '/' ? '' : p;
    } catch {
      return '';
    }
  }

  protected since(iso: string | null): string {
    return ago(iso).replace('há ', '');
  }

  protected size = bytes;
  protected time = ms;
  protected pct = percent;
  protected tok = tokens;
}
