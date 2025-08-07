import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, TrendingUp, Users, Mail, Lock, CheckCircle, Star } from 'lucide-react';
import './MarketingLanding.css';

function MarketingLanding() {
  const features = [
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Take control of your digital footprint by managing email subscriptions'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Scan thousands of emails in seconds with our optimized engine'
    },
    {
      icon: TrendingUp,
      title: 'Smart Analytics',
      description: 'AI-powered insights about your email habits and spam sources'
    },
    {
      icon: Lock,
      title: 'Secure & Encrypted',
      description: 'Bank-level security with OAuth 2.0 and encrypted data storage'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Product Manager',
      content: 'INBoxit helped me recover 5GB of email storage and saved hours of manual cleanup!',
      rating: 5
    },
    {
      name: 'Mike Chen',
      role: 'Software Developer',
      content: 'Finally, a tool that respects privacy while being incredibly effective.',
      rating: 5
    },
    {
      name: 'Emily Davis',
      role: 'Marketing Director',
      content: 'The AI suggestions are spot-on. It found subscriptions I forgot I had!',
      rating: 5
    }
  ];

  const stats = [
    { value: '10M+', label: 'Emails Cleaned' },
    { value: '50K+', label: 'Happy Users' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9/5', label: 'User Rating' }
  ];

  return (
    <div className="marketing-landing">
      {/* Hero Section */}
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="hero-title">
            Take Back Control of Your
            <span className="gradient-text"> Email Inbox</span>
          </h1>
          <p className="hero-subtitle">
            Discover, manage, and delete unwanted emails from 50+ platforms with one click.
            Free up storage, protect your privacy, and save time.
          </p>
          <div className="hero-actions">
            <button className="btn-primary">
              Get Started Free
            </button>
            <button className="btn-secondary">
              Watch Demo
            </button>
          </div>
          <div className="hero-stats">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="stat"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img src="/dashboard-preview.png" alt="INBoxit Dashboard" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Why Choose INBoxit?</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <feature.icon className="feature-icon" />
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Connect Your Email</h3>
              <p>Securely connect with Google OAuth 2.0</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>AI Scans Your Inbox</h3>
              <p>Discovers all your subscriptions automatically</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Review & Delete</h3>
              <p>Choose what to keep and delete the rest</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <h2 className="section-title">What Our Users Say</h2>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="testimonial-card"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="stars">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="star" fill="gold" />
                  ))}
                </div>
                <p className="testimonial-content">"{testimonial.content}"</p>
                <div className="testimonial-author">
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing">
        <div className="container">
          <h2 className="section-title">Simple, Transparent Pricing</h2>
          <div className="pricing-cards">
            <div className="pricing-card">
              <h3>Free</h3>
              <div className="price">$0</div>
              <ul>
                <li><CheckCircle /> 5 Platform Scans</li>
                <li><CheckCircle /> 100 Emails/month</li>
                <li><CheckCircle /> Basic Analytics</li>
              </ul>
              <button className="btn-outline">Start Free</button>
            </div>
            <div className="pricing-card featured">
              <div className="badge">Most Popular</div>
              <h3>Pro</h3>
              <div className="price">$9.99<span>/month</span></div>
              <ul>
                <li><CheckCircle /> Unlimited Platforms</li>
                <li><CheckCircle /> Unlimited Deletions</li>
                <li><CheckCircle /> Advanced Analytics</li>
                <li><CheckCircle /> Automation Rules</li>
                <li><CheckCircle /> Priority Support</li>
              </ul>
              <button className="btn-primary">Start Pro Trial</button>
            </div>
            <div className="pricing-card">
              <h3>Business</h3>
              <div className="price">$29.99<span>/month</span></div>
              <ul>
                <li><CheckCircle /> Everything in Pro</li>
                <li><CheckCircle /> Multiple Accounts</li>
                <li><CheckCircle /> Team Management</li>
                <li><CheckCircle /> API Access</li>
                <li><CheckCircle /> White Label</li>
              </ul>
              <button className="btn-outline">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>Ready to Clean Your Inbox?</h2>
          <p>Join 50,000+ users who've taken control of their email</p>
          <button className="btn-cta">Start Free Trial</button>
        </div>
      </section>
    </div>
  );
}

export default MarketingLanding;
