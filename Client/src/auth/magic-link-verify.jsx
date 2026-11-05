import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

import GraduationCapLoader from "../components/ui/GraduationCapLoader";

const MagicLinkVerification = () => {
  const navigate = useNavigate();
  const { verifyMagicLink } = useAuth();
  const token = new URLSearchParams(window.location.search).get("token");
  const hasVerified = useRef(false);
  const [status, setStatus] = useState(token ? "checking" : "error");
  const [message, setMessage] = useState(
    token ? "" : "Missing verification token.",
  );

  useEffect(() => {
    if (!token || hasVerified.current) {
      return;
    }

    hasVerified.current = true;

    verifyMagicLink(token).then((result) => {
      if (result.success) {
        setStatus("success");
        navigate(result.user?.passwordSetupRequired ? "/setup-password" : "/", {
          replace: true,
        });
      } else {
        setStatus("error");
        setMessage(result.error || "Invalid or expired login link.");
      }
    });
  }, [token, navigate, verifyMagicLink]);

  if (status === "checking" || status === "success") {
    return <GraduationCapLoader label="Verifying your login link" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--auth-background)] px-6">
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
          Verify your login link
        </h1>
        <p className="text-center text-[12px] text-zinc-500 mb-6 leading-relaxed">
          {status === "checking" && "Checking your secure login link..."}
          {status === "success" && "Login link verified. Redirecting..."}
          {status === "error" && "We could not verify this login link."}
        </p>

        {(message ||
          (status === "error" &&
            "Please request a new login link from the login page.")) && (
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
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span>
              {message ||
                "Please request a new login link from the login page."}
            </span>
          </div>
        )}

        {status === "error" && (
          <a
            href="/login"
            className="flex items-center justify-center h-9 w-full rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold hover:bg-zinc-800 transition-colors"
          >
            Back to login
          </a>
        )}
      </div>
    </div>
  );
};

export default MagicLinkVerification;
