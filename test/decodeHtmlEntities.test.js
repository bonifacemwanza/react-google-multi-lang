import { describe, it, expect, vi } from 'vitest';
import decodeHtmlEntities from '../src/utils/decodeHtmlEntities.js';

describe('decodeHtmlEntities()', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeHtmlEntities('&lt;div&gt;')).toBe('<div>');
    expect(decodeHtmlEntities('&quot;hi&quot;')).toBe('"hi"');
  });

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('caf&#233;')).toBe('café');
  });

  it('returns strings without entities unchanged (fast path)', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });

  it('passes through non-string input', () => {
    expect(decodeHtmlEntities(undefined)).toBeUndefined();
    expect(decodeHtmlEntities(null)).toBeNull();
    expect(decodeHtmlEntities(42)).toBe(42);
  });

  it('returns the input unchanged when there is no DOM (SSR)', () => {
    const originalDocument = globalThis.document;
    vi.stubGlobal('document', undefined);
    try {
      expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
    } finally {
      vi.stubGlobal('document', originalDocument);
    }
  });
});
