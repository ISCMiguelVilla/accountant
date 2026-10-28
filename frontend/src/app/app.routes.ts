import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/auth.guards';
import { AppLayoutComponent } from './core/layout/app-layout.component';
import { BREADCRUMB } from './core/layout/breadcrumb.component';
import { AUTH_ROUTES } from './features/auth/auth.routes';

export const routes: Routes = [
  // sign-in / sign-up / sign-out (each page is lazy loaded).
  ...AUTH_ROUTES,
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        data: { [BREADCRUMB]: 'menu.home' },
        loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: 'accounts',
        data: { [BREADCRUMB]: 'menu.accounts' },
        loadChildren: () =>
          import('./features/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES),
      },
      {
        path: 'transactions',
        data: { [BREADCRUMB]: 'menu.transactions' },
        loadChildren: () =>
          import('./features/transactions/transactions.routes').then((m) => m.TRANSACTIONS_ROUTES),
      },
      {
        path: 'schedules',
        data: { [BREADCRUMB]: 'menu.schedules' },
        loadChildren: () =>
          import('./features/schedules/schedules.routes').then((m) => m.SCHEDULES_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        data: { [BREADCRUMB]: 'menu.admin' },
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
