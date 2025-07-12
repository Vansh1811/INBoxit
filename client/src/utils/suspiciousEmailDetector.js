/**
 * AI-Powered Suspicious Email Detection System
 * Analyzes email patterns to identify potentially suspicious or spam services
 */

class SuspiciousEmailDetector {
  constructor() {
    // Suspicious domain patterns
    this.suspiciousDomains = [
      /\d{4,}/, // Domains with 4+ consecutive numbers
      /[a-z]{20,}/, // Very long domain names
      /-{2,}/, // Multiple consecutive hyphens
      /\.(tk|ml|ga|cf)$/, // Free/suspicious TLDs
      /temp|disposable|fake|spam/i, // Temporary email indicators
    ];

    // Suspicious sender patterns
    this.suspiciousSenders = [
      /no-?reply@/i,
      /noreply@/i,
      /donotreply@/i,
      /automated@/i,
      /system@/i,
      /admin@.*\.(tk|ml|ga|cf)/i,
    ];

    // Suspicious subject patterns
    this.suspiciousSubjects = [
      /urgent|immediate|act now|limited time/i,
      /congratulations.*won|lottery|prize/i,
      /click here|download now|install/i,
      /free.*money|cash|reward/i,
      /verify.*account.*suspended/i,
      /security.*alert.*click/i,
      /\$\d+.*free|earn.*\$\d+/i,
    ];

    // Legitimate service patterns (whitelist)
    this.legitimateServices = [
      'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'github.com', 'gitlab.com', 'stackoverflow.com', 'reddit.com',
      'netflix.com', 'spotify.com', 'youtube.com', 'discord.com',
      'slack.com', 'zoom.us', 'dropbox.com', 'adobe.com',
      'paypal.com', 'stripe.com', 'shopify.com', 'wordpress.com',
    ];

    // Scoring weights
    this.weights = {
      domain: 0.3,
      sender: 0.25,
      subject: 0.25,
      frequency: 0.1,
      timing: 0.1,
    };
  }

  /**
   * Analyze a service for suspicious patterns
   * @param {Object} service - Service object with email data
   * @param {Array} allServices - All services for pattern analysis
   * @returns {Object} Analysis result with score and reasons
   */
  analyzeService(service, allServices = []) {
    const analysis = {
      score: 0,
      isSuspicious: false,
      confidence: 0,
      reasons: [],
      category: 'unknown',
    };

    // Domain analysis
    const domainScore = this.analyzeDomain(service.domain || service.email?.split('@')[1]);
    analysis.score += domainScore.score * this.weights.domain;
    analysis.reasons.push(...domainScore.reasons);

    // Sender analysis
    const senderScore = this.analyzeSender(service.email || service.sender);
    analysis.score += senderScore.score * this.weights.sender;
    analysis.reasons.push(...senderScore.reasons);

    // Subject analysis
    const subjectScore = this.analyzeSubject(service.subject);
    analysis.score += subjectScore.score * this.weights.subject;
    analysis.reasons.push(...subjectScore.reasons);

    // Frequency analysis
    const frequencyScore = this.analyzeFrequency(service, allServices);
    analysis.score += frequencyScore.score * this.weights.frequency;
    analysis.reasons.push(...frequencyScore.reasons);

    // Timing analysis
    const timingScore = this.analyzeTiming(service);
    analysis.score += timingScore.score * this.weights.timing;
    analysis.reasons.push(...timingScore.reasons);

    // Determine final assessment
    analysis.isSuspicious = analysis.score > 0.6;
    analysis.confidence = Math.min(analysis.score, 1.0);
    analysis.category = this.categorizeService(service, analysis.score);

    // Filter out empty reasons
    analysis.reasons = analysis.reasons.filter(reason => reason.trim().length > 0);

    return analysis;
  }

  /**
   * Analyze domain for suspicious patterns
   */
  analyzeDomain(domain) {
    const result = { score: 0, reasons: [] };
    
    if (!domain) return result;

    // Check if it's a known legitimate service
    if (this.legitimateServices.some(legit => domain.includes(legit))) {
      result.score = 0;
      result.reasons.push('✅ Known legitimate service');
      return result;
    }

    // Check suspicious patterns
    this.suspiciousDomains.forEach(pattern => {
      if (pattern.test(domain)) {
        result.score += 0.3;
        result.reasons.push(`🚨 Suspicious domain pattern: ${domain}`);
      }
    });

    // Check domain length
    if (domain.length > 30) {
      result.score += 0.2;
      result.reasons.push('⚠️ Unusually long domain name');
    }

    // Check for random-looking domains
    const randomPattern = /^[a-z]{8,}[0-9]{3,}[a-z]{3,}\./;
    if (randomPattern.test(domain)) {
      result.score += 0.4;
      result.reasons.push('🎲 Random-looking domain structure');
    }

    return result;
  }

