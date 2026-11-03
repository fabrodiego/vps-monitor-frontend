import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export interface Polled<T> {
  readonly data: Signal<T | null>;
  readonly error: Signal<string | null>;
  readonly loading: Signal<boolean>;
  readonly updatedAt: Signal<number | null>;
  refresh(): void;
}

/**
 * Busca agora e repete a cada intervalo. Para quando a aba fica escondida
 * (nao gasta Prometheus a toa) e busca de novo ao voltar.
 * Chamar dentro de um contexto de injecao (construtor/campo de componente).
 * lazy: so comeca no primeiro refresh() (ex.: quando depende de inputs do componente).
 */
export function poll<T>(source: () => Observable<T>, intervalMs = 15_000, lazy = false): Polled<T> {
  const data = signal<T | null>(null);
  const error = signal<string | null>(null);
  const loading = signal(false);
  const updatedAt = signal<number | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;
  let current: Subscription | undefined;

  const run = () => {
    current?.unsubscribe();
    loading.set(true);
    current = source().subscribe({
      next: (value) => {
        data.set(value);
        error.set(null);
        updatedAt.set(Date.now());
        loading.set(false);
      },
      error: (err: unknown) => {
        error.set(message(err));
        loading.set(false);
      },
    });
  };
  const start = () => {
    stop();
    run();
    timer = setInterval(run, intervalMs);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };
  let started = !lazy;
  const onVisibility = () => {
    if (!started) return;
    if (document.hidden) stop();
    else start();
  };

  document.addEventListener('visibilitychange', onVisibility);
  inject(DestroyRef).onDestroy(() => {
    stop();
    current?.unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
  });
  if (started) start();

  return {
    data, error, loading, updatedAt,
    refresh: () => {
      started = true;
      start();
    },
  };
}

export function message(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Sem conexão com a API';
    if (err.status === 502) return 'Prometheus indisponível';
    const detail = (err.error as { detail?: string } | null)?.detail;
    return detail ?? `Erro ${err.status}`;
  }
  return 'Erro inesperado';
}
