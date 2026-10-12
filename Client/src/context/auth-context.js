import { createContext } from 'react';

// Keep context identity independent of the provider's Fast Refresh updates.
export const AuthContext = createContext(null);
