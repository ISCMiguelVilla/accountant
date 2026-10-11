import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatAmount } from './money';

/** `{{ balance | money: 'MXN' }}` → `1,234.50 MXN`, formatted for the active language. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | string | null | undefined, currencyCode?: string | null): string {
    return formatAmount(value, this.language.locale(), currencyCode);
  }
}
