import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_MENU } from './menu';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-col gap-1 p-3" [attr.aria-label]="'menu.title' | translate">
      @for (item of menu; track item.route) {
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
    </nav>
  `,
})
export class SidebarComponent {
  /** Emitted after a navigation so the mobile drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly menu = APP_MENU;
}
