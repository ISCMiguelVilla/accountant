import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { FieldErrorComponent } from '../../shared/forms/field-error.component';
import { toApiProblem } from '../../shared/models/api-problem.model';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-sign-in-page',
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
    <app-auth-shell title="auth.signIn.title" subtitle="auth.signIn.subtitle">
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        @if (error(); as message) {
          <p-message severity="error" [text]="message" />
        }
        <div class="flex flex-col gap-2">
          <label for="username">{{ 'auth.username' | translate }}</label>
          <input pInputText id="username" formControlName="username" autocomplete="username" />
          <app-field-error [control]="form.controls.username" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="password">{{ 'auth.password' | translate }}</label>
          <p-password
            inputId="password"
            formControlName="password"
            [feedback]="false"
            [toggleMask]="true"
            autocomplete="current-password"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          <app-field-error [control]="form.controls.password" />
        </div>
        <p-button
          type="submit"
          [label]="'auth.signIn.action' | translate"
          icon="pi pi-sign-in"
          [loading]="loading()"
          styleClass="w-full"
        />
        <p class="m-0 text-center text-sm">
          {{ 'auth.signIn.noAccount' | translate }}
          <a routerLink="/sign-up" class="font-semibold">{{ 'auth.signUp.action' | translate }}</a>
        </p>
      </form>
    </app-auth-shell>
  `,
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorNotifier);

  /** Bound from the `returnUrl` query param. */
  readonly returnUrl = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.maxLength(72)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.signIn(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.errors.message(toApiProblem(err)));
      },
    });
  }
}

/** Only internal paths are accepted as return URL. */
export function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/home';
}
