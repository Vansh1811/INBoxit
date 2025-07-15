import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Shield, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  Eye, 
  EyeOff,
  Sparkles,
  Lock,
  Trash2,
  BarChart3
} from 'lucide-react';
import './LandingPage.css';

function LandingPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = 'http://localhost:5000/auth/google';
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const features = [
    {
      icon: <Trash2 className="w-8 h-8" />,
      title: "Clean Your Inbox",
      description: "Automatically detect and unsubscribe from unwanted email services with one click.",
      color: "from-red-500 to-pink-500"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Protect Your Privacy",
      description: "AI-powered detection identifies suspicious and potentially harmful email services.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Fast",
      description: "Scan your entire Gmail history in minutes and get instant insights.",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Smart Analytics",
      description: "Get detailed insights about your email subscriptions and privacy score.",
      color: "from-green-500 to-emerald-500"
    }
  ];

  const benefits = [
    "🧹 Clean your inbox automatically",
    "🔒 Protect your privacy and data",
    "⚡ Unsubscribe in 1 click",
    "🤖 AI-powered suspicious detection",
    "📊 Detailed analytics and insights",
    "🔄 Automatic periodic scans"
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`landing-page ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <motion.header 
        className="landing-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="header-content">
          <motion.div 
            className="logo"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Mail className="w-8 h-8 text-blue-500" />
            <span className="logo-text">InboxIt</span>
          </motion.div>
          
          <motion.button
            onClick={toggleDarkMode}
            className="theme-toggle"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {darkMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </motion.button>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section 
        className="hero-section"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="hero-content">
          <motion.div className="hero-text" variants={itemVariants}>
            <motion.h1 
              className="hero-title"
              variants={itemVariants}
            >
              Take Control of Your
              <motion.span 
                className="gradient-text"
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {" "}Email Privacy
              </motion.span>
            </motion.h1>
            
            <motion.p 
              className="hero-subtitle"
              variants={itemVariants}
            >
              InboxIt is the smart Gmail assistant that helps you unsubscribe from unwanted emails, 
              detect suspicious services, and protect your privacy with AI-powered insights.
            </motion.p>

            <motion.div 
              className="hero-benefits"
              variants={itemVariants}
            >
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  className="benefit-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  {benefit}
                </motion.div>
              ))}
            </motion.div>

            <motion.div 
              className="hero-cta"
              variants={itemVariants}
            >
              <motion.button
                onClick={handleLogin}
                disabled={isLoading}
                className="cta-button"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <img 
                      src="https://developers.google.com/identity/images/g-logo.png" 
                      alt="Google" 
                      className="w-5 h-5"
                    />
                    Continue with Google
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </motion.button>
              
              <motion.p 
                className="privacy-note"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <Lock className="w-4 h-4 mr-1" />
                We never store your emails. Your privacy is our priority.
              </motion.p>
            </motion.div>
          </motion.div>

          <motion.div 
            className="hero-visual"
            variants={itemVariants}
          >
            <motion.div 
              className="floating-card"
              variants={floatingVariants}
              animate="animate"
            >
              <div className="card-header">
                <div className="card-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="card-title">Email Dashboard</span>
              </div>
              <div className="card-content">
                <div className="stat-row">
                  <span>Total Services</span>
                  <span className="stat-number">247</span>
                </div>
                <div className="stat-row">
                  <span>Suspicious</span>
                  <span className="stat-number warning">23</span>
                </div>
                <div className="stat-row">
                  <span>Unsubscribed</span>
                  <span className="stat-number success">156</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="floating-icons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <motion.div 
                className="floating-icon"
                animate={{ 
                  y: [-5, 5, -5],
                  rotate: [0, 5, 0, -5, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  delay: 0
                }}
              >
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </motion.div>
              <motion.div 
                className="floating-icon"
                animate={{ 
                  y: [5, -5, 5],
                  rotate: [0, -5, 0, 5, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  delay: 1
                }}
              >
                <Shield className="w-6 h-6 text-blue-400" />
              </motion.div>
              <motion.div 
                className="floating-icon"
                animate={{ 
                  y: [-3, 7, -3],
                  rotate: [0, 3, 0, -3, 0]
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity,
                  delay: 2
                }}
              >
                <Zap className="w-6 h-6 text-purple-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        className="features-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <motion.div 
          className="features-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Powerful Features for Email Privacy</h2>
          <p>Everything you need to take control of your inbox and protect your privacy</p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <motion.div 
                className={`feature-icon bg-gradient-to-r ${feature.color}`}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                {feature.icon}
              </motion.div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        className="cta-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <motion.div 
          className="cta-content"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Ready to Clean Your Inbox?</h2>
          <p>Join thousands of users who have already taken control of their email privacy</p>
          
          <motion.button
            onClick={handleLogin}
            disabled={isLoading}
            className="cta-button secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <>
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        className="landing-footer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="footer-content">
          <div className="footer-logo">
            <Mail className="w-6 h-6 text-blue-500" />
            <span>InboxIt</span>
          </div>
          <p>© 2024 InboxIt. Your privacy, simplified.</p>
        </div>
      </motion.footer>
    </div>
  );
}

export default LandingPage;