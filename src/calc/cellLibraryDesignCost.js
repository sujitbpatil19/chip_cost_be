/**
 * Cell Library (Titan Tecton) design-cost toggle.
 *
 * Titan Tecton is our cell library product — it generates layouts that are
 * already LVS/DRC-clean. That means it replaces both manual DESIGN effort
 * and manual VERIFICATION (LVS/DRC) effort, so callers pass in the combined
 * design + verification labor as `designCostStandard`. This module applies
 * a flat, fixed-percentage discount to that combined figure only — it never
 * touches yield, fabrication (wafer/mask), packaging, test, EDA licenses,
 * IP license, or foundry fees (those are unrelated to the cell library:
 * EDA licenses cover the broader chip-level flow, IP license covers
 * third-party functional IP). Contingency is left exactly as originally
 * calculated — it is NOT re-run against the discounted cost. Manufacturing
 * metrics (die area, dies/wafer, yield, cost per good die) are identical
 * under both options — the cell library choice never changes the standard
 * manufacturing method.
 *
 * Two selector options:
 *  - "standard"  — baseline, no discount.
 *  - "optimized" — "Our Cell Library" (Titan Tecton): flat 75% reduction.
 */

const DESIGN_COST_REDUCTION_PCT = 0.75; // flat 75% reduction, design + verification cost only

/**
 * @param {number} nreTotal            Standard NRE total (nreCost().total)
 * @param {number} designCostStandard  Standard design + verification labor combined
 * @param {number} manufacturingCost   Fixed manufacturing cost = volume * cpgdFull
 *                                     (fabrication + yield-driven cost + packaging + test)
 * @param {string} mode                'standard' | 'optimized'
 */
function applyCellLibraryToggle({ nreTotal, designCostStandard, manufacturingCost, mode }) {
  const isOptimized = mode === 'optimized';

  const designCostOptimized = designCostStandard * (1 - DESIGN_COST_REDUCTION_PCT);
  const designSavings = designCostStandard - designCostOptimized;

  // Everything in NRE except design + verification labor: mask, IP
  // license, EDA cost, foundry fees, contingency. Held fixed regardless
  // of mode.
  const nreFixed = nreTotal - designCostStandard;

  const totalBillStandard = nreFixed + designCostStandard + manufacturingCost;
  const totalBillOptimized = nreFixed + designCostOptimized + manufacturingCost;
  const totalBillSavings = totalBillStandard - totalBillOptimized;

  const effectiveDesignCost = isOptimized ? designCostOptimized : designCostStandard;
  const effectiveNreTotal = nreFixed + effectiveDesignCost;
  const effectiveTotalBill = isOptimized ? totalBillOptimized : totalBillStandard;

  return {
    mode: isOptimized ? 'optimized' : 'standard',
    effectiveDesignCost,
    effectiveNreTotal,
    effectiveTotalBill,
    comparison: {
      designCost: {
        before: designCostStandard,
        after: designCostOptimized,
        savings: designSavings,
        savingsPct: DESIGN_COST_REDUCTION_PCT * 100 // always exactly 75
      },
      totalBill: {
        before: totalBillStandard,
        after: totalBillOptimized,
        savings: totalBillSavings,
        savingsPct: totalBillStandard > 0 ? (totalBillSavings / totalBillStandard) * 100 : 0
      }
    }
  };
}

/**
 * Design/total-bill savings across a set of production volumes — for the
 * "savings vs. volume" chart. Manufacturing cost (volume * cpgdFull) scales
 * with volume on both sides identically; only the one-time design cost
 * differs, so the DOLLAR savings is constant across volume while the
 * PERCENTAGE savings shrinks as volume (and thus total bill) grows.
 *
 * @param {number} nreTotal            Standard NRE total
 * @param {number} designCostStandard  Standard design + verification labor combined
 * @param {number} cpgdFull            Fully-loaded cost per die (fab+yield+packaging+test)
 * @param {number[]} volumes           Production volumes to evaluate
 */
function compoundOverVolumes({ nreTotal, designCostStandard, cpgdFull, volumes }) {
  const nreFixed = nreTotal - designCostStandard;
  const designCostOptimized = designCostStandard * (1 - DESIGN_COST_REDUCTION_PCT);

  return volumes.map((volume) => {
    const manufacturingCost = volume * cpgdFull;
    const totalBillStandard = nreFixed + designCostStandard + manufacturingCost;
    const totalBillOptimized = nreFixed + designCostOptimized + manufacturingCost;
    const savings = totalBillStandard - totalBillOptimized;
    const savingsPct = totalBillStandard > 0 ? (savings / totalBillStandard) * 100 : 0;

    return { volume, totalBillStandard, totalBillOptimized, savings, savingsPct };
  });
}

module.exports = { applyCellLibraryToggle, compoundOverVolumes, DESIGN_COST_REDUCTION_PCT };
