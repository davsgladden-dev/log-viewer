export interface Segment {
  text: string;
  match: boolean;
}

/** Split text into segments so matches of `query` (already lowercased) can be highlighted. */
export function highlight(text: string, query: string): Segment[] {
  if (!query) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const out: Segment[] = [];
  let pos = 0;

  while (true) {
    const i = lower.indexOf(query, pos);
    if (i === -1) break;
    if (i > pos) out.push({ text: text.slice(pos, i), match: false });
    out.push({ text: text.slice(i, i + query.length), match: true });
    pos = i + query.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });

  return out.length ? out : [{ text, match: false }];
}
