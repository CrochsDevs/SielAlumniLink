export function mentionQuery(text, caret) {
  const prefix = text.slice(0, caret);
  const match = /(?:^|[\s([{])@([^@\n]{0,60})$/.exec(prefix);
  return match ? { start: caret - match[1].length - 1, end: caret, query: match[1] } : null;
}

// Draft styling uses only people selected from the picker or saved edit metadata.
export function draftMentionRanges(text, people = []) {
  const ranges = [];
  for (const person of people) {
    if (!person.authId || !person.name?.trim()) continue;
    const name = person.name.trim(), label = `@${name}`;
    let start = 0;
    while ((start = text.indexOf(label, start)) !== -1) {
      const end = start + label.length;
      if ((!start || /\s|[([{]/u.test(text[start - 1])) && (end === text.length || /\s|[.,!?;:)}\]]/u.test(text[end]))) ranges.push({ authId: person.authId, name, start, end });
      start = end;
    }
  }
  let end = 0;
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end).filter(range => {
    if (range.start < end) return false;
    end = range.end;
    return true;
  });
}

// Render only valid server-issued ranges, as React text nodes (never HTML).
export function mentionParts(text = '', mentions = []) {
  const parts = [];
  let cursor = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (!Number.isInteger(mention.start) || !Number.isInteger(mention.end) || mention.start < cursor || mention.end > text.length || text.slice(mention.start, mention.end) !== `@${mention.name}`) continue;
    if (mention.start > cursor) parts.push({ text: text.slice(cursor, mention.start) });
    parts.push({ text: text.slice(mention.start, mention.end), authId: mention.authId });
    cursor = mention.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
