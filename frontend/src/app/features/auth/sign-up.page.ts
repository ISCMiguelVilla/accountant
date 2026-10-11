import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FieldErrorComponent } from '../../shared/forms/field-error.component';
import { applyServerErrors } from '../../shared/forms/server-errors';
import { toApiProblem } from '../../shared/models/api-problem.model';
import { AuthShellComponent } from './auth-shell.component';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword');
  if (confirm && confirm.value && confirm.value !== password) {
    confirm.setErrors({ ...(confirm.errors ?? {}), mismatch: true });
  } else if (confirm?.hasError('mismatch')) {
    const { mismatch: _mismatch, ...rest } = confirm.errors ?? {};
    confirm.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}

@Component({
  selector: 'app-sign-up-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    AuthShellComponent,
    FieldErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell title="auth.signUp.title" subtitle="auth.signUp.subtitle">
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        @if (error(); as message) {
          <p-message severity="error" [text]="message" />
        }
        <div class="flex flex-col gap-2">
          <label for="name">{{ 'auth.name' | translate }}</label>
          <input pInputText id="name" formControlName="name" autocomplete="name" />
          <app-field-error [control]="form.controls.name" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="username">{{ 'auth.username' | translate }}</label>
          <input pInputText id="username" formControlName="username" autocomplete="username" />
          <small class="text-muted-color">{{ 'auth.usernameHint' | translate }}</small>
          <app-field-error [control]="form.controls.username" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="password">{{ 'auth.password' | translate }}</label>
          <p-password
            inputId="password"
            formControlName="password"
            [toggleMask]="true"
            autocomplete="new-password"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          <app-field-error [control]="form.controls.password" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="confirmPassword">{{ 'auth.confirmPassword' | translate }}</label>
          <p-password
            inputId="confirmPassword"
            formControlName="confirmPassword"
            [feedback]="false"
            [toggleMask]="true"
            autocomplete="new-password"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          <app-field-error [control]="form.controls.confirmPassword" />
        </div>
        <p-button
          type="submit"
          [label]="'auth.signUp.action' | translate"
          icon="pi pi-user-plus"
          [loading]="loading()"
          styleClass="w-full"
        />
        <p class="m-0 text-center text-sm">
          {{ 'auth.signUp.haveAccount' | translate }}
          <a routerLink="/sign-in" class="font-semibold">{{ 'auth.signIn.action' | translate }}</a>
        </p>
      </form>
    </app-auth-shell>
  `,
})
export class SignUpPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorNotifier);
  private readonly language = inject(LanguageService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(USERNAME_PATTERN),
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth
      .signUp({ name, username, password, preferredLanguage: this.language.language() })
      .subscribe({
        next: () => void this.router.navigateByUrl('/home'),
        error: (err: unknown) => {
          this.loading.set(false);
          const problem = toApiProblem(err);
          if (!applyServerErrors(this.form, problem)) {
            this.error.set(this.errors.message(problem));
          }
        },
      });
  }
}
