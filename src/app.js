require("dotenv").config();
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./config/database");
const redisClient = require("./config/redis");

// Routes
const authRoutes = require("./routes/authRoutes");
const preferencesRoutes = require("./routes/preferencesRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

connectDB();

// Session Middleware
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 30 * 60 * 1000, 
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  })
);

// Routes Middleware
app.use("/api/auth", authRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/session", sessionRoutes);

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
