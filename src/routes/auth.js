const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "7d";

/**
 * POST /api/auth/register
 * body: { email, password }
 * returns: { token, user: { id, email } }
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase(), passwordHash });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: TOKEN_TTL });

    res.json({
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 * returns: { token, user: { id, email } }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.json({
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
