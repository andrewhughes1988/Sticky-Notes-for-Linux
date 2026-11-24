export function createSearchQuery(search?: string) {
  const terms = [...new Set(search?.match(/[\p{L}\p{M}\p{N}]+/gu))];
  const indexedTerms: string[] = [];
  const shortTerms: string[] = [];
  for (const term of terms) {
    ([...term].length >= 3 ? indexedTerms : shortTerms).push(term);
  }
  return {
    indexedTerms,
    shortTerms,
    indexedQuery: indexedTerms.map((term) => `"${term}"`).join(' AND '),
    punctuationOnly: Boolean(search?.trim()) && !terms.length,
  };
}

function originalOffset(text: string, foldedOffset: number): number {
  let offset = 0;
  for (const character of text) {
    const foldedLength = character.toLowerCase().length;
    if (foldedOffset < foldedLength) break;
    foldedOffset -= foldedLength;
    offset += character.length;
  }
  return offset;
}

export function excerptAroundMatch(text: string, foldedTerms: string[]): string | undefined {
  const folded = text.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;
  for (const term of foldedTerms) {
    const index = folded.indexOf(term);
    if (
      index >= 0 &&
      (term.length > matchLength || (term.length === matchLength && index < matchIndex))
    ) {
      matchIndex = index;
      matchLength = term.length;
    }
  }
  if (matchIndex === -1) return;

  // Lowercasing can expand a character, for example dotted capital I.
  const matchStart = folded.length === text.length ? matchIndex : originalOffset(text, matchIndex);
  const foldedEnd = matchIndex + matchLength - 1;
  const matchEnd =
    folded.length === text.length ? foldedEnd + 1 : originalOffset(text, foldedEnd) + 1;
  let start = Math.max(0, matchStart - 32);
  let end = Math.min(text.length, Math.max(matchEnd + 48, start + 100));
  // Keep surrogate pairs intact at the cut boundaries.
  if (/[\uDC00-\uDFFF]/.test(text.charAt(start))) start--;
  if (/[\uDC00-\uDFFF]/.test(text.charAt(end))) end++;
  const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < text.length ? '…' : ''}`;
}
