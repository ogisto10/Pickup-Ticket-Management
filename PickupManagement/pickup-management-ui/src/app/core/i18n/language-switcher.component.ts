import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLanguage } from './translations';
import { TranslationService } from './translation.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-switcher.component.html'
})
export class LanguageSwitcherComponent {
  private readonly i18n = inject(TranslationService);

  readonly currentLang = this.i18n.currentLang;

  readonly languages: { code: AppLanguage; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'ar', label: 'العربية' }
  ];

  selectLanguage(code: AppLanguage): void {
    this.i18n.setLanguage(code);
  }
}
