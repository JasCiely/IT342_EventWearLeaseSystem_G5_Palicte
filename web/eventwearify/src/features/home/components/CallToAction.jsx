import React from 'react';
import '../styles/CallToAction.css';
import { ArrowRight } from 'lucide-react';

const CallToAction = () => {
  return (
    <section className="cta-section">
      <div className="cta-container">
        <h2 className="cta-title">Ready to Look Stunning?</h2>
        <p className="cta-subtitle">
          Book your perfect outfit today and make your special event truly unforgettable. 
          New customers get 10% off their first rental!
        </p>
        
        <div className="cta-actions">
          <button className="btn-start">
            Start Browsing <ArrowRight size={18} />
          </button>
          <button className="btn-account">
            Create Account
          </button>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;