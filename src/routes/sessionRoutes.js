const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Start Session
router.post("/", (req, res) => {
  req.session.startTime = new Date();
  req.session.pagesVisited = [];
  req.session.activityLog = [];
  res.status(200).json({ message: "Session started" });
});

// Log Page Visit
router.post("/page", (req, res) => {
  const { page } = req.body;

  req.session.pagesVisited.push(page);
  res.status(200).json({ message: "Page logged", page });
});

// Log Activity
router.post("/action", (req, res) => {
  const { action } = req.body;

  req.session.activityLog.push({ action, timestamp: new Date() });
  res.status(200).json({ message: "Action logged", action });
});

// Get Session Logs with Pagination
router.get("/logs", (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const startIndex = (page - 1) * limit;
  const paginatedLogs = req.session.activityLog.slice(startIndex, startIndex + limit);

  res.status(200).json({
    logs: paginatedLogs,
    totalPages: Math.ceil(req.session.activityLog.length / limit),
  });
});

// End Session
router.delete("/", async (req, res) => {
  const { authenticatedUser, startTime, activityLog, pagesVisited } = req.session;

  if (authenticatedUser) {
    const duration = Date.now() - new Date(startTime).getTime();

    await User.updateOne(
      { userId: authenticatedUser },
      {
        $push: {
          sessions: {
            startTime,
            duration,
            pagesVisited,
            activityLog,
          },
        },
      }
    );
  }

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Failed to end session" });
    res.status(200).json({ message: "Session ended" });
  });
});

module.exports = router;
