import React, { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { gooeyToast as toast } from "goey-toast";
import { ArrowRight, CircleHelp, Eye, EyeOff, KeyRound, Mail, X } from "lucide-react";
import { useAuth } from "../context/useAuth";
import GraduationCapLoader from "../components/ui/GraduationCapLoader";
import clsuLogo from "../assets/logo/clsu_logo.png";
import "./login.css";

const errorToast = (title, description) => toast.error(title, { description });

const loginMessage = (message) =>
  /^invalid credentials?$/i.test(message?.trim() || "")
    ? "Invalid email or password. Please check your details and try again."
    : message;

const Login = () => {
  const {
    login,
    requestMagicLink,
    isAuthenticated,
    user,
    error: authError,
  } = useAuth();
  const helpDialog = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [authMode, setAuthMode] = useState("magic");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [magicMessage, setMagicMessage] = useState("");
  const [magicCooldown, setMagicCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = helpDialog.current;
    if (!helpOpen || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [helpOpen]);

  useEffect(() => {
    if (magicCooldown <= 0) return;
    const timer = setTimeout(
      () => setMagicCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [magicCooldown]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === "email") setMagicMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) return;
      errorToast(
        "Unable to log in",
        loginMessage(
          result.error ||
            authError ||
            "Please check your details and try again.",
        ),
      );
    } catch {
      errorToast(
        "Unable to log in",
        "Please try again. If the problem continues, check your internet connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e) => {
    e.preventDefault();
    if (loading || magicCooldown > 0) return;
    setMagicMessage("");
    setLoading(true);
    const result = await requestMagicLink(formData.email);
    setMagicCooldown(result.retryAfter || 0);
    if (result.success) {
      setMagicMessage(result.message);
    } else {
      errorToast(
        "Could not send login link",
        result.error || authError || "Please try again.",
      );
    }
    setLoading(false);
  };

  // Keep the cap visible during authentication and its animation window.
  // The destination's skeleton takes over only after the session is accepted.
  if (loading && authMode === "password") {
    return <GraduationCapLoader label="Signing you in" />;
  }

  // The chat provider remounts this page when the account changes. Use the
  // accepted session so that a remount cannot briefly show the login form.
  if (isAuthenticated) {
    return (
      <>
        <GraduationCapLoader label="Signing you in" />
        <Navigate
          to={user?.passwordSetupRequired ? "/setup-password" : "/"}
          replace
        />
      </>
    );
  }

  return (
    <>
      <div className="login-page min-h-screen bg-[var(--auth-background)] flex items-center justify-center p-4 font-sans">
        <div className="login-card w-full max-w-md lg:max-w-4xl grid grid-cols-1 lg:grid-cols-2">
          <div className="login-panel login-form-panel bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-brand/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="text-center mb-5">
                <img
                  src={clsuLogo}
                  alt="Central Luzon State University logo"
                  className="mx-auto mb-4 h-16 w-16 object-contain lg:hidden"
                />
                <h1 className="text-[19px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
                  Get started with{" "}
                  <span className="text-brand">SielAlumni</span>
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Start exploring smarter connections
                  <br />
                  and faster results with CLSU Alumni Network
                </p>
              </div>

              <div className="space-y-2.5">
                {authMode === "password" ? (
                  <form onSubmit={handleSubmit} className="space-y-2.5">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="Enter your email"
                        className="w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/15"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="login-password"
                          className="block text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-200"
                        >
                          Password
                        </label>
                        <Link
                          to="/forgot-password"
                          className="text-[10px] font-medium text-brand hover:text-brand transition-colors hover:underline underline-offset-2"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="login-password-wrap">
                        <input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          autoComplete="current-password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          placeholder="Enter your password"
                          className="login-password-input w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/15"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="login-password-toggle"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-pressed={showPassword}
                          aria-controls="login-password"
                        >
                          {showPassword ? (
                            <EyeOff size={16} aria-hidden="true" />
                          ) : (
                            <Eye size={16} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-8 mt-1 rounded-lg bg-zinc-900 text-white text-[12px] font-semibold tracking-wide transition-all duration-200 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-3 w-3"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Logging in...
                        </span>
                      ) : (
                        "Log in with email"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("magic");
                        setShowPassword(false);
                      }}
                      className="w-full h-7 text-[10.5px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 transition-colors"
                    >
                      Use single-use login instead
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleMagicLinkSubmit}
                    className="space-y-2.5"
                  >
                    <div>
                      <label className="block text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="Enter your email"
                        className="w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/15"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || magicCooldown > 0}
                      className="w-full h-8 rounded-lg bg-brand text-white text-[12px] font-semibold tracking-wide transition-all duration-200 hover:bg-brand disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-3 w-3"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Sending link...
                        </span>
                      ) : magicCooldown > 0 ? (
                        `Try again in ${magicCooldown}s`
                      ) : (
                        "Send single-use link"
                      )}
                    </button>

                    {magicMessage && (
                      <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-brand p-2 rounded-lg text-[11px] leading-relaxed">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 mt-0.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <path d="M22 4L12 14.01l-3-3" />
                        </svg>
                        <span>
                          {magicMessage} Check your email and click the secure
                          login link.
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setAuthMode("password")}
                      className="w-full h-7 text-[10.5px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 transition-colors"
                    >
                      Use password instead
                    </button>
                  </form>
                )}
              </div>

              <button type="button" className="login-help login-help-trigger" onClick={() => setHelpOpen(true)} aria-haspopup="dialog">
                <span className="login-help-icon"><CircleHelp size={20} aria-hidden="true" /></span>
                <span className="login-help-heading">
                  <span className="login-help-title">First time here?</span>
                  <span className="login-help-subtitle">Learn how to create your password</span>
                </span>
                <span className="login-help-label">Help <ArrowRight size={15} aria-hidden="true" /></span>
              </button>

              <dialog ref={helpDialog} className="login-help login-help-modal" aria-labelledby="login-help-title" aria-describedby="login-help-description" onClose={() => setHelpOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
                <div className="login-help-modal-inner">
                  <div className="login-help-modal-header">
                    <span className="login-help-icon"><CircleHelp size={24} aria-hidden="true" /></span>
                    <button type="button" className="login-help-close" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={20} aria-hidden="true" /></button>
                  </div>
                  <h2 id="login-help-title">Your first login, made easy</h2>
                  <p id="login-help-description">Use a single-use email link to sign in for the first time and create your password.</p>
                  <div className="login-help-content">
                  <ol className="login-help-steps">
                    <li>
                      <span className="login-help-number">1</span>
                      <div><strong>Start with a single-use link</strong><p>Enter your registered email and select “Send single-use link”.</p></div>
                      <Mail size={16} aria-hidden="true" />
                    </li>
                    <li>
                      <span className="login-help-number">2</span>
                      <div><strong>Check your inbox</strong><p>Open the secure login link sent to your email.</p></div>
                    </li>
                    <li>
                      <span className="login-help-number">3</span>
                      <div><strong>Create your password</strong><p>Follow the prompts to set up your password.</p></div>
                      <KeyRound size={16} aria-hidden="true" />
                    </li>
                  </ol>
                  <div className="login-help-next">
                    <KeyRound size={16} aria-hidden="true" />
                    <p><strong>All set for next time.</strong> Choose “Use password instead” and sign in with your email and new password.</p>
                  </div>
                  </div>
                  <button type="button" className="login-help-action" onClick={() => { setAuthMode("magic"); setShowPassword(false); setHelpOpen(false); }}>
                    {authMode === "password" ? "Use single-use login instead" : "Got it, let's get started"} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </dialog>

              <p className="text-center text-[9.5px] text-zinc-400 mt-5 leading-relaxed">
                By continuing, you agree to SielAlumni's{" "}
                <a
                  href="#"
                  className="text-zinc-600 dark:text-zinc-300 hover:text-brand font-medium transition-colors"
                >
                  Terms
                </a>{" "}
                &amp;{" "}
                <a
                  href="#"
                  className="text-zinc-600 dark:text-zinc-300 hover:text-brand font-medium transition-colors"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>

          <div className="login-panel bg-gradient-to-br from-brand via-brand to-brand rounded-xl border border-zinc-100 shadow-sm p-5 sm:p-6 relative overflow-hidden hidden lg:flex flex-col justify-center items-center text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand/30 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand/40 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="relative mb-5">
                {/* Green glow — outer, mas malaki */}
                <div className="absolute inset-0 rounded-full bg-brand blur-2xl opacity-80 scale-125"></div>

                {/* White glow — inner, mas maliit */}
                <div className="absolute inset-0 rounded-full bg-white blur-xl opacity-50 scale-110"></div>

                {/* Green ring — animated */}
                <div className="absolute inset-0 rounded-full ring-2 ring-brand/50 ring-offset-4 ring-offset-transparent animate-pulse"></div>

                {/* Logo container */}
                <div className="relative h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-black/20 overflow-hidden ring-1 ring-white/60">
                  <img
                    src={clsuLogo}
                    alt="CLSU Logo"
                    className="h-16 w-16 object-contain"
                  />
                </div>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-white mb-1.5">
                Alumni<span className="text-white/70">Link</span>
              </h2>
              <p className="text-[11.5px] text-white/70 leading-relaxed max-w-xs mb-6">
                The official alumni network of Central Luzon State University
              </p>

              <div className="w-full max-w-sm">
                {authMode === "magic" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-white/20"></div>
                      <div className="flex items-center gap-1.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3 text-white/60"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="20" height="16" x="2" y="4" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <span className="text-[9.5px] font-semibold text-white/60 uppercase tracking-wider">
                          Single-use login
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-white/20"></div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          1
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Enter your email
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          Use your registered email address
                        </p>
                      </div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          2
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Check your inbox
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          We'll send you a secure single-use login link
                        </p>
                      </div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          3
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Click to sign in
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          First-time users will be asked to create a new
                          password
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-white/20"></div>
                      <div className="flex items-center gap-1.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3 text-white/60"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="18"
                            height="11"
                            x="3"
                            y="11"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span className="text-[9.5px] font-semibold text-white/60 uppercase tracking-wider">
                          Password login
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-white/20"></div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          1
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Enter your credentials
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          Use the email and password you registered with
                        </p>
                      </div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          2
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Click "Log in"
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          You'll be signed in instantly
                        </p>
                      </div>
                    </div>

                    <div className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                      <div className="relative shrink-0">
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10.5px] font-bold shadow-lg shadow-brand/50 ring-2 ring-white/20">
                          3
                        </div>
                      </div>
                      <div className="flex-1 pt-0.5 text-left">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">
                          Forgot password?
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                          Use the "Forgot password?" link to reset it
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
