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
const { computeImpact, compoundImpactChart } = require("../calc/cellLibraryImpact");

const router = express.Router();

/**
 * POST /api/calc
 * Returns the full result set that matches the frontend's expected shape.
 */
router.post("/", (req, res) => {
  try {
    const inputs = req.body;
    const {
      node, areaMm2, category, volume, teamSize, region,
      designMonths, packageType, sellingPrice
    } = inputs;

    // Validate essentials
    if (!node || !areaMm2 || !region) {
      return res.status(400).json({ error: "Missing required inputs: node, areaMm2, region" });
    }

    // Look up cost data
    const mask = costTables.masks[node]?.mid;
    const waferCost = costTables.wafers[node]?.mid;
    const d0 = costTables.defectDensity[node]?.mature;
    const labor = costTables.labor[region];
    const pkg = costTables.packaging[packageType];

    if (!mask || !waferCost || !d0 || !labor) {
      return res.status(400).json({
        error: `Missing cost data. Check node='${node}' and region='${region}'.`
      });
    }

    const monthlyLoaded = labor.loaded / 12;

    // NRE (with breakdown)
    const nre = nreCost({
      mask,
      teamSize,
      months: designMonths,
      monthlyLoaded,
      ipLicense: 500_000,
      edaAnnualPerSeat: 200_000
    });

    // Manufacturing
    const dpw = diesPerWafer(areaMm2);
    const y = yieldPoisson(areaMm2, d0);
    const cpgd = costPerGoodDie({ waferCost, dieAreaMm2: areaMm2, d0 });
    const packagingPerDie = pkg ? pkg.mid : 2;
    const cpgdFull = fullyLoadedCostPerDie({
      cpgd,
      packagingPerDie,
      testPerDie: 0.5
    });

    // Totals
    const totalCost = totalProjectCost({ nre: nre.total, volume, cpgdFull });
    const curve = costCurve(nre.total, cpgdFull);
    const be = sellingPrice
      ? breakEvenVolume(nre.total, sellingPrice, cpgdFull)
      : null;

    res.json({
      outputs: {
        nre: nre.total,
        nreBreakdown: nre.breakdown,
        diesPerWafer: dpw,
        yield: y,
        cpgd,
        cpgdFull,
        totalCost,
        costCurve: curve,
        breakEvenVolume: be,
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
 */
router.post("/cell-library-impact", (req, res) => {
  try {
    const { areaMm2, node, volume, aiAreaFactor = 0.88 } = req.body;

    const waferCost = costTables.wafers[node]?.mid;
    const d0 = costTables.defectDensity[node]?.mature;

    if (!waferCost || !d0) {
      return res.status(400).json({ error: `Missing cost data for node '${node}'` });
    }

    const impact = computeImpact({
      baselineAreaMm2: areaMm2,
      waferCost,
      d0,
      volume,
      aiAreaFactor
    });

    const compound = compoundImpactChart({
      baselineAreaMm2: areaMm2,
      waferCost,
      d0,
      aiAreaFactor
    });

    res.json({ impact, compound });
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
