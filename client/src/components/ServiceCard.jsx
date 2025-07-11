import React from 'react';
import ServiceCard from './ServiceCard';

function ServiceList({ services }) {
  if (!Array.isArray(services) || services.length === 0) {
    return <p>No services found yet.</p>;
  }

  return (
    <div className="service-list">
      {services.map((service, index) => (
        <ServiceCard
          key={service.domain || index}
          platform={service.platform || 'Unknown'}
          domain={service.domain || 'unknown.com'}
        />
      ))}
    </div>
  );
}

export default ServiceList;
