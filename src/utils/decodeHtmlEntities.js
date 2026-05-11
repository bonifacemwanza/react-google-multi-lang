// Decodes HTML entities (e.g. "&amp;" -> "&") in a string.
// Returns the input unchanged when there is no DOM (SSR) or no entities present.
const decodeHtmlEntities = (text) => {
  if (typeof text !== 'string' || text.indexOf('&') === -1) {
    return text;
  }
  if (typeof document === 'undefined') {
    return text;
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

export default decodeHtmlEntities;
