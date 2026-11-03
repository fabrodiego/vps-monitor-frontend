import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/login').then((m) => m.Login), title: 'Entrar · VPS Monitor' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/overview/overview').then((m) => m.OverviewPage), title: 'Visão geral · VPS Monitor' },
      { path: 'apps', loadComponent: () => import('./pages/apps/apps').then((m) => m.AppsPage), title: 'Apps · VPS Monitor' },
      { path: 'pods', loadComponent: () => import('./pages/pods/pods').then((m) => m.PodsPage), title: 'Pods · VPS Monitor' },
      { path: 'servicos', loadComponent: () => import('./pages/services/services').then((m) => m.ServicesPage), title: 'Serviços · VPS Monitor' },
    ],
  },
  { path: '**', redirectTo: '' },
];
