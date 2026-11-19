export const CATEGORIES = ['spam', 'phishing', 'fraud', 'harassment', 'hate', 'violence', 'sexual', 'impersonation', 'malware', 'unauthorized', 'other'];
export const DEFAULT_SETTINGS = {
  enabledCategories: CATEGORIES, reviewThreshold: 0.75, blockThreshold: 0.98, criticalThreshold: 0.995,
  automaticBlocking: true, automaticRestrictions: true, appealsEnabled: true, notificationsEnabled: true,
  durations: [1, 1, 3, 7, 14], strikeLevels: [1, 2, 2, 3, 3], maliciousHosts: [], evidenceDays: 90,
};
export const fail = (status, message, extra = {}) => { throw Object.assign(new Error(message), { status, ...extra }); };
export const adminOnly = user => { if (String(user?.role).toLowerCase() !== 'admin') fail(403, 'Only administrators can access community moderation'); };
export const clean = (value, max = 2000, required = false) => {
  if (typeof value !== 'string' || value.length > max) fail(400, `Provide text of up to ${max} characters`);
  const text = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (required && !text) fail(400, 'Please provide an explanation');
  return text;
};
export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Invalid moderation settings');
  const result = {};
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) fail(400, `Unknown setting: ${key}`);
    const value = input[key];
    if (['automaticBlocking', 'automaticRestrictions', 'appealsEnabled', 'notificationsEnabled'].includes(key)) {
      if (typeof value !== 'boolean') fail(400, `Invalid ${key}`);
    } else if (['reviewThreshold', 'blockThreshold', 'criticalThreshold'].includes(key)) {
      if (!Number.isFinite(value) || value < 0.5 || value > 1) fail(400, 'Thresholds must be between 0.5 and 1');
    } else if (key === 'enabledCategories') {
      if (!Array.isArray(value) || value.some(item => !CATEGORIES.includes(item))) fail(400, 'Invalid categories');
    } else if (key === 'durations' || key === 'strikeLevels') {
      if (!Array.isArray(value) || value.length !== 5 || value.some(item => !Number.isInteger(item) || item < 1 || item > (key === 'durations' ? 30 : 4))) fail(400, 'Configure five escalation steps (automatic restrictions are capped at 30 days and level 4)');
    } else if (key === 'maliciousHosts') {
      if (!Array.isArray(value) || value.length > 200 || value.some(host => typeof host !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))) fail(400, 'Provide up to 200 lowercase domain names');
    } else if (key === 'evidenceDays' && (!Number.isInteger(value) || value < 7 || value > 365)) fail(400, 'Evidence retention must be 7–365 days');
    result[key] = value;
  }
  return result;
}
export const blockedFeatures = level => level >= 5 ? ['social', 'posting', 'messaging', 'receiving_messages', 'connections', 'connection_accept', 'profile']
  : level >= 4 ? ['social', 'posting', 'messaging', 'receiving_messages', 'connections', 'connection_accept', 'profile']
    : level >= 3 ? ['posting', 'messaging', 'connections'] : level >= 2 ? ['posting'] : [];
export function restrictionError(rows, feature) {
  const active = rows.filter(row => blockedFeatures(row.level).includes(feature));
  if (!active.length) return null;
  const restriction = [...active].sort((a, b) => b.level - a.level)[0];
  return Object.assign(new Error(`Your account is temporarily restricted from ${feature.replaceAll('_', ' ')}. ${restriction.reason} Expires ${new Date(restriction.expiresAt).toISOString()}. You can view details and appeal at /community-status.`),
    { status: 403, code: 'COMMUNITY_RESTRICTED', restriction: { _id: restriction._id, caseId: restriction.caseId, level: restriction.level, reason: restriction.reason,
      features: blockedFeatures(restriction.level), startsAt: restriction.startsAt, expiresAt: restriction.expiresAt }, appealUrl: '/community-status' });
}

export function ruleSignals(text, attempts, frequency, settings) {
  const signals = [];
  const links = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)].slice(0, 30).map(match => {
    try { return new URL(match[0].startsWith('www.') ? `https://${match[0]}` : match[0]); } catch { return null; }
  }).filter(Boolean);
  const money = /(?:guaranteed|double|triple|100%|risk.free).{0,45}(?:profit|return|money|investment)|(?:send|transfer|pay).{0,35}(?:password|otp|deposit|crypto|fee)/i.test(text);
  for (const url of links) {
    if (settings.maliciousHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) signals.push({ category: 'phishing', score: 0.999, severity: 'high', explanation: 'Link matches an administrator-configured malicious domain.' });
    else if ((url.username || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes('xn--')) && /password|login|verify|otp|account|bank/i.test(text)) signals.push({ category: 'phishing', score: 0.85, severity: 'medium', explanation: 'Credential request combined with a disguised or numeric-host link; administrator review required.' });
    if (/\.(exe|scr|bat|cmd|ps1|msi)(?:$|\?)/i.test(url.pathname) && /download|install|run|disable.{0,15}(?:antivirus|security)/i.test(text)) signals.push({ category: 'malware', score: 0.88, severity: 'medium', explanation: 'Executable link combined with installation/security instructions; review required.' });
  }
  if (money && links.length) signals.push({ category: 'fraud', score: 0.82, severity: 'medium', explanation: 'Financial/credential solicitation combined with an external link; context requires review.' });
  if ((attempts >= 3 && links.length) || (attempts >= 6 && text.length >= 40) || frequency > 40) signals.push({ category: 'spam', score: 0.9, severity: 'medium', explanation: 'Repeated identical submissions or excessive activity within a short time window; no automatic strike.' });
  if (/\b(?:i will|i am going to|i'm going to)\b.{0,60}\b(?:kill|shoot|stab)\b.{0,40}\b(?:you|him|her|them)\b/i.test(text) && /\b(?:tonight|tomorrow|gun|knife|school|house|address)\b/i.test(text)) signals.push({ category: 'violence', score: 0.86, severity: 'medium', explanation: 'Directed future threat with timing/location/weapon context; urgent human review required.' });
  if (/(?:official|university|administrator|admin).{0,30}(?:account|representative|support)/i.test(text) && /(?:send|pay|transfer).{0,25}(?:money|fee|deposit|otp|password)/i.test(text)) signals.push({ category: 'impersonation', score: 0.84, severity: 'medium', explanation: 'Authority claim combined with a payment/credential request; identity must be verified by an administrator.' });
  return signals.filter(signal => settings.enabledCategories.includes(signal.category));
}
