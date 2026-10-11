import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ErrorNotifier } from '../../../core/http/error-notifier.service';
import { USER_STATUSES, UserStatus } from '../../../shared/enums/user-status.enum';
import { FieldErrorComponent } from '../../../shared/forms/field-error.component';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import { toApiProblem } from '../../../shared/models/api-problem.model';
import { User } from '../../../shared/models/user.model';
import { UserAdminApiService } from './user-admin-api.service';

/** Edits name and status. The role is never editable and the admin cannot be disabled. */
@Component({
  selector: 'app-user-edit-dialog',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
    FieldErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="'admin.users.edit' | translate"
      [visible]="!!user()"
      (visibleChange)="!$event && closed.emit()"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
        @if (error(); as message) {
          <p-message severity="error" [text]="message" />
        }
        <div class="flex flex-col gap-2">
          <label for="user-name">{{ 'common.name' | translate }}</label>
          <input pInputText id="user-name" formControlName="name" />
          <app-field-error [control]="form.controls.name" />
        </div>
        <div class="flex flex-col gap-2">
          <span>{{ 'common.status' | translate }}</span>
          <p-selectbutton
            [options]="statusOptions"
            formControlName="status"
            [allowEmpty]="false"
            [ariaLabel]="'common.status' | translate"
          >
            <ng-template #item let-option>{{
              'enums.userStatus.' + option | translate
            }}</ng-template>
          </p-selectbutton>
          @if (isAdmin()) {
            <small class="text-muted-color">{{ 'admin.users.adminImmutable' | translate }}</small>
          }
        </div>
        <div class="flex justify-end gap-2">
          <p-button
            [label]="'common.cancel' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="closed.emit()"
          />
          <p-button type="submit" [label]="'common.save' | translate" [loading]="saving()" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class UserEditDialogComponent {
  private readonly api = inject(UserAdminApiService);
  private readonly notifier = inject(ErrorNotifier);

  readonly user = input<User | null>(null);
  readonly closed = output<void>();
  readonly saved = output<User>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  protected readonly statusOptions = [...USER_STATUSES];

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    status: ['ACTIVE' as UserStatus, Validators.required],
  });

  constructor() {
    effect(() => {
      const user = this.user();
      this.error.set(null);
      if (user) {
        this.form.reset({ name: user.name, status: user.status });
        if (user.role === 'ADMIN') {
          this.form.controls.status.disable();
        } else {
          this.form.controls.status.enable();
        }
      }
    });
  }

  protected save(): void {
    const user = this.user();
    if (!user || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.update(user.id, this.form.getRawValue()).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.notifier.success('admin.users.saved');
        this.saved.emit(updated);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const problem = toApiProblem(err);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(this.notifier.message(problem));
        }
      },
    });
  }
}
