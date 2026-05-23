import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src="/logo.png" alt="Sportza" className="navbar-logo-icon" />
          <span className="navbar-logo-text">Sportza</span>
        </Link>
        <div className="navbar-menu">
          <Link to="/venues" className="navbar-link">Venues</Link>
          {user ? (
            <>
              <Link to="/bookings" className="navbar-link">My Bookings</Link>
              <Link to="/matches" className="navbar-link">Matches</Link>
              <Link to="/stats" className="navbar-link">Stats</Link>
              <Link to="/profile" className="navbar-link">Profile</Link>
              <button onClick={handleLogout} className="navbar-button">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Login</Link>
              <Link to="/register" className="navbar-button">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
