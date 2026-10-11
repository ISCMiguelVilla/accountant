import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { APP_MENU } from './menu';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-col gap-1 p-3" [attr.aria-label]="'menu.title' | translate">
      @for (section of sections(); track $index) {
        @if (section.title) {
          <span class="mt-4 px-3 pb-1 text-xs font-semibold uppercase text-muted-color">
            {{ section.title | translate }}
          </span>
        }
        @for (item of section.items; track item.route) {
          <a
            [routerLink]="item.route"
            routerLinkActive="bg-emphasis font-semibold"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-color no-underline transition-colors hover:bg-emphasis"
            (click)="navigate.emit()"
          >
            <i [class]="item.icon"></i>
            <span>{{ item.label | translate }}</span>
          </a>
        }
      }
    </nav>
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  /** Emitted after a navigation so the mobile drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly sections = computed(() =>
    APP_MENU.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || this.auth.isAdmin()),
    })).filter((section) => section.items.length > 0),
  );
}
