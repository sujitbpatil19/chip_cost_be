const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  title: String,
  url: String
}, { _id: false });

/**
 * Knowledge base document with embedding for RAG retrieval.
 * Each doc is a searchable "fact" about chip economics.
 */
const costDataSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ["masks", "wafers", "defect", "labor", "packaging", "general"],
    required: true
  },
  node: String,
  text: { type: String, required: true },
  metadata: Object,
  sources: { type: [sourceSchema], default: [] },
  embedding: { type: [Number], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CostData", costDataSchema);
