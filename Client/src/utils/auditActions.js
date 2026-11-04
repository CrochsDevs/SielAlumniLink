export const AUDIT_ACTIONS = {
  login: 'Logged in', logout: 'Logged out', user_created: 'Created a user', user_updated: 'Updated a user',
  email_changed: 'Changed a login email', role_changed: 'Changed a role', account_disabled: 'Disabled an account',
  user_deleted: 'Removed a profile', user_graduated: 'Marked a user as graduated', users_synced: 'Synced users',
  post_deleted: 'Removed a post', comment_deleted: 'Removed a comment', post_blocked: 'Blocked a post',
  post_restored: 'Restored a post', comments_disabled: 'Disabled comments', comments_enabled: 'Enabled comments',
  author_restricted: 'Restricted feed access', author_unrestricted: 'Restored feed access',
};
export const auditLabel = action => AUDIT_ACTIONS[action] || String(action || 'Unknown action').replaceAll('_', ' ');
