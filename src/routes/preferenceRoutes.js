const express = require("express");
const User = require("../models/User");
const preferencesSchema = require("../utils/validate");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

// Save Preferences
router.post("/", authMiddleware, async (req, res) => {
  const { theme, notifications, language } = req.body;

  const { error } = preferencesSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  req.session.user.preferences = { theme, notifications, language };

  if (req.session.authenticatedUser) {
    await User.updateOne(
      { userId: req.session.authenticatedUser },
      { $set: { preferences: req.session.user.preferences } },
      { upsert: true }
    );
  }

  res.status(200).json({ message: "Preferences saved" });
});

// Get Preferences
router.get("/", authMiddleware, (req, res) => {
  res.status(200).json({ preferences: req.session.user.preferences || {} });
});

module.exports = router;
