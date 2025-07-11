import React from 'react';
import './PlatformList.css'; // optional for styling

function PlatformList({ platforms }) {
  if (!Array.isArray(platforms) || platforms.length === 0) return null;

  return (
    <div className="platforms-section">
      <h3>🔍 Detected Platforms:</h3>
      {platforms.map((platform, index) => (
        <div
          key={index}
          className="platform-card"
        >
          <strong>📧 {platform.platform}</strong>
          <span className="platform-status">
            ✅ Connected
          </span>
          <br />
          <small>From: {platform.sender}</small>
        </div>
      ))}
    </div>
  );
}

export default PlatformList;
