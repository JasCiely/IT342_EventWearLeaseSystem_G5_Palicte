import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import logo from '../assets/logo.png';
import '../components/css/pages/ForgotPassword.css';

const API_BASE_URL = 'http://localhost:8080/api/auth';

const STEPS = { EMAIL: 1, OTP: 2, RESET: 3, SUCCESS: 4 };

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.EMAIL);

  // Shared state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  const otpRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const checkPasswordStrength = (password) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    });
  };

  const getStrengthPercent = () => {
    const met = Object.values(passwordStrength).filter(Boolean).length;
    return (met / 5) * 100;
  };

  const getStrengthColor = () => {
    const p = getStrengthPercent();
    if (p < 40) return '#ef4444';
    if (p < 80) return '#f59e0b';
    return '#10b981';
  };

  const getStrengthLabel = () => {
    const p = getStrengthPercent();
    if (p < 40) return 'Weak';
    if (p < 80) return 'Medium';
    return 'Strong';
  };

  // ── Step 1: Send OTP ────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email address.'); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      // Always succeeds on backend (anti-enumeration) — just advance
      if (res.ok) {
        startResendCooldown();
        setStep(STEPS.OTP);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: OTP input handling ──────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      const data = await res.json();

      if (res.ok) {
        setStep(STEPS.RESET);
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      startResendCooldown();
      showToast('A new OTP has been sent to your email.', 'success');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Reset password ──────────────────────────────────────────────
  const handleResetPassword = async () => {
    setError('');
    const otpValue = otp.join('');

    if (!newPassword) { setError('Please enter a new password.'); return; }

    const missing = [];
    if (newPassword.length < 8) missing.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) missing.push('one uppercase letter');
    if (!/[a-z]/.test(newPassword)) missing.push('one lowercase letter');
    if (!/[0-9]/.test(newPassword)) missing.push('one number');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) missing.push('one special character');
    if (missing.length > 0) { setError(`Password must contain ${missing.join(', ')}.`); return; }

    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setStep(STEPS.SUCCESS);
      } else {
        setError(data.message || 'Failed to reset password. Please try again.');
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step indicators ─────────────────────────────────────────────────────
  const stepLabels = ['Email', 'Verify OTP', 'New Password'];
  const currentStepIndex = step === STEPS.SUCCESS ? 3 : step - 1;

  return (
    <div className="fp-wrapper">
      {toast.show && (
        <div className={`fp-toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="fp-card">
        {/* Back button */}
        <button className="fp-back-btn" onClick={() => navigate('/auth')} disabled={isLoading}>
          <ArrowLeft size={16} />
          <span>Back to Sign In</span>
        </button>

        {/* Logo + header */}
        <div className="fp-header">
          <div className="fp-logo-container">
            <img src={logo} alt="EventWear Logo" className="fp-brand-logo" />
          </div>
          <h1 className="fp-title">Reset Password</h1>
          <p className="fp-subtitle">We'll send a code to verify your identity</p>
        </div>

        {/* Step indicators — hidden on success */}
        {step !== STEPS.SUCCESS && (
          <div className="fp-steps">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`fp-step ${i < currentStepIndex ? 'done' : ''} ${i === currentStepIndex ? 'active' : ''}`}>
                  <div className="fp-step-circle">
                    {i < currentStepIndex ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
                  </div>
                  <span className="fp-step-label">{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`fp-step-line ${i < currentStepIndex ? 'done' : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── STEP 1: Email ── */}
        {step === STEPS.EMAIL && (
          <div className="fp-body">
            <p className="fp-instruction">
              Enter the email address linked to your EventWear account and we'll send you a 6-digit OTP.
            </p>
            <div className={`fp-input-group ${error ? 'has-error' : ''}`}>
              <label>Email Address</label>
              <div className="fp-input-wrapper">
                <Mail className="fp-input-icon" size={18} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {error && (
                <div className="fp-error">
                  <AlertCircle size={12} /> {error}
                </div>
              )}
            </div>
            <button className="fp-submit-btn" onClick={handleSendOtp} disabled={isLoading}>
              {isLoading ? (
                <><span className="fp-spinner" /><span>Sending OTP...</span></>
              ) : (
                <><span>Send OTP</span><ArrowRight size={18} /></>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === STEPS.OTP && (
          <div className="fp-body">
            <p className="fp-instruction">
              Enter the 6-digit code sent to <strong>{email}</strong>. It expires in 10 minutes.
            </p>
            <div className="fp-otp-row" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className={`fp-otp-input ${error ? 'otp-error' : ''} ${digit ? 'otp-filled' : ''}`}
                  disabled={isLoading}
                />
              ))}
            </div>
            {error && (
              <div className="fp-error centered">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <button className="fp-submit-btn" onClick={handleVerifyOtp} disabled={isLoading}>
              {isLoading ? (
                <><span className="fp-spinner" /><span>Verifying...</span></>
              ) : (
                <><span>Verify OTP</span><ArrowRight size={18} /></>
              )}
            </button>
            <button
              className="fp-resend-btn"
              onClick={handleResendOtp}
              disabled={isLoading || resendCooldown > 0}
            >
              <RefreshCw size={14} />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
            <button className="fp-change-email-btn" onClick={() => { setStep(STEPS.EMAIL); setError(''); setOtp(['','','','','','']); }}>
              Use a different email
            </button>
          </div>
        )}

        {/* ── STEP 3: New Password ── */}
        {step === STEPS.RESET && (
          <div className="fp-body">
            <p className="fp-instruction">
              Create a strong new password for <strong>{email}</strong>.
            </p>

            <div className={`fp-input-group ${error && !confirmPassword ? 'has-error' : ''}`}>
              <label>New Password</label>
              <div className="fp-input-wrapper">
                <Lock className="fp-input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); checkPasswordStrength(e.target.value); setError(''); }}
                  disabled={isLoading}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="fp-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {newPassword && (
                <>
                  <div className="fp-strength-bar-container">
                    <div className="fp-strength-bar" style={{ width: `${getStrengthPercent()}%`, backgroundColor: getStrengthColor() }} />
                  </div>
                  <span className="fp-strength-text" style={{ color: getStrengthColor() }}>
                    {getStrengthLabel()} Password
                  </span>
                </>
              )}

              <div className="fp-requirements">
                {[
                  { key: 'hasMinLength', label: 'At least 8 characters' },
                  { key: 'hasUpperCase', label: 'One uppercase letter' },
                  { key: 'hasLowerCase', label: 'One lowercase letter' },
                  { key: 'hasNumber', label: 'One number' },
                  { key: 'hasSpecialChar', label: 'One special character (!@#$%^&*)' },
                ].map(({ key, label }) => (
                  <div key={key} className={`fp-req-item ${passwordStrength[key] ? 'met' : ''}`}>
                    <span className="fp-req-dot">•</span>
                    <span>{label}</span>
                    {passwordStrength[key] && <CheckCircle size={12} className="fp-check-icon" />}
                  </div>
                ))}
              </div>
            </div>

            <div className={`fp-input-group ${error ? 'has-error' : ''}`}>
              <label>Confirm Password</label>
              <div className="fp-input-wrapper">
                <Lock className="fp-input-icon" size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button type="button" className="fp-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <div className="fp-error">
                  <AlertCircle size={12} /> {error}
                </div>
              )}
            </div>

            <button className="fp-submit-btn" onClick={handleResetPassword} disabled={isLoading}>
              {isLoading ? (
                <><span className="fp-spinner" /><span>Resetting...</span></>
              ) : (
                <><span>Reset Password</span><ArrowRight size={18} /></>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 4: Success ── */}
        {step === STEPS.SUCCESS && (
          <div className="fp-body fp-success-body">
            <div className="fp-success-icon">
              <ShieldCheck size={48} />
            </div>
            <h2 className="fp-success-title">Password Reset!</h2>
            <p className="fp-success-msg">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <button className="fp-submit-btn" onClick={() => navigate('/auth')}>
              <span>Back to Sign In</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;