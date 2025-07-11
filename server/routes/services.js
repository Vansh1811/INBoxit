const express = require('express');
const router = express.Router();

router.get('/test-connection', (req, res) => {
  const services = ['Gmail']; // Add logic to check actual connections
  res.json({ services });
});

module.exports = router;