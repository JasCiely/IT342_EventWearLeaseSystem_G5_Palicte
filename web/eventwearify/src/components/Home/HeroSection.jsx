import React from 'react';
import '../css/Home/HeroSection.css';
import { ArrowRight, Sparkles, Shield, Clock, Star, Users, Award } from 'lucide-react';
import heroGown from '../../assets/hero-gown.png';

const HeroSection = () => {
  return (
    <section className="hero-container">
      <div className="hero-bg-pattern"></div>

      {/* Floating Elements - Positioned relative to the header */}
      <div className="floating-element" style={{ top: '40px', left: '4%', animationDelay: '0s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={14} color="#f3d19e" fill="#f3d19e" />
          <span style={{ fontSize: '11px', fontWeight: '600' }}>Top Rated Collection</span>
        </div>
      </div>

      <div className="floating-element" style={{ top: '80px', right: '5%', animationDelay: '1.5s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={14} color="#f3d19e" />
          <span style={{ fontSize: '11px', fontWeight: '600' }}>Luxury Certified</span>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="hero-content">
        <div className="hero-badge">
          <Sparkles size={14} />
          <span>PREMIUM FORMAL RENTALS</span>
        </div>

        <h1 className="hero-title">
          Make Every Event<br />
          <span className="gold-text">Unforgettable</span>
        </h1>

        <p className="hero-description">
          Experience the elegance of designer fashion without the designer price tag. 
          Rent your dream outfit today.
        </p>

        <div className="hero-actions">
          <button className="btn-browse">
            EXPLORE COLLECTION <ArrowRight size={18} />
          </button>
          <button className="btn-how">HOW IT WORKS</button>
        </div>

        <div className="hero-trust-row">
          <div className="trust-item">
            <Shield size={14} /> <span>Quality Inspected</span>
          </div>
          <div className="trust-item">
            <Clock size={14} /> <span>Next Day Delivery</span>
          </div>
          <div className="trust-item">
            <Users size={14} /> <span>5k+ Happy Clients</span>
          </div>
        </div>
      </div>

      {/* Main Image Wrapper */}
      <div className="hero-image-wrapper">
        <div className="hero-main-image-container">
          <img src={heroGown} alt="Luxury Gown" className="hero-main-image" />
        </div>
      </div>

      {/* Wave Bottom */}
      <div className="bottom-wave">
        <svg 
          viewBox="0 0 1440 120" 
          preserveAspectRatio="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M0,80 C480,130 960,30 1440,80 L1440,120 L0,120 Z" 
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;