/**
 * Seed script: populate MongoDB with cost data + embeddings for RAG.
 * Run: `npm run seed`
 *
 * NOTE: This uses your GEMINI_API_KEY quota. Free tier is fine.
 * ~50 documents × ~1 sec each = ~1 minute to complete.
 */
require("dotenv").config();
const connectDB = require("../config/db");
const CostData = require("../models/CostData");
const { getEmbeddings } = require("../ai/embeddings");
const costTables = require("./costTables");

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

/**
 * Build human-readable documents from the cost tables.
 * Each doc becomes a searchable fact for the AI Copilot.
 */
function buildDocuments() {
  const docs = [];

  // Mask cost documents (per node)
  for (const [node, cost] of Object.entries(costTables.masks)) {
    docs.push({
      category: "masks",
      node,
      text: `Mask set cost for the ${node} process node ranges from ${formatMoney(cost.low)} to ${formatMoney(cost.high)}. This is one of the largest NRE items and scales sharply with process complexity. EUV lithography at 7nm and below drives this cost significantly higher due to multi-patterning and mask complexity.`,
      metadata: cost,
      sources: costTables.sources.masks
    });
  }

  // Wafer cost documents (per node)
  for (const [node, cost] of Object.entries(costTables.wafers)) {
    docs.push({
      category: "wafers",
      node,
      text: `A 300mm wafer at ${node} costs approximately $${cost.low.toLocaleString()} to $${cost.high.toLocaleString()}. Wafer cost is the primary variable cost of production. Advanced nodes cost multiples of mature nodes due to EUV, multi-patterning, and lower initial yields during ramp.`,
      metadata: cost,
      sources: costTables.sources.wafers
    });
  }

  // Defect density / yield documents
  for (const [node, d0] of Object.entries(costTables.defectDensity)) {
    docs.push({
      category: "defect",
      node,
      text: `At ${node}, mature defect density (D0) is approximately ${d0.mature} defects/cm², rising to ${d0.ramp} defects/cm² during early production ramp. Defect density directly determines yield through the Poisson model Y = e^(-A × D0), where A is die area in cm². Smaller dies always yield better.`,
      metadata: d0,
      sources: costTables.sources.defectDensity
    });
  }

  // Labor documents (per region)
  for (const [region, data] of Object.entries(costTables.labor)) {
    docs.push({
      category: "labor",
      text: `Chip designer loaded cost in ${data.label} averages ${formatMoney(data.loaded)} per engineer per year, based on ${formatMoney(data.base)} base salary times a 1.5-2x loaded multiplier for benefits, tools, real estate, and overhead. This is the primary driver of design NRE.`,
      metadata: data,
      sources: costTables.sources.labor
    });
  }

  // Packaging documents (per type)
  for (const [type, data] of Object.entries(costTables.packaging)) {
    docs.push({
      category: "packaging",
      text: `${data.label} packaging costs $${data.low} to $${data.high} per unit. Advanced packaging like CoWoS is required for AI accelerators using HBM, driving packaging costs above $50/unit and sometimes into the hundreds. Package choice significantly affects per-die cost.`,
      metadata: data,
      sources: costTables.sources.packaging
    });
  }

  // General economics facts (non-node-specific)
  docs.push({
    category: "general",
    text: "Cell library area reduction has a compounding effect on chip economics. A 12% smaller cell library shrinks die area 12%, which increases dies-per-wafer by ~15%, which improves yield (smaller dies yield better via the Poisson model), which further reduces cost per die. Net savings often exceed the initial area reduction percentage.",
    sources: [{ title: "ChipCost internal analysis", url: "" }]
  });

  docs.push({
    category: "general",
    text: "AI-optimized standard cell libraries typically deliver 8-15% area reduction versus standard commercial libraries. This is based on published DTCO (Design-Technology Co-Optimization) papers at DAC and VLSI Symposium showing that AI-driven co-optimization of transistor sizing, layout, and process rules can exceed hand-tuned designs.",
    sources: [
      { title: "DAC DTCO papers", url: "https://www.dac.com" },
      { title: "VLSI Symposium proceedings", url: "https://www.vlsisymposium.org" }
    ]
  });

  docs.push({
    category: "general",
    text: "MPW (Multi-Project Wafer) shuttles are a cost-effective option for prototypes and small volumes. Efabless offers SkyWater 130nm shuttles from $10K, Muse Semiconductor offers TSMC nodes from $15K, and MOSIS and Europractice serve academic customers. For volumes under a few thousand units, MPW is dramatically cheaper than dedicated mask sets.",
    sources: [
      { title: "Efabless", url: "https://efabless.com" },
      { title: "Muse Semiconductor", url: "https://www.musesemi.com" },
      { title: "MOSIS", url: "https://www.mosis.com" }
    ]
  });

  docs.push({
    category: "general",
    text: "The Bosch/de Vries formula computes dies per 300mm wafer as: DPW = (π × (D/2)²) / S − (π × D) / √(2 × S), where D is wafer diameter (300mm) and S is die area (mm²). The second term corrects for wafer edge exclusion. Typical results: a 100 mm² die yields ~590 dies gross before yield loss.",
    sources: [{ title: "Semiconductor manufacturing textbooks", url: "" }]
  });

  docs.push({
    category: "general",
    text: "Break-even volume for a chip project is computed as NRE / (Selling Price − Cost per Die). If the selling price is less than or equal to per-die cost, no break-even exists at any volume — the project is not economically viable at that price. Consider raising price, cutting cost, or increasing volume.",
    sources: [{ title: "ChipCost methodology", url: "" }]
  });

  return docs;
}

async function seed() {
  console.log("=== ChipCost RAG Knowledge Base Seed ===\n");
  await connectDB();

  console.log("Clearing existing cost data...");
  await CostData.deleteMany({});

  console.log("Building documents from cost tables...");
  const docs = buildDocuments();
  console.log(`Built ${docs.length} documents.\n`);

  console.log("Generating embeddings via Gemini (this takes ~1 minute)...");
  console.log("If this fails: check your GEMINI_API_KEY in .env\n");
  const texts = docs.map(d => d.text);

  let embeddings;
  try {
    embeddings = await getEmbeddings(texts);
  } catch (err) {
    console.error("\n✗ Embedding generation failed:");
    console.error("  Error:", err.message);
    console.error("\nCheck your GEMINI_API_KEY in .env");
    console.error("Get one free at: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  console.log(`\n✓ Generated ${embeddings.length} embeddings.`);

  console.log("Saving to MongoDB...");
  const withEmbeddings = docs.map((d, i) => ({ ...d, embedding: embeddings[i] }));
  await CostData.insertMany(withEmbeddings);

  console.log(`\n✓ Seeded ${withEmbeddings.length} cost data documents with embeddings.`);
  console.log("\nOpen MongoDB Compass and browse `chipcost.costdatas` to inspect them.");
  console.log("Start the server with: npm run dev\n");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
