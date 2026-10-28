import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3002/api",
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.response.use(response => {
  if (response.data?.reauthenticationRequired) window.dispatchEvent(new Event('auth:expired'));
  return response;
}, error => {
  const path = error.config?.url || '';
  // Failed sign-in credentials do not invalidate an unrelated current session.
  if (error.response?.status === 401 && !/^\/auth\/(login|verify-otp|reset-password|magic-link)/.test(path)) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  return Promise.reject(error);
});

export default api;
