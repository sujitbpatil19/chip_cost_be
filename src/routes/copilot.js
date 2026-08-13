const express = require("express");
const { askAI } = require("../ai/llm");
const { retrieveContext, formatContext, extractSources } = require("../ai/rag");
const { COPILOT_SYSTEM, buildUserPrompt } = require("../ai/prompts");
const { evaluateRules, buildRuleFallbackResponse } = require("../ai/rules");
const Conversation = require("../models/Conversation");

const router = express.Router();

/**
 * POST /api/copilot/query
 * body: { query, projectState, results, projectId }
 * returns: { response, sources: [{ title, url }] }
 *
 * Full RAG flow:
 *   1. Retrieve top-K relevant cost data docs via vector search
 *   2. Build LLM prompt with context + project state + user query
 *   3. Call Gemini
 *   4. If LLM fails, fall back to rule-based advisor
 *   5. Return response + source citations
 *   6. Persist to conversation history (if projectId provided)
 */
router.post("/query", async (req, res) => {
  try {
    const { query, projectState, results, projectId } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing or invalid query" });
    }

    // === Retrieve context via RAG ===
    let retrieved = [];
    let sources = [];
    try {
      retrieved = await retrieveContext(query, 5);
      sources = extractSources(retrieved);
    } catch (ragErr) {
      console.warn("[copilot] RAG failed, continuing without context:", ragErr.message);
    }

    const contextText = formatContext(retrieved);
    const userPrompt = buildUserPrompt({
      query,
      projectState,
      results,
      retrievedContext: contextText
    });

    // === Call LLM (with rule-based fallback) ===
    let response;
    try {
      response = await askAI({
        systemPrompt: COPILOT_SYSTEM,
        userMessage: userPrompt
      });
    } catch (llmErr) {
      console.warn("[copilot] LLM failed, falling back to rules:", llmErr.message);
      const insights = evaluateRules({ inputs: projectState, results });
      response = buildRuleFallbackResponse(insights);
      // Signal fallback in sources
      sources = sources.length ? sources : [{ title: "Rule-based advisor (LLM unavailable)", url: "" }];
    }

    // === Persist to conversation history ===
    if (projectId) {
      try {
        await Conversation.updateOne(
          { projectId },
          {
            $push: {
              messages: {
                $each: [
                  { role: "user", content: query, timestamp: new Date() },
                  { role: "assistant", content: response, sources, timestamp: new Date() }
                ]
              }
            },
            $setOnInsert: { projectId, createdAt: new Date() }
          },
          { upsert: true }
        );
      } catch (persistErr) {
        console.warn("[copilot] Persist failed:", persistErr.message);
      }
    }

    res.json({ response, sources });
  } catch (err) {
    console.error("[copilot.query]", err);
    res.status(500).json({ error: err.message || "AI request failed" });
  }
});

/**
 * POST /api/copilot/insights
 * Rule-based proactive insights (no LLM call).
 * Fast, deterministic — safe to call on every input change.
 */
router.post("/insights", (req, res) => {
  try {
    const { inputs, results } = req.body;
    const insights = evaluateRules({ inputs, results });
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/copilot/history/:projectId
 */
router.get("/history/:projectId", async (req, res) => {
  try {
    const convo = await Conversation.findOne({ projectId: req.params.projectId });
    res.json(convo || { messages: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
