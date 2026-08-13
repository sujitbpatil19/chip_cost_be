const CostData = require("../models/CostData");
const { getEmbedding } = require("./embeddings");

/**
 * Retrieval-Augmented Generation logic.
 * In-memory cosine similarity search — perfect for the ~40 documents in our knowledge base.
 * No vector DB required.
 */

let cache = null;
let cacheLoadedAt = null;

async function loadCache() {
  console.log("[RAG] Loading knowledge base into memory...");
  const docs = await CostData.find({}).lean();
  cache = docs;
  cacheLoadedAt = Date.now();
  console.log(`[RAG] Cache loaded: ${docs.length} documents`);
  return docs.length;
}

async function ensureCache() {
  if (!cache) await loadCache();
  return cache;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Retrieve top-K most relevant cost data documents.
 */
async function retrieveContext(query, k = 5) {
  const docs = await ensureCache();
  if (docs.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scored = docs
    .filter(d => d.embedding && d.embedding.length > 0)
    .map(doc => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Format retrieved docs into a context block for the LLM prompt.
 */
function formatContext(retrieved) {
  if (!retrieved.length) return "(no relevant context found)";
  return retrieved
    .map((r, i) => {
      const sources = (r.doc.sources || []).map(s => s.title).join(", ");
      return `[${i + 1}] ${r.doc.text}\nSources: ${sources}`;
    })
    .join("\n\n");
}

/**
 * Extract unique source citations from retrieved docs.
 */
function extractSources(retrieved) {
  const seen = new Set();
  const out = [];
  for (const r of retrieved) {
    for (const s of r.doc.sources || []) {
      const key = s.url || s.title;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ title: s.title, url: s.url });
      }
    }
  }
  return out;
}

module.exports = {
  loadCache,
  retrieveContext,
  formatContext,
  extractSources
};
