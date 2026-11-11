const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

// Resolve IDs against current membership and server-owned profile names. Clients
// never choose displayed names, offsets, or people outside this conversation.
export async function resolveMessageMentions(conversation, text, input, profiles) {
  let ids = input ?? [];
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch { fail('Invalid mentions'); }
  }
  if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) fail('Choose up to 20 group members to mention');
  if (!ids.length) return [];
  const members = new Set((conversation.participants || []).map(member => String(member.authId)));
  ids = [...new Set(ids)];
  if (!conversation.isGroup || ids.some(id => !members.has(id))) fail('You can only mention current members of this group');
  const people = await profiles(ids);
  const mentions = [];
  for (const id of ids) {
    const name = people.find(person => String(person.authId) === id)?.name;
    if (typeof name !== 'string' || !name.trim()) continue;
    const label = `@${name.trim()}`;
    let start = 0;
    while ((start = text.indexOf(label, start)) !== -1) {
      const end = start + label.length;
      if ((start === 0 || /\s|[([{]/u.test(text[start - 1])) && (end === text.length || /\s|[.,!?;:)}\]]/u.test(text[end]))) mentions.push({ authId: id, name: name.trim(), start, end });
      start = end;
    }
  }
  // Overlapping names (e.g. Ann and Ann Lee) cannot corrupt rendered text.
  let end = 0;
  return mentions.sort((a, b) => a.start - b.start || b.end - a.end).filter(mention => {
    if (mention.start < end) return false;
    end = mention.end;
    return true;
  });
}
