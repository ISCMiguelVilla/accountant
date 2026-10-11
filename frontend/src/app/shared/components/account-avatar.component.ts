import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccountType } from '../enums/account-type.enum';
import { AccountTypeIconPipe } from '../pipes/account-type.pipes';

/** Round badge with the account icon (or the type icon) on the account color. */
@Component({
  selector: 'app-account-avatar',
  imports: [AccountTypeIconPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      [class]="size() === 'lg' ? 'h-12 w-12 text-xl' : 'h-8 w-8 text-sm'"
      [style.background-color]="color() || 'var(--p-surface-500)'"
      aria-hidden="true"
    >
      <i [class]="icon() || (type() | accountTypeIcon)"></i>
    </span>
  `,
})
export class AccountAvatarComponent {
  readonly icon = input<string | null>(null);
  readonly color = input<string | null>(null);
  readonly type = input<AccountType | null>(null);
  readonly size = input<'md' | 'lg'>('md');
}
