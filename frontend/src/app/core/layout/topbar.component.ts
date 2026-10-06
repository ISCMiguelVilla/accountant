import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { LANGUAGES, Language } from '../i18n/language';
import { LanguageService } from '../i18n/language.service';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, TranslatePipe, ButtonModule, SelectModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="flex h-16 items-center gap-3 border-b border-surface bg-surface-0 px-4 dark:bg-surface-900"
    >
      <p-button
        class="lg:hidden"
        icon="pi pi-bars"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [ariaLabel]="'layout.toggleMenu' | translate"
        (onClick)="toggleMenu.emit()"
      />
      <a href="/" class="flex items-center gap-2 text-color no-underline">
        <i class="pi pi-wallet text-xl"></i>
        <span class="text-lg font-semibold">{{ 'app.name' | translate }}</span>
      </a>

      <div class="ml-auto flex items-center gap-2">
        <p-select
          [options]="languageOptions"
          [ngModel]="language.language()"
          (ngModelChange)="changeLanguage($event)"
          optionLabel="label"
          optionValue="value"
          size="small"
          [ariaLabel]="'layout.language' | translate"
        >
          <ng-template #selectedItem let-option>
            <span>{{ option.label | translate }}</span>
          </ng-template>
          <ng-template #item let-option>
            <span>{{ option.label | translate }}</span>
          </ng-template>
        </p-select>
        <p-button
          [icon]="theme.darkMode() ? 'pi pi-sun' : 'pi pi-moon'"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [pTooltip]="(theme.darkMode() ? 'layout.lightMode' : 'layout.darkMode') | translate"
          tooltipPosition="bottom"
          [ariaLabel]="(theme.darkMode() ? 'layout.lightMode' : 'layout.darkMode') | translate"
          (onClick)="theme.toggle()"
        />
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);

  readonly toggleMenu = output<void>();

  protected readonly languageOptions = LANGUAGES.map((value) => ({
    value,
    label: `languages.${value}`,
  }));

  protected changeLanguage(language: Language): void {
    this.language.use(language).subscribe();
  }
}
