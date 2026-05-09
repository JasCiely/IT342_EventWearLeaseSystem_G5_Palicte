import React from 'react';
import '../../styles/layout/Footer.css';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="footer-section">
      <div className="footer-container">
        {/* Brand Column */}
        <div className="footer-column brand-col">
          <h2 className="footer-logo">EventWear</h2>
          <p className="footer-brand-desc">
            Premium formal wear rentals for your most memorable moments. 
            Look stunning without the commitment.
          </p>
        </div>

        {/* Quick Links Column */}
        <div className="footer-column">
          <h3 className="footer-heading">Quick Links</h3>
          <ul className="footer-links">
            <li><a href="#collection">Our Collection</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#signin">Sign In</a></li>
          </ul>
        </div>

        {/* Categories Column */}
        <div className="footer-column">
          <h3 className="footer-heading">Categories</h3>
          <ul className="footer-links">
            <li><a href="#gowns">Wedding Gowns</a></li>
            <li><a href="#barong">Barong Tagalog</a></li>
            <li><a href="#tuxedos">Tuxedos</a></li>
            <li><a href="#cocktail">Cocktail Dresses</a></li>
          </ul>
        </div>

        {/* Contact Column */}
        <div className="footer-column">
          <h3 className="footer-heading">Contact Us</h3>
          <ul className="footer-contact">
            <li>
              <MapPin size={16} className="contact-icon" />
              <span>123 Fashion Avenue, Metro Manila, Philippines</span>
            </li>
            <li>
              <Phone size={16} className="contact-icon" />
              <span>+63 912 345 6789</span>
            </li>
            <li>
              <Mail size={16} className="contact-icon" />
              <span>hello@eventwear.ph</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <hr className="footer-divider" />
        <p className="copyright">© 2026 EventWear. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;