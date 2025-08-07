require('dotenv').config();

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const logger = require('../utils/logger');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    logger.info('Google OAuth callback received', {
      profileId: profile.id,
      email: profile.emails[0]?.value,
      hasRefreshToken: !!refreshToken,
      tokenExpiry: profile._json?.exp || 'unknown'
    });

    const email = profile.emails[0]?.value;
    const profilePicture = profile.photos[0]?.value;

    if (!email) {
      logger.error('No email found in Google profile', { profileId: profile.id });
      return done(new Error('Email is required for account creation'), null);
    }

    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      const updateData = {
        displayName: profile.displayName,
        email: email,
        accessToken: accessToken,
        tokenExpiry: profile._json?.exp ?
          new Date(profile._json.exp * 1000) :
          new Date(Date.now() + 3600 * 1000),
        lastTokenRefresh: new Date(),
        lastActive: new Date()
      };

      if (refreshToken) {
        updateData.refreshToken = refreshToken;
        updateData.tokenRefreshCount = (user.tokenRefreshCount || 0) + 1;
      }

      if (profilePicture && profilePicture !== user.profilePicture) {
        updateData.profilePicture = profilePicture;
      }

      user = await User.findByIdAndUpdate(user._id, updateData, { new: true });

      logger.info('Existing user updated', {
        userId: user._id,
        email: user.email,
        tokenRefreshed: !!refreshToken,
        tokenExpiry: user.tokenExpiry
      });

    } else {
      if (!refreshToken) {
        logger.warn('New user signup without refresh token', { profileId: profile.id, email });
        return done(new Error('Refresh token is required for new users. Please try logging in again.'), null);
      }

      user = new User({
        googleId: profile.id,
        displayName: profile.displayName,
        email: email,
        profilePicture: profilePicture,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiry: profile._json?.exp ?
          new Date(profile._json.exp * 1000) :
          new Date(Date.now() + 3600 * 1000),
        lastTokenRefresh: new Date(),
        lastActive: new Date(),
        createdAt: new Date(),
        accountStatus: 'active',
        isVerified: true,
        analytics: {
          loginCount: 1,
          lastLoginDate: new Date(),
          apiCallsCount: 0
        },
        preferences: {
          emailNotifications: true,
          autoScan: false,
          scanFrequency: 'weekly',
          theme: 'auto',
          language: 'en'
        }
      });

      await user.save();

      logger.info('New user created', {
        userId: user._id,
        email: user.email,
        googleId: user.googleId
      });
    }

    await user.updateLastLogin();

    const userForSession = {
      id: user._id.toString(),
      googleId: user.googleId,
      displayName: user.displayName,
      email: user.email,
      profilePicture: user.profilePicture,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiry: user.tokenExpiry,
      accountStatus: user.accountStatus,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    };

    return done(null, userForSession);

  } catch (error) {
    logger.error('Google OAuth strategy error', {
      error: error.message,
      stack: error.stack,
      profileId: profile.id,
      email: profile.emails[0]?.value
    });
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  logger.debug('Serializing user for session', { userId: user.id });
  done(null, {
    id: user.id,
    googleId: user.googleId,
    sessionTimestamp: Date.now()
  });
});

passport.deserializeUser(async (sessionData, done) => {
  try {
    logger.debug('Deserializing user from session', {
      userId: sessionData.id,
      googleId: sessionData.googleId
    });

    const user = await User.findById(sessionData.id);

    if (!user) {
      logger.warn('User not found during deserialization', { userId: sessionData.id });
      return done(null, false);
    }

    if (user.accountStatus !== 'active') {
      logger.warn('Inactive user attempted to access system', {
        userId: user._id,
        status: user.accountStatus
      });
      return done(null, false);
    }

    const userForRequest = {
      id: user._id.toString(),
      googleId: user.googleId,
      displayName: user.displayName,
      email: user.email,
      profilePicture: user.profilePicture,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiry: user.tokenExpiry,
      accountStatus: user.accountStatus,
      isPremium: user.isPremium,
      preferences: user.preferences,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      lastScan: user.lastScan,
      signupServices: user.signupServices || []
    };

    User.findByIdAndUpdate(user._id, {
      lastActive: new Date()
    }).catch(err => {
      logger.warn('Failed to update lastActive', {
        userId: user._id,
        error: err.message
      });
    });

    return done(null, userForRequest);

  } catch (error) {
    logger.error('User deserialization error', {
      userId: sessionData.id,
      error: error.message,
      stack: error.stack
    });

    return done(error, null);
  }
});

module.exports = passport;
