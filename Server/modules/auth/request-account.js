// This optional header binds a page's expected identity to the cookie identity.
// It never grants access: normal cookie/session/role checks remain mandatory.
export function requestAccountMatches(req, user) {
  const expected = req.headers?.['x-account-id'];
  return expected === undefined || (typeof expected === 'string' && expected === String(user._id));
}

export const rejectChangedAccount = res => res.status(409).json({
  success: false,
  code: 'SESSION_ACCOUNT_CHANGED',
  message: 'Your browser account changed. Please refresh your session.',
});
