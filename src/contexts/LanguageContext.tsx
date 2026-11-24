import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, translations } from '../data/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang') as Language | null;
      const savedLang = localStorage.getItem('betteralcala_lang') as Language | null;
      if (urlLang && ['en', 'fil', 'ilo'].includes(urlLang)) {
        setLanguageState(urlLang);
        localStorage.setItem('betteralcala_lang', urlLang);
      } else if (savedLang && ['en', 'fil', 'ilo'].includes(savedLang)) {
        setLanguageState(savedLang);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('betteralcala_lang', lang);
      document.documentElement.lang = lang === 'en' ? 'en' : lang === 'fil' ? 'tl' : 'ilo';
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return translations[language]?.[key] || translations.en[key] || fallback || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
