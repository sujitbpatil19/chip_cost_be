const express = require("express");
const costTables = require("../seed/costTables");
const {
  costPerGoodDie,
  fullyLoadedCostPerDie,
  totalProjectCost,
  costCurve,
  breakEvenVolume,
  diesPerWafer,
  yieldPoisson
} = require("../calc/costEngine");
const { computeTitanTectonComparison } = require("../calc/titanTectonModel");
const { DEFAULT_INPUTS } = require("../models/Project");

const router = express.Router();

const COMPOUND_VOLUMES = [1e4, 1e5, 5e5, 1e6];

/**
 * Shared core computation used by both POST / and POST /cell-library-impact,
 * so manufacturing metrics (dies/wafer, yield, cost per good die) and the
 * Titan Tecton comparison are always derived identically no matter which
 * endpoint is called.
 *
 * Returns { error } on bad input, otherwise the full computed core.
 */
function computeCore(inputs) {
  const {
    node, areaMm2, category, volume, packageType, sellingPrice,
    cellLibraryMode = "standard"
  } = inputs;

  if (!node || !areaMm2) {
    return { error: "Missing required inputs: node, areaMm2" };
  }

  const mask = costTables.masks[node]?.mid;
  const waferCost = costTables.wafers[node]?.mid;
  const d0 = costTables.defectDensity[node]?.mature;
  const pkg = costTables.packaging[packageType];

  if (!mask || !waferCost || !d0) {
    return { error: `Missing cost data. Check node='${node}'.` };
  }

  // Foundry fees — same simple formula costEngine.js's nreCost() has always
  // used (mask * 5%). Shared/unchanged between Conventional and Titan Tecton.
  const foundryFees = mask * 0.05;

  // Manufacturing — the "standard manufacturing method". Identical
  // regardless of Cell Library selection: yield, dies/wafer, fabrication,
  // packaging, and test are never touched by the Titan Tecton model.
  const dpw = diesPerWafer(areaMm2);
  const y = yieldPoisson(areaMm2, d0);
  const cpgd = costPerGoodDie({ waferCost, dieAreaMm2: areaMm2, d0 });
  const packagingPerDie = pkg ? pkg.mid : 2;
  const cpgdFull = fullyLoadedCostPerDie({
    cpgd,
    packagingPerDie,
    testPerDie: 0.5
  });

  // Titan Tecton comparison — Conventional vs Titan Tecton, computed fully
  // independently on each side from the activity-level engineering model
  // (Architecture, RTL Design, Layout Generation, Integration, Other
  // Engineering), EDA, IP license, and the Titan Tecton tool license itself.
  const titanTecton = inputs.titanTecton || DEFAULT_INPUTS.titanTecton;

  // Guard: licenses must be a positive integer. It's a divisor in the
  // layout-generation rate math, so 0/negative would produce Infinity or a
  // negative rate, and fractional counts don't correspond to anything
  // purchasable. Clamp rather than error — this is a cost-estimation tool,
  // not a strict form — and don't mutate titanTecton (it may be the shared
  // DEFAULT_INPUTS.titanTecton reference).
  const rawLicenses = titanTecton.layoutGeneration?.licenses;
  const licenses = Number.isFinite(rawLicenses) && rawLicenses >= 1 ? Math.floor(rawLicenses) : 1;

  const comparison = computeTitanTectonComparison({
    ...titanTecton,
    layoutGeneration: { ...titanTecton.layoutGeneration, licenses },
    mask,
    foundryFees
  });

  const isOptimized = cellLibraryMode === "optimized";
  const effectiveNre = isOptimized ? comparison.nre.titan : comparison.nre.conventional;
  const effectiveDurationMonths = isOptimized
    ? comparison.designEffort.durationMonths.titan
    : comparison.designEffort.durationMonths.conventional;

  const manufacturingCost = volume * cpgdFull;
  const totalCost = totalProjectCost({ nre: effectiveNre, volume, cpgdFull });
  const curve = costCurve(effectiveNre, cpgdFull);
  const be = sellingPrice
    ? breakEvenVolume(effectiveNre, sellingPrice, cpgdFull)
    : null;

  const effectiveNreBreakdown = {
    mask,
    designVerifLabor: isOptimized ? comparison.designEffort.laborCost.titan : comparison.designEffort.laborCost.conventional,
    edaCost: isOptimized ? comparison.eda.cost.titan : comparison.eda.cost.conventional,
    ipLicense: isOptimized ? comparison.ip.titan : comparison.ip.conventional,
    foundryFees,
    contingency: isOptimized ? comparison.contingency.titan : comparison.contingency.conventional,
    titanToolLicenseCost: isOptimized ? comparison.titanToolLicenseCost.total : 0
  };

  return {
    node, areaMm2, category, volume, packageType, sellingPrice,
    mask, waferCost, d0, pkg, foundryFees,
    dpw, y, cpgd, cpgdFull, manufacturingCost,
    comparison, cellLibraryMode: isOptimized ? "optimized" : "standard",
    effectiveNre, effectiveNreBreakdown, effectiveDurationMonths,
    totalCost, curve, be
  };
}

