import React, { useState, useEffect, useRef } from 'react';
import {
  UserCircle,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle,
  Edit2,
  X,
  Loader2,
  Camera,
  Trash2,
} from 'lucide-react';
import '../../../components/css/adminDashboard/ProfileFragment.css';

const API_BASE  = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const AUTH_BASE = `${API_BASE}/api/auth`;
const USER_BASE = `${API_BASE}/api/user`;
// No SERVER prefix needed — Supabase Storage returns full CDN URLs

/* ── read profile from localStorage instantly ── */
const getLocalProfile = () => ({
  firstName:       localStorage.getItem('firstName')       || '',
  lastName:        localStorage.getItem('lastName')        || '',
  email:           localStorage.getItem('email')           || '',
  phone:           localStorage.getItem('phone')           || '',
  role:            localStorage.getItem('role')            || 'ADMIN',
  profilePhotoUrl: localStorage.getItem('profilePhotoUrl') || '',
});

const saveLocalProfile = (p) => {
  localStorage.setItem('firstName',       p.firstName);
  localStorage.setItem('lastName',        p.lastName);
  localStorage.setItem('email',           p.email);
  localStorage.setItem('phone',           p.phone           || '');
  localStorage.setItem('role',            p.role);
  localStorage.setItem('profilePhotoUrl', p.profilePhotoUrl || '');
};

