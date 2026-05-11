import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { apiResponse, echoTranslate } from './helpers.jsx';

// --- axios mock ---------------------------------------------------------------
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post } }));

import {
  TranslationProvider,
  useTranslation,
} from '../src/providers/TranslationProvider.jsx';
import { withTranslation } from '../src/hoc/withTranslation.jsx';

const renderWrapped = (Component, { providerProps = {}, props = {} } = {}) => {
  const Wrapped = withTranslation(Component);
  return render(
    <TranslationProvider apiKey="test-key" {...providerProps}>
      <Wrapped {...props} />
    </TranslationProvider>
  );
};

beforeEach(() => {
  post.mockReset();
  post.mockImplementation(echoTranslate);
  window.localStorage.clear();
});

describe('withTranslation()', () => {
  it('renders the original component first, then the translated markup', async () => {
    const Hello = () => <p>Hello</p>;
    const { container } = renderWrapped(Hello, {
      providerProps: { defaultLanguage: 'en' },
    });

    // Default language === en: never calls the API, original text stays.
    await waitFor(() =>
      expect(container.querySelector('p')).toHaveTextContent('Hello')
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('translates text nodes when the language differs from the default', async () => {
    const Hello = () => (
      <div>
        <h1>Hello</h1>
        <p>World</p>
      </div>
    );
    renderWrapped(Hello, { providerProps: { defaultLanguage: 'en' } });

    // It mounts on 'en' (no calls); switch to 'fr' via a child that uses the hook.
    // Simpler: render directly on a non-default language by pre-seeding storage.
    window.localStorage.setItem('siteLanguage', 'fr');
    renderWrapped(Hello, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() => {
      expect(screen.getByText('[fr] Hello')).toBeInTheDocument();
      expect(screen.getByText('[fr] World')).toBeInTheDocument();
    });
  });

  it('skips elements with the "no-translate" class', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    const Comp = () => (
      <div>
        <p>Translate me</p>
        <p className="no-translate">Leave me alone</p>
      </div>
    );
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() =>
      expect(screen.getByText('[fr] Translate me')).toBeInTheDocument()
    );
    expect(screen.getByText('Leave me alone')).toBeInTheDocument();
    // Only the one translatable string was sent.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][2].params.q).toBe('Translate me');
  });

  it('skips <code> and <pre> blocks', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    const Comp = () => (
      <div>
        <p>Run this</p>
        <code>npm install</code>
        <pre>const x = 1;</pre>
      </div>
    );
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() =>
      expect(screen.getByText('[fr] Run this')).toBeInTheDocument()
    );
    expect(screen.getByText('npm install')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not translate whitespace-only text nodes', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    const Comp = () => (
      <div>
        {' '}
        <span>Hi</span>{' '}
      </div>
    );
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });
    await waitFor(() => expect(post).toHaveBeenCalled());
    // Every call's source string is non-blank.
    for (const call of post.mock.calls) {
      expect(call[2].params.q.trim()).not.toBe('');
    }
  });

  it('decodes HTML entities returned by the API', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    post.mockImplementation(() =>
      Promise.resolve(apiResponse('Tom &amp; Jerry'))
    );
    const Comp = () => <p>Tom and Jerry</p>;
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() =>
      expect(screen.getByText('Tom & Jerry')).toBeInTheDocument()
    );
  });

  it('falls back to the original text when a translation request fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('siteLanguage', 'fr');
    post.mockRejectedValue(new Error('boom'));
    const Comp = () => <p>Hello</p>;
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
    errSpy.mockRestore();
  });

  it('re-translates when the language changes', async () => {
    const Inner = () => <p>Hello</p>;
    const WrappedInner = withTranslation(Inner);
    const Switcher = () => {
      const { setLanguage } = useTranslation();
      return <button onClick={() => setLanguage('es')}>switch</button>;
    };

    const { container } = render(
      <TranslationProvider apiKey="test-key" defaultLanguage="en">
        <Switcher />
        <WrappedInner />
      </TranslationProvider>
    );

    // Starts on 'en' — original text, no API.
    await waitFor(() =>
      expect(container.querySelector('p')).toHaveTextContent('Hello')
    );
    expect(post).not.toHaveBeenCalled();

    act(() => screen.getByText('switch').click());

    await waitFor(() =>
      expect(container.querySelector('p')).toHaveTextContent('[es] Hello')
    );
  });

  it('de-duplicates repeated identical strings within one render pass', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    const Comp = () => (
      <ul>
        <li>Item</li>
        <li>Item</li>
        <li>Item</li>
      </ul>
    );
    renderWrapped(Comp, { providerProps: { defaultLanguage: 'en' } });

    await waitFor(() =>
      expect(screen.getAllByText('[fr] Item')).toHaveLength(3)
    );
    // "Item" should have been sent to the API exactly once despite 3 nodes.
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sets a descriptive displayName', () => {
    const Named = () => <p>x</p>;
    Named.displayName = 'MyNamed';
    expect(withTranslation(Named).displayName).toBe('withTranslation(MyNamed)');
    const Anon = () => <p>x</p>;
    expect(withTranslation(Anon).displayName).toMatch(/^withTranslation\(/);
  });

  it('does not re-run the translation pass on an unrelated parent re-render', async () => {
    window.localStorage.setItem('siteLanguage', 'fr');
    const Child = () => <p>Hello</p>;
    const WrappedChild = withTranslation(Child);

    const Parent = () => {
      const [, force] = React.useState(0);
      return (
        <TranslationProvider apiKey="test-key" defaultLanguage="en">
          <button onClick={() => force((n) => n + 1)}>rerender</button>
          <WrappedChild />
        </TranslationProvider>
      );
    };

    render(<Parent />);
    await waitFor(() =>
      expect(screen.getByText('[fr] Hello')).toBeInTheDocument()
    );
    const callsAfterFirstPass = post.mock.calls.length;

    act(() => screen.getByText('rerender').click());
    act(() => screen.getByText('rerender').click());

    // No new API calls — the effect didn't re-fire just because props changed.
    expect(post.mock.calls.length).toBe(callsAfterFirstPass);
  });
});
