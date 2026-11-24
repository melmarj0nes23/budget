import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { BudgetStage } from '../types/budget';
import { en } from './translations/en';
import { SUPPORTED_LANGUAGES, type LanguageCode, type TranslationBundle } from './types';

const LANG_STORAGE_KEY = 'budgetlens_ph_lang';

const bundleCache = new Map<LanguageCode, TranslationBundle>([['en', en]]);

async function loadLanguageBundle(code: LanguageCode): Promise<TranslationBundle> {
  const existing = bundleCache.get(code);
  if (existing) return existing;

  let mod: TranslationBundle;
  switch (code) {
    case 'tl':
      mod = (await import('./translations/tl')).tl;
      break;
    case 'ilo':
      mod = (await import('./translations/ilo')).ilo;
      break;
    default:
      mod = en;
  }
  bundleCache.set(code, mod);
  return mod;
}

function readInitialLanguage(): LanguageCode {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage restriction
  }
  return 'en';
}

export interface LanguageContextValue {
  language: LanguageCode;
  loadingLanguage: boolean;
  t: TranslationBundle;
  setLanguage: (code: LanguageCode) => void;
  translateDepartment: (deptId: string, fallbackName: string, stage?: BudgetStage) => string;
  translateExpenseClass: (expenseCode: string, fallbackLabel: string) => string;
  translateRegion: (regCode: string, fallbackName: string) => string;
  translateSector: (
    sectorId: string,
    fallback: { label: string; shortLabel: string; description: string }
  ) => { label: string; shortLabel: string; description: string };
  translateRecordHint: (officialEnglishText: string) => string | null;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => readInitialLanguage());
  const [bundle, setBundle] = useState<TranslationBundle>(en);
  const [loadingLanguage, setLoadingLanguage] = useState(false);

  const activateLanguage = useCallback(async (code: LanguageCode) => {
    setLanguageState(code);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      // Ignore storage restriction
    }

    if (code === 'en') {
      setBundle(en);
      document.documentElement.lang = 'en';
      return;
    }

    setLoadingLanguage(true);
    try {
      const loaded = await loadLanguageBundle(code);
      setBundle(loaded);
      document.documentElement.lang = code;
    } finally {
      setLoadingLanguage(false);
    }
  }, []);

  useEffect(() => {
    if (language !== 'en') {
      void activateLanguage(language);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateDepartment = useCallback(
    (deptId: string, fallbackName: string, stage: BudgetStage = 'gaa') => {
      if (bundle.code === 'en') return fallbackName;
      if (stage === 'nep' && deptId === '04') {
        return bundle.departments['04-dar'] ?? fallbackName;
      }
      return bundle.departments[deptId] ?? fallbackName;
    },
    [bundle]
  );

  const translateExpenseClass = useCallback(
    (expenseCode: string, fallbackLabel: string) => {
      return bundle.expenseClasses[expenseCode] ?? fallbackLabel;
    },
    [bundle]
  );

  const translateRegion = useCallback(
    (regCode: string, fallbackName: string) => {
      return bundle.regions[regCode] ?? fallbackName;
    },
    [bundle]
  );

  const translateSector = useCallback(
    (
      sectorId: string,
      fallback: { label: string; shortLabel: string; description: string }
    ) => {
      return bundle.sectors[sectorId] ?? fallback;
    },
    [bundle]
  );

  /**
   * Returns a plain-language translation hint for recurring official DBM agency/program/object
   * phrases when viewing in a Philippine language, while preserving the exact official English title.
   */
  const translateRecordHint = useCallback(
    (officialEnglishText: string): string | null => {
      if (bundle.code === 'en' || !officialEnglishText) return null;
      const lower = officialEnglishText.toLowerCase();
      for (const [enPhrase, translated] of bundle.recordPhrases) {
        if (lower.includes(enPhrase.toLowerCase())) {
          return translated;
        }
      }
      return null;
    },
    [bundle]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        loadingLanguage,
        t: bundle,
        setLanguage: (code) => {
          void activateLanguage(code);
        },
        translateDepartment,
        translateExpenseClass,
        translateRegion,
        translateSector,
        translateRecordHint,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
