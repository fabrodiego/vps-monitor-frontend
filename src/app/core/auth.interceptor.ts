import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const HOP_KEY = 'vps.access-hop';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(environment.apiUrl);
  if (!isApi) return next(req);

  const isLogin = req.url.includes('/api/auth/login');
  const token = isLogin ? null : auth.token();
  // withCredentials: leva o cookie do Cloudflare Access do dominio da API
  const request = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });
  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        auth.logout();
      }
      if (err instanceof HttpErrorResponse && err.status === 0) {
        hopThroughAccess();
      }
      return throwError(() => err);
    }),
  );
};

/**
 * Status 0 = o navegador bloqueou a resposta. Em producao, quase sempre e o Cloudflare Access
 * pedindo login no dominio da API (o cookie vale por dominio). Navega uma vez pela API, que
 * devolve para o site ja com o cookie. No maximo uma vez por minuto, para nao entrar em laco.
 */
function hopThroughAccess(): void {
  if (!environment.production) return;
  try {
    const last = Number(sessionStorage.getItem(HOP_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(HOP_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.href = `${environment.apiUrl}/api/access/voltar`;
}
