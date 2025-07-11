const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log('✅ Google login success!');
    console.log('User:', req.user.displayName);
    console.log('Full user object:', JSON.stringify(req.user, null, 2)); // ✅ Debug full user
    console.log('Access Token exists:', !!req.user.accessToken); // ✅ Check token exists
    console.log('Refresh Token exists:', !!req.user.refreshToken); // ✅ Check refresh token
    res.redirect('http://localhost:3000');
  }
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    console.log('✅ /me route - user object:', JSON.stringify(req.user, null, 2)); // ✅ Debug
    res.json({
      id: req.user.id,
      name: req.user.displayName,
      email: req.user.emails[0].value,
      hasAccessToken: !!req.user.accessToken, // ✅ Include token status
      hasRefreshToken: !!req.user.refreshToken // ✅ Include refresh token status
    });
  } else {
    res.status(401).json({ msg: "Not logged in" });
  }
});

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

module.exports = router;