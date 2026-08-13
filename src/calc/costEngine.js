/**
 * Cost calculation engine.
 * Pure functions matching formulas in the playbook (Section 9).
 * Testable in isolation via: `node src/calc/costEngine.js`
 */

/**
 * Dies per wafer (Bosch/de Vries formula).
 * Accounts for wafer edge waste.
 */
function diesPerWafer(dieAreaMm2, waferDiameter = 300) {
  const S = dieAreaMm2;
  const D = waferDiameter;
  if (S <= 0) return 0;
  const dpw = (Math.PI * Math.pow(D / 2, 2)) / S - (Math.PI * D) / Math.sqrt(2 * S);
  return Math.max(0, Math.floor(dpw));
}

/**
 * Yield — Poisson model.
 * Y = e^(-A * D0), where A is die area in cm² and D0 defects/cm².
 */
function yieldPoisson(dieAreaMm2, d0) {
  const A_cm2 = dieAreaMm2 / 100;
  return Math.exp(-A_cm2 * d0);
}

/**
 * Yield — Murphy's model (more conservative for large dies).
 */
function yieldMurphy(dieAreaMm2, d0) {
  const A_cm2 = dieAreaMm2 / 100;
  const x = A_cm2 * d0;
  if (x === 0) return 1;
  return Math.pow((1 - Math.exp(-x)) / x, 2);
}

/**
 * Cost per good die at the wafer level (before packaging/test).
 */
function costPerGoodDie({ waferCost, dieAreaMm2, d0, packagingYield = 0.95 }) {
  const dpw = diesPerWafer(dieAreaMm2);
  const y = yieldPoisson(dieAreaMm2, d0);
  const denom = dpw * y * packagingYield;
  if (denom <= 0) return Infinity;
  return waferCost / denom;
}

/**
 * Fully-loaded cost per die: adds packaging, test, IP royalty per die.
 */
function fullyLoadedCostPerDie({
  cpgd,
  packagingPerDie = 0.5,
  testPerDie = 0.5,
  ipRoyaltyPerDie = 0
}) {
  return cpgd + packagingPerDie + testPerDie + ipRoyaltyPerDie;
}

/**
 * NRE (Non-Recurring Engineering).
 * Sum of all one-time costs before production.
 */
function nreCost({
  mask,
  teamSize,
  months,
  monthlyLoaded,
  ipLicense = 500000,
  edaAnnualPerSeat = 200000,
  contingencyPct = 0.15
}) {
  const designLabor = teamSize * months * monthlyLoaded;
  const verifLabor = designLabor * 1.5;
  const edaCost = teamSize * 0.6 * months * (edaAnnualPerSeat / 12);
  const foundryFees = mask * 0.05;
  const subtotal = mask + designLabor + verifLabor + ipLicense + edaCost + foundryFees;
  const contingency = subtotal * contingencyPct;
  return {
    total: subtotal + contingency,
    breakdown: {
      mask,
      designLabor,
      verifLabor,
      ipLicense,
      edaCost,
      foundryFees,
      contingency
    }
  };
}

/**
 * Total project cost = NRE + volume × per-die cost.
 */
function totalProjectCost({ nre, volume, cpgdFull }) {
  return nre + volume * cpgdFull;
}

/**
 * Amortized cost per die at a specific volume.
 */
function amortizedCostPerDie(volume, nre, cpgdFull) {
  if (volume <= 0) return Infinity;
  return nre / volume + cpgdFull;
}

/**
 * Cost curve — 9 points across log-scale volumes for the frontend chart.
 */
function costCurve(nre, cpgdFull) {
  const volumes = [1e3, 5e3, 1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7];
  return volumes.map(v => ({
    volume: v,
    ampd: amortizedCostPerDie(v, nre, cpgdFull)
  }));
}

/**
 * Break-even volume for a given selling price.
 * Returns Infinity if unit economics don't work at any volume.
 */
function breakEvenVolume(nre, sellingPrice, cpgdFull) {
  if (!sellingPrice || sellingPrice <= cpgdFull) return Infinity;
  return Math.ceil(nre / (sellingPrice - cpgdFull));
}

module.exports = {
  diesPerWafer,
  yieldPoisson,
  yieldMurphy,
  costPerGoodDie,
  fullyLoadedCostPerDie,
  nreCost,
  totalProjectCost,
  amortizedCostPerDie,
  costCurve,
  breakEvenVolume
};

// ===== Self-test when run directly =====
if (require.main === module) {
  console.log("Running cost engine self-tests...\n");

  const dpw100 = diesPerWafer(100);
  console.log(`Dies per wafer (100 mm² die, 300mm wafer): ${dpw100}`);
  console.assert(dpw100 > 500 && dpw100 < 700, "Expected ~590 dies");

  const y = yieldPoisson(100, 0.2);
  console.log(`Yield (100 mm², D0=0.2): ${(y * 100).toFixed(1)}%`);
  console.assert(y > 0.7 && y < 0.9, "Expected ~82%");

  const nre = nreCost({
    mask: 17500000,
    teamSize: 40,
    months: 24,
    monthlyLoaded: 31250,
    ipLicense: 500000
  });
  console.log(`NRE for 5nm AI accelerator: $${(nre.total / 1e6).toFixed(1)}M`);
  console.assert(nre.total > 80e6 && nre.total < 150e6, "Expected $80-150M for full 5nm project");

  const be = breakEvenVolume(50e6, 500, 195);
  console.log(`Break-even at $500 SP, $195 cost, $50M NRE: ${be.toLocaleString()} units`);

  console.log("\n✓ Self-tests complete.");
}
