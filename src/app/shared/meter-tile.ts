import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Level, level, percent } from '../core/format';

/**
 * Bloco de numero + medidor. A cor do preenchimento carrega a severidade
 * (azul -> amarelo -> vermelho) e vem sempre com texto ("atencao", "critico").
 */
@Component({
  selector: 'app-meter-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="label">{{ label() }}</span>
      @if (lvl() !== 'ok') {
        <span class="status" [class.warn]="lvl() === 'warn'" [class.crit]="lvl() === 'crit'">
          {{ lvl() === 'crit' ? 'crítico' : 'atenção' }}
        </span>
      }
    </div>
    <div class="value">{{ value() ?? pct() }}</div>
    @if (fraction() != null) {
      <div class="meter" [class]="lvl()" role="meter" aria-valuemin="0" aria-valuemax="100"
           [attr.aria-valuenow]="ariaNow()" [attr.aria-label]="label()">
        <span [style.width.%]="width()"></span>
      </div>
    }
    <div class="sub secondary">{{ sub() }}</div>
  `,
  styles: `
    :host { display: grid; gap: 6px; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; min-width: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
    .label { font-family: var(--mono); font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
    .value { font-size: 1.9rem; font-weight: 600; line-height: 1.1; letter-spacing: -0.01em; }
    .sub { font-size: 0.82rem; min-height: 1.2em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meter { height: 6px; border-radius: 999px; background: rgb(59 130 246 / 0.18); overflow: hidden; }
    .meter span { display: block; height: 100%; border-radius: 999px; background: var(--brand-blue); box-shadow: 0 0 10px rgb(59 130 246 / 0.6); transition: width 0.4s; }
    .meter.warn { background: rgb(250 178 25 / 0.18); }
    .meter.warn span { background: var(--warning); box-shadow: none; }
    .meter.crit { background: rgb(208 59 59 / 0.2); }
    .meter.crit span { background: var(--critical); box-shadow: none; }
  `,
})
export class MeterTile {
  readonly label = input.required<string>();
  /** Fracao 0..1 do medidor. null = sem medidor. */
  readonly fraction = input<number | null>(null);
  /** Texto principal. Sem ele, mostra a fracao em %. */
  readonly value = input<string | null>(null);
  readonly sub = input('');
  readonly warnAt = input(0.75);
  readonly critAt = input(0.9);

  protected readonly lvl = computed<Level>(() => level(this.fraction(), this.warnAt(), this.critAt()));
  protected readonly pct = computed(() => percent(this.fraction()));
  protected readonly width = computed(() => Math.min(100, Math.max(0, (this.fraction() ?? 0) * 100)));
  protected readonly ariaNow = computed(() => Math.round(this.width()));
}
