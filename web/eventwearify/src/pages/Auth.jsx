import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import logo from '../assets/logo.png';

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
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    // Auto hide after 2 seconds
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 2000);
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
    
    // Check password strength when password field changes
    if (name === 'password') {
      checkPasswordStrength(value);
    }
    
    // Clear error for this field if user starts typing
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

  const validateForm = () => {
    const newErrors = {};
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Stricter Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const password = formData.password;
      const errors = [];
      
      if (password.length < 8) {
        errors.push('at least 8 characters');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('one number');
      }
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        errors.push('one special character');
      }
      
      if (errors.length > 0) {
        newErrors.password = `Password must contain ${errors.join(', ')}`;
      }
    }
    
    // Registration-specific validations
    if (!isLogin) {
      // First name validation
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      } else if (!/^[a-zA-Z\s]+$/.test(formData.firstName)) {
        newErrors.firstName = 'Only letters and spaces allowed';
      } else if (formData.firstName.trim().length < 2) {
        newErrors.firstName = 'First name must be at least 2 characters';
      }
      
      // Last name validation
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      } else if (!/^[a-zA-Z\s]+$/.test(formData.lastName)) {
        newErrors.lastName = 'Only letters and spaces allowed';
      } else if (formData.lastName.trim().length < 2) {
        newErrors.lastName = 'Last name must be at least 2 characters';
      }
      
      // Confirm password validation
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setErrors({});

    // Simulate API call with timeout
    setTimeout(() => {
      if (isLogin) {
        // SIMULATED LOGIN
        console.log('Login attempt with:', {
          email: formData.email,
          password: formData.password
        });
        
        // Store authentication info (simulated)
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userRole", "USER");
        localStorage.setItem("userEmail", formData.email);
        
        // Call the onLogin callback
        if (onLogin) {
          onLogin();
        }
        
        navigate('/dashboard');
      } else {
        // SIMULATED REGISTRATION
        console.log('Registration attempt with:', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
        });
        
        showToast("Account created successfully! You can now login.", 'success');
        
        // Switch to login view with email pre-filled
        setIsLogin(true);
        setFormData({
          firstName: '',
          lastName: '',
          email: formData.email,
          password: '',
          confirmPassword: ''
        });
        
        // Clear errors
        setErrors({});
        // Reset password strength
        setPasswordStrength({
          hasMinLength: false,
          hasUpperCase: false,
          hasLowerCase: false,
          hasNumber: false,
          hasSpecialChar: false
        });
      }
      
      setIsLoading(false);
    }, 1500); // Simulate network delay
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    showToast("Password reset feature coming soon!", 'info');
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
    if (percentage < 40) return '#ef4444'; // Red - Weak
    if (percentage < 70) return '#f59e0b'; // Orange - Medium
    return '#10b981'; // Green - Strong
  };

  const getPasswordStrengthText = () => {
    const percentage = getPasswordStrengthPercentage();
    if (percentage < 40) return 'Weak';
    if (percentage < 70) return 'Medium';
    return 'Strong';
  };

  return (
    <div className="auth-wrapper">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <CheckCircle size={18} />
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
            onClick={() => { 
              setIsLogin(true); 
              setErrors({}); 
            }}
            disabled={isLoading}
          >
            Sign In
          </button>
          <button 
            type="button"
            className={`toggle-btn ${!isLogin ? 'active' : ''}`} 
            onClick={() => { 
              setIsLogin(false); 
              setErrors({}); 
            }}
            disabled={isLoading}
          >
            Create Account
          </button>
        </div>

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
                    <AlertCircle size={12}/>
                    {errors.firstName}
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
                    <AlertCircle size={12}/>
                    {errors.lastName}
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
                <AlertCircle size={12}/>
                {errors.email}
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
                <AlertCircle size={12}/>
                {errors.password}
              </div>
            )}
            
            {/* Password Strength Indicator - Only show for registration */}
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

            {/* Password Requirements Checklist - Only show for registration */}
            {!isLogin && (
              <div className="password-requirements">
                <div className={`requirement-item ${passwordStrength.hasMinLength ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>At least 8 characters</span>
                  {passwordStrength.hasMinLength && <CheckCircle size={12} className="check-icon" />}
                </div>
                <div className={`requirement-item ${passwordStrength.hasUpperCase ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>One uppercase letter</span>
                  {passwordStrength.hasUpperCase && <CheckCircle size={12} className="check-icon" />}
                </div>
                <div className={`requirement-item ${passwordStrength.hasLowerCase ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>One lowercase letter</span>
                  {passwordStrength.hasLowerCase && <CheckCircle size={12} className="check-icon" />}
                </div>
                <div className={`requirement-item ${passwordStrength.hasNumber ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>One number</span>
                  {passwordStrength.hasNumber && <CheckCircle size={12} className="check-icon" />}
                </div>
                <div className={`requirement-item ${passwordStrength.hasSpecialChar ? 'met' : ''}`}>
                  <span className="requirement-dot">•</span>
                  <span>One special character (!@#$%^&*)</span>
                  {passwordStrength.hasSpecialChar && <CheckCircle size={12} className="check-icon" />}
                </div>
              </div>
            )}
          </div>

          {isLogin && (
            <div className="forgot-pass">
              <a href="#" onClick={handleForgotPassword}>
                Forgot password?
              </a>
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
                  <AlertCircle size={12}/>
                  {errors.confirmPassword}
                </div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={isLoading}
          >
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
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              disabled={isLoading}
            >
              {isLogin ? ' Sign up here' : ' Sign in here'}
            </button>
          </p>
          
          <div className="separator">
            <span>or</span>
          </div>
          
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