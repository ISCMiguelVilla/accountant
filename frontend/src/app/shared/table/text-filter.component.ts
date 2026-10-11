import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { debounceTime, distinctUntilChanged } from 'rxjs';

/** Debounced text filter that stays in sync with the URL value. */
@Component({
  selector: 'app-text-filter',
  imports: [ReactiveFormsModule, IconFieldModule, InputIconModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-iconfield>
      <p-inputicon styleClass="pi pi-search" />
      <input
        pInputText
        type="search"
        [formControl]="control"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
      />
    </p-iconfield>
  `,
})
export class TextFilterComponent {
  readonly value = input<string | undefined>();
  readonly placeholder = input('');
  readonly changed = output<string>();

  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      const value = this.value() ?? '';
      if (value !== this.control.value) {
        this.control.setValue(value, { emitEvent: false });
      }
    });
    this.control.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.changed.emit(value));
  }
}
