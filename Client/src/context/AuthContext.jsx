import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../utils/axios';
import { connectSocket, disconnectSocket } from '../realtime/socket';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const didCheckAuth = useRef(false);
  const pendingMagicLinkVerification = useRef(null);
  const magicVerificationStarted = useRef(false);
  const authCheckVersion = useRef(0);

  const checkAuth = useCallback(async () => {
    if (didCheckAuth.current || magicVerificationStarted.current) {
      return;
    }

    didCheckAuth.current = true;
    const checkVersion = ++authCheckVersion.current;

    try {
      const response = await api.get('/auth/me');
      if (checkVersion !== authCheckVersion.current || magicVerificationStarted.current) {
        return;
      }

      if (response.data.success) {
        const data = response.data.data || null;
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      if (checkVersion === authCheckVersion.current && !magicVerificationStarted.current) {
        setUser(null);
      }
    } finally {
      if (checkVersion === authCheckVersion.current && !magicVerificationStarted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Presence socket follows auth state: online while logged in.
  useEffect(() => {
    if (user) {
      connectSocket();
    } else if (!loading) {
      disconnectSocket();
    }
  }, [user, loading]);

  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        setUser(response.data.data.user);
        return { success: true };
      }

      return { success: false, error: response.data.message || 'Login failed' };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const requestMagicLink = useCallback(async (email) => {
    try {
      setError(null);
      const response = await api.post('/auth/magic-link/send', { email });
      if (response.data.success) {
        return { success: true, message: response.data.message };
      }

      return { success: false, error: response.data.message || 'Failed to send magic link' };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send login link';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const verifyMagicLink = useCallback((token) => {
    if (pendingMagicLinkVerification.current?.token === token) {
      return pendingMagicLinkVerification.current.promise;
    }

    magicVerificationStarted.current = true;
    const magicCheckVersion = ++authCheckVersion.current;

    const promise = (async () => {
      try {
        setError(null);
        const response = await api.get('/auth/magic-link/verify', {
          params: { token }
        });
        if (response.data.success) {
          const user = response.data.data?.user || null;
          setUser(user);
          setLoading(false);
          return { success: true, user };
        }

        return { success: false, error: response.data.message || 'Invalid or expired login link' };
      } catch (err) {
        const message = err.response?.data?.message || 'Invalid or expired login link';
        setError(message);
        if (magicCheckVersion === authCheckVersion.current) {
          setLoading(false);
        }
        return { success: false, error: message };
      }
    })();

    pendingMagicLinkVerification.current = { token, promise };
    promise.then(() => {
      if (pendingMagicLinkVerification.current?.token === token) {
        pendingMagicLinkVerification.current = null;
      }
    });

    return promise;
  }, []);

  const setupPassword = useCallback(async (newPassword, confirmPassword) => {
    try {
      setError(null);
      const response = await api.post('/auth/password/setup', {
        newPassword,
        confirmPassword
      });
      if (response.data.success) {
        setUser(response.data.data.user);
        setLoading(false);
        return { success: true };
      }

      return { success: false, error: response.data.message || 'Password setup failed' };
    } catch (err) {
      const message = err.response?.data?.message || 'Password setup failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const signup = async (name, email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/signup', { name, email, password });
      if (response.data.success) {
        setUser(response.data.data.user);
        return { success: true };
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
      return { success: false, error: err.response?.data?.message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Re-fetch the current user (e.g. after editing own profile).
  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data || null);
      }
    } catch {
      // keep current user on failure
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      requestMagicLink,
      verifyMagicLink,
      setupPassword,
      signup,
      logout,
      refreshUser,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};