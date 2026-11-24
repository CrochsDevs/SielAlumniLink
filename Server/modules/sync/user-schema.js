// CAIS/Laravel user rows are adapted at the import boundary. Credentials and
// local account state are never copied from a source system.
// Field contract:
// id -> sourceId (MongoDB keeps its own _id); external_id -> externalId.
// avatar -> profilePicture; student_number -> studentId; contact_no -> contactNumber.
// first/middle/last/extension_name -> first/middle/last/extensionName plus display name.
// status -> academicStatus and sourceStatus; source_status overrides sourceStatus.
// is_active -> sourceIsActive (mirrored into auth to gate access).
// email_verified_at/last_login_at/first_time_login -> source-only metadata;
// these never mark a local login verified or skip local password setup.
// created_at/updated_at -> sourceCreatedAt/sourceUpdatedAt, preserving local dates.
// last_seen_at -> lastSeenAt; all other source_* fields use camelCase.
// password, two_factor_*, remember_token are intentionally excluded: this app
// uses its local password hash, session cookies and magic-link setup instead.
const own = (value, key) => Object.hasOwn(value, key);
const text = (entry, keys, limit = 255) => {
  for (const key of keys) {
    const value = entry[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number') throw new TypeError(`Invalid ${key}`);
    const result = String(value).trim();
    if (result.length > limit) throw new TypeError(`${key} is too long`);
    if (result) return result;
  }
  return '';
};
const boolean = value => {
  if ([true, 1, '1', 'true'].includes(value)) return true;
  if ([false, 0, '0', 'false'].includes(value)) return false;
  throw new TypeError('Invalid source boolean');
};
const date = value => {
  if (value == null || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string') throw new TypeError('Invalid source timestamp');
  // MySQL timestamps have no offset; the import contract treats them as UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + 'Z' : value;
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) throw new TypeError('Source timestamp needs a timezone');
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError('Invalid source timestamp');
  return parsed;
};

export function mapSyncedUser(entry, source) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Invalid user row');
  const firstName = text(entry, ['firstName', 'first_name', 'firstname', 'given_name']);
  const middleName = text(entry, ['middleName', 'middle_name', 'middlename']);
  const lastName = text(entry, ['lastName', 'last_name', 'lastname', 'surname', 'family_name']);
  const extensionName = text(entry, ['extensionName', 'extension_name']);
  const academicStatus = text(entry, ['academicStatus', 'academic_status', 'academicstatus', 'enrollment_status', 'status']);
  const sourceUserType = text(entry, ['sourceUserType', 'source_user_type', 'role', 'user_type', 'usertype', 'account_type', 'type'], 50).toLowerCase();
  const explicitRole = text(entry, ['role'], 50).toLowerCase();
  let role = explicitRole || sourceUserType;
  if (['graduate', 'graduates', 'alumnus', 'alumna'].includes(role)) role = 'alumni';
  if (source === 'alumni') role = 'alumni';
  else if (!role && source === 'student') role = /graduat|alum/i.test(academicStatus) ? 'alumni' : 'student';
  const result = {
    name: text(entry, ['name', 'full_name', 'fullname', 'complete_name'], 1024)
      || [firstName, middleName, lastName, extensionName].filter(Boolean).join(' '),
    email: text(entry, ['email', 'email_address', 'school_email', 'emailaddress']).toLowerCase(),
    role,
    studentId: text(entry, ['studentId', 'student_number', 'student_id', 'studentid', 'student_no', 'id_number'], 100),
    program: text(entry, ['program', 'course', 'program_course', 'degree']),
    yearLevel: text(entry, ['yearLevel', 'year_level', 'yearlevel', 'year', 'level']),
    section: text(entry, ['section', 'class_section', 'block']),
    academicStatus: academicStatus || (source === 'alumni' ? 'Graduated' : ''),
    contactNumber: text(entry, ['contactNumber', 'contact_number', 'contactnumber', 'contact_no', 'mobile', 'phone', 'cp_number'], 60),
  };
  for (const [key, value, aliases] of [
    ['firstName', firstName, ['firstName', 'first_name', 'firstname', 'given_name']],
    ['middleName', middleName, ['middleName', 'middle_name', 'middlename']],
    ['lastName', lastName, ['lastName', 'last_name', 'lastname', 'surname', 'family_name']],
    ['extensionName', extensionName, ['extensionName', 'extension_name']],
    ['sourceUserType', sourceUserType, ['sourceUserType', 'source_user_type']],
  ]) if (value || aliases.some(alias => own(entry, alias))) result[key] = value || null;

  for (const [key, aliases, limit] of [
    ['sourceId', ['sourceId', 'id'], 20],
    ['externalId', ['externalId', 'external_id'], 20],
    ['sourceStatus', ['sourceStatus', 'source_status', 'status'], 255],
    ['sourceVersion', ['sourceVersion', 'source_version'], 100],
    ['sourcePayloadHash', ['sourcePayloadHash', 'source_payload_hash'], 64],
  ]) {
    if (!aliases.some(alias => own(entry, alias))) continue;
    if (['sourceId', 'externalId'].includes(key)) {
      const raw = entry[aliases.find(alias => own(entry, alias))];
      if (typeof raw === 'number' && !Number.isSafeInteger(raw)) throw new TypeError('Send BIGINT identifiers as strings');
    }
    const value = text(entry, aliases, limit);
    if (value && ['sourceId', 'externalId'].includes(key) && !/^\d+$/.test(value)) throw new TypeError('Invalid source identifier');
    if (value && key === 'sourcePayloadHash' && !/^[a-f\d]{64}$/i.test(value)) throw new TypeError('Invalid source payload hash');
    result[key] = value || null;
  }
  for (const [key, aliases] of [
    ['sourceCreatedAt', ['sourceCreatedAt', 'created_at']],
    ['sourceUpdatedAt', ['sourceUpdatedAt', 'updated_at']],
    ['sourceEmailVerifiedAt', ['sourceEmailVerifiedAt', 'email_verified_at']],
    ['sourceLastLoginAt', ['sourceLastLoginAt', 'last_login_at']],
    ['lastSeenAt', ['lastSeenAt', 'last_seen_at']],
    ['sourceLastSeenAt', ['sourceLastSeenAt', 'source_last_seen_at']],
    ['sourceDeletedAt', ['sourceDeletedAt', 'source_deleted_at']],
  ]) {
    const alias = aliases.find(key => own(entry, key));
    if (alias) result[key] = date(entry[alias]);
  }
  for (const [key, aliases] of [
    ['sourceIsActive', ['sourceIsActive', 'is_active']],
    ['sourceFirstTimeLogin', ['sourceFirstTimeLogin', 'first_time_login']],
  ]) {
    const alias = aliases.find(key => own(entry, key));
    if (alias) result[key] = boolean(entry[alias]);
  }
  if (own(entry, 'avatar') || own(entry, 'profilePicture')) {
    const avatar = text(entry, ['profilePicture', 'avatar'], 2048);
    if (avatar && !(avatar.startsWith('/') && !/^[/\\]{2}|\\/.test(avatar))) {
      let url;
      try { url = new URL(avatar); } catch { throw new TypeError('Invalid avatar URL'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Invalid avatar URL');
    }
    result.profilePicture = avatar || null;
  }
  return result;
}
