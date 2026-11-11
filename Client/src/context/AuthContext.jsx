import React, { useState, useCallback, useEffect, useRef } from "react";
import { AuthContext } from "./auth-context.js";
import api from "../utils/axios";
import { confirmSession } from '../auth/confirm-session.js';
import { connectSocket, disconnectSocket, getSocket } from "../realtime/socket";
import { accountId, sessionIdentity, setRequestAccount, publishSessionChange, subscribeToSessionChanges } from '../auth/session-sync.js';

let reloadingSession = false;
const reloadBrowserSession = () => {
  if (reloadingSession) return;
  reloadingSession = true;
  disconnectSocket();
  window.location.replace('/');
};

const authErrorMessage = (err, fallback) => {
  if (err.message === 'Your sign-in session could not be saved. Please reload the page and try again.') return err.message;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
    return "The sign-in request timed out. Please try again.";
  }
  if (!err.response) {
    return "Cannot reach the sign-in server. Check your connection and make sure the backend is running.";
  }
  return fallback;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const didCheckAuth = useRef(false);
  const pendingMagicLinkVerification = useRef(null);
  const magicVerificationStarted = useRef(false);
  const authCheckVersion = useRef(0);
  const activeUser = useRef(null);
  const sessionLoaded = useRef(false);
  const updateUser = useCallback(next => {
    activeUser.current = next;
    setRequestAccount(next);
    setUser(next);
  }, []);
  const acceptSession = useCallback(next => {
    ++authCheckVersion.current;
    disconnectSocket();
    // A full navigation also discards page forms, calls and chat caches before
    // a different identity is allowed to use the new shared cookie.
    if (accountId(activeUser.current) && accountId(next) && accountId(activeUser.current) !== accountId(next)) {
      publishSessionChange();
      reloadBrowserSession();
      return;
    }
    updateUser(next);
    sessionLoaded.current = true;
    setLoading(false);
    setError(null);
    publishSessionChange();
  }, [updateUser]);
  const chatOwnerId = user?.authId || user?._id;
  useEffect(() => {
    const expired = () => {
      ++authCheckVersion.current;
      disconnectSocket();
      updateUser(null);
      sessionLoaded.current = true;
      setLoading(false);
      setError('Your session ended. Please sign in again.');
    };
    const socket = getSocket();
    socket.on('auth:revoked', expired);
    window.addEventListener('auth:expired', expired);
    return () => { socket.off('auth:revoked', expired); window.removeEventListener('auth:expired', expired); };
  }, [updateUser]);

  useEffect(() => {
    const unsubscribe = subscribeToSessionChanges(reloadBrowserSession);
    window.addEventListener('auth:session-changed', reloadBrowserSession);
    let pending = false, active = true;
    const revalidate = async () => {
      if (pending || document.visibilityState === 'hidden' || !sessionLoaded.current || magicVerificationStarted.current) return;
      pending = true;
      const version = authCheckVersion.current;
      try {
        const response = await api.get('/auth/me');
        if (!active || version !== authCheckVersion.current || response.data.success !== true) return;
        if (sessionIdentity(response.data.data || null) !== sessionIdentity(activeUser.current)) reloadBrowserSession();
      } catch { /* A network failure does not claim the current account changed. */ }
      finally { pending = false; }
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('auth:session-changed', reloadBrowserSession);
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, []);

  const checkAuth = useCallback(async () => {
    if (didCheckAuth.current || magicVerificationStarted.current) {
      return;
    }

    didCheckAuth.current = true;
    const checkVersion = ++authCheckVersion.current;

    try {
      const response = await api.get("/auth/me");
      if (
        checkVersion !== authCheckVersion.current ||
        magicVerificationStarted.current
      ) {
        return;
      }

      if (response.data.success) {
        const data = response.data.data || null;
        updateUser(data);
      } else {
        updateUser(null);
      }
    } catch {
      if (
        checkVersion === authCheckVersion.current &&
        !magicVerificationStarted.current
      ) {
        updateUser(null);
      }
    } finally {
      if (
        checkVersion === authCheckVersion.current &&
        !magicVerificationStarted.current
      ) {
        setLoading(false);
        sessionLoaded.current = true;
      }
    }
  }, [updateUser]);

  useEffect(() => {
    // Initial session lookup updates state only after the API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAuth();
  }, [checkAuth]);

  // Presence socket follows auth state: online while logged in.
  useEffect(() => {
    if (user && !user.passwordSetupRequired) {
      connectSocket();
    } else if (!loading) {
      disconnectSocket();
    }
  }, [user, loading]);

  const login = useCallback(async (email, password) => {
    const startedAt = Date.now();
    setSigningIn(true);
    try {
      setError(null);
      const response = await api.post("/auth/login", { email: email.trim(), password });
      if (response.data.success) {
        const verifiedUser = await confirmSession(api, response.data.data.user);
        // The cap animation takes 3.4s, including the returning tassel.
        // Allow a full cycle and a short settling period before entering.
        const remaining = 4000 - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        // A slower initial /auth/me response must not clear this new session.
        acceptSession(verifiedUser);
        return { success: true };
      }

      return { success: false, error: response.data.message || "Login failed" };
    } catch (err) {
      const message = authErrorMessage(err, "Login failed");
      setError(message);
      return { success: false, error: message };
    } finally {
      setSigningIn(false);
    }
  }, [acceptSession]);

  const requestMagicLink = useCallback(async (email) => {
    try {
      setError(null);
      const response = await api.post("/auth/magic-link/send", { email: email.trim() });
      if (response.data.success) {
        return { success: true, message: response.data.message, retryAfter: 60 };
      }

      return {
        success: false,
        error: response.data.message || "Failed to send magic link",
      };
    } catch (err) {
      const limited = err.response?.status === 429;
      const unavailable = !err.response;
      const seconds = Number(err.response?.headers?.['retry-after']);
      const retryAfter = limited || unavailable
        ? (Number.isFinite(seconds) && seconds > 0 ? Math.min(900, Math.ceil(seconds)) : 60) : 0;
      const message = limited
        ? `Too many login-link requests. Please wait ${retryAfter} seconds and try again.`
        : unavailable
          ? 'The email request could not be completed. Please wait a minute and try again.'
          : authErrorMessage(err, "Failed to send login link");
      setError(message);
      return { success: false, error: message, retryAfter };
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
        const response = await api.get("/auth/magic-link/verify", {
          params: { token },
        });
        if (response.data.success) {
          const user = await confirmSession(api, response.data.data?.user);
          acceptSession(user);
          return { success: true, user };
        }

        return {
          success: false,
          error: response.data.message || "Invalid or expired login link",
        };
      } catch (err) {
        const message = authErrorMessage(err, "Invalid or expired login link");
        setError(message);
        return { success: false, error: message };
      } finally {
        if (magicCheckVersion === authCheckVersion.current) {
          setLoading(false);
          sessionLoaded.current = true;
        }
      }
    })();

    pendingMagicLinkVerification.current = { token, promise };
    promise.then(() => {
      if (pendingMagicLinkVerification.current?.token === token) {
        pendingMagicLinkVerification.current = null;
        magicVerificationStarted.current = false;
      }
    });

    return promise;
  }, [acceptSession]);

  const setupPassword = useCallback(async (newPassword, confirmPassword) => {
    try {
      setError(null);
      const response = await api.post("/auth/password/setup", {
        newPassword,
        confirmPassword,
      });
      if (response.data.success) {
        const verifiedUser = await confirmSession(api, response.data.data.user);
        acceptSession(verifiedUser);
        return { success: true };
      }

      return {
        success: false,
        error: response.data.message || "Password setup failed",
      };
    } catch (err) {
      const message = authErrorMessage(err, "Password setup failed");
      setError(message);
      return { success: false, error: message };
    }
  }, [acceptSession]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
      if (chatOwnerId) {
        try {
          localStorage.removeItem(`chatdock:${String(chatOwnerId)}`);
        } catch {
          // Storage access must not prevent a successful logout.
        }
      }
      acceptSession(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to complete logout. Please try again.");
      throw err;
    }
  }, [chatOwnerId, acceptSession]);

  // Re-fetch the current user (e.g. after editing own profile).
  const refreshUser = useCallback(async () => {
    const checkVersion = authCheckVersion.current;
    try {
      const response = await api.get("/auth/me");
      if (checkVersion === authCheckVersion.current && response.data.success) {
        const next = response.data.data || null;
        if (sessionIdentity(next) !== sessionIdentity(activeUser.current)) reloadBrowserSession();
        else updateUser(next);
      }
    } catch {
      // keep current user on failure
    }
  }, [updateUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        error,
        login,
        requestMagicLink,
        verifyMagicLink,
        setupPassword,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
