import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/css/pages/AdminChangePassword.css';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import logo from '../assets/logo.png';

const API_BASE_URL = 'http://localhost:8080/api/auth';

const AdminChangePassword = () => {
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Guard: only accessible for admins on first login
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    const firstLogin = localStorage.getItem('firstLogin');

    if (role !== 'ADMIN' || firstLogin !== 'true') {
      if (role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'newPassword') checkPasswordStrength(value);
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const getPasswordStrengthPercentage = () => {
    const met = Object.values(passwordStrength).filter(Boolean).length;
    return (met / Object.values(passwordStrength).length) * 100;
  };

  const getPasswordStrengthColor = () => {
    const pct = getPasswordStrengthPercentage();
    if (pct < 40) return '#ef4444';
    if (pct < 70) return '#f59e0b';
    return '#10b981';
  };

  const getPasswordStrengthText = () => {
    const pct = getPasswordStrengthPercentage();
    if (pct < 40) return 'Weak';
    if (pct < 70) return 'Medium';
    return 'Strong';
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const p = formData.newPassword;
      const missing = [];
      if (p.length < 8) missing.push('at least 8 characters');
      if (!/[A-Z]/.test(p)) missing.push('one uppercase letter');
      if (!/[a-z]/.test(p)) missing.push('one lowercase letter');
      if (!/[0-9]/.test(p)) missing.push('one number');
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)) missing.push('one special character');
      if (missing.length > 0) {
        newErrors.newPassword = `Password must contain ${missing.join(', ')}`;
      }
      if (formData.newPassword === formData.currentPassword) {
        newErrors.newPassword = 'New password must be different from the current password';
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => navigate('/auth', { replace: true }), 1500);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        showToast('Unexpected server response. Please try again.', 'error');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        // 400 — Spring @Valid field-level errors
        if (response.status === 400 && data.validationErrors) {
          setErrors(data.validationErrors);
          setIsLoading(false);
          return;
        }

        // 401 — could be expired token OR wrong current password
        if (response.status === 401) {
          const msg = data.message || '';

          // Expired/invalid token → clear everything and go to login
          if (
            msg.toLowerCase().includes('expired') ||
            msg.toLowerCase().includes('session') ||
            msg.toLowerCase().includes('invalid token')
          ) {
            localStorage.clear();
            showToast('Session expired. Please log in again.', 'error');
            setTimeout(() => navigate('/auth', { replace: true }), 1500);
            return;
          }

          // Wrong current password
          if (
            msg.toLowerCase().includes('current') ||
            msg.toLowerCase().includes('incorrect') ||
            msg.toLowerCase().includes('password')
          ) {
            setErrors({ currentPassword: 'Current password is incorrect' });
            setIsLoading(false);
            return;
          }

          showToast(msg || 'Unauthorized. Please log in again.', 'error');
          setIsLoading(false);
          return;
        }

        // Any other error
        showToast(data.message || 'Failed to change password. Please try again.', 'error');
        setIsLoading(false);
        return;
      }

      // ── SUCCESS ──
      localStorage.removeItem('firstLogin');
      showToast('Password changed successfully! Redirecting...', 'success');
      setTimeout(() => navigate('/admin/dashboard', { replace: true }), 1500);

    } catch (err) {
      showToast('Unable to connect to server. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="change-password-wrapper">
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="change-password-card">
        <div className="change-password-header">
          <div className="change-password-logo-container">
            <img src={logo} alt="EventWear Logo" className="change-password-brand-logo" />
          </div>
          <div className="change-password-badge">
            <ShieldAlert size={12} />
            Admin — First Login
          </div>
          <h1 className="change-password-title">Set New Password</h1>
          <p className="change-password-subtitle">
            For your security, you must change the default admin password before continuing.
          </p>
        </div>

        <div className="info-banner">
          <Info size={16} />
          <span>
            Use the temporary password you received to verify your identity, then set a strong new password.
          </span>
        </div>

        <form className="change-password-form" onSubmit={handleSubmit} noValidate>

          {/* Current (Temporary) Password */}
          <div className={`input-group ${errors.currentPassword ? 'has-error' : ''}`}>
            <label>Current (Temporary) Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                name="currentPassword"
                placeholder="Enter your temporary password"
                value={formData.currentPassword}
                onChange={handleChange}
                className={errors.currentPassword ? 'error-input' : ''}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex="-1"
                disabled={isLoading}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.currentPassword && (
              <div className="error-message">
                <AlertCircle size={12} /> {errors.currentPassword}
              </div>
            )}
          </div>

          {/* New Password */}
          <div className={`input-group ${errors.newPassword ? 'has-error' : ''}`}>
            <label>New Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showNewPassword ? 'text' : 'password'}
                name="newPassword"
                placeholder="Create a strong password"
                value={formData.newPassword}
                onChange={handleChange}
                className={errors.newPassword ? 'error-input' : ''}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex="-1"
                disabled={isLoading}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && (
              <div className="error-message">
                <AlertCircle size={12} /> {errors.newPassword}
              </div>
            )}

            {formData.newPassword && (
              <div className="password-strength-container">
                <div className="strength-bar-container">
                  <div
                    className="strength-bar"
                    style={{
                      width: `${getPasswordStrengthPercentage()}%`,
                      backgroundColor: getPasswordStrengthColor(),
                    }}
                  />
                </div>
                <span className="strength-text" style={{ color: getPasswordStrengthColor() }}>
                  {getPasswordStrengthText()} Password
                </span>
              </div>
            )}

            <div className="password-requirements">
              {[
                { key: 'hasMinLength', label: 'At least 8 characters' },
                { key: 'hasUpperCase', label: 'One uppercase letter' },
                { key: 'hasLowerCase', label: 'One lowercase letter' },
                { key: 'hasNumber', label: 'One number' },
                { key: 'hasSpecialChar', label: 'One special character (!@#$%^&*)' },
              ].map(({ key, label }) => (
                <div key={key} className={`requirement-item ${passwordStrength[key] ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>{label}</span>
                  {passwordStrength[key] && <CheckCircle size={12} className="check-icon" />}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm New Password */}
          <div className={`input-group ${errors.confirmPassword ? 'has-error' : ''}`}>
            <label>Confirm New Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Re-enter your new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error-input' : ''}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <div className="error-message">
                <AlertCircle size={12} /> {errors.confirmPassword}
              </div>
            )}
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading-spinner" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                Set New Password
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminChangePassword;