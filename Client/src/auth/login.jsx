import React, { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { gooeyToast as toast } from "goey-toast";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/useAuth";
import GraduationCapLoader from "../components/ui/GraduationCapLoader";
import clsuLogo from "../assets/logo/clsu_logo.png";
import "./login.css";

const errorToast = (message) => toast.error(message);

const Login = () => {
  const { login, requestMagicLink, isAuthenticated, user, error: authError } = useAuth();
  const [authMode, setAuthMode] = useState("magic");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [magicMessage, setMagicMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === "email") setMagicMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(formData.email, formData.password);
    if (result.success) {
      return;
    } else {
      errorToast(result.error || authError || "Login failed");
    }
    setLoading(false);
  };

  const handleMagicLinkSubmit = async (e) => {
    e.preventDefault();
    setMagicMessage("");
    setLoading(true);
    const result = await requestMagicLink(formData.email);
    if (result.success) {
      setMagicMessage(result.message);
    } else {
      errorToast(result.error || authError || "Failed to send magic link");
    }
    setLoading(false);
  };

  // The chat provider remounts this page when the account changes. Use the
  // accepted session so that a remount cannot briefly show the login form.
  if (isAuthenticated) {
    return (
      <>
        <GraduationCapLoader label="Signing you in" />
        <Navigate to={user?.passwordSetupRequired ? "/setup-password" : "/"} replace />
      </>
    );
  }

  if (loading && authMode === "password") {
    return <GraduationCapLoader label="Signing you in" />;
  }

  return (
    <>
      <div className="login-page min-h-screen bg-[var(--auth-background)] flex items-center justify-center p-4 font-sans">
        <div className="login-card w-full max-w-md lg:max-w-4xl grid grid-cols-1 lg:grid-cols-2">
          <div className="login-panel bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 sm:p-6 relative overflow-hidden">
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
                      disabled={loading}
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

              <div className="flex items-center gap-3 my-3.5">
                <div className="flex-1 h-px bg-zinc-200"></div>
                <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-zinc-200"></div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full h-8 flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] font-medium text-zinc-700 dark:text-zinc-200 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200 active:scale-[0.99]"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  className="w-full h-8 flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] font-medium text-zinc-700 dark:text-zinc-200 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200 active:scale-[0.99]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                  </svg>
                  Continue with LinkedIn
                </button>
              </div>

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
