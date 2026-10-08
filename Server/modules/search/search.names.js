// Short n-grams make literal substring discovery indexable without a separate search service.
// Regex verification after the index filter eliminates false positives/reordered fragments.
export function nameGrams(name) {
  const characters = Array.from(String(name || '').toLowerCase());
  const grams = new Set();
  for (let size = 1; size <= 3; size++) {
    for (let index = 0; index <= characters.length - size; index++) {
      grams.add(`${size}:${characters.slice(index, index + size).join('')}`);
    }
  }
  return [...grams];
}

export function queryGrams(query) {
  return [...new Set(query.toLowerCase().split(/\s+/).flatMap(word => {
    const characters = Array.from(word);
    const size = Math.min(3, characters.length);
    return characters.slice(0, characters.length - size + 1).map((_, index) => `${size}:${characters.slice(index, index + size).join('')}`);
  }))];
}
