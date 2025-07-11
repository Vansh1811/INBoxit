import React from 'react';
import './LoginSection.css';

function LoginSection() {
  const handleLogin = () => {
    // Fixed: Use the correct Google OAuth route
    window.location.href = 'http://localhost:5000/auth/google';
  };

  return (
    <div className="login-section">
      <p>Discover and manage your email subscriptions</p>
      <button className="login-btn" onClick={handleLogin}>
        🔐 Login with Google
      </button>
    </div>
  );
}

export default LoginSection;