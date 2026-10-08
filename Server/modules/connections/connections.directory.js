const key = value => value == null ? '' : String(value);
const emailKey = value => typeof value === 'string' ? value.toLowerCase() : '';

// Auth IDs remain stable when members change email or graduate from student to alumni.
export function enrichConnections(connections, accounts, profiles) {
  const accountById = new Map(accounts.map(account => [key(account._id), account]));
  const accountByEmail = new Map(accounts.filter(account => account.email).map(account => [emailKey(account.email), account]));
  const profileById = new Map();
  const profileByEmail = new Map();
  // The database supplies newest profiles first. Keep one canonical profile per account.
  for (const profile of profiles) {
    if (profile.authId && !profileById.has(key(profile.authId))) profileById.set(key(profile.authId), profile);
    if (profile.email && !profileByEmail.has(emailKey(profile.email))) profileByEmail.set(emailKey(profile.email), profile);
  }
  const participant = (connection, side) => {
    const storedId = connection[`${side}AuthId`];
    const storedEmail = connection[`${side}Email`];
    const account = accountById.get(key(storedId)) || accountByEmail.get(emailKey(storedEmail));
    const profile = profileById.get(key(account?._id || storedId)) ||
      profileByEmail.get(emailKey(account?.email || storedEmail));
    const role = account?.role || profile?.role;
    return {
      [`${side}AuthId`]: key(account?._id || storedId || profile?.authId) || null,
      [`${side}Email`]: account?.email || profile?.email || storedEmail || null,
      [`${side}Name`]: profile?.name || account?.name || null,
      [`${side}Role`]: role ? String(role).toLowerCase() : null,
      [`${side}ProfileId`]: profile?._id ? key(profile._id) : null,
    };
  };
  return connections.map(connection => ({ ...connection, ...participant(connection, 'requester'), ...participant(connection, 'recipient') }));
}
