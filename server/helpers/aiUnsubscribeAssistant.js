// Create new file: helpers/aiUnsubscribeAssistant.js
const logger = require('../utils/logger');

class AIUnsubscribeAssistant {
  constructor() {
    // Platform-specific unsubscribe knowledge base
    this.unsubscribeGuides = {
      'netflix.com': {
        difficulty: 'Easy',
        estimatedTime: '2-3 minutes',
        steps: [
          {
            id: 1,
            title: 'Sign in to Netflix',
            description: 'Go to netflix.com and sign in with your account',
            action: 'Navigate to https://www.netflix.com/login',
            tips: 'Use the same email and password you used for signup'
          },
          {
            id: 2,
            title: 'Access Account Settings',
            description: 'Click on your profile icon in the top right corner',
            action: 'Click profile icon → Select "Account"',
            tips: 'The account option is usually at the bottom of the dropdown'
          },
          {
            id: 3,
            title: 'Cancel Membership',
            description: 'Look for "Cancel Membership" in the membership section',
            action: 'Click "Cancel Membership" button',
            tips: 'This is usually in the "Membership & Billing" section'
          },
          {
            id: 4,
            title: 'Confirm Cancellation',
            description: 'Follow the prompts to confirm your cancellation',
            action: 'Complete the cancellation flow',
            tips: 'Your account will remain active until the end of your billing period'
          }
        ],
        commonQuestions: {
          'billing': 'You will not be charged again after your current billing period ends',
          'access': 'You can still watch Netflix until your current subscription expires',
          'reactivate': 'You can reactivate anytime by signing in and updating payment'
        }
      },
      
      'amazon.com': {
        difficulty: 'Medium',
        estimatedTime: '3-5 minutes',
        steps: [
          {
            id: 1,
            title: 'Go to Your Account',
            description: 'Sign in and navigate to "Your Account"',
            action: 'Go to amazon.com → Sign in → Your Account',
            tips: 'Your Account is usually in the top right corner'
          },
          {
            id: 2,
            title: 'Find Prime Membership',
            description: 'Look for "Prime Membership" section',
            action: 'Click "Prime Membership" or "Manage Prime Membership"',
            tips: 'This might be under "Account & Login Info" section'
          },
          {
            id: 3,
            title: 'End Membership',
            description: 'Click on "End Membership" or "Cancel Prime"',
            action: 'Select cancellation option',
            tips: 'Amazon may offer you deals to stay - you can skip these'
          },
          {
            id: 4,
            title: 'Choose End Date',
            description: 'Select when you want your membership to end',
            action: 'Choose to end now or at period end',
            tips: 'Ending at period end lets you use benefits until expiration'
          }
        ],
        commonQuestions: {
          'shipping': 'You will lose free 2-day shipping after cancellation',
          'prime_video': 'Prime Video access will also be cancelled',
          'refund': 'You may get a partial refund if you cancel mid-cycle'
        }
      },
      
      'linkedin.com': {
        difficulty: 'Easy',
        estimatedTime: '1-2 minutes',
        steps: [
          {
            id: 1,
            title: 'Access Settings',
            description: 'Click your profile picture and go to Settings & Privacy',
            action: 'Profile picture → Settings & Privacy',
            tips: 'This is in the dropdown menu under your profile'
          },
          {
            id: 2,
            title: 'Communications',
            description: 'Navigate to Communications tab',
            action: 'Click "Communications" in left sidebar',
            tips: 'You can control email frequency here instead of full unsubscribe'
          },
          {
            id: 3,
            title: 'Email Frequency',
            description: 'Adjust email notification settings',
            action: 'Turn off unwanted email types',
            tips: 'You can keep important notifications and disable marketing emails'
          }
        ],
        commonQuestions: {
          'account': 'This only unsubscribes from emails, your LinkedIn account stays active',
          'networking': 'You will still receive messages and connection requests',
          'resubscribe': 'You can change these settings back anytime'
        }
      }
    };

    // General fallback guidance
    this.generalGuidance = {
      steps: [
        {
          id: 1,
          title: 'Find Account Settings',
          description: 'Look for account, settings, or profile options',
          tips: 'Usually found by clicking your name or profile picture'
        },
        {
          id: 2,
          title: 'Look for Email Preferences',
          description: 'Find email settings, notifications, or communication preferences',
          tips: 'May be under Privacy, Communications, or Notifications'
        },
        {
          id: 3,
          title: 'Unsubscribe or Disable',
          description: 'Turn off marketing emails or promotional notifications',
          tips: 'You might want to keep security and account notifications'
        }
      ]
    };
  }

