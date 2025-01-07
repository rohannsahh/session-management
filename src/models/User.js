const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
    pagesVisited: { type: [String], default: [] },
    lastSessionStart: { type: Date.now() },
    lastSessionDuration: { type: Number, default: 0 },
  activityLog: [{ action: String, timestamp: Date.now() }],
});

const UserSchema = new mongoose.Schema({
  userId: {type: mongoose.Types.ObjectId  } ,
  username: {
    type: String, required: true, unique: true,},
  password: {
    type: String,
    required: [true, 'Password is required'],
},
  preferences: {
    theme: { type: String, enum: ["dark", "light"], default: "light" },
    notifications: { type: String, enum: ["enabled", "disabled"], default: "enabled" },
    language: { type: String, default: "English" },
},
  sessions: [SessionSchema],
},{timestamps: true});



module.exports = mongoose.model("User", UserSchema);
