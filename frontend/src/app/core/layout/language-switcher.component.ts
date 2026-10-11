import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../auth/auth.service';
import { LANGUAGES, Language } from '../i18n/language';
import { LanguageService } from '../i18n/language.service';

/** Language select; when signed in, the choice is also saved as the user's preference. */
@Component({
  selector: 'app-language-switcher',
  imports: [FormsModule, TranslatePipe, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [options]="options"
      [ngModel]="language.language()"
      (ngModelChange)="change($event)"
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
  `,
})
export class LanguageSwitcherComponent {
  protected readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  protected readonly options = LANGUAGES.map((value) => ({ value, label: `languages.${value}` }));

  protected change(language: Language): void {
    this.auth.changeLanguage(language);
  }
}