  // Main method to get unsubscribe guidance
  async getUnsubscribeGuidance(domain, step = null) {
    try {
      const platformGuide = this.unsubscribeGuides[domain.toLowerCase()];
      
      if (platformGuide) {
        // Return specific guidance for known platforms
        return {
          platform: domain,
          difficulty: platformGuide.difficulty,
          estimatedTime: platformGuide.estimatedTime,
          totalSteps: platformGuide.steps.length,
          currentStep: step || 1,
          guidance: step ? 
            platformGuide.steps.find(s => s.id === step) : 
            platformGuide.steps[0],
          allSteps: platformGuide.steps,
          hasAISupport: true,
          status: 'detailed_guidance_available'
        };
      } else {
        // Return general guidance for unknown platforms
        return {
          platform: domain,
          difficulty: 'Unknown',
          estimatedTime: '5-10 minutes',
          totalSteps: this.generalGuidance.steps.length,
          currentStep: step || 1,
          guidance: step ? 
            this.generalGuidance.steps[step - 1] : 
            this.generalGuidance.steps[0],
          allSteps: this.generalGuidance.steps,
          hasAISupport: true,
          status: 'general_guidance',
          message: 'General guidance provided - each platform is different'
        };
      }
    } catch (error) {
      logger.error('Failed to get unsubscribe guidance', {
        domain,
        step,
        error: error.message
      });
      throw error;
    }
  }

  // AI chat functionality
  async handleUserQuestion(domain, question, currentStep = null) {
    try {
      const normalizedQuestion = question.toLowerCase();
      const platformGuide = this.unsubscribeGuides[domain.toLowerCase()];
      
      // Check for common questions first
      if (platformGuide?.commonQuestions) {
        for (const [key, answer] of Object.entries(platformGuide.commonQuestions)) {
          if (normalizedQuestion.includes(key)) {
            return {
              type: 'direct_answer',
              question: question,
              answer: answer,
              helpful: true,
              suggestedActions: ['Continue with next step', 'Ask another question']
            };
          }
        }
      }

      // Context-aware responses based on current step
      let contextualAnswer = null;
      if (currentStep && platformGuide) {
        const stepInfo = platformGuide.steps.find(s => s.id === currentStep);
        if (stepInfo) {
          contextualAnswer = this.generateContextualAnswer(question, stepInfo);
        }
      }

      // Fallback to general help
      const generalAnswer = this.generateGeneralAnswer(question, domain);

      return {
        type: 'ai_response',
        question: question,
        answer: contextualAnswer || generalAnswer,
        currentStep,
        suggestions: [
          'Can you show me the next step?',
          'What if I cannot find this option?',
          'How long will this take?',
          'Will this delete my account?'
        ]
      };

    } catch (error) {
      logger.error('AI question handling failed', {
        domain,
        question,
        error: error.message
      });

      return {
        type: 'error',
        message: 'I am having trouble understanding your question. Can you please rephrase it?',
        suggestions: [
          'Ask about a specific step',
          'Ask about timing or difficulty',
          'Ask about what happens after unsubscribing'
        ]
      };
    }
  }

  generateContextualAnswer(question, stepInfo) {
    const questionWords = question.toLowerCase();
    
    if (questionWords.includes('find') || questionWords.includes('where')) {
      return `For this step: ${stepInfo.description}. ${stepInfo.tips}. The specific action is: ${stepInfo.action}`;
    }
    
    if (questionWords.includes('next') || questionWords.includes('after')) {
      return `After completing "${stepInfo.title}", you will move to the next step in the unsubscription process.`;
    }
    
    if (questionWords.includes('problem') || questionWords.includes('cannot') || questionWords.includes('stuck')) {
      return `If you are having trouble with "${stepInfo.title}", try this: ${stepInfo.tips}. If the option is not visible, look for similar words or check if you need to scroll down.`;
    }
    
    return null;
  }

  generateGeneralAnswer(question, domain) {
    const questionWords = question.toLowerCase();
    
    if (questionWords.includes('account') && questionWords.includes('delete')) {
      return `This process will unsubscribe you from ${domain} emails, but will not delete your account. Your account will remain active, you just will not receive marketing emails.`;
    }
    
    if (questionWords.includes('time') || questionWords.includes('long')) {
      return `The unsubscription process usually takes 2-5 minutes depending on the platform. Some platforms make it easier than others.`;
    }
    
    if (questionWords.includes('safe') || questionWords.includes('secure')) {
      return `Yes, unsubscribing through official platform settings is completely safe. Always make sure you are on the official website of ${domain}.`;
    }
    
    if (questionWords.includes('resubscribe') || questionWords.includes('change mind')) {
      return `Most platforms allow you to resubscribe to emails through the same settings page, or by clicking "subscribe" in future emails from ${domain}.`;
    }
    
    return `I can help you with unsubscribing from ${domain}. Could you be more specific about what step you need help with?`;
  }

  // Progress tracking
  async trackStepCompletion(userId, domain, step) {
    try {
      // This would integrate with your progress tracking system
      const progress = {
        userId,
        domain,
        step,
        completedAt: new Date(),
        status: 'step_completed'
      };
      
      logger.info('Unsubscribe step completed', progress);
      return progress;
    } catch (error) {
      logger.error('Failed to track step completion', { userId, domain, step, error: error.message });
      throw error;
    }
  }
}

module.exports = new AIUnsubscribeAssistant();
