import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { authEmail } from '../auth/auth.validation.js';
import { resetTokenHash } from '../auth/password-reset.js';
import { mapSyncedUser } from '../sync/user-schema.js';
import { activeAccount, sessionVersion } from '../auth/session-token.js';
import { nameGrams } from '../search/search.names.js';

export const INVITATION_HOURS = 24;
const failure = (status, message) => Object.assign(new Error(message), { status });

export async function ensureInvitationIndexes(db) {
  // Registration and CAIS sync share the same login namespace. Enforce this at
  // storage level so simultaneous requests cannot create duplicate identities.
  await db.collection('auth').createIndex({ email: 1 }, {
    name: 'auth_unique_email', unique: true, partialFilterExpression: { email: { $type: 'string' } },
  });
}

export function invitationProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(400, 'Please provide user details.');
  for (const key of ['first_name', 'last_name', 'email', 'source_user_type']) {
    if (typeof body[key] !== 'string' || !body[key].trim()) throw failure(400, 'First name, last name, email, and account type are required.');
  }
  if (!['student', 'alumni'].includes(body.source_user_type)) throw failure(400, 'Choose Student or Alumni.');
  // Only editable registration fields enter the schema adapter. Source audit
  // timestamps, credentials, privilege and activation state are server-owned.
  const allowed = ['first_name', 'middle_name', 'last_name', 'extension_name', 'email',
    'contact_no', 'student_number', 'source_user_type', 'program', 'year_level', 'section', 'status'];
  const fields = Object.fromEntries(allowed.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string') throw failure(400, `Invalid ${key.replaceAll('_', ' ')}.`);
  }
  if (!authEmail(fields.email)) throw failure(400, 'Please enter a valid email address.');
  if ((fields.contact_no || '').trim().length > 20) throw failure(400, 'Contact number must be at most 20 characters.');
  try { return mapSyncedUser(fields); }
  catch (error) { throw failure(400, error.message); }
}

export function createUserInvitations({ db, transaction, sendEmail, frontendUrl, now = () => new Date() }) {
  const auth = db.collection('auth');
  const users = db.collection('users');
  const links = db.collection('magic_links');
  const origin = requestOrigin => {
    let url;
    try { url = new URL(frontendUrl(requestOrigin)); } catch { throw failure(503, 'Invitation email is not configured.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw failure(503, 'Invitation email is not configured.');
    return url.origin;
  };

  async function deliver(authId, requestOrigin) {
    const frontend = origin(requestOrigin);
    const at = now();
    const account = await auth.findOne({ _id: authId });
    if (!account || account.registrationSource !== 'manual' || !activeAccount(account)) throw failure(404, 'Invitable account not found.');
    if (account.passwordSetupRequired === false) throw failure(409, 'This user has already set a password.');
    // A single atomic claim prevents duplicate emails from double-clicks or tabs.
    const claimed = await auth.findOneAndUpdate({ _id: authId, disabledAt: null,
      sourceIsActive: { $ne: false }, sourceDeletedAt: null, passwordSetupRequired: true,
      $or: [{ 'invitation.lastAttemptAt': { $exists: false } },
        { 'invitation.lastAttemptAt': { $lte: new Date(at.getTime() - 60_000) } }],
    }, { $set: { 'invitation.lastAttemptAt': at, 'invitation.delivery': 'pending', updatedAt: at } }, { returnDocument: 'after' });
    if (!claimed) throw failure(429, 'Please wait one minute before sending another invitation.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = resetTokenHash(token);
    const expiresAt = new Date(at.getTime() + INVITATION_HOURS * 60 * 60 * 1000);
    let accepted = false;
    try {
      await links.deleteMany({ authId, purpose: 'invitation', usedAt: null });
      await links.insertOne({ email: claimed.email, authId, tokenHash, expiresAt,
        usedAt: null, sessionVersion: sessionVersion(claimed), purpose: 'invitation', createdAt: at });
      const result = await sendEmail(claimed.email, `${frontend}/verify-magic-link?token=${token}`);
      accepted = result?.success === true;
    } catch { /* The account remains available for an administrator to retry. */ }
    if (!accepted) await links.deleteOne({ tokenHash });
    await auth.updateOne({ _id: authId, 'invitation.lastAttemptAt': at }, {
      $set: { 'invitation.delivery': accepted ? 'accepted' : 'failed',
        'invitation.expiresAt': accepted ? expiresAt : null, updatedAt: now() },
    });
    return { invitationDelivery: accepted ? 'accepted' : 'failed',
      invitationExpiresAt: accepted ? expiresAt : null };
  }

  return {
    async register(body, actor, requestOrigin) {
      const profile = invitationProfile(body);
      origin(requestOrigin);
      const authId = new ObjectId();
      const at = now();
      try {
        await transaction(async session => {
          const options = { session };
          if (await auth.findOne({ email: profile.email }, options) || await users.findOne({ email: profile.email }, options)) {
            throw failure(409, 'An account with this email already exists.');
          }
          await auth.insertOne({ _id: authId, email: profile.email, role: profile.role,
            isVerified: true, passwordSetupRequired: true, registrationSource: 'manual',
            registeredBy: String(actor._id), sourceIsActive: true, sourceDeletedAt: null,
            sessionVersion: 0, createdAt: at, updatedAt: at }, options);
          await users.insertOne({ ...profile, authId, searchNameGrams: nameGrams(profile.name),
            createdAt: at, updatedAt: at }, options);
        });
      } catch (error) {
        if (error.code === 11000) throw failure(409, 'An account with this email already exists.');
        throw error;
      }
      // Delivery is after the transaction: retries never resend a rolled-back
      // account, and provider failure never discards a registered user.
      let result;
      try { result = await deliver(authId, requestOrigin); }
      catch { result = { invitationDelivery: 'failed', invitationExpiresAt: null }; }
      return { authId: String(authId), name: profile.name, email: profile.email, ...result };
    },
    async resend(id, requestOrigin) {
      if (!ObjectId.isValid(id)) throw failure(404, 'Invitable account not found.');
      return deliver(new ObjectId(id), requestOrigin);
    },
  };
}
