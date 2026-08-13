const { GoogleGenerativeAI } = require("@google/generative-ai");

let embedModel = null;

function getModel() {
  if (!embedModel) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "your-gemini-key-here") {
      throw new Error("GEMINI_API_KEY not set. Get one free at https://aistudio.google.com/apikey");
    }
    const genAI = new GoogleGenerativeAI(key);
    embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
  }
  return embedModel;
}

/**
 * Generate embedding vector for a single text.
 * Returns array of ~768 numbers.
 */
async function getEmbedding(text) {
  const model = getModel();
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Batch embedding — sequential (Gemini free tier has rate limits).
 * For seed script — throttled to stay under free-tier limits.
 */
async function getEmbeddings(texts) {
  const out = [];
  for (const t of texts) {
    out.push(await getEmbedding(t));
    // Throttle slightly to avoid rate limits (~15 req/min on free tier)
    await new Promise(r => setTimeout(r, 250));
  }
  return out;
}

module.exports = { getEmbedding, getEmbeddings };
