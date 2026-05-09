import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Mail, Calendar, MapPin, Phone, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { fetchCustomerDetail } from '../services/customerService';
import '../styles/CustomerDetailModal.css';

const getInitials = (f, l) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
const formatDate = (s) => s
  ? new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';
const formatDateTime = (s) => s
  ? new Date(s).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const AVATAR_COLORS = ['#6b2d39','#8b3a4a','#a34f60','#4a1f28','#7a3040','#5c2433','#92455a','#3d1820'];
const getAvatarColor = (id) => {
  const n = id ? [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
};

export default function CustomerDetailModal({ customerId, isOpen, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !customerId) return;

    const loadCustomer = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCustomerDetail(customerId);
        setCustomer(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [isOpen, customerId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="cdm-overlay" onClick={onClose}>
      <div className="cdm-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="cdm-header">
          <h2 className="cdm-title">Customer Details</h2>
          <button className="cdm-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="cdm-content">
          
          {loading && (
            <div className="cdm-state">
              <Loader2 size={32} className="cdm-spinner" />
              <p>Loading customer details…</p>
            </div>
          )}

          {error && (
            <div className="cdm-state error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button 
                className="cdm-retry-btn" 
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && customer && (
            <>
              {/* Hero: Avatar + Name + Status */}
              <div className="cdm-hero">
                <div className="cdm-avatar" style={{ background: getAvatarColor(customer.id) }}>
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div className="cdm-hero-info">
                  <h3 className="cdm-name">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <span className={`cdm-status-badge ${customer.active ? 'active' : 'inactive'}`}>
                    {customer.active ? '● Active' : '● Inactive'}
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <section className="cdm-section">
                <h4 className="cdm-section-title">Contact Information</h4>
                <div className="cdm-info-grid">
                  <div className="cdm-info-item">
                    <Mail size={16} className="cdm-info-icon" />
                    <div>
                      <span className="cdm-info-label">Email</span>
                      <p className="cdm-info-value">{customer.email || '—'}</p>
                    </div>
                  </div>
                  {customer.phone && (
                    <div className="cdm-info-item">
                      <Phone size={16} className="cdm-info-icon" />
                      <div>
                        <span className="cdm-info-label">Phone</span>
                        <p className="cdm-info-value">{customer.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Address (if available) */}
              {customer.address && (
                <section className="cdm-section">
                  <h4 className="cdm-section-title">Address</h4>
                  <div className="cdm-info-item">
                    <MapPin size={16} className="cdm-info-icon" />
                    <div>
                      <p className="cdm-info-value">{customer.address}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Account Information */}
              <section className="cdm-section">
                <h4 className="cdm-section-title">Account Information</h4>
                <div className="cdm-info-grid">
                  <div className="cdm-info-item">
                    <Calendar size={16} className="cdm-info-icon" />
                    <div>
                      <span className="cdm-info-label">Joined</span>
                      <p className="cdm-info-value">{formatDate(customer.createdAt)}</p>
                    </div>
                  </div>
                  {customer.updatedAt && (
                    <div className="cdm-info-item">
                      <Clock size={16} className="cdm-info-icon" />
                      <div>
                        <span className="cdm-info-label">Last Updated</span>
                        <p className="cdm-info-value">{formatDateTime(customer.updatedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}