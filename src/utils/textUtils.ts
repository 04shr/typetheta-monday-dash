/**
 * Strips HTML tags, entities, and code markup from text strings, returning clean plain text.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);

  // Use DOMParser if available in browser environment
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      text = doc.body.textContent || "";
    } catch {
      // Fallback below
    }
  }

  // Regex fallback & HTML entity decoding
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
