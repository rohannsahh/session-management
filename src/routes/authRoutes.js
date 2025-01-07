const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Login Route
router.post("/login", async (req, res) => {
  const { username } = req.body;

  const user = await User.findOne({ username });

  if (user) {
    req.session.authenticatedUser = user.userId;
    req.session.user = {
      preferences: user.preferences,
      sessions: user.sessions,
    };

    res.status(200).json({
      message: "Login successful",
      preferences: user.preferences,
    });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// Logout Route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.status(200).json({ message: "Logout successful" });
  });
});

module.exports = router;
