const categoryMap = { 'harassment': 'harassment', 'harassment/threatening': 'violence', 'hate': 'hate', 'hate/threatening': 'hate',
  'violence': 'violence', 'violence/graphic': 'violence', 'sexual': 'sexual', 'sexual/minors': 'sexual',
  'illicit': 'unauthorized', 'illicit/violent': 'violence' };

// Fixed HTTPS endpoint: neither submitted URLs nor administrator settings can
// redirect requests or credentials to an arbitrary host. No user URLs are fetched.
export function createModerationProvider({ key = process.env.OPENAI_API_KEY, fetcher = fetch, timeoutMs = 7000 } = {}) {
  let lastSuccessAt = null, lastFailureAt = null, unavailableUntil = 0;
  const cache = new Map();
  const status = () => ({ provider: 'OpenAI', model: 'omni-moderation-latest', configured: !!key, lastSuccessAt, lastFailureAt });
  return { status,
    async analyze({ text, images = [], hash }) {
      if (!key) return { available: false, reason: 'not_configured', signals: [] };
      if (Date.now() < unavailableUntil) return { available: false, reason: 'provider_unavailable', signals: [] };
      const cached = cache.get(hash);
      if (cached && cached.expires > Date.now()) return cached.result;
      const input = [...(text.trim() ? [{ type: 'text', text }] : []), ...images.map(url => ({ type: 'image_url', image_url: { url } }))];
      if (!input.length) return { available: true, signals: [] };
      try {
        const response = await fetcher('https://api.openai.com/v1/moderations', { method: 'POST', signal: AbortSignal.timeout(timeoutMs),
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'omni-moderation-latest', input }) });
        if (!response.ok) throw new Error('Provider unavailable');
        const body = await response.json();
        if (!Array.isArray(body.results) || !body.results.length || !body.results[0].category_scores || !body.results[0].categories) throw new Error('Invalid moderation response');
        const signals = body.results.flatMap(result => Object.entries(result.category_scores).filter(([category, score]) => categoryMap[category] && typeof score === 'number' && score >= 0 && score <= 1 && result.categories[category] === true)
          .map(([category, score]) => ({ category: categoryMap[category], providerCategory: category, score,
            severity: ['violence', 'violence/graphic'].includes(category) ? 'medium' : ['sexual/minors', 'illicit/violent', 'hate/threatening', 'harassment/threatening'].includes(category) ? 'critical' : 'high',
            explanation: `Provider flagged ${category}. Score is a model signal, not proof of a violation.` })));
        const result = { available: true, signals, model: body.model || 'omni-moderation-latest' };
        lastSuccessAt = new Date(); unavailableUntil = 0;
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(hash, { result, expires: Date.now() + 60000 });
        return result;
      } catch { lastFailureAt = new Date(); unavailableUntil = Date.now() + 30000; return { available: false, reason: 'provider_unavailable', signals: [] }; }
    },
  };
}
