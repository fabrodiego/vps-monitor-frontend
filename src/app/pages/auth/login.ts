import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { message } from '../../core/poll';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Logo, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-logo [size]="44" />
        <p class="secondary hint mono">acesso restrito · somente leitura</p>

        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }

        <div class="field">
          <label for="username">Usuário</label>
          <input id="username" class="input" formControlName="username" autocomplete="username" autocapitalize="off" spellcheck="false" />
        </div>
        <div class="field">
          <label for="password">Senha</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label for="code">Código do autenticador</label>
          <input id="code" class="input mono code" formControlName="code" inputmode="numeric" autocomplete="one-time-code"
                 maxlength="6" placeholder="000000" />
        </div>

        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          <app-icon name="lock" [size]="18" />{{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
  styles: `
    main { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; }
    form { width: min(380px, 100%); display: grid; gap: 16px; padding: 28px; box-shadow: var(--glow); }
    .hint { margin: -8px 0 0; font-size: 0.8rem; }
    .code { letter-spacing: 0.4em; text-align: center; font-size: 1.2rem; }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Preencha usuário, senha e o código de 6 dígitos.');
      return;
    }
    const { username, password, code } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(username.trim(), password, code).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err: unknown) => {
        this.busy.set(false);
        this.form.controls.code.reset();
        this.error.set(message(err));
      },
    });
  }
}
