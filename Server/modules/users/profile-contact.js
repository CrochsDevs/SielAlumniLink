const linkTypes = new Set(['website', 'github', 'linkedin']);

export function normalizeProfileLink(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) {
    throw new Error('Enter a valid website URL (maximum 2,048 characters).');
  }
  const trimmed = value.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) {
    throw new Error('Links must use a valid http or https website address.');
  }
  return url.href;
}

export function contactUpdates(body) {
  const updates = {};
  if (body.contactNumber !== undefined) {
    if (typeof body.contactNumber !== 'string' || body.contactNumber.length > 60) throw new Error('Phone number must be at most 60 characters.');
    updates.contactNumber = body.contactNumber.trim();
  }
  if (body.contactEmail !== undefined) {
    if (typeof body.contactEmail !== 'string' || body.contactEmail.length > 254) throw new Error('Enter a valid contact email.');
    updates.contactEmail = body.contactEmail.trim();
    if (updates.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.contactEmail)) throw new Error('Enter a valid contact email.');
  }
  if (body.profileLinks !== undefined) {
    if (!Array.isArray(body.profileLinks) || body.profileLinks.length > 20) throw new Error('You can add up to 20 portfolio and profile links.');
    updates.profileLinks = body.profileLinks.map(link => {
      if (!link || !linkTypes.has(link.type)) throw new Error('Choose Portfolio website, GitHub, or LinkedIn for each link.');
      return { type: link.type, url: normalizeProfileLink(link.url) };
    });
  }
  return updates;
}
