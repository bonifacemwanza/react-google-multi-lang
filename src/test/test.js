import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  TranslationProvider,
  withTranslation,
  useTranslation,
} from 'react-google-multi-lang';

const CustomLanguageSwitcher = () => {
  const { setLanguage } = useTranslation();

  return (
    <div>
      <button onClick={() => setLanguage('en')}>English</button>
      <button onClick={() => setLanguage('es')}>Spanish</button>
      <button onClick={() => setLanguage('fr')}>French</button>
    </div>
  );
};

const MyComponent = () => (
  <div>
    <h1>Hello, World!</h1>
    <p>This is a translatable text.</p>
  </div>
);

const TranslatedComponent = withTranslation(MyComponent);

const App = () => (
  <TranslationProvider
    apiKey={process.env.REACT_APP_TRANSLATION_API}
    defaultLanguage="en"
  >
    <CustomLanguageSwitcher />
    <TranslatedComponent />
  </TranslationProvider>
);

const root = createRoot(document.getElementById('root'));
root.render(<App />);
