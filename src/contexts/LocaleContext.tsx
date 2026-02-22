import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import i18n from 'i18next';
import {
  addEnPrefix,
  DEFAULT_LOCALE,
  EN_LOCALE,
  localeFromPathname,
  normalizeLocale,
  setDocumentLang,
  stripEnPrefix,
  type SupportedLocale
} from '../i18n';

const STORAGE_KEY = 'tumuai_locale';
const AUTODETECT_KEY = 'tumuai_locale_autodetected';

function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeLocale(raw);
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

function hasAutodetected(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(AUTODETECT_KEY) === '1';
  } catch {
    return false;
  }
}

function markAutodetected() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTODETECT_KEY, '1');
  } catch {
    // ignore
  }
}

const NON_LOCALIZED_PREFIXES = ['/admin', '/admin-login', '/diagnostic'];

function isNonLocalizedPathname(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildPathForLocale(pathname: string, locale: SupportedLocale): string {
  if (isNonLocalizedPathname(pathname)) return pathname;
  return locale === EN_LOCALE ? addEnPrefix(stripEnPrefix(pathname)) : stripEnPrefix(pathname);
}

export interface LocaleContextValue {
  locale: SupportedLocale;
  preferredLocale: SupportedLocale | null;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || '/';

  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale | null>(() => readStoredLocale());
  const urlLocale = useMemo(() => localeFromPathname(pathname), [pathname]);

  const locale: SupportedLocale = useMemo(() => {
    if (isNonLocalizedPathname(pathname)) return preferredLocale ?? urlLocale;
    return urlLocale;
  }, [pathname, preferredLocale, urlLocale]);

  const inflightRef = useRef<AbortController | null>(null);

  // Keep i18n + <html lang> in sync with effective locale.
  useEffect(() => {
    setDocumentLang(locale);
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  // If user has an explicit preference, keep URL in sync for localizable routes.
  useEffect(() => {
    if (!preferredLocale) return;
    if (isNonLocalizedPathname(pathname)) return;

    const targetPath = buildPathForLocale(pathname, preferredLocale);
    if (targetPath === pathname) return;
    navigate(`${targetPath}${location.search}${location.hash}`, { replace: true });
  }, [preferredLocale, pathname, location.search, location.hash, navigate]);

  // Best-effort locale autodetection (IP/Accept-Language) for first-time visitors.
  useEffect(() => {
    if (preferredLocale) return;
    if (isNonLocalizedPathname(pathname)) return;
    if (urlLocale === EN_LOCALE) return;
    if (hasAutodetected()) return;

    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;

    (async () => {
      try {
        const res = await fetch('/api/locale', { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestedLocale?: string };
        const suggested = normalizeLocale(data.suggestedLocale);
        markAutodetected();
        if (suggested === DEFAULT_LOCALE) return;
        setPreferredLocale(suggested);
        writeStoredLocale(suggested);
        const targetPath = buildPathForLocale(pathname, suggested);
        if (targetPath !== pathname) {
          navigate(`${targetPath}${location.search}${location.hash}`, { replace: true });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    })();

    return () => controller.abort();
  }, [preferredLocale, pathname, urlLocale, location.search, location.hash, navigate]);

  const setLocale = useCallback((next: SupportedLocale) => {
    const normalized = normalizeLocale(next);
    setPreferredLocale(normalized);
    writeStoredLocale(normalized);

    const targetPath = buildPathForLocale(pathname, normalized);
    if (targetPath !== pathname) {
      navigate(`${targetPath}${location.search}${location.hash}`, { replace: true });
    }
  }, [pathname, location.search, location.hash, navigate]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === EN_LOCALE ? DEFAULT_LOCALE : EN_LOCALE);
  }, [locale, setLocale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    preferredLocale,
    setLocale,
    toggleLocale
  }), [locale, preferredLocale, setLocale, toggleLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

