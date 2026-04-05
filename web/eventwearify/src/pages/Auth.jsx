import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/css/pages/Auth.css';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import logo from '../assets/logo.png';

const API_BASE_URL = 'http://localhost:8080/api/auth';

// ── Security: Whitelist allowed error parameters ──
const ALLOWED_OAUTH_ERRORS = ['not_registered', 'oauth_failed', 'cancelled', 'access_denied'];

// ── Security: Predefined error messages (prevent XSS via backend messages) ──
const ERROR_MESSAGES = {
  EMAIL_EXISTS: 'This email is already registered. Please use a different email or sign in.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  WEAK_PASSWORD: 'Password does not meet security requirements.',
  SERVER_ERROR: 'Unable to connect to server. Please try again.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </g>
  </svg>
);

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  
  const navigate = useNavigate();

  // ── Security: Validate and handle OAuth2 errors ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    // Security: Only process whitelisted error codes
    if (error && ALLOWED_OAUTH_ERRORS.includes(error)) {
      if (error === 'not_registered') {
        showToast(
          'No EventWear account found for this Google email. Please sign up first.',
          'error'
        );
        setIsLogin(true);
      } else if (error === 'oauth_failed') {
        showToast('Google sign-in failed. Please try again.', 'error');
      } else if (error === 'cancelled' || error === 'access_denied') {
        showToast('Google sign-in was cancelled. Please try again if you wish to continue.', 'info');
      }
      
      // Clean URL to prevent re-showing error on refresh
      window.history.replaceState({}, '', '/auth');
    } else if (error) {
      // Security: Log unknown error codes but don't display them
      console.warn('Unknown OAuth error parameter:', error);
      window.history.replaceState({}, '', '/auth');
    }

    // Reset loading state in case user used browser back button
    setIsGoogleLoading(false);
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 5000);
  };

  const checkPasswordStrength = (password) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'password') {
      checkPasswordStrength(value);
    }
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleGuestContinue = () => {
    localStorage.setItem("isAuthenticated", "false");
    localStorage.setItem("userRole", "GUEST");
    localStorage.setItem("userEmail", "guest@example.com");
    navigate('/home'); 
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    
    // Track OAuth flow start (for analytics/timeout detection)
    sessionStorage.setItem('oauthStartTime', Date.now().toString());
    
    window.location.href = isLogin
      ? 'http://localhost:8080/oauth2/authorization/google'
      : 'http://localhost:8080/oauth2/authorization/google-register';
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const password = formData.password;
      const passwordErrors = [];
      if (password.length < 8) passwordErrors.push('at least 8 characters');
      if (!/[A-Z]/.test(password)) passwordErrors.push('one uppercase letter');
      if (!/[a-z]/.test(password)) passwordErrors.push('one lowercase letter');
      if (!/[0-9]/.test(password)) passwordErrors.push('one number');
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) passwordErrors.push('one special character');
      if (passwordErrors.length > 0) {
        newErrors.password = `Password must contain ${passwordErrors.join(', ')}`;
      }
    }
    
    if (!isLogin) {
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      } else if (!/^[a-zA-Z\s]+$/.test(formData.firstName)) {
        newErrors.firstName = 'Only letters and spaces allowed';
      } else if (formData.firstName.trim().length < 2) {
        newErrors.firstName = 'First name must be at least 2 characters';
      }
      
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      } else if (!/^[a-zA-Z\s]+$/.test(formData.lastName)) {
        newErrors.lastName = 'Only letters and spaces allowed';
      } else if (formData.lastName.trim().length < 2) {
        newErrors.lastName = 'Last name must be at least 2 characters';
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Security: Handle backend errors safely ────────────────────────────────
  const handleBackendError = (data) => {
    // Security: Use predefined messages instead of echoing backend strings
    if (data.errorCode && ERROR_MESSAGES[data.errorCode]) {
      showToast(ERROR_MESSAGES[data.errorCode], 'error');
      return;
    }

    // Handle specific known error patterns
    if (data.message) {
      const msg = data.message.toLowerCase();
      if (msg.includes('email') && msg.includes('already')) {
        showToast(ERROR_MESSAGES.EMAIL_EXISTS, 'error');
      } else if (msg.includes('password')) {
        showToast(ERROR_MESSAGES.WEAK_PASSWORD, 'error');
      } else if (msg.includes('invalid') && msg.includes('credentials')) {
        showToast(ERROR_MESSAGES.INVALID_CREDENTIALS, 'error');
      } else {
        // Generic error - don't echo potentially unsafe message
        showToast(ERROR_MESSAGES.SERVER_ERROR, 'error');
      }
    } else {
      showToast(ERROR_MESSAGES.SERVER_ERROR, 'error');
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          handleBackendError(data);
          setIsLoading(false);
          return;
        }

        // Security: Validate token exists before storing
        if (!data.token) {
          showToast(ERROR_MESSAGES.SERVER_ERROR, 'error');
          setIsLoading(false);
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userRole", data.role);
        localStorage.setItem("userEmail", data.email);
        localStorage.setItem("firstName", data.firstName);
        localStorage.setItem("lastName", data.lastName);

        if (onLogin) onLogin();

        if (data.role === 'ADMIN') {
          if (data.mustChangePassword === true) {
            localStorage.setItem("firstLogin", "true");
            navigate('/admin/change-password');
          } else {
            sessionStorage.setItem("showLoginSuccess", "true");
            navigate('/admin/dashboard');
          }
        } else {
          sessionStorage.setItem("showLoginSuccess", "true");
          navigate('/dashboard');
        }

      } else {
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            password: formData.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.validationErrors && Object.keys(data.validationErrors).length > 0) {
            Object.entries(data.validationErrors).forEach(([field, message]) => {
              if (field !== 'password') {
                // Security: Use safe error handling
                handleBackendError({ message });
              } else {
                setErrors(prev => ({ ...prev, [field]: message }));
              }
            });
          } else {
            handleBackendError(data);
          }
          setIsLoading(false);
          return;
        }

        showToast("Account created successfully! You can now login.", 'success');

        setIsLogin(true);
        setFormData({
          firstName: '',
          lastName: '',
          email: formData.email,
          password: '',
          confirmPassword: ''
        });
        setErrors({});
        setPasswordStrength({
          hasMinLength: false,
          hasUpperCase: false,
          hasLowerCase: false,
          hasNumber: false,
          hasSpecialChar: false
        });
      }

    } catch (err) {
      console.error('Network error:', err);
      showToast(ERROR_MESSAGES.SERVER_ERROR, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    navigate('/forgot-password');
  };

  const clearForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    setPasswordStrength({
      hasMinLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumber: false,
      hasSpecialChar: false
    });
  };

  const getPasswordStrengthPercentage = () => {
    const requirements = Object.values(passwordStrength);
    const metCount = requirements.filter(Boolean).length;
    return (metCount / requirements.length) * 100;
  };

  const getPasswordStrengthColor = () => {
    const percentage = getPasswordStrengthPercentage();
    if (percentage < 40) return '#ef4444';
    if (percentage < 70) return '#f59e0b';
    return '#10b981';
  };

  const getPasswordStrengthText = () => {
    const percentage = getPasswordStrengthPercentage();
    if (percentage < 40) return 'Weak';
    if (percentage < 70) return 'Medium';
    return 'Strong';
  };

  return (
    <div className="auth-wrapper">
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="auth-card">
        <button 
          className="back-btn" 
          onClick={() => navigate('/')}
          disabled={isLoading}
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>

        <div className="auth-header">
          <div className="auth-logo-container">
            <img src={logo} alt="EventWear Logo" className="auth-brand-logo" />
          </div>
          <h1 className="auth-title">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="auth-subtitle">
            {isLogin 
              ? 'Sign in to manage your bookings and rentals' 
              : 'Join EventWear to get started with premium rentals'
            }
          </p>
        </div>

        <div className="auth-toggle">
          <button 
            type="button"
            className={`toggle-btn ${isLogin ? 'active' : ''}`} 
            onClick={() => { setIsLogin(true); setErrors({}); }}
            disabled={isLoading}
          >
            Sign In
          </button>
          <button 
            type="button"
            className={`toggle-btn ${!isLogin ? 'active' : ''}`} 
            onClick={() => { setIsLogin(false); setErrors({}); }}
            disabled={isLoading}
          >
            Create Account
          </button>
        </div>

        {/* ── Google OAuth Button ── */}
        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <>
              <span className="loading-spinner"></span>
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>{isLogin ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </>
          )}
        </button>

        <div className="separator"><span>or</span></div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="name-row">
              <div className={`input-group ${errors.firstName ? 'has-error' : ''}`}>
                <label>First Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input 
                    type="text" 
                    name="firstName" 
                    placeholder="Juan" 
                    value={formData.firstName} 
                    onChange={handleChange} 
                    className={errors.firstName ? 'error-input' : ''}
                    disabled={isLoading}
                    maxLength={50}
                  />
                </div>
                {errors.firstName && (
                  <div className="error-message">
                    <AlertCircle size={12}/>{errors.firstName}
                  </div>
                )}
              </div>
              <div className={`input-group ${errors.lastName ? 'has-error' : ''}`}>
                <label>Last Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input 
                    type="text" 
                    name="lastName" 
                    placeholder="Dela Cruz" 
                    value={formData.lastName} 
                    onChange={handleChange} 
                    className={errors.lastName ? 'error-input' : ''}
                    disabled={isLoading}
                    maxLength={50}
                  />
                </div>
                {errors.lastName && (
                  <div className="error-message">
                    <AlertCircle size={12}/>{errors.lastName}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`input-group ${errors.email ? 'has-error' : ''}`}>
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                name="email" 
                placeholder="you@example.com" 
                value={formData.email} 
                onChange={handleChange} 
                className={errors.email ? 'error-input' : ''}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <div className="error-message">
                <AlertCircle size={12}/>{errors.email}
              </div>
            )}
          </div>

          <div className={`input-group ${errors.password ? 'has-error' : ''}`}>
            <label>Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={handleChange} 
                className={errors.password ? 'error-input' : ''}
                disabled={isLoading}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button 
                type="button" 
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <div className="error-message">
                <AlertCircle size={12}/>{errors.password}
              </div>
            )}
            
            {!isLogin && formData.password && (
              <div className="password-strength-container">
                <div className="strength-bar-container">
                  <div 
                    className="strength-bar" 
                    style={{ 
                      width: `${getPasswordStrengthPercentage()}%`,
                      backgroundColor: getPasswordStrengthColor()
                    }}
                  ></div>
                </div>
                <span className="strength-text" style={{ color: getPasswordStrengthColor() }}>
                  {getPasswordStrengthText()} Password
                </span>
              </div>
            )}

            {!isLogin && (
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
            )}
          </div>

          {isLogin && (
            <div className="forgot-pass">
              <a href="#" onClick={handleForgotPassword}>Forgot password?</a>
            </div>
          )}

          {!isLogin && (
            <div className={`input-group ${errors.confirmPassword ? 'has-error' : ''}`}>
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  name="confirmPassword" 
                  placeholder="••••••••" 
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
                  <AlertCircle size={12}/>{errors.confirmPassword}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'} 
                <ArrowRight size={18} />
              </>
            )}
          </button>
          
          <button 
            type="button" 
            className="clear-btn"
            onClick={clearForm}
            disabled={isLoading}
          >
            Clear Form
          </button>
        </form>

        <div className="auth-footer">
          <p className="switch-text">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button" 
              className="switch-btn"
              onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
              disabled={isLoading}
            >
              {isLogin ? ' Sign up here' : ' Sign in here'}
            </button>
          </p>
          
          <div className="separator"><span>or</span></div>
          
          <p className="guest-text">Just browsing?</p>
          <button 
            type="button" 
            className="guest-btn" 
            onClick={handleGuestContinue}
            disabled={isLoading}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;