# react-google-multi-lang

[![npm version](https://img.shields.io/npm/v/react-google-multi-lang.svg)](https://www.npmjs.com/package/react-google-multi-lang)
[![CI](https://github.com/bonifacemwanza/react-google-multi-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/bonifacemwanza/react-google-multi-lang/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-google-multi-lang.svg)](./LICENSE)

A React library for multi-language UI translation, powered by the [Google Cloud
Translation API](https://cloud.google.com/translate). No translation files to
maintain — wrap your app, pick a language, and the visible text is translated at
runtime and cached.

## Installation

```bash
npm install react-google-multi-lang
```

`react` and `react-dom` (v18 or v19) are peer dependencies.

> **You need a Google Cloud Translation API key.** Enable the _Cloud Translation
> API_ in a Google Cloud project and create an API key. The key is sent from the
> browser, so restrict it (HTTP referrers + the Translation API only). For
> production, prefer proxying requests through your own backend — see
> [Security](#security).

## Quick start

### 1. Wrap your app with `TranslationProvider`

```jsx
// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TranslationProvider } from 'react-google-multi-lang';
import App from './App';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TranslationProvider
      apiKey={import.meta.env.VITE_TRANSLATION_API_KEY}
      defaultLanguage="en"
    >
      <App />
    </TranslationProvider>
  </React.StrictMode>
);
```

### 2. Add a language switcher with `useTranslation`

```jsx
// src/LanguageSwitcher.jsx
import { useTranslation } from 'react-google-multi-lang';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
    <div>
      <button disabled={language === 'en'} onClick={() => setLanguage('en')}>
        English
      </button>
      <button disabled={language === 'es'} onClick={() => setLanguage('es')}>
        Español
      </button>
      <button disabled={language === 'fr'} onClick={() => setLanguage('fr')}>
        Français
      </button>
    </div>
  );
}
```

### 3. Wrap the components you want translated with `withTranslation`

```jsx
// src/Welcome.jsx
import { withTranslation } from 'react-google-multi-lang';

function Welcome() {
  return (
    <section>
      <h1>Hello, world!</h1>
      <p>This text is translated automatically.</p>
      <p className="no-translate">Brand names stay as-is.</p>
      <code>npm install react-google-multi-lang</code>
      <pre>const x = 1;</pre>
    </section>
  );
}

export default withTranslation(Welcome);
```

### 4. Use them

```jsx
// src/App.jsx
import LanguageSwitcher from './LanguageSwitcher';
import Welcome from './Welcome';

export default function App() {
  return (
    <>
      <LanguageSwitcher />
      <Welcome />
    </>
  );
}
```

That's it. When `defaultLanguage` is active no API calls are made; switching to
another language translates the text in the wrapped components and caches the
results (in memory and in `localStorage`).

## Excluding content from translation

`withTranslation` walks the rendered markup and skips:

- any element with the **`no-translate`** class (and its descendants);
- the contents of **`<code>`**, **`<pre>`**, **`<script>`** and **`<style>`**;
- whitespace-only text nodes.

```jsx
<p className="no-translate">Acme Corp™</p>
<code>git commit -m "fix"</code>
```

## API

### `<TranslationProvider>`

Wrap your app once, near the root.

| Prop              | Type        | Required | Description                                                                                                           |
| ----------------- | ----------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `apiKey`          | `string`    | ✅       | Google Cloud Translation API key.                                                                                     |
| `defaultLanguage` | `string`    | —        | The language your source text is written in. Default `'en'`. Translating _to_ this language is a no-op (no API call). |
| `children`        | `ReactNode` | ✅       | Your app.                                                                                                             |

The selected language is persisted to `localStorage` (`siteLanguage`) and the
translation cache to `localStorage` (`translations`), so they survive reloads.
On the server (SSR), the provider renders with `defaultLanguage` and hydrates the
stored values on the client — no hydration mismatch.

### `useTranslation()`

Hook. Must be called inside a `TranslationProvider`.

```js
const { language, setLanguage, translateText } = useTranslation();
```

| Member                        | Type                                                | Description                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`                    | `string`                                            | The currently active language code.                                                                                                                                 |
| `setLanguage(lang)`           | `(lang: string) => void`                            | Switch the active language.                                                                                                                                         |
| `translateText(text, target)` | `(text: string, target: string) => Promise<string>` | Translate a single string. Returns the cached result if available, dedupes concurrent requests for the same string, and falls back to `text` if the API call fails. |

### `withTranslation(Component)`

Higher-order component. Returns a component that renders `Component`, then
replaces its visible text with translations of the active language.

```js
const Translated = withTranslation(MyComponent);
```

**Limitations** — by design, `withTranslation` renders the translated output as
HTML, so the wrapped subtree is **not interactive**: event handlers, refs,
controlled inputs and component state inside it won't work after translation. Use
it for presentational content (headings, copy, labels). For interactive UI, drive
text through your own strings and translate them with `translateText` /
`useTranslation` instead. Also, because props are not part of the translation
trigger, changing a wrapped component's props won't re-run translation — only a
language change does.

## TypeScript

Type definitions ship with the package (`index.d.ts`); no `@types/...` install
needed.

## Redux

If you keep language state in Redux, see [`README_redux.md`](./README_redux.md)
for a small integration pattern.

## Security

The API key is used from the browser, so:

- **Restrict the key** in the Google Cloud console to your domains (HTTP referrer
  restrictions) and to the _Cloud Translation API_ only.
- For production, the safer pattern is to route translation requests through your
  own backend that holds the key server-side. (A pluggable request endpoint is on
  the roadmap.)

## Contributing / Releasing

CI (`lint` + `test` + `build`) runs on every push and pull request across Node
18/20/22. To cut a release (maintainers):

```bash
npm version patch   # or minor / major — bumps package.json and creates a git tag
git push --follow-tags
```

Then create a GitHub Release for the new `vX.Y.Z` tag. The `Release` workflow
verifies the tag matches `package.json`, re-runs lint/test/build, and publishes
to npm with provenance. (Requires an `NPM_TOKEN` repo secret — see
`.github/workflows/release.yml`.)

## License

MIT © [Boniface Mwanza](https://github.com/bonifacemwanza)
