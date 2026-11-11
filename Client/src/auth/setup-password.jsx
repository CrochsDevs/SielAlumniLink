import { newPasswordError } from '../utils/password-policy';
import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

import GraduationCapLoader from "../components/ui/GraduationCapLoader";

const SetupPassword = () => {
  const navigate = useNavigate();
  const { user, setupPassword, loading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading || loading) {
    return <GraduationCapLoader label="Setting up your account" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.passwordSetupRequired !== true) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordError = newPasswordError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    const result = await setupPassword(newPassword, confirmPassword);
    setLoading(false);

    if (result.success) {
      navigate("/");
      return;
    }

    setError(result.error || "Password setup failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e6e6e6`] px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-zinc-900/5 border border-zinc-100">
        <div className="flex justify-center mb-5">
          <div className="h-12 w-12 rounded-xl bg-brand flex items-center justify-center shadow-md shadow-brand/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </div>

        <h1 className="text-center text-[22px] font-bold text-zinc-900 mb-2">
          Set your password
        </h1>
        <p className="text-center text-[12px] text-zinc-500 mb-6 leading-relaxed">
          Your CAIS login credentials are synced. Create a SielAlumni password
          to continue.
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-[12px] leading-relaxed mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 mt-0.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={15}
              placeholder="Enter a new password"
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12.5px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={15}
              placeholder="Confirm your new password"
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12.5px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 rounded-lg bg-brand text-white text-[12.5px] font-semibold tracking-wide transition-all duration-200 hover:bg-brand disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {loading ? "Setting up password..." : "Set password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupPassword;
