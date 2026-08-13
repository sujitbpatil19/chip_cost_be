const {
  diesPerWafer,
  yieldPoisson,
  costPerGoodDie
} = require("./costEngine");

/**
 * Cell Library Impact — the strategic differentiator.
 * Compares standard commercial library vs AI-optimized.
 *
 * Returns shape matching frontend expectations exactly.
 */
function computeImpact({ baselineAreaMm2, waferCost, d0, volume, aiAreaFactor = 0.88 }) {
  const factors = {
    baseline: 1.0,
    optimized: aiAreaFactor
  };

  const results = {};

  for (const [key, factor] of Object.entries(factors)) {
    const areaMm2 = baselineAreaMm2 * factor;
    const dpw = diesPerWafer(areaMm2);
    const y = yieldPoisson(areaMm2, d0);
    const goodDiesPerWafer = Math.floor(dpw * y);
    const cpgd = costPerGoodDie({ waferCost, dieAreaMm2: areaMm2, d0 });
    const totalProductionCost = cpgd * volume;

    results[key] = {
      areaMm2,
      diesPerWafer: dpw,
      yield: y,
      goodDiesPerWafer,
      costPerGoodDie: cpgd,
      totalProductionCost
    };
  }

  const savingsPerDie = results.baseline.costPerGoodDie - results.optimized.costPerGoodDie;
  const totalSavings = savingsPerDie * volume;
  const savingsPct = (savingsPerDie / results.baseline.costPerGoodDie) * 100;
  const areaReductionPct = (1 - aiAreaFactor) * 100;

  return {
    baseline: results.baseline,
    optimized: results.optimized,
    savingsPerDie,
    totalSavings,
    savingsPct,
    areaReductionPct
  };
}

/**
 * Compound impact across common production volumes — for the bar chart.
 */
function compoundImpactChart({ baselineAreaMm2, waferCost, d0, aiAreaFactor }) {
  const volumes = [1e4, 1e5, 5e5, 1e6];
  return volumes.map(v => {
    const impact = computeImpact({ baselineAreaMm2, waferCost, d0, volume: v, aiAreaFactor });
    return { volume: v, savings: impact.totalSavings };
  });
}

module.exports = { computeImpact, compoundImpactChart };
