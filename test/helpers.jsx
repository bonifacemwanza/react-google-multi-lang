// Shared, non-mock test helpers. (axios mocking is done per-file with
// `vi.hoisted` + `vi.mock` because Vitest hoists `vi.mock` above imports.)

// Builds a Google Translate API v2 success response shape.
export const apiResponse = (translatedText) => ({
  data: { data: { translations: [{ translatedText }] } },
});

// The library calls `axios.post(url, null, { params: { q, target, key } })`,
// so request params live in the *third* argument.
export const requestParams = (...args) => args[2]?.params ?? {};

// Default mock implementation: echoes the source string with a target-language
// marker so tests can assert "this got translated" without pinning exact text.
export const echoTranslate = (...args) => {
  const { q, target } = requestParams(...args);
  return Promise.resolve(apiResponse(`[${target}] ${q}`));
};

// Resolves on the next macrotask — lets queued microtask chains (the in-flight
// promise map, awaited DOM walk) settle before assertions.
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
