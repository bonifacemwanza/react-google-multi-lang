'use client';

import React, { useEffect, useState, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { useTranslation } from '../providers/TranslationProvider';
import decodeHtmlEntities from '../utils/decodeHtmlEntities';

const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']);

export const withTranslation = (Component) => {
  const WithTranslation = (props) => {
    const { language, translateText } = useTranslation();
    const [translatedHTML, setTranslatedHtml] = useState(null);

    // Keep the latest props in a ref so they don't have to be an effect
    // dependency — `props` is a fresh object on every parent render, which would
    // otherwise re-run (and re-fetch) the whole translation pass needlessly.
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
      // Bail out early during SSR — there is no DOM to walk and `react-dom/server`
      // markup is what gets hydrated anyway.
      if (typeof document === 'undefined') return;

      let cancelled = false;

      const translateElement = async (element) => {
        if (cancelled) return;
        if (element.classList && element.classList.contains('no-translate')) {
          return;
        }
        if (element.tagName && SKIP_TAGS.has(element.tagName)) {
          return;
        }
        if (element.nodeType === Node.TEXT_NODE && element.nodeValue.trim()) {
          const translated = await translateText(element.nodeValue, language);
          if (cancelled) return;
          element.nodeValue = decodeHtmlEntities(translated);
        }
        if (element.childNodes && element.childNodes.length > 0) {
          for (let i = 0; i < element.childNodes.length; i++) {
            await translateElement(element.childNodes[i]);
            if (cancelled) return;
          }
        }
      };

      const translateContent = async () => {
        const container = document.createElement('div');
        container.innerHTML = ReactDOMServer.renderToString(
          <Component {...propsRef.current} />
        );

        await translateElement(container);
        if (cancelled) return;
        setTranslatedHtml(container.innerHTML);
      };

      translateContent();

      return () => {
        // A language switch (or unmount) cancels the in-flight pass so a stale
        // response can't land after a newer one.
        cancelled = true;
      };
    }, [language, translateText]);

    if (translatedHTML === null) {
      return <Component {...props} />;
    }
    return <div dangerouslySetInnerHTML={{ __html: translatedHTML }}></div>;
  };

  WithTranslation.displayName = `withTranslation(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WithTranslation;
};
