import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';
export const EN_LOCALE: SupportedLocale = 'en';

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  const raw = String(input || '').trim();
  if (!raw) return DEFAULT_LOCALE;

  const lower = raw.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';

  return DEFAULT_LOCALE;
}

export function isEnPathname(pathname: string): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

export function localeFromPathname(pathname: string): SupportedLocale {
  return isEnPathname(pathname) ? 'en' : 'zh-CN';
}

export function stripEnPrefix(pathname: string): string {
  if (!isEnPathname(pathname)) return pathname;
  if (pathname === '/en') return '/';
  return pathname.replace(/^\/en(?=\/)/, '');
}

export function addEnPrefix(pathname: string): string {
  if (isEnPathname(pathname)) return pathname;
  if (pathname === '/') return '/en';
  return `/en${pathname}`;
}

export function setDocumentLang(locale: SupportedLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
}

let initialized = false;

export function initI18n() {
  if (initialized) return i18n;
  initialized = true;

  i18n
    .use(initReactI18next)
    .init({
      resources: {
        'zh-CN': { translation: zhCN },
        en: { translation: en }
      },
      fallbackLng: DEFAULT_LOCALE,
      interpolation: { escapeValue: false },
      supportedLngs: [...SUPPORTED_LOCALES],
      lng: DEFAULT_LOCALE
    })
    .catch((error) => {
      console.error('[i18n] init failed:', error);
    });

  return i18n;
}
