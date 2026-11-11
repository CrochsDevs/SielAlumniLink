import axios from "axios";
import { getRequestAccount } from '../auth/session-sync.js';

const api = axios.create({
  // Production uses the UI origin so Safari can keep the HttpOnly session cookie.
  baseURL: import.meta.env.PROD ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:3002/api"),
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use(config => {
  const path = config.url || '';
  // Sign-in and session discovery intentionally use whichever cookie is current.
  if (!/^\/auth\/(me|login|signup|magic-link|forgot-password|verify-otp|reset-password)(?:\/|\?|$)/.test(path)) {
    config.sessionAccountId = getRequestAccount();
    if (config.sessionAccountId) config.headers.set('X-Account-Id', config.sessionAccountId);
  }
  return config;
});

const belongsToPreviousAccount = config => {
  const current = getRequestAccount();
  // The revocation socket can arrive before the successful logout/password
  // response. Let those requests finish when they intentionally signed out.
  if (!current && /^\/auth\/(logout|password\/change)(?:\?|$)/.test(config?.url || '')) return false;
  return config?.sessionAccountId && config.sessionAccountId !== current;
};

api.interceptors.response.use(response => {
  if (belongsToPreviousAccount(response.config)) throw new axios.CanceledError('The browser account changed.');
  if (response.data?.reauthenticationRequired) window.dispatchEvent(new Event('auth:expired'));
  return response;
}, error => {
  if (belongsToPreviousAccount(error.config)) return Promise.reject(new axios.CanceledError('The browser account changed.'));
  if (error.response?.data?.code === 'SESSION_ACCOUNT_CHANGED') {
    window.dispatchEvent(new Event('auth:session-changed'));
    return Promise.reject(error);
  }
  const path = error.config?.url || '';
  // Failed sign-in credentials do not invalidate an unrelated current session.
  if (error.response?.status === 401 && !/^\/auth\/(login|verify-otp|reset-password|magic-link)/.test(path)) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  return Promise.reject(error);
});

export default api;
