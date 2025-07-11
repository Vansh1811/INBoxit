import React from 'react';
import './ConnectionStatus.css';

function ConnectionStatus({ status, retry }) {
  if (!status) return null;

  return (
    <div className={`connection-status ${status.status}`}>
      {status.status === 'success' ? (
        <p>✅ Connected: {status.email} ({status.messagesTotal} messages)</p>
      ) : (
        <div>
          <p>❌ Connection failed: {status.message}</p>
          <button onClick={retry}>🔄 Retry</button>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