const ProfileFragment = () => {
  const token     = localStorage.getItem('token');
  const hasSynced = useRef(false);
  const fileInput = useRef(null);

  /* ── profile state — instant from localStorage ── */
  const [profile,    setProfile]    = useState(getLocalProfile);
  const [editMode,   setEditMode]   = useState(false);
  const [editFields, setEditFields] = useState(getLocalProfile);
  const [saving,     setSaving]     = useState(false);
  const [syncing,    setSyncing]    = useState(false);

  /* ── photo upload state ── */
  const [photoPreview,   setPhotoPreview]   = useState(null); // local blob URL
  const [photoFile,      setPhotoFile]      = useState(null); // File object
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* ── password state ── */
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [showPw,   setShowPw]   = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  /* ── toast ── */
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 3500);
  };

  /* ── background sync once per session ── */
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    const syncProfile = async () => {
      setSyncing(true);
      try {
        const res = await fetch(`${USER_BASE}/profile`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        const fetched = {
          firstName:       data.firstName       || '',
          lastName:        data.lastName        || '',
          email:           data.email           || '',
          phone:           data.phone           || '',
          role:            data.role            || 'ADMIN',
          profilePhotoUrl: data.profilePhotoUrl || '',
        };

        setProfile(prev => {
          const changed = Object.keys(fetched).some(k => prev[k] !== fetched[k]);
          if (changed) { saveLocalProfile(fetched); return fetched; }
          return prev;
        });
        setEditMode(em => { if (!em) setEditFields(fetched); return em; });
      } catch {
        // silent — localStorage values remain
      } finally {
        setSyncing(false);
      }
    };

    syncProfile();
  }, []);

  /* ── photo file picker ── */
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      showToast('error', 'Invalid file type. Use JPEG, PNG, WEBP, or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File too large. Maximum size is 5 MB.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  /* ── upload photo — POST /api/user/profile/photo ── */
  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);

      const res = await fetch(`${USER_BASE}/profile/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to upload photo');
      }

      const updated = await res.json();
      const serverUrl = updated.profilePhotoUrl || '';

      // Update profile state with new server URL first
      const newProfile = { ...profile, profilePhotoUrl: serverUrl };
      setProfile(newProfile);
      saveLocalProfile(newProfile);

      // Clear staged file — revoke blob URL after a tick so the
      // <img> has already switched to the server URL before we destroy it
      const blobUrl = photoPreview;
      setPhotoPreview(null);
      setPhotoFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setTimeout(() => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, 500);

      showToast('success', 'Profile photo updated!');
    } catch (err) {
      showToast('error', err.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  /* ── discard local preview without uploading ── */
  const handleDiscardPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  /* ── displayed photo src: local preview > server url > null ── */
  // Supabase returns full CDN URLs — just use directly with cache-bust param
  const displayPhoto = photoPreview
    || (profile.profilePhotoUrl
        ? `${profile.profilePhotoUrl}?t=${encodeURIComponent(profile.profilePhotoUrl.split('/').pop())}`
        : null);

  /* ── field change handlers ── */
  const handleEditChange = (e) =>
    setEditFields(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePwChange = (e) =>
    setPwForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  /* ── save profile — PUT /api/user/profile ── */
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${USER_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: editFields.firstName,
          lastName:  editFields.lastName,
          email:     editFields.email,
          phone:     editFields.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to update profile');
      }

      const updated = await res.json();
      const newProfile = {
        firstName:       updated.firstName       || '',
        lastName:        updated.lastName        || '',
        email:           updated.email           || '',
        phone:           updated.phone           || '',
        role:            updated.role            || profile.role,
        profilePhotoUrl: updated.profilePhotoUrl || profile.profilePhotoUrl,
      };

      setProfile(newProfile);
      setEditFields(newProfile);
      saveLocalProfile(newProfile);
      setEditMode(false);
      showToast('success', 'Profile updated successfully!');
    } catch (err) {
      showToast('error', err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditFields({ ...profile });
    setEditMode(false);
  };

  /* ── change password — POST /api/auth/change-password ── */
  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      showToast('error', 'New passwords do not match.');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      showToast('error', 'Password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch(`${AUTH_BASE}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword:     pwForm.newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to change password');
      }

      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('success', 'Password changed successfully!');
    } catch (err) {
      showToast('error', err.message || 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  /* ── initials fallback ── */
  const initials =
    `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || 'A';

  /* ── password strength ── */
  const pwStrength = (() => {
    const p = pwForm.newPassword;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8)           score++;
    if (/[A-Z]/.test(p))         score++;
    if (/[0-9]/.test(p))         score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#b45309', width: '25%'  };
    if (score === 2) return { label: 'Fair',   color: '#d97706', width: '50%'  };
    if (score === 3) return { label: 'Good',   color: '#c4717f', width: '75%'  };
    return                { label: 'Strong', color: '#15803d', width: '100%' };
  })();

  /* ── render ── */
  return (
    <div className="pf-root">

      {/* Page header */}
      <div className="pf-top">
        <div className="pf-header">
          <div>
            <h2 className="pf-title">My Profile</h2>
            <p className="pf-subtitle">Manage your account information and security settings</p>
          </div>
          {syncing && (
            <div className="pf-sync-indicator">
              <Loader2 size={13} className="pf-spin" />
              <span>Syncing…</span>
            </div>
          )}
        </div>
      </div>

      <div className="pf-grid">

        {/* LEFT — avatar card */}
        <div className="pf-card pf-card--avatar">

          {/* ── Photo area ── */}
          <div className="pf-avatar-wrapper">
            <div className="pf-avatar-circle">
              {displayPhoto
                ? <img src={displayPhoto} alt="Profile" className="pf-avatar-img" />
                : <span className="pf-avatar-initials">{initials}</span>}
            </div>

            {/* Camera button — always visible to trigger picker */}
            <label className="pf-avatar-upload-btn" title="Change photo">
              <Camera size={13} />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
            </label>
          </div>

          <h3 className="pf-avatar-name">{profile.firstName} {profile.lastName}</h3>
          <span className="pf-avatar-role-badge">{profile.role}</span>
          <p className="pf-avatar-email">{profile.email}</p>

          {/* ── Photo action buttons (only when a new photo is staged) ── */}
          {photoFile && (
            <div className="pf-photo-actions">
              <button
                className="pf-btn-upload-photo"
                onClick={handleUploadPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto
                  ? <><Loader2 size={13} className="pf-spin" /> Uploading…</>
                  : <><Save size={13} /> Save Photo</>}
              </button>
              <button
                className="pf-btn-discard-photo"
                onClick={handleDiscardPhoto}
                disabled={uploadingPhoto}
                title="Discard"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {/* ── Profile edit buttons ── */}
          {!editMode ? (
            <button className="pf-btn-edit" onClick={() => setEditMode(true)}>
              <Edit2 size={14} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="pf-btn-save" onClick={handleSaveProfile} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className="pf-spin" /> Saving…</>
                  : <><Save size={14} /> Save</>}
              </button>
              <button className="pf-btn-cancel" onClick={handleCancelEdit}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — detail cards */}
        <div className="pf-detail-col">

          {/* Personal information */}
          <div className="pf-card">
            <h4 className="pf-card-title">
              <UserCircle size={14} /> Personal Information
            </h4>
            <div className="pf-form-grid">
              {[
                { label: 'First Name', name: 'firstName', icon: UserCircle, type: 'text'  },
                { label: 'Last Name',  name: 'lastName',  icon: UserCircle, type: 'text'  },
                { label: 'Email',      name: 'email',     icon: Mail,       type: 'email' },
                { label: 'Phone',      name: 'phone',     icon: Phone,      type: 'tel'   },
              ].map(({ label, name, icon: Icon, type }) => (
                <div className="pf-field" key={name}>
                  <label className="pf-field-label">{label}</label>
                  {editMode ? (
                    <div className="pf-input-wrap">
                      <Icon size={14} className="pf-input-icon" />
                      <input
                        className="pf-input"
                        type={type}
                        name={name}
                        value={editFields[name]}
                        onChange={handleEditChange}
                        placeholder={label}
                      />
                    </div>
                  ) : (
                    <div className="pf-field-value">
                      <Icon size={14} className="pf-field-value-icon" />
                      <span>
                        {profile[name] || <em style={{ color: '#c0bdb9' }}>Not set</em>}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Change password */}
          <div className="pf-card">
            <h4 className="pf-card-title">
              <Lock size={14} /> Change Password
            </h4>
            <div className="pf-form-grid">
              {[
                { label: 'Current Password', name: 'currentPassword', key: 'current' },
                { label: 'New Password',     name: 'newPassword',     key: 'next'    },
                { label: 'Confirm Password', name: 'confirmPassword', key: 'confirm' },
              ].map(({ label, name, key }) => (
                <div className="pf-field pf-field--full" key={name}>
                  <label className="pf-field-label">{label}</label>
                  <div className="pf-input-wrap">
                    <input
                      className="pf-input pf-input--no-icon"
                      type={showPw[key] ? 'text' : 'password'}
                      name={name}
                      value={pwForm[name]}
                      onChange={handlePwChange}
                      placeholder={label}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pf-pw-toggle"
                      onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                      tabIndex={-1}
                    >
                      {showPw[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pwStrength && (
              <div className="pf-pw-strength-wrap">
                <div className="pf-pw-strength-bg">
                  <div
                    className="pf-pw-strength-fill"
                    style={{ width: pwStrength.width, background: pwStrength.color }}
                  />
                </div>
                <span className="pf-pw-strength-label" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </span>
              </div>
            )}

            <div style={{ marginTop: '1.25rem' }}>
              <button
                className="pf-btn-password"
                onClick={handleChangePassword}
                disabled={
                  savingPw ||
                  !pwForm.currentPassword ||
                  !pwForm.newPassword ||
                  !pwForm.confirmPassword
                }
              >
                {savingPw
                  ? <><Loader2 size={14} className="pf-spin" /> Updating…</>
                  : <><Lock size={14} /> Update Password</>}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`dashboard-toast ${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ProfileFragment;