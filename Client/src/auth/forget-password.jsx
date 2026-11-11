import { newPasswordError } from "../utils/password-policy";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import GraduationCapLoader from "../components/ui/GraduationCapLoader";
import clsuLogo from "../assets/logo/clsu_logo.png";
import "./forget-password.css";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/axios";
import VerificationCodeInput from "./VerificationCodeInput";
import { scrollToTop } from "../lib/scroll";

const COOLDOWN_KEY = "siel-password-reset-cooldown";
const readCooldown = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(COOLDOWN_KEY));
    if (typeof saved?.email === "string" && Number.isFinite(saved.until))
      return saved;
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  return { email: "", until: 0 };
};

const ForgetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [complete, setComplete] = useState(false);
  const redirectTimer = useRef(null);
  const headingRef = useRef(null);
  const otpRef = useRef(null);
  const sendingOtpRef = useRef(false);
  const [cooldown, setCooldown] = useState(readCooldown);
  const [clock, setClock] = useState(Date.now);
  const normalizedEmail = email.trim().toLowerCase();
  const resendSeconds =
    cooldown.email === normalizedEmail
      ? Math.max(0, Math.ceil((cooldown.until - clock) / 1000))
      : 0;
  useEffect(() => {
    if (!cooldown.until) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= cooldown.until) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [cooldown.until]);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);
  useEffect(() => {
    if (step === 2) otpRef.current?.focus({ preventScroll: true });
    else if (step > 1) headingRef.current?.focus({ preventScroll: true });
    scrollToTop();
  }, [step]);

  const handleSendOTP = async (e, isResend = false) => {
    e.preventDefault();
    if (loading || complete || sendingOtpRef.current) return;
    if (cooldown.email === normalizedEmail && cooldown.until > Date.now())
      return;
    sendingOtpRef.current = true;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });
      if (response.data.success) {
        const sentAt = Date.now();
        const nextCooldown = { email: normalizedEmail, until: sentAt + 60000 };
        setCooldown(nextCooldown);
        setClock(sentAt);
        try {
          sessionStorage.setItem(COOLDOWN_KEY, JSON.stringify(nextCooldown));
        } catch {
          /* Keep the in-memory timer if storage is unavailable. */
        }
        setOtp("");
        setResetToken("");
        setMessage(
          isResend
            ? "A new code has been sent. Please use the latest code from your email."
            : "OTP sent to your email! Valid for 10 minutes.",
        );
        setStep(2);
        if (isResend) otpRef.current?.focus();
      } else {
        setError(
          response.data.message || "Unable to send the code. Please try again.",
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      sendingOtpRef.current = false;
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (loading || complete) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/auth/verify-otp", { email, otp });
      if (response.data.success) {
        setResetToken(response.data.data.resetToken);
        setMessage("OTP verified! Create your new password.");
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (loading || complete) return;
    setError("");
    setMessage("");
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
    try {
      const response = await api.post("/auth/reset-password", {
        token: resetToken,
        newPassword,
      });
      if (response.data.success) {
        setMessage("Password reset successful! Redirecting to login...");
        setComplete(true);
        redirectTimer.current = setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Your email", "Verify code", "New password"];
  const titles = [
    "Forgot your password?",
    "Check your inbox",
    "Create a new password",
  ];
  const descriptions = [
    "No worries. We'll help you get back into your account.",
    "Enter the 6-digit code we sent to your registered email.",
    "Choose a password you can remember and keep it private.",
  ];
  const submitLabels = ["Send reset code", "Verify code", "Reset password"];
  const loadingLabels = [
    "Sending code...",
    "Verifying...",
    "Updating password...",
  ];

  return (
    <main className="password-recovery">
      <div className="recovery-shell">
        <div className="recovery-card">
          <section
            className="recovery-form-panel"
            aria-labelledby="recovery-title"
          >
            <h1 id="recovery-title" tabIndex={-1} ref={headingRef}>
              {complete ? "You're all set!" : titles[step - 1]}
            </h1>
            <p className="recovery-description">
              {complete
                ? "Your password has been updated. You can sign in again."
                : descriptions[step - 1]}
            </p>
            <ol
              className="recovery-progress"
              aria-label="Password recovery progress"
            >
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={
                    complete || step > index + 1
                      ? "is-complete"
                      : step === index + 1
                        ? "is-current"
                        : ""
                  }
                  aria-current={
                    !complete && step === index + 1 ? "step" : undefined
                  }
                >
                  <span>
                    {complete || step > index + 1 ? (
                      <Check size={13} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <small>{label}</small>
                </li>
              ))}
            </ol>
            {error && (
              <div className="recovery-error" role="alert">
                {error}
              </div>
            )}
            {message && !complete && (
              <p className="recovery-message" role="status">
                <CheckCircle2 size={15} />
                {message}
              </p>
            )}
            {!complete ? (
              <form
                onSubmit={
                  step === 1
                    ? handleSendOTP
                    : step === 2
                      ? handleVerifyOTP
                      : handleResetPassword
                }
                className="recovery-form"
                aria-busy={loading}
              >
                {step === 1 && (
                  <div className="recovery-field">
                    <label htmlFor="recovery-email">Email address</label>
                    <div className="recovery-input-wrap">
                      <Mail size={17} aria-hidden="true" />
                      <input
                        id="recovery-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <p>Use the email linked to your SielAlumni account.</p>
                  </div>
                )}
                {step === 2 && (
                  <>
                    <div className="recovery-email-summary">
                      <Mail size={18} />
                      <div>
                        <span>Code sent to</span>
                        <strong>{email}</strong>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setStep(1);
                          setOtp("");
                          setError("");
                          setMessage("");
                        }}
                      >
                        Change
                      </button>
                    </div>
                    <div className="recovery-field">
                      <label htmlFor="recovery-otp">Verification code</label>
                      <VerificationCodeInput
                        value={otp}
                        onChange={setOtp}
                        inputRef={otpRef}
                        disabled={loading}
                      />
                      <p id="recovery-otp-help">
                        Enter or paste the 6-digit code. It is valid for 10
                        minutes.
                      </p>
                    </div>
                    <div className="recovery-resend">
                      <span>Didn't receive the code?</span>
                      <button
                        type="button"
                        onClick={(event) => handleSendOTP(event, true)}
                        disabled={loading || resendSeconds > 0}
                      >
                        {loading
                          ? "Please wait..."
                          : resendSeconds > 0
                            ? `Resend code (${resendSeconds}s)`
                            : "Resend code"}
                      </button>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="recovery-field">
                      <label htmlFor="recovery-password">New password</label>
                      <div className="recovery-input-wrap">
                        <LockKeyhole size={17} aria-hidden="true" />
                        <input
                          id="recovery-password"
                          name="newPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Create a new password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          aria-describedby="recovery-password-help"
                          required
                          disabled={loading}
                        />
                        <button
                          className="recovery-password-toggle"
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={
                            showPassword ? "Hide passwords" : "Show passwords"
                          }
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <EyeOff size={17} />
                          ) : (
                            <Eye size={17} />
                          )}
                        </button>
                      </div>
                      <p id="recovery-password-help">
                        Use at least 15 characters.
                      </p>
                    </div>
                    <div className="recovery-field">
                      <label htmlFor="recovery-confirm">Confirm password</label>
                      <div className="recovery-input-wrap">
                        <LockKeyhole size={17} aria-hidden="true" />
                        <input
                          id="recovery-confirm"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Re-enter your new password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </>
                )}
                {loading && (
                  <GraduationCapLoader
                    fullScreen={false}
                    compact
                    className="graduation-cap-loader--inline"
                    label={
                      step === 1
                        ? "Sending reset code"
                        : step === 2
                          ? "Verifying your code"
                          : "Resetting your password"
                    }
                  />
                )}
                <button
                  className="recovery-submit"
                  type="submit"
                  disabled={loading || (step === 1 && resendSeconds > 0)}
                >
                  {loading
                    ? loadingLabels[step - 1]
                    : step === 1 && resendSeconds > 0
                      ? `Send again in ${resendSeconds}s`
                      : submitLabels[step - 1]}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            ) : (
              <div className="recovery-success" role="status">
                <p>Taking you back to login...</p>
                <Link to="/login" className="recovery-submit">
                  Continue to login
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
            <Link to="/login" className="recovery-back">
              <ArrowLeft size={13} />
              Back to login
            </Link>
            <p className="recovery-footer">
              <ShieldCheck size={14} />A secure way back to your account
            </p>
          </section>
          <aside className="recovery-story" aria-label="Account recovery guide">
            <div className="recovery-logo">
              <img src={clsuLogo} alt="CLSU Logo" />
            </div>
            <h2>
              Alumni<span>Link</span>
            </h2>
            <p>The official alumni network of Central Luzon State University</p>
            <div className="recovery-guide-heading">
              <span />
              <LockKeyhole size={12} />
              <strong>Password recovery</strong>
              <span />
            </div>
            <div className="recovery-guide">
              {[
                [
                  "1",
                  "Enter your email",
                  "Use the email registered to your account.",
                ],
                [
                  "2",
                  "Verify your code",
                  "Check your inbox for the 6-digit code.",
                ],
                [
                  "3",
                  "Create a new password",
                  "Set a new password and sign back in.",
                ],
              ].map(([index, title, description]) => (
                <div key={index}>
                  <span>{index}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default ForgetPassword;
