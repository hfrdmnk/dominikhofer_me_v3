/** Hugo's `strings.Truncate`: cuts at the last word boundary within `length` characters. */
export function truncate(text: string, length: number, ellipsis: string): string {
  const characters = [...text];
  if (characters.length <= length) return text;
  const cut = characters.slice(0, length).join("");
  const lastSpace = cut.search(/\s\S*$/);
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}${ellipsis}`;
}

/** Go's `url.QueryEscape`, which escapes everything but letters, digits and `-_.~`. */
export function queryEscape(text: string): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replaceAll("%20", "+");
}

/** The obfuscated `mailto:` href used for "Reply by email" links, as raw HTML. */
export function replyEmailHref(email: string, title: string): string {
  const mailto = [...`mailto:${email}`].map((character) => `&#${character.charCodeAt(0)};`).join("");
  return `${mailto}?subject=${queryEscape(`Re: ${title}`).replaceAll("+", "%20")}`;
}
