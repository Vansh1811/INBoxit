import React from 'react';
import './header.css';

function Header({ user, darkMode, toggleDarkMode }) {
  return (
    <header className="app-header">
      <h1 className="animated-title">📬 InBoxIt</h1>

      <div className="header-controls">
        {user && (
          <p className="welcome-text">
            👋 Welcome, <strong>{user.name || user.email || 'User'}</strong>!
          </p>
        )}
        <button className="toggle-btn" onClick={toggleDarkMode}>
          {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </header>
  );
}

export default Header;
