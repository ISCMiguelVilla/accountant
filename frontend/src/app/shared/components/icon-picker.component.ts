import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';

/** PrimeIcons that make sense for accounts. */
export const ACCOUNT_ICONS = [
  'pi pi-wallet',
  'pi pi-money-bill',
  'pi pi-credit-card',
  'pi pi-building-columns',
  'pi pi-building',
  'pi pi-dollar',
  'pi pi-euro',
  'pi pi-bitcoin',
  'pi pi-chart-line',
  'pi pi-chart-bar',
  'pi pi-chart-pie',
  'pi pi-briefcase',
  'pi pi-shop',
  'pi pi-shopping-cart',
  'pi pi-shopping-bag',
  'pi pi-home',
  'pi pi-car',
  'pi pi-truck',
  'pi pi-bolt',
  'pi pi-wifi',
  'pi pi-phone',
  'pi pi-mobile',
  'pi pi-apple',
  'pi pi-heart',
  'pi pi-gift',
  'pi pi-book',
  'pi pi-graduation-cap',
  'pi pi-user',
  'pi pi-users',
  'pi pi-box',
  'pi pi-globe',
  'pi pi-ticket',
  'pi pi-star',
  'pi pi-folder',
  'pi pi-tag',
  'pi pi-percentage',
  'pi pi-calculator',
  'pi pi-receipt',
] as const;

@Component({
  selector: 'app-icon-picker',
  imports: [FormsModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => IconPickerComponent), multi: true },
  ],
  template: `
    <p-select
      [options]="icons"
      [ngModel]="value()"
      (ngModelChange)="change($event)"
      [filter]="true"
      [showClear]="true"
      [disabled]="disabled()"
      [inputId]="inputId()"
      [placeholder]="placeholder()"
      styleClass="w-full"
    >
      <ng-template #selectedItem let-icon>
        <span class="flex items-center gap-2"><i [class]="icon"></i>{{ short(icon) }}</span>
      </ng-template>
      <ng-template #item let-icon>
        <span class="flex items-center gap-2"><i [class]="icon"></i>{{ short(icon) }}</span>
      </ng-template>
    </p-select>
  `,
})
export class IconPickerComponent implements ControlValueAccessor {
  readonly inputId = input<string>();
  readonly placeholder = input('');

  protected readonly icons = [...ACCOUNT_ICONS];
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected change(value: string | null): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  protected short(icon: string | null): string {
    return icon ? icon.replace('pi pi-', '') : '';
  }
}
