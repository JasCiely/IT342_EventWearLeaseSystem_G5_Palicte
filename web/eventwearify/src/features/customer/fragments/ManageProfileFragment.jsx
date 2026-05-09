import { useState, useEffect } from 'react';
import '../styles/ManageProfileFragment.css';
import { getProfile, updateProfile } from '../services/userService';

const normalizePhilippinePhone = (raw) => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('639')) {
    digits = '09' + digits.slice(3);
  } else if (digits.startsWith('9')) {
    digits = '0' + digits;
  }
  return digits.slice(0, 11);
};

const validatePhilippinePhone = (phone) => /^09\d{9}$/.test(phone);

const ManageProfileFragment = () => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getProfile()
      .then((data) => {
        setForm({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handlePhoneChange = (e) => {
    const normalized = normalizePhilippinePhone(e.target.value);
    setForm((prev) => ({ ...prev, phone: normalized }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.phone && !validatePhilippinePhone(form.phone)) {
      setError('Invalid Philippine mobile number. Use 09XXXXXXXXX or +639XXXXXXXXX format.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await updateProfile(form);
      if (data.emailChanged) {
        setSuccess('Profile updated. Email changed — redirecting to login...');
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/auth';
        }, 2500);
      } else {
        setSuccess('Profile updated successfully.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const initials =
    (form.firstName.charAt(0) + form.lastName.charAt(0)).toUpperCase() || '?';

  if (loading) {
    return (
      <div className="profile-section profile-loading-container">
        <div className="spinner"></div>
        <p className="profile-loading">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <div className="profile-card-header">
        <h2 className="card-title">Account Settings</h2>
        <p className="card-subtitle">Manage your public profile and account details</p>
      </div>

      <div className="profile-header">
        <div className="avatar-container">
          <div className="avatar-circle">{initials}</div>
          <div className="avatar-badge">✓</div>
        </div>
        <div className="profile-info">
          <h3>{form.firstName} {form.lastName}</h3>
          <p>{form.email}</p>
        </div>
      </div>

      {error && <div className="profile-message profile-message--error">{error}</div>}
      {success && <div className="profile-message profile-message--success">{success}</div>}

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-grid">
          <div className="profile-field">
            <label className="profile-label">First Name</label>
            <input
              className="profile-input"
              type="text"
              name="firstName"
              placeholder="Enter first name"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">Last Name</label>
            <input
              className="profile-input"
              type="text"
              name="lastName"
              placeholder="Enter last name"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">Email Address</label>
            <input
              className="profile-input"
              type="email"
              name="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">Phone Number</label>
            <input
              className="profile-input"
              type="tel"
              name="phone"
              placeholder="09XXXXXXXXX"
              maxLength={11}
              value={form.phone}
              onChange={handlePhoneChange}
            />
          </div>
        </div>

        <div className="form-footer">
          <button className="update-btn" type="submit" disabled={saving}>
            {saving ? 'Saving changes...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManageProfileFragment;