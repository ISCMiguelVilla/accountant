import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { LanguageSwitcherComponent } from '../../core/layout/language-switcher.component';
import { ThemeToggleComponent } from '../../core/layout/theme-toggle.component';

/** Centered card layout shared by sign-in and sign-up. */
@Component({
  selector: 'app-auth-shell',
  imports: [TranslatePipe, CardModule, LanguageSwitcherComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-surface-50 dark:bg-surface-950">
      <div class="flex justify-end gap-2 p-4">
        <app-language-switcher />
        <app-theme-toggle />
      </div>
      <main class="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <p-card styleClass="w-full max-w-md">
          <div class="mb-6 flex flex-col items-center gap-2 text-center">
            <i class="pi pi-wallet text-4xl"></i>
            <h1 class="m-0 text-2xl font-semibold">{{ title() | translate }}</h1>
            <p class="m-0 text-muted-color">{{ subtitle() | translate }}</p>
          </div>
          <ng-content />
        </p-card>
      </main>
    </div>
  `,
})
export class AuthShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
}