/**
 * POST /api/calc
 * Returns the full result set that matches the frontend's expected shape.
 */
router.post("/", (req, res) => {
  try {
    const core = computeCore(req.body);
    if (core.error) return res.status(400).json({ error: core.error });

    const {
      node, dpw, y, cpgd, cpgdFull, totalCost, curve, be,
      effectiveNre, effectiveNreBreakdown, effectiveDurationMonths, cellLibraryMode
    } = core;

    res.json({
      outputs: {
        nre: effectiveNre,
        nreBreakdown: effectiveNreBreakdown,
        diesPerWafer: dpw,
        yield: y,
        cpgd,
        cpgdFull,
        totalCost,
        costCurve: curve,
        breakEvenVolume: be,
        cellLibraryMode,
        timelineMonths: {
          low: Math.ceil(effectiveDurationMonths) + 5,
          high: Math.ceil(effectiveDurationMonths) + 9
        }
      },
      dataSources: {
        mask: costTables.masks[node],
        wafer: costTables.wafers[node],
        d0: costTables.defectDensity[node]
      }
    });
  } catch (err) {
    console.error("[calc]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/calc/cell-library-impact
 *
 * Titan Tecton Impact — the full Conventional vs Titan Tecton comparison:
 * activity-level engineering effort, the Layout Generation throughput
 * model, design/verification labor, EDA, IP license, and NRE/total-bill
 * totals for both sides. Manufacturing metrics (die area, dies/wafer,
 * yield, cost per good die) are identical on both sides — the standard
 * manufacturing method never changes.
 */
router.post("/cell-library-impact", (req, res) => {
  try {
    const core = computeCore(req.body);
    if (core.error) return res.status(400).json({ error: core.error });

    const { areaMm2, dpw, y, cpgd, cpgdFull, comparison, cellLibraryMode } = core;

    const compound = COMPOUND_VOLUMES.map((volume) => {
      const totalBillConventional = comparison.nre.conventional + volume * cpgdFull;
      const totalBillTitan = comparison.nre.titan + volume * cpgdFull;
      const savings = totalBillConventional - totalBillTitan;
      const savingsPct = totalBillConventional > 0 ? (savings / totalBillConventional) * 100 : 0;
      return { volume, totalBillConventional, totalBillTitan, savings, savingsPct };
    });

    res.json({
      impact: {
        mode: cellLibraryMode,
        // Fixed "standard manufacturing method" — identical regardless of
        // which Cell Library option is selected.
        manufacturing: {
          areaMm2,
          diesPerWafer: dpw,
          yield: y,
          costPerGoodDie: cpgd,
          cpgdFull
        },
        activityRows: comparison.activityRows,
        layoutGeneration: comparison.layoutGeneration,
        designEffort: comparison.designEffort,
        eda: comparison.eda,
        ip: comparison.ip,
        titanToolLicenseCost: comparison.titanToolLicenseCost,
        contingency: comparison.contingency,
        nre: comparison.nre
      },
      compound
    });
  } catch (err) {
    console.error("[cell-library-impact]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/calc/nodes — dropdown options
 */
router.get("/nodes", (req, res) => {
  res.json(Object.keys(costTables.masks));
});

/**
 * GET /api/calc/data-tables — for the transparency/sources panel
 */
router.get("/data-tables", (req, res) => {
  res.json({
    masks: costTables.masks,
    wafers: costTables.wafers,
    labor: costTables.labor,
    packaging: costTables.packaging,
    sources: costTables.sources
  });
});

module.exports = router;
