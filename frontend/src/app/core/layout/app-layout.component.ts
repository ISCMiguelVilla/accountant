import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { readStorage, writeStorage } from '../storage/local-storage';
import { BreadcrumbComponent } from './breadcrumb.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

const SIDEBAR_STORAGE_KEY = 'accountant:sidebar';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, DrawerModule, TopbarComponent, SidebarComponent, BreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-surface-50 dark:bg-surface-950">
      <app-topbar (toggleMenu)="toggleMenu()" />
      <div class="flex flex-1">
        @if (sidebarVisible()) {
          <aside
            class="hidden w-64 shrink-0 border-r border-surface bg-surface-0 lg:block dark:bg-surface-900"
          >
            <app-sidebar />
          </aside>
        }
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
  private readonly document = inject(DOCUMENT);

  protected readonly mobileMenu = signal(false);
  /** Fixed sidebar of wide screens; the choice is remembered in this browser. */
  protected readonly sidebarVisible = signal(readStorage(SIDEBAR_STORAGE_KEY) !== 'hidden');

  /** Wide screens show / hide the fixed sidebar; smaller ones open the menu drawer. */
  protected toggleMenu(): void {
    const wide = this.document.defaultView?.matchMedia('(min-width: 1024px)').matches ?? true;
    if (!wide) {
      this.mobileMenu.set(true);
      return;
    }
    const visible = !this.sidebarVisible();
    this.sidebarVisible.set(visible);
    writeStorage(SIDEBAR_STORAGE_KEY, visible ? 'visible' : 'hidden');
  }
}
