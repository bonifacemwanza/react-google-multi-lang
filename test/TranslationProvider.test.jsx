import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { apiResponse, echoTranslate, flush } from './helpers.jsx';

// --- axios mock ---------------------------------------------------------------
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post } }));

// Import after the mock is registered.
import {
  TranslationProvider,
  useTranslation,
} from '../src/providers/TranslationProvider.jsx';

const wrapperWith = (props = {}) =>
  function Wrapper({ children }) {
    return (
      <TranslationProvider apiKey="test-key" {...props}>
        {children}
      </TranslationProvider>
    );
  };

beforeEach(() => {
  post.mockReset();
  post.mockImplementation(echoTranslate);
  window.localStorage.clear();
});

describe('useTranslation()', () => {
  it('throws when used outside a TranslationProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTranslation())).toThrow(
      /must be used within a TranslationProvider/
    );
    spy.mockRestore();
  });

  it('exposes language, setLanguage and translateText', () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    expect(result.current.language).toBe('en');
    expect(typeof result.current.setLanguage).toBe('function');
    expect(typeof result.current.translateText).toBe('function');
  });

  it('defaults language to "en" when no defaultLanguage prop is given', () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    expect(result.current.language).toBe('en');
  });
});

describe('translateText()', () => {
  it('returns the original text without calling the API when target === defaultLanguage', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    const out = await result.current.translateText('Hello', 'en');
    expect(out).toBe('Hello');
    expect(post).not.toHaveBeenCalled();
  });

  it('returns the input unchanged for empty / falsy text', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    expect(await result.current.translateText('', 'fr')).toBe('');
    expect(post).not.toHaveBeenCalled();
  });

  it('calls the Google Translate endpoint with the expected params', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    await result.current.translateText('Hello', 'fr');

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toContain('translation.googleapis.com');
    expect(body).toBeNull();
    expect(config.params).toMatchObject({
      q: 'Hello',
      target: 'fr',
      key: 'test-key',
      format: 'text',
    });
  });

  it('caches results: a repeated string hits the API only once', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    const first = await result.current.translateText('Hello', 'fr');
    const second = await result.current.translateText('Hello', 'fr');

    expect(first).toBe(second);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent in-flight requests for the same string', async () => {
    let resolveFn;
    post.mockImplementation(
      () =>
        new Promise((res) => (resolveFn = () => res(apiResponse('Bonjour'))))
    );
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });

    const p1 = result.current.translateText('Hello', 'fr');
    const p2 = result.current.translateText('Hello', 'fr');
    resolveFn();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('Bonjour');
    expect(r2).toBe('Bonjour');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('caches per (text, targetLanguage) pair', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    await result.current.translateText('Hello', 'fr');
    await result.current.translateText('Hello', 'es');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original text and logs when the API call fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    post.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });

    const out = await result.current.translateText('Hello', 'fr');
    expect(out).toBe('Hello');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('falls back to the original text when the response shape is unexpected', async () => {
    post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    expect(await result.current.translateText('Hello', 'fr')).toBe('Hello');
  });

  it('keeps a stable identity across translations (no re-render churn)', async () => {
    const { result, rerender } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    const before = result.current.translateText;
    await result.current.translateText('Hello', 'fr');
    rerender();
    expect(result.current.translateText).toBe(before);
  });
});

describe('language state', () => {
  it('setLanguage updates the current language', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    act(() => result.current.setLanguage('fr'));
    expect(result.current.language).toBe('fr');
  });

  it('persists the selected language to localStorage', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    act(() => result.current.setLanguage('de'));
    await waitFor(() =>
      expect(window.localStorage.getItem('siteLanguage')).toBe('de')
    );
  });

  it('hydrates the language from localStorage on mount', async () => {
    window.localStorage.setItem('siteLanguage', 'es');
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith({ defaultLanguage: 'en' }),
    });
    // Renders with the default first (SSR-safe), then hydrates.
    await waitFor(() => expect(result.current.language).toBe('es'));
  });

  it('persists successful translations to localStorage', async () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    await result.current.translateText('Hello', 'fr');
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem('translations') || '{}'
      );
      expect(stored['Hello-fr']).toBe('[fr] Hello');
    });
  });

  it('hydrates the translation cache from localStorage (no API call on a stored string)', async () => {
    window.localStorage.setItem(
      'translations',
      JSON.stringify({ 'Hello-fr': 'Bonjour' })
    );
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    await flush();
    const out = await result.current.translateText('Hello', 'fr');
    expect(out).toBe('Bonjour');
    expect(post).not.toHaveBeenCalled();
  });

  it('does not throw when localStorage.setItem fails (quota exceeded)', async () => {
    const setItem = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useTranslation(), {
      wrapper: wrapperWith(),
    });
    await expect(result.current.translateText('Hello', 'fr')).resolves.toBe(
      '[fr] Hello'
    );
    setItem.mockRestore();
  });

  it('ignores corrupt JSON in the stored translations', async () => {
    window.localStorage.setItem('translations', '{not valid json');
    expect(() =>
      render(
        <TranslationProvider apiKey="test-key">
          <span>ok</span>
        </TranslationProvider>
      )
    ).not.toThrow();
  });
});
