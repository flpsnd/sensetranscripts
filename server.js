const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');

// In-memory store for demo
let userContext = {};

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, cb) => cb(null, profile)));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((obj, cb) => cb(null, obj));

const app = express();
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.post('/api/save-context', upload.single('docx'), async (req, res) => {
  try {
    const { notes, apiKey, slackUsers } = req.body;
    let docxText = '';
    if (req.file) {
      const buf = fs.readFileSync(req.file.path);
      const result = await mammoth.extractRawText({ buffer: buf });
      docxText = result.value;
    }
    userContext[req.user.id] = { notes, apiKey, slackUsers: slackUsers.split(','), docxText };
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/context', (req, res) => {
  const ctx = userContext[req.user.id] || {};
  res.json(ctx);
});

app.post('/api/ai/process', (req, res) => {
  // Placeholder for GenAI call using stored context
  const ctx = userContext[req.user.id];
  if (!ctx) return res.status(400).json({ error: 'no context' });
  const summary = `Processed notes for ${req.user.displayName}`; // stub
  res.json({ summary });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
