const express = require("express");
const costTables = require("../seed/costTables");
const {
  nreCost,
  costPerGoodDie,
  fullyLoadedCostPerDie,
  totalProjectCost,
  costCurve,
  breakEvenVolume,
  diesPerWafer,
  yieldPoisson
} = require("../calc/costEngine");
const { applyCellLibraryToggle, compoundOverVolumes } = require("../calc/cellLibraryDesignCost");

const router = express.Router();

const COMPOUND_VOLUMES = [1e4, 1e5, 5e5, 1e6];

/**
 * Shared core computation used by both POST / and POST /cell-library-impact,
 * so manufacturing metrics (dies/wafer, yield, cost per good die) and NRE
 * are always derived identically no matter which endpoint is called.
 *
 * Returns { error } on bad input, otherwise the full computed core.
 */
function computeCore(inputs) {
  const {
    node, areaMm2, category, volume, teamSize, region,
    designMonths, packageType, sellingPrice,
    cellLibraryMode = "standard"
  } = inputs;

  if (!node || !areaMm2 || !region) {
    return { error: "Missing required inputs: node, areaMm2, region" };
  }

  const mask = costTables.masks[node]?.mid;
  const waferCost = costTables.wafers[node]?.mid;
  const d0 = costTables.defectDensity[node]?.mature;
  const labor = costTables.labor[region];
  const pkg = costTables.packaging[packageType];

  if (!mask || !waferCost || !d0 || !labor) {
    return { error: `Missing cost data. Check node='${node}' and region='${region}'.` };
  }

  const monthlyLoaded = labor.loaded / 12;

  // NRE (with breakdown) — standard, unmodified by the Cell Library toggle.
  const nre = nreCost({
    mask,
    teamSize,
    months: designMonths,
    monthlyLoaded,
    ipLicense: 500_000,
    edaAnnualPerSeat: 200_000
  });

  // Manufacturing — the "standard manufacturing method". Identical
  // regardless of Cell Library selection: yield, dies/wafer, fabrication,
  // packaging, and test are never touched by the design-cost toggle.
  const dpw = diesPerWafer(areaMm2);
  const y = yieldPoisson(areaMm2, d0);
  const cpgd = costPerGoodDie({ waferCost, dieAreaMm2: areaMm2, d0 });
  const packagingPerDie = pkg ? pkg.mid : 2;
  const cpgdFull = fullyLoadedCostPerDie({
    cpgd,
    packagingPerDie,
    testPerDie: 0.5
  });

  // Titan Tecton (our cell library product) generates layouts that are
  // already LVS/DRC-clean, so it replaces both manual design effort AND
  // manual verification (LVS/DRC) effort. The flat 75% reduction therefore
  // applies to design labor + verification labor combined.
  //
  // EDA licenses and IP license are NOT discounted — EDA tool licenses cover
  // the broader chip-level flow (synthesis, STA, place & route, etc.) that
  // Titan Tecton doesn't replace, and IP license covers third-party
  // functional IP (e.g. CPU/memory/PHY cores) unrelated to the cell
  // library. Mask, foundry fees, and contingency are likewise untouched.
  const designAndVerifStandard = nre.breakdown.designLabor + nre.breakdown.verifLabor;
  const manufacturingCost = volume * cpgdFull;
  const cellLibrary = applyCellLibraryToggle({
    nreTotal: nre.total,
    designCostStandard: designAndVerifStandard,
    manufacturingCost,
    mode: cellLibraryMode === "optimized" ? "optimized" : "standard"
  });

  // Scale design labor and verification labor by the same factor so the
  // NRE breakdown table stays internally consistent with the combined
  // discount (both line items get reduced together, at the same rate).
  const scaleFactor = designAndVerifStandard > 0
    ? cellLibrary.effectiveDesignCost / designAndVerifStandard
    : 1;
  const effectiveNreBreakdown = {
    ...nre.breakdown,
    designLabor: nre.breakdown.designLabor * scaleFactor,
    verifLabor: nre.breakdown.verifLabor * scaleFactor
  };

  // Totals — reflect the selected Cell Library mode
  const totalCost = totalProjectCost({ nre: cellLibrary.effectiveNreTotal, volume, cpgdFull });
  const curve = costCurve(cellLibrary.effectiveNreTotal, cpgdFull);
  const be = sellingPrice
    ? breakEvenVolume(cellLibrary.effectiveNreTotal, sellingPrice, cpgdFull)
    : null;

  return {
    node, areaMm2, category, volume, teamSize, region, designMonths, packageType, sellingPrice,
    mask, waferCost, d0, labor, pkg,
    nre, dpw, y, cpgd, cpgdFull, manufacturingCost,
    designAndVerifStandard, effectiveNreBreakdown,
    cellLibrary, totalCost, curve, be
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

    const { node, designMonths, cellLibrary, dpw, y, cpgd, cpgdFull, totalCost, curve, be, effectiveNreBreakdown } = core;

    res.json({
      outputs: {
        nre: cellLibrary.effectiveNreTotal,
        nreBreakdown: effectiveNreBreakdown,
        diesPerWafer: dpw,
        yield: y,
        cpgd,
        cpgdFull,
        totalCost,
        costCurve: curve,
        breakEvenVolume: be,
        cellLibraryMode: cellLibrary.mode,
        cellLibrary: cellLibrary.comparison,
        timelineMonths: {
          low: designMonths + 5,
          high: designMonths + 9
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
 * Titan Tecton Impact — Standard (Manual) vs Our Cell Library (Titan
 * Tecton, Optimized). Manufacturing metrics (die area, dies/wafer, yield,
 * cost per good die) are identical on both sides — the standard
 * manufacturing method never changes. Only design + verification cost
 * (flat 75% reduction, since Titan Tecton generates LVS/DRC-clean layouts)
 * and the totals derived from it differ. EDA licenses and IP license are
 * unaffected.
 */
router.post("/cell-library-impact", (req, res) => {
  try {
    const core = computeCore(req.body);
    if (core.error) return res.status(400).json({ error: core.error });

    const { areaMm2, dpw, y, cpgd, cpgdFull, nre, cellLibrary, designAndVerifStandard } = core;

    const compound = compoundOverVolumes({
      nreTotal: nre.total,
      designCostStandard: designAndVerifStandard,
      cpgdFull,
      volumes: COMPOUND_VOLUMES
    });

    res.json({
      impact: {
        mode: cellLibrary.mode,
        // Fixed "standard manufacturing method" — identical regardless of
        // which Cell Library option is selected.
        manufacturing: {
          areaMm2,
          diesPerWafer: dpw,
          yield: y,
          costPerGoodDie: cpgd,
          cpgdFull
        },
        designCost: cellLibrary.comparison.designCost,
        totalBill: cellLibrary.comparison.totalBill
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
