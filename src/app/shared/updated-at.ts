import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Icon } from './icon';

/** "atualizado 12:03:15" + botao de atualizar. */
@Component({
  selector: 'app-updated-at',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mono muted">{{ at() ? 'atualizado ' + (at() | date: 'HH:mm:ss') : 'carregando…' }}</span>
    <button type="button" class="btn btn-ghost btn-icon btn-sm" [class.spin]="loading()" (click)="refresh.emit()"
            aria-label="Atualizar agora" title="Atualizar agora">
      <app-icon name="refresh" [size]="18" />
    </button>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; }
    .btn-sm { width: 32px; }
    .spin app-icon { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin app-icon { animation: none; } }
  `,
})
export class UpdatedAt {
  readonly at = input<number | null>(null);
  readonly loading = input(false);
  readonly refresh = output<void>();
}
