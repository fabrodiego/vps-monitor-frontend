import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenResponse } from './models';

// sessionStorage: fechou a aba, precisa logar de novo (painel de servidor, sessao curta).
const STORAGE_KEY = 'vps.session';

interface Session {
  token: string;
  expiresAt: number;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/api/auth`;

  private readonly session = signal<Session | null>(this.restore());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly username = computed(() => this.session()?.username ?? '');

  token(): string | null {
    const s = this.session();
    if (s && s.expiresAt <= Date.now()) {
      this.clear();
      return null;
    }
    return s?.token ?? null;
  }

  login(username: string, password: string, code: string) {
    return this.http
      .post<TokenResponse>(`${this.base}/login`, { username, password, code })
      .pipe(tap((res) => this.store(res, username)));
  }

  logout(): void {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  private store(res: TokenResponse, username: string): void {
    const session: Session = { token: res.accessToken, expiresAt: Date.now() + res.expiresIn * 1000, username };
    this.session.set(session);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Sem storage: a sessao vale so enquanto a pagina estiver aberta.
    }
  }

  private clear(): void {
    this.session.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}
