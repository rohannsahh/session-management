// Required Libraries
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const RedisStore = require("connect-redis")(session);
const Redis = require("ioredis");
const Joi = require("joi");
require("dotenv").config();

// Initialize Redis and Express
const redisClient = new Redis();
const app = express();
app.use(express.json());
app.use(cookieParser());

// MongoDB Configuration
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const UserSchema = new mongoose.Schema({
  username: String,
  preferences: {
    theme: String,
    notifications: String,
    language: String,
  },
  sessions: [
    {
      startTime: Date,
      duration: Number,
      pagesVisited: [String],
    },
  ],
});

const User = mongoose.model("User", UserSchema);

// Middleware for session handling
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 30 * 60 * 1000, // 30 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  })
);

// Input Validation Schemas
const preferencesSchema = Joi.object({
  theme: Joi.string().valid("dark", "light").required(),
  notifications: Joi.string().valid("enabled", "disabled").required(),
  language: Joi.string().required(),
});

const pageSchema = Joi.object({
  page: Joi.string().required(),
});

// Endpoints

// User Preferences Endpoints
app.post("/preferences", async (req, res) => {
  const { error } = preferencesSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { theme, notifications, language } = req.body;
  const user = req.session.user || { preferences: {} };

  user.preferences = { theme, notifications, language };

  if (req.session.authenticatedUser) {
    await User.updateOne(
      { username: req.session.authenticatedUser },
      { $set: { preferences: user.preferences } },
      { upsert: true }
    );
  }

  res.cookie("preferences", JSON.stringify(user.preferences), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  req.session.user = user;
  res.status(200).json({ message: "Preferences saved", preferences: user.preferences });
});

app.get("/preferences", (req, res) => {
  const preferences = req.session.user?.preferences || {};
  res.status(200).json({ preferences });
});

// Session Management Endpoints
app.post("/session", (req, res) => {
  req.session.startTime = new Date();
  req.session.pagesVisited = [];
  res.status(200).json({ message: "Session started" });
});

app.get("/session", (req, res) => {
  if (!req.session.startTime) {
    return res.status(404).json({ message: "No active session" });
  }

  const duration = Date.now() - new Date(req.session.startTime).getTime();
  res.status(200).json({
    startTime: req.session.startTime,
    duration,
    pagesVisited: req.session.pagesVisited,
  });
});

app.post("/session/page", (req, res) => {
  const { error } = pageSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { page } = req.body;
  if (!req.session.pagesVisited) req.session.pagesVisited = [];
  req.session.pagesVisited.push(page);
  res.status(200).json({ message: "Page logged", page });
});

app.delete("/session", async (req, res) => {
  if (req.session.authenticatedUser) {
    const duration = Date.now() - new Date(req.session.startTime).getTime();
    await User.updateOne(
      { username: req.session.authenticatedUser },
      {
        $push: {
          sessions: {
            startTime: req.session.startTime,
            duration,
            pagesVisited: req.session.pagesVisited,
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

// Pagination for session logs
app.get("/session/logs", (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  if (!req.session.pagesVisited) {
    return res.status(404).json({ message: "No pages visited" });
  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedLogs = req.session.pagesVisited.slice(startIndex, endIndex);

  res.status(200).json({
    logs: paginatedLogs,
    totalPages: Math.ceil(req.session.pagesVisited.length / limit),
  });
});

// Server Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
