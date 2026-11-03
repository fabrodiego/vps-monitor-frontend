import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** O favicon (terminal >_ com ponto de status) + nome. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#080E1A" stroke="#3B82F6" stroke-opacity="0.2" stroke-width="8" />
      <rect x="96" y="100" width="320" height="312" rx="28" fill="none" stroke="#3B82F6" stroke-width="16" />
      <path d="M160 180l60 50-60 50" fill="none" stroke="#00F2FE" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="240" y1="280" x2="320" y2="280" stroke="#3B82F6" stroke-width="16" stroke-linecap="round" />
      <circle cx="170" cy="345" r="14" fill="#00F2FE" />
      <circle cx="230" cy="345" r="14" fill="#3B82F6" />
      <circle cx="290" cy="345" r="14" fill="#3B82F6" opacity="0.4" />
      <circle cx="390" cy="122" r="22" fill="#00F2FE" />
      <circle cx="390" cy="122" r="34" fill="none" stroke="#00F2FE" stroke-width="6" opacity="0.5" />
    </svg>
    @if (showName()) {
      <span class="name">vps<span class="cursor">_</span>monitor</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    .name { font-family: var(--mono); font-weight: 600; letter-spacing: 0.02em; color: var(--text-primary); }
    .cursor { color: var(--brand-cyan); text-shadow: 0 0 8px rgb(0 242 254 / 0.6); }
  `,
})
export class Logo {
  readonly size = input(32);
  readonly showName = input(true);
}
