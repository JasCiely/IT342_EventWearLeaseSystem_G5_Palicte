import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../css/layout/Header.css';
import { FiUser, FiShoppingBag } from 'react-icons/fi';
import logo from '../../assets/logo.png';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update active tab based on current path or hash
  useEffect(() => {
    if (location.pathname === '/') {
      if (location.hash === '#collection') {
        setActiveTab('collection');
      } else if (location.hash === '#how-it-works') {
        setActiveTab('how-it-works');
      } else {
        setActiveTab('home');
      }
    } else {
      setActiveTab('');
    }
  }, [location]);

  const handleLinkClick = (tab, path, hash) => {
    setActiveTab(tab);
    if (path === '/') {
      if (hash) {
        navigate('/', { replace: true });
        setTimeout(() => {
          document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      navigate(path);
    }
  };

  const handleSignIn = () => {
    // Navigate to Auth page
    navigate('/auth');
  };

  const handleBookNow = () => {
    // Add your booking logic here
    console.log('Book now clicked');
    // You can also navigate to booking page if needed
    // navigate('/booking');
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" onClick={() => handleLinkClick('home', '/')}>
            <img src={logo} alt="EventWear Logo" className="logo-img" />
          </Link>
        </div>
        <div className="navbar-links">
          <Link
            to="/"
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleLinkClick('home', '/')}
          >
            Home
          </Link>
          <Link
            to="/#collection"
            className={`nav-item ${activeTab === 'collection' ? 'active' : ''}`}
            onClick={() => handleLinkClick('collection', '/', '#collection')}
          >
            Collection
          </Link>
          <Link
            to="/#how-it-works"
            className={`nav-item ${activeTab === 'how-it-works' ? 'active' : ''}`}
            onClick={() => handleLinkClick('how-it-works', '/', '#how-it-works')}
          >
            How It Works
          </Link>
        </div>
        <div className="navbar-actions">
          <button
            className="btn-sign-in"
            onClick={handleSignIn}
            aria-label="Sign In"
          >
            <FiUser className="icon" />
            <span>Sign In</span>
          </button>
          <button
            className="btn-book-now"
            onClick={handleBookNow}
            aria-label="Book Now"
          >
            <FiShoppingBag className="icon" />
            <span>Book Now</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;