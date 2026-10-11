import { Routes } from '@angular/router';
import { BREADCRUMB } from '../../core/layout/breadcrumb.component';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    data: { [BREADCRUMB]: 'menu.users' },
    loadComponent: () => import('./users/user-list.page').then((m) => m.UserListPage),
  },
  {
    path: 'currencies',
    data: { [BREADCRUMB]: 'menu.currencies' },
    loadComponent: () => import('./currencies/currency-list.page').then((m) => m.CurrencyListPage),
  },
];
