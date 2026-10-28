// Validate scalar values before using them in authentication query filters.
export const authEmail = value => {
    if (typeof value !== 'string') return null;
    const email = value.trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export const isOTP = value => typeof value === 'string' && value.length === 6 && /^[0-9]{6}$/.test(value);
