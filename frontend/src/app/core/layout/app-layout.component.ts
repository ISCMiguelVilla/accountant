import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { BreadcrumbComponent } from './breadcrumb.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, DrawerModule, TopbarComponent, SidebarComponent, BreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-surface-50 dark:bg-surface-950">
      <app-topbar (toggleMenu)="mobileMenu.set(true)" />
      <div class="flex flex-1">
        <aside
          class="hidden w-64 shrink-0 border-r border-surface bg-surface-0 lg:block dark:bg-surface-900"
        >
          <app-sidebar />
        </aside>
        <main class="min-w-0 flex-1 p-4 lg:p-6">
          <app-breadcrumb />
          <div class="mt-4">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>

    <p-drawer [visible]="mobileMenu()" (visibleChange)="mobileMenu.set($event)" position="left">
      <app-sidebar (navigate)="mobileMenu.set(false)" />
    </p-drawer>
  `,
})
export class AppLayoutComponent {
  protected readonly mobileMenu = signal(false);
}
