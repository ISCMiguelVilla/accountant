import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'app-topbar',
  imports: [
    RouterLink,
    TranslatePipe,
    ButtonModule,
    MenuModule,
    TooltipModule,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="flex h-16 items-center gap-3 border-b border-surface bg-surface-0 px-4 dark:bg-surface-900"
    >
      <a routerLink="/home" class="flex items-center gap-2 text-color no-underline">
        <i class="pi pi-wallet text-xl"></i>
        <span class="text-lg font-semibold">{{ 'app.name' | translate }}</span>
      </a>
      <p-button
        size="small"
        icon="pi pi-bars"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [ariaLabel]="'layout.toggleMenu' | translate"
        [pTooltip]="'layout.toggleMenu' | translate"
        tooltipPosition="bottom"
        (onClick)="toggleMenu.emit()"
      />

      <div class="ml-auto flex items-center gap-2">
        <app-language-switcher />
        <app-theme-toggle />
        @if (auth.user(); as user) {
          <p-button
            size="small"
            icon="pi pi-user"
            [label]="user.name"
            [text]="true"
            severity="secondary"
            styleClass="hidden! sm:inline-flex!"
            [ariaLabel]="'layout.userMenu' | translate"
            (onClick)="menu.toggle($event)"
          />
          <p-button
            size="small"
            class="sm:hidden"
            icon="pi pi-user"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="'layout.userMenu' | translate"
            (onClick)="menu.toggle($event)"
          />
          <p-menu #menu [model]="userMenu()" [popup]="true" appendTo="body" />
        }
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly languageChange = toSignal(this.translate.onLangChange, { initialValue: null });

  readonly toggleMenu = output<void>();

  protected readonly userMenu = computed<MenuItem[]>(() => {
    this.languageChange();
    const user = this.auth.user();
    if (!user) {
      return [];
    }
    return [
      {
        label: `${user.username} · ${this.translate.instant(`enums.role.${user.role}`)}`,
        disabled: true,
      },
      { separator: true },
      {
        label: this.translate.instant('auth.signOut'),
        icon: 'pi pi-sign-out',
        command: () => this.auth.signOut(),
      },
    ];
  });
}
