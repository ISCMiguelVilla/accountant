import { Routes } from '@angular/router';
import { BREADCRUMB } from '../../core/layout/breadcrumb.component';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./account-list.page').then((m) => m.AccountListPage),
  },
  {
    path: 'new',
    data: { [BREADCRUMB]: 'accounts.new' },
    loadComponent: () => import('./account-form.page').then((m) => m.AccountFormPage),
  },
  {
    path: ':id',
    data: { [BREADCRUMB]: 'accounts.detail' },
    children: [
      {
        path: '',
        loadComponent: () => import('./account-detail.page').then((m) => m.AccountDetailPage),
      },
      {
        path: 'edit',
        data: { [BREADCRUMB]: 'common.edit' },
        loadComponent: () => import('./account-form.page').then((m) => m.AccountFormPage),
      },
    ],
  },
];
