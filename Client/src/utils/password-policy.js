// Match the backend policy. Bcrypt has a 72-byte UTF-8 input limit.
export function newPasswordError(value) {
  if (typeof value !== 'string') return 'Please provide a valid password';
  if ([...value].length < 15) return 'Use at least 15 characters for your new password';
  if (new TextEncoder().encode(value).length > 72) return 'Password must not exceed 72 UTF-8 bytes';
  return null;
}
