import { Routes } from '@angular/router';
import { BREADCRUMB } from '../../core/layout/breadcrumb.component';

export const TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./transaction-list.page').then((m) => m.TransactionListPage),
  },
  {
    path: 'batch',
    data: { [BREADCRUMB]: 'transactions.batch.title' },
    loadComponent: () => import('./editor/batch-editor.page').then((m) => m.BatchEditorPage),
  },
];
