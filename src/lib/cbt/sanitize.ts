// Shared HTML sanitizer for rich-text rendered via `dangerouslySetInnerHTML`.
//
// Rich text (exam descriptions, questions, options, explanations) is authored
// and imported as raw HTML, so any render path must strip executable content
// before it reaches the DOM. `isomorphic-dompurify` works in both the browser
// and the TanStack Start server (it self-bundles jsdom under node), so the
// same helper is safe on every render path.
//
// IMPORTANT ordering (see RichView): file:// rewrite -> sanitizeHtml -> KaTeX.
// KaTeX output is trusted, code-generated HTML with required inline styles, so
// it MUST run after sanitization; sanitizing KaTeX output would strip those
// styles and break formula rendering.

import DOMPurify from "isomorphic-dompurify";

// Explicit allowlist. We permit the formatting the editor can produce
// (text styling, lists, tables, links, images) and nothing that can execute.
// DOMPurify removes every `on*` handler and unsafe-scheme URL by default; the
// config below makes the intent explicit and constrains attributes.
const ALLOWED_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "pre",
  "code",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "colspan", "rowspan"];

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Do NOT widen the URI policy: DOMPurify's default blocks javascript:/
    // vbscript: everywhere and permits data: ONLY on its built-in
    // DATA_URI_TAGS (img/audio/video/...), which is exactly what we need for
    // file:// images rewritten to data: URLs. A custom ALLOWED_URI_REGEXP that
    // added `data:` globally would also re-enable data: on <a href> (a latent
    // XSS vector in legacy/embedded webviews), so we rely on the safe default.
    // Defense-in-depth: never allow these even if added to the tag list.
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style"],
  });
}