  /**
   * Analyze sender email for suspicious patterns
   */
  analyzeSender(email) {
    const result = { score: 0, reasons: [] };
    
    if (!email) return result;

    this.suspiciousSenders.forEach(pattern => {
      if (pattern.test(email)) {
        result.score += 0.2;
        result.reasons.push(`📧 Suspicious sender pattern: ${email}`);
      }
    });

    // Check for generic/automated senders
    const genericPatterns = [
      /info@/, /support@/, /hello@/, /contact@/, /team@/
    ];
    
    const isGeneric = genericPatterns.some(pattern => pattern.test(email));
    if (isGeneric) {
      result.score += 0.1;
      result.reasons.push('🤖 Generic/automated sender address');
    }

    return result;
  }

  /**
   * Analyze email subject for suspicious content
   */
  analyzeSubject(subject) {
    const result = { score: 0, reasons: [] };
    
    if (!subject) return result;

    this.suspiciousSubjects.forEach(pattern => {
      if (pattern.test(subject)) {
        result.score += 0.3;
        result.reasons.push(`⚠️ Suspicious subject content: "${subject.substring(0, 50)}..."`);
      }
    });

    // Check for excessive capitalization
    const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capsRatio > 0.5 && subject.length > 10) {
      result.score += 0.2;
      result.reasons.push('📢 Excessive capitalization in subject');
    }

    // Check for excessive punctuation
    const punctRatio = (subject.match(/[!?]{2,}/g) || []).length;
    if (punctRatio > 0) {
      result.score += 0.15;
      result.reasons.push('❗ Excessive punctuation in subject');
    }

    return result;
  }

  /**
   * Analyze email frequency patterns
   */
  analyzeFrequency(service, allServices) {
    const result = { score: 0, reasons: [] };
    
    if (!allServices.length) return result;

    // Count emails from same domain
    const sameDomainCount = allServices.filter(s => 
      s.domain === service.domain || 
      (s.email && service.email && s.email.split('@')[1] === service.email.split('@')[1])
    ).length;

    if (sameDomainCount > 5) {
      result.score += 0.3;
      result.reasons.push(`📊 High frequency: ${sameDomainCount} emails from same domain`);
    }

    return result;
  }

  /**
   * Analyze timing patterns
   */
  analyzeTiming(service) {
    const result = { score: 0, reasons: [] };
    
    if (!service.date) return result;

    try {
      const emailDate = new Date(service.date);
      const now = new Date();
      const hoursSinceEmail = (now - emailDate) / (1000 * 60 * 60);

      // Very recent emails might be suspicious if they're promotional
      if (hoursSinceEmail < 24 && service.subject?.match(/sale|offer|deal|discount/i)) {
        result.score += 0.2;
        result.reasons.push('⏰ Recent promotional email');
      }

      // Check if email was sent at unusual hours (might indicate automation)
      const emailHour = emailDate.getHours();
      if (emailHour < 6 || emailHour > 22) {
        result.score += 0.1;
        result.reasons.push('🌙 Sent during unusual hours');
      }

    } catch (error) {
      // Invalid date format
      result.score += 0.1;
      result.reasons.push('📅 Invalid or suspicious date format');
    }

    return result;
  }

  /**
   * Categorize service based on analysis
   */
  categorizeService(service, score) {
    if (score < 0.3) return 'legitimate';
    if (score < 0.6) return 'questionable';
    if (score < 0.8) return 'suspicious';
    return 'highly_suspicious';
  }

  /**
   * Batch analyze multiple services
   */
  batchAnalyze(services) {
    return services.map(service => ({
      ...service,
      suspiciousAnalysis: this.analyzeService(service, services)
    }));
  }

  /**
   * Get summary statistics for analyzed services
   */
  getAnalysisSummary(analyzedServices) {
    const total = analyzedServices.length;
    const suspicious = analyzedServices.filter(s => s.suspiciousAnalysis?.isSuspicious).length;
    const categories = analyzedServices.reduce((acc, service) => {
      const category = service.suspiciousAnalysis?.category || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      suspicious,
      suspiciousPercentage: total > 0 ? Math.round((suspicious / total) * 100) : 0,
      categories,
      recommendations: this.generateRecommendations(analyzedServices)
    };
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analyzedServices) {
    const recommendations = [];
    const suspicious = analyzedServices.filter(s => s.suspiciousAnalysis?.isSuspicious);

    if (suspicious.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Suspicious Services Detected',
        message: `Found ${suspicious.length} potentially suspicious services. Review and consider unsubscribing.`,
        action: 'review_suspicious'
      });
    }

    const highFrequency = analyzedServices.filter(s => 
      s.suspiciousAnalysis?.reasons.some(r => r.includes('High frequency'))
    );

    if (highFrequency.length > 0) {
      recommendations.push({
        type: 'info',
        title: 'High Frequency Senders',
        message: `${highFrequency.length} services are sending frequent emails. Consider adjusting preferences.`,
        action: 'manage_frequency'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const suspiciousEmailDetector = new SuspiciousEmailDetector();
export default suspiciousEmailDetector;