import { Injectable, effect, signal } from '@angular/core';
import { AppLanguage, TRANSLATIONS } from './translations';

const LANG_STORAGE_KEY = 'pickup_mgmt_lang';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly currentLang = signal<AppLanguage>(this.readInitialLanguage());

  constructor() {
    effect(() => {
      const lang = this.currentLang();
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    });
  }

  setLanguage(lang: AppLanguage): void {
    this.currentLang.set(lang);
  }

  t(key: string): string {
    const lang = this.currentLang();
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }

  private readInitialLanguage(): AppLanguage {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'ar') {
      return saved;
    }
    return 'en';
  }
}
