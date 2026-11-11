// Validate scalar values before using them in authentication query filters.
export const authEmail = value => {
    if (typeof value !== 'string') return null;
    const email = value.trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export const isOTP = value => typeof value === 'string' && value.length === 6 && /^[0-9]{6}$/.test(value);

// Bcrypt only processes the first 72 UTF-8 bytes. Reject, never silently truncate.
export const newPasswordError = value => {
    if (typeof value !== 'string') return 'Please provide a valid password';
    if ([...value].length < 15) return 'Use at least 15 characters for your new password';
    if (Buffer.byteLength(value, 'utf8') > 72) return 'Password must not exceed 72 UTF-8 bytes';
    return null;
};
