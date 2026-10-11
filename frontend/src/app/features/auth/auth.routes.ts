import { Routes } from '@angular/router';
import { guestGuard, signOutGuard } from '../../core/auth/auth.guards';

export const AUTH_ROUTES: Routes = [
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    loadComponent: () => import('./sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'sign-up',
    canActivate: [guestGuard],
    loadComponent: () => import('./sign-up.page').then((m) => m.SignUpPage),
  },
  { path: 'sign-out', canActivate: [signOutGuard], children: [] },
];
