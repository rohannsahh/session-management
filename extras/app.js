// Optimized Session Management System for Squid

const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const zlib = require('zlib');
const { promisify } = require('util');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Redis setup
const redisClient = new Redis();
const redisSet = promisify(redisClient.set).bind(redisClient);
const redisGet = promisify(redisClient.get).bind(redisClient);
const redisPub = redisClient.duplicate();
const redisSub = redisClient.duplicate();

const sessionStore = new RedisStore({ client: redisClient });

app.use(
    session({
        store: sessionStore,
        secret: 'super-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 1800000, // 30 minutes
        },
    })
);

// MongoDB setup
mongoose.connect('mongodb://localhost:27017/squid', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const sessionSchema = new mongoose.Schema({
    sessionId: String,
    userId: String,
    startTime: Date,
    pagesVisited: [String],
    updatedAt: { type: Date, default: Date.now },
});

sessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 1800 });

const Session = mongoose.model('Session', sessionSchema);

// Middleware to sync session data to MongoDB
const syncSessionToMongo = async (req, res, next) => {
    if (req.session.userId) {
        const sessionData = req.session;
        await Session.findOneAndUpdate(
            { sessionId: sessionData.id },
            {
                $set: {
                    userId: sessionData.userId,
                    startTime: sessionData.startTime,
                    pagesVisited: sessionData.pagesVisited,
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );
    }
    next();
};

app.use(syncSessionToMongo);

// Preferences Endpoints
app.post('/preferences', (req, res) => {
    const { theme, notifications, language } = req.body;

    if (!theme || !notifications || !language) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const preferences = { theme, notifications, language };
    const compressedPrefs = zlib.gzipSync(JSON.stringify(preferences));

    res.cookie('preferences', compressedPrefs.toString('base64'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ message: 'Preferences saved.' });
});

app.get('/preferences', (req, res) => {
    const compressedPrefs = req.cookies.preferences;

    if (!compressedPrefs) {
        return res.status(404).json({ error: 'Preferences not found.' });
    }

    const preferences = JSON.parse(zlib.gunzipSync(Buffer.from(compressedPrefs, 'base64')));
    res.json(preferences);
});

// Session Endpoints
app.post('/session', (req, res) => {
    req.session.startTime = new Date();
    req.session.pagesVisited = [];
    res.json({ message: 'Session started.' });
});

app.get('/session', (req, res) => {
    if (!req.session.startTime) {
        return res.status(404).json({ error: 'No active session.' });
    }

    const sessionDuration = Math.round((Date.now() - req.session.startTime.getTime()) / 1000);

    res.json({
        startTime: req.session.startTime,
        pagesVisited: req.session.pagesVisited,
        duration: `${sessionDuration} seconds`,
    });
});

app.post('/session/page', (req, res) => {
    const { page } = req.body;

    if (!page) {
        return res.status(400).json({ error: 'Page is required.' });
    }

    req.session.pagesVisited.push(page);
    redisPub.publish('session_updates', JSON.stringify({ sessionId: req.session.id, page }));
    res.json({ message: 'Page visit logged.' });
});

app.delete('/session', (req, res) => {
    const sessionId = req.session.id;
    req.session.destroy(async (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to end session.' });
        }
        await Session.deleteOne({ sessionId });
        res.json({ message: 'Session ended.' });
    });
});

// Redis Subscriber to sync session updates
redisSub.subscribe('session_updates');
redisSub.on('message', async (channel, message) => {
    if (channel === 'session_updates') {
        const { sessionId, page } = JSON.parse(message);
        await Session.updateOne(
            { sessionId },
            { $push: { pagesVisited: page }, $set: { updatedAt: new Date() } }
        );
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
