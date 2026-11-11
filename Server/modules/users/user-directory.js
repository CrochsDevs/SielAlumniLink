import { ObjectId } from 'mongodb';
import { profileProjection, visibleProfile } from './profile-visibility.js';

export function createUserDirectory(db) {
  return async (viewer, role) => {
    const profiles = await db.collection('users').find({}, { projection: profileProjection }).toArray();
    const ids = [...new Set(profiles.filter(profile => profile.authId).map(profile => String(profile.authId)))];
    const emails = [...new Set(profiles.filter(profile => !profile.authId && profile.email).map(profile => profile.email.trim().toLowerCase()))];
    const values = ids.flatMap(id => ObjectId.isValid(id) ? [new ObjectId(id), id] : [id]);
    const accounts = ids.length || emails.length ? await db.collection('auth').find({
      $or: [{ _id: { $in: values } }, { email: { $in: emails } }],
    }, { projection: { _id: 1, email: 1, role: 1, disabledAt: 1 } }).toArray() : [];
    const byId = new Map(accounts.map(account => [String(account._id), account]));
    const byEmail = new Map(accounts.map(account => [account.email, account]));
    return profiles.flatMap(profile => {
      const account = profile.authId ? byId.get(String(profile.authId)) : byEmail.get(profile.email?.trim().toLowerCase());
      if (account?.disabledAt) return [];
      const resolved = { ...profile, role: account?.role || profile.role || null };
      if (role && (resolved.role || '').toLowerCase() !== String(role).toLowerCase()) return [];
      return [visibleProfile(resolved, viewer)];
    });
  };
}
