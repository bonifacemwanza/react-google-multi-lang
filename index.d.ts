declare module 'react-google-multi-lang' {
  import * as React from 'react';

  export interface TranslationProviderProps {
    /** Google Cloud Translation API key. */
    apiKey: string;
    /**
     * The language your source text is written in. Translating *to* this
     * language is a no-op. Defaults to `'en'`.
     */
    defaultLanguage?: string;
    children: React.ReactNode;
  }

  export const TranslationProvider: React.FC<TranslationProviderProps>;

  export interface TranslationContextValue {
    /** The currently active language code. */
    language: string;
    /** Switch the active language. */
    setLanguage: (language: string) => void;
    /**
     * Translate a single string to `targetLanguage`. Resolves to the cached
     * result if available, dedupes concurrent requests for the same string, and
     * falls back to the original `text` when the API call fails.
     */
    translateText: (text: string, targetLanguage: string) => Promise<string>;
  }

  /** Access the translation context. Must be used within a `TranslationProvider`. */
  export function useTranslation(): TranslationContextValue;

  /**
   * Wrap a component so its rendered text is translated to the active language.
   * Note: the wrapped subtree is rendered as HTML and is not interactive.
   */
  export function withTranslation<P>(
    Component: React.ComponentType<P>
  ): React.ComponentType<P>;
}
