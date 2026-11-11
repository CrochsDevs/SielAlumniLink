// Bound database fan-out while preserving the input order of list responses.
export async function mapConcurrent(items, limit, transform) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Invalid concurrency limit');
  const results = new Array(items.length);
  let cursor = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try { results[index] = await transform(items[index], index); }
      catch (error) { failed = true; throw error; }
    }
  }));
  return results;
}
