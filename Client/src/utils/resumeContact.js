export const LINK_LABELS = { website: 'Portfolio website', github: 'GitHub', linkedin: 'LinkedIn' };

export function websiteUrl(value) {
  try {
    const text = String(value || '').trim();
    if (!text) return null;
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function resumeLinks(user) {
  const links = Array.isArray(user?.profileLinks) ? user.profileLinks : [
    { type: 'website', url: user?.portfolioWebsite || user?.website },
    { type: 'github', url: user?.github },
    { type: 'linkedin', url: user?.linkedin },
  ];
  return links.filter(link => LINK_LABELS[link?.type] && typeof link.url === 'string' && link.url.trim());
}
