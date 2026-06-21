import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale, translations, TranslationKey } from '@/lib/translations';

interface LanguageState {
  language: Locale;
  setLanguage: (lang: Locale) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'id',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'pos-language-storage',
    }
  )
);

// Helper hook for easy translation usage in components
import { useState, useEffect } from 'react';

export function useTranslation() {
  const storeLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  
  // Guard against hydration mismatch (SSR vs CSR)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Default to 'id' during SSR
  const activeLang: Locale = mounted ? storeLanguage : 'id';

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[activeLang][key] || translations['id'][key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return {
    t,
    language: activeLang,
    setLanguage,
    isMounted: mounted,
  };
}
