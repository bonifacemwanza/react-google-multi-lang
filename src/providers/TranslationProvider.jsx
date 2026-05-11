'use client';

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

const TranslationContext = createContext();

const URL = 'https://translation.googleapis.com/language/translate/v2';

// localStorage has a ~5MB ceiling; keep the persisted cache well under it.
const MAX_CACHED_ENTRIES = 2000;
const LANGUAGE_STORAGE_KEY = 'siteLanguage';
const TRANSLATIONS_STORAGE_KEY = 'translations';

const isBrowser = typeof window !== 'undefined';

const readStoredLanguage = () => {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const readStoredTranslations = () => {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem(TRANSLATIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistTranslations = (cache) => {
  if (!isBrowser) return;
  try {
    const entries = Object.entries(cache);
    // Keep only the most-recently-inserted entries (insertion order is preserved
    // on plain objects), so the blob can't grow unbounded.
    const trimmed =
      entries.length > MAX_CACHED_ENTRIES
        ? Object.fromEntries(entries.slice(entries.length - MAX_CACHED_ENTRIES))
        : cache;
    window.localStorage.setItem(
      TRANSLATIONS_STORAGE_KEY,
      JSON.stringify(trimmed)
    );
  } catch {
    // Quota exceeded or storage unavailable — non-fatal, just skip persistence.
  }
};

const TranslationProvider = ({ children, apiKey, defaultLanguage = 'en' }) => {
  // `defaultLanguage` until hydration; the stored value is read in an effect so
  // server and client render the same markup (no SSR/hydration mismatch).
  const [language, setLanguage] = useState(defaultLanguage);

  // The translation cache lives in a ref so reading/writing it never changes the
  // identity of `translateText`. A separate counter triggers re-renders only when
  // we actually want consumers to re-translate.
  const cacheRef = useRef({});
  const inFlightRef = useRef(new Map());
  const [, forceCacheTick] = useState(0);
  const bumpCacheTick = useCallback(() => forceCacheTick((n) => n + 1), []);

  // Hydrate persisted state on mount (client only).
  useEffect(() => {
    const storedLanguage = readStoredLanguage();
    if (storedLanguage && storedLanguage !== language) {
      setLanguage(storedLanguage);
    }
    const storedTranslations = readStoredTranslations();
    if (Object.keys(storedTranslations).length > 0) {
      cacheRef.current = storedTranslations;
      bumpCacheTick();
    }
  }, []);

  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage failures
    }
  }, [language]);

  const translateText = useCallback(
    async (text, targetLanguage) => {
      if (!text || targetLanguage === defaultLanguage) {
        return text;
      }

      const cacheKey = `${text}-${targetLanguage}`;

      // 1. Already translated this string → return it synchronously.
      const cached = cacheRef.current[cacheKey];
      if (cached !== undefined) {
        return cached;
      }

      // 2. A request for this exact string is already in flight → reuse it so we
      //    never hit the API twice for the same text in one render pass.
      const pending = inFlightRef.current.get(cacheKey);
      if (pending) {
        return pending;
      }

      const request = (async () => {
        try {
          const response = await axios.post(URL, null, {
            params: {
              q: text,
              target: targetLanguage,
              key: apiKey,
              format: 'text',
            },
          });

          const translatedText =
            response?.data?.data?.translations?.[0]?.translatedText ?? text;

          cacheRef.current = {
            ...cacheRef.current,
            [cacheKey]: translatedText,
          };
          persistTranslations(cacheRef.current);
          return translatedText;
        } catch (error) {
          console.error('Error translating text:', error);
          return text;
        } finally {
          inFlightRef.current.delete(cacheKey);
        }
      })();

      inFlightRef.current.set(cacheKey, request);
      return request;
    },
    // Stable across cache changes — depends only on the API key and default lang.
    [apiKey, defaultLanguage]
  );

  return (
    <TranslationContext.Provider
      value={{ language, setLanguage, translateText }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

TranslationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  apiKey: PropTypes.string.isRequired,
  defaultLanguage: PropTypes.string,
};

TranslationProvider.displayName = 'TranslationProvider';

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export { TranslationProvider };
