import { useEffect } from 'react';

const OAuth2Callback = ({ onLogin }) => {

  useEffect(() => {
    const search = window.location.search;
    const hash   = window.location.hash;

    let params;
    if (search && search.includes('token')) {
      params = new URLSearchParams(search);
    } else if (hash && hash.includes('token')) {
      const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?')) : '';
      params = new URLSearchParams(hashQuery);
    } else {
      params = new URLSearchParams(search);
    }

    const token     = params.get('token');
    const email     = params.get('email');
    const firstName = params.get('firstName');
    const lastName  = params.get('lastName');
    const role      = params.get('role');

    if (!token) {
      window.location.replace('/auth');
      return;
    }

    // Write to localStorage first
    localStorage.setItem('token',           token);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail',       email);
    localStorage.setItem('firstName',       firstName);
    localStorage.setItem('lastName',        lastName);
    localStorage.setItem('userRole',        role);

    if (onLogin) onLogin();
    sessionStorage.setItem('showLoginSuccess', 'true');

    // Full page reload — guarantees route guards re-read localStorage fresh
    const destination = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    window.location.replace(destination);

  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
    }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 48 48"
          style={{ display: 'block', margin: '0 auto 16px' }}>
          <circle cx="24" cy="24" r="20" fill="none" stroke="#e0e0e0" strokeWidth="3"/>
          <circle cx="24" cy="24" r="20" fill="none" stroke="#4285F4" strokeWidth="3"
            strokeDasharray="126" strokeDashoffset="96"
            style={{ animation: 'spin 0.9s linear infinite', transformOrigin: 'center' }}/>
        </svg>
        <p style={{ color: '#6b7280', fontSize: '14px', fontFamily: 'sans-serif', margin: 0 }}>
          Signing you in…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default OAuth2Callback;