import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule
  ],
  template: `
    <div class="min-h-screen flex align-items-center justify-content-center p-4 surface-ground">
      <div class="w-full" style="max-width: 420px;">
        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 pb-0 flex align-items-center gap-3">
              <i class="pi pi-ticket text-primary text-3xl"></i>
              <div>
                <h1 class="m-0 text-xl font-bold text-900">Client Pickup Management</h1>
                <p class="m-0 text-sm text-600">Sign in to access your workstation</p>
              </div>
            </div>
          </ng-template>

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-column gap-3 mt-2">
            <p-message
              *ngIf="errorMessage()"
              severity="error"
              [text]="errorMessage()!"
              styleClass="w-full"
            ></p-message>

            <div class="flex flex-column gap-2">
              <label for="userName" class="font-semibold text-sm text-700">Username</label>
              <input
                id="userName"
                type="text"
                pInputText
                formControlName="userName"
                placeholder="Enter your username"
                autocomplete="username"
                class="w-full"
              />
              <small
                class="p-error"
                *ngIf="form.controls.userName.touched && form.controls.userName.invalid"
              >
                Username is required.
              </small>
            </div>

            <div class="flex flex-column gap-2">
              <label for="password" class="font-semibold text-sm text-700">Password</label>
              <p-password
                inputId="password"
                formControlName="password"
                [feedback]="false"
                [toggleMask]="true"
                placeholder="Enter your password"
                styleClass="w-full"
                inputStyleClass="w-full"
                autocomplete="current-password"
              ></p-password>
              <small
                class="p-error"
                *ngIf="form.controls.password.touched && form.controls.password.invalid"
              >
                Password is required.
              </small>
            </div>

            <p-button
              type="submit"
              label="Sign In"
              icon="pi pi-sign-in"
              [loading]="loading()"
              [disabled]="form.invalid || loading()"
              styleClass="w-full mt-2"
            ></p-button>
          </form>
        </p-card>
      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    userName: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (res: LoginResponse) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Signed In',
          detail: `Welcome, ${res.user.fullName}`
        });
        void this.router.navigateByUrl(this.authService.getDefaultRoute());
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          (err?.error as { message?: string } | undefined)?.message ??
            'Invalid username or password.'
        );
      }
    });
  }
}
