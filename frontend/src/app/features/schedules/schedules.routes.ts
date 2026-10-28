import { Routes } from '@angular/router';
import { BREADCRUMB } from '../../core/layout/breadcrumb.component';

export const SCHEDULES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./schedule-list.page').then((m) => m.ScheduleListPage),
  },
  {
    path: 'new',
    data: { [BREADCRUMB]: 'schedules.new' },
    loadComponent: () => import('./schedule-form.page').then((m) => m.ScheduleFormPage),
  },
  {
    path: ':id/edit',
    data: { [BREADCRUMB]: 'schedules.edit' },
    loadComponent: () => import('./schedule-form.page').then((m) => m.ScheduleFormPage),
  },
];
