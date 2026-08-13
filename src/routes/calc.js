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
const { computeEngineeringImpact, computeManufacturingParams } = require("../calc/titanTectonImpact");
const {
  DEFAULT_ACTIVITIES,
  DEFAULT_EDA_CONVENTIONAL,
  DEFAULT_EDA_TITAN,
  DEFAULT_IP_LICENSE,
  DEFAULT_TITAN_TOOL_COST,
  DEFAULT_CONTINGENCY_PCT,
  DEFAULT_LOADED_SALARY_PER_YEAR
} = require("../seed/titanActivities");

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
 * POST /api/calc/titan-impact
 * Conventional vs Titan Tecton engineering-effort comparison.
 * Manufacturing parameters are frozen and shown identically on both sides.
 */
router.post("/titan-impact", (req, res) => {
  try {
    const {
      node, areaMm2,
      activities = DEFAULT_ACTIVITIES,
      edaConventional = DEFAULT_EDA_CONVENTIONAL,
      edaTitan = DEFAULT_EDA_TITAN,
      ipLicense = DEFAULT_IP_LICENSE,
      titanReplacesIp = false,
      ipLicenseReplacementValue = 0,
      titanToolCost = DEFAULT_TITAN_TOOL_COST,
      contingencyPct = DEFAULT_CONTINGENCY_PCT,
      loadedSalaryPerYear = DEFAULT_LOADED_SALARY_PER_YEAR
    } = req.body;

    const mask = costTables.masks[node]?.mid;
    const waferCost = costTables.wafers[node]?.mid;
    const d0 = costTables.defectDensity[node]?.mature;

    if (!mask || !waferCost || !d0) {
      return res.status(400).json({ error: `Missing cost data for node='${node}'.` });
    }

    const monthlyLoadedRate = loadedSalaryPerYear / 12;

    const manufacturing = computeManufacturingParams({ areaMm2, waferCost, d0 });

    const engineering = computeEngineeringImpact({
      activities,
      monthlyLoadedRate,
      edaConventional,
      edaTitan,
      ipLicense,
      titanReplacesIp,
      ipLicenseReplacementValue,
      titanToolCost,
      mask,
      contingencyPct
    });

    res.json({ manufacturing, ...engineering });
  } catch (err) {
    console.error("[titan-impact]", err);
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
