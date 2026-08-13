require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { loadCache } = require("./ai/rag");

const app = express();

// Core middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Rate limit AI endpoint to prevent runaway API costs
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many AI requests. Please slow down (20/min limit)." }
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/calc", require("./routes/calc"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/copilot", aiLimiter, require("./routes/copilot"));

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    // Warm the RAG cache in the background (non-blocking)
    loadCache().catch(err => console.warn("RAG cache warm-up failed:", err.message));

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║  ChipCost API running                      ║
║  http://localhost:${PORT}                       ║
║  Health: /api/health                       ║
╚════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

start();
