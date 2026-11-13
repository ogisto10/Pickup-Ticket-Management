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
import { LanguageSwitcherComponent } from '../../core/i18n/language-switcher.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
    MessageModule,
    LanguageSwitcherComponent,
    TranslatePipe
  ],
  templateUrl: './login.component.html'
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

  readonly demoAccounts = [
    { userName: 'admin', label: 'Administrator' },
    { userName: 'commercial', label: 'Commercial' },
    { userName: 'reception', label: 'Reception' },
    { userName: 'credit', label: 'CreditManager' },
    { userName: 'warehouse', label: 'WarehouseOperator' },
    { userName: 'supervisor', label: 'Supervisor' },
    { userName: 'display', label: 'DisplayDevice' }
  ];

  fillDemo(userName: string): void {
    this.form.patchValue({ userName, password: 'PickupDev!2026' });
  }

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
