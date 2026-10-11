import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { startWith, switchMap } from 'rxjs';
import { SERVER_ERROR } from './server-errors';

interface ErrorMessage {
  key: string;
  params: Record<string, unknown>;
}

/** Translated message for the first error of a control, shown once it was touched. */
@Component({
  selector: 'app-field-error',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as error) {
      <small class="text-red-500" role="alert">{{ error.key | translate: error.params }}</small>
    }
  `,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl>();

  /** Emits on every value, status, touched or pristine change of the control. */
  private readonly lastEvent = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.events.pipe(startWith(null)))),
    { initialValue: null },
  );

  protected readonly message = computed<ErrorMessage | null>(() => {
    this.lastEvent();
    const control = this.control();
    if (!control.errors || !(control.touched || control.dirty)) {
      return null;
    }
    return toMessage(control.errors);
  });
}

export function toMessage(errors: ValidationErrors): ErrorMessage {
  const [name, value] = Object.entries(errors)[0];
  if (name === SERVER_ERROR) {
    return { key: `validation.server.${String(value)}`, params: {} };
  }
  const params =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return { key: `validation.${name}`, params };
}
