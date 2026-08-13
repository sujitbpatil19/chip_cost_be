const { diesPerWafer, yieldPoisson, costPerGoodDie } = require("./costEngine");
const { HOURS_PER_DAY, toMonths } = require("./constants");

const PACKAGING_YIELD = 0.95;

/**
 * Per-activity engineering effort: Conventional vs Titan Tecton.
 * Converts each side's {team, duration, unit} into a common
 * engineer-months basis, then derives labor cost and speedup.
 */
function computeEffortActivity(activity, monthlyLoadedRate) {
  const convMonths = toMonths(activity.conventional.duration, activity.conventional.unit);
  const titanMonths = toMonths(activity.titan.duration, activity.titan.unit);

  const convEffort = activity.conventional.team * convMonths;
  const titanEffort = activity.titan.team * titanMonths;

  const convLabor = convEffort * monthlyLoadedRate;
  const titanLabor = titanEffort * monthlyLoadedRate;

  const speedup = titanMonths > 0 ? convMonths / titanMonths : Infinity;
  const timeSavingPct = convMonths > 0 ? ((convMonths - titanMonths) / convMonths) * 100 : 0;

  return {
    key: activity.key,
    label: activity.label,
    category: activity.category,
    conventional: { ...activity.conventional, months: convMonths, effort: convEffort, labor: convLabor },
    titan: { ...activity.titan, months: titanMonths, effort: titanEffort, labor: titanLabor },
    speedup,
    timeSavingPct
  };
}

/**
 * Throughput-based activity effort — for work measured in a unit count
 * (e.g. layouts) rather than a hand-typed duration. Given how many units
 * Titan Tecton produced in how many hours (its benchmark rate) and how many
 * units one engineer produces per day conventionally, derives the time and
 * cost to produce `totalUnits` on both sides.
 *
 *   titanRatePerHour  = titanUnitsGenerated / titanHoursTaken
 *   convRatePerHour   = conventionalUnitsPerEngineerPerDay / HOURS_PER_DAY
 *   titanHours        = totalUnits / titanRatePerHour
 *   conventionalHours = totalUnits / (conventionalTeamSize * convRatePerHour)
 */
function computeThroughputActivity(activity, monthlyLoadedRate) {
  const titanRatePerHour = activity.titanLayoutsGenerated / activity.titanHoursTaken;
  const conventionalRatePerHour = activity.conventionalThroughputPerEngineerPerDay / HOURS_PER_DAY;

  const titanHours = activity.totalLayouts / titanRatePerHour;
  const conventionalHours = activity.totalLayouts / (activity.conventionalTeamSize * conventionalRatePerHour);

  const convMonths = toMonths(conventionalHours, "hours");
  const titanMonths = toMonths(titanHours, "hours");

  const convEffort = activity.conventionalTeamSize * convMonths;
  const titanEffort = activity.titanTeamSize * titanMonths;

  const convLabor = convEffort * monthlyLoadedRate;
  const titanLabor = titanEffort * monthlyLoadedRate;

  const speedup = titanHours > 0 ? conventionalHours / titanHours : Infinity;
  const timeSavingPct = conventionalHours > 0 ? ((conventionalHours - titanHours) / conventionalHours) * 100 : 0;

  return {
    key: activity.key,
    label: activity.label,
    category: activity.category,
    throughput: {
      totalLayouts: activity.totalLayouts,
      cellsInLibrary: activity.cellsInLibrary,
      titanRatePerHour,
      conventionalRatePerHour
    },
    conventional: {
      team: activity.conventionalTeamSize, duration: conventionalHours, unit: "hours",
      months: convMonths, effort: convEffort, labor: convLabor
    },
    titan: {
      team: activity.titanTeamSize, duration: titanHours, unit: "hours",
      months: titanMonths, effort: titanEffort, labor: titanLabor
    },
    speedup,
    timeSavingPct
  };
}

function computeActivityEffort(activity, monthlyLoadedRate) {
  if (activity.type === "throughput") {
    return computeThroughputActivity(activity, monthlyLoadedRate);
  }
  return computeEffortActivity(activity, monthlyLoadedRate);
}

/**
 * Full NRE + savings roll-up for the Conventional vs Titan Tecton comparison.
 * Manufacturing/production economics are intentionally excluded here —
 * they are frozen and identical on both sides (see computeManufacturingParams).
 */
function computeEngineeringImpact({
  activities,
  monthlyLoadedRate,
  edaConventional,
  edaTitan,
  ipLicense,
  titanReplacesIp = false,
  ipLicenseReplacementValue = 0,
  titanToolCost,
  mask,
  contingencyPct
}) {
  const activityResults = activities.map(a => computeActivityEffort(a, monthlyLoadedRate));

  const designLaborC = activityResults.reduce((sum, a) => sum + a.conventional.labor, 0);
  const designLaborT = activityResults.reduce((sum, a) => sum + a.titan.labor, 0);

  const effortC = activityResults.reduce((sum, a) => sum + a.conventional.effort, 0);
  const effortT = activityResults.reduce((sum, a) => sum + a.titan.effort, 0);

  const monthsC = activityResults.reduce((sum, a) => sum + a.conventional.months, 0);
  const monthsT = activityResults.reduce((sum, a) => sum + a.titan.months, 0);

  const edaCostC = edaConventional.seats * edaConventional.months * (edaConventional.annualPerSeat / 12);
  const edaCostT = edaTitan.seats * edaTitan.months * (edaTitan.annualPerSeat / 12);

  const ipC = ipLicense;
  const ipT = titanReplacesIp ? ipLicenseReplacementValue : ipLicense;

  const foundryFees = mask * 0.05;

  const subtotalC = mask + designLaborC + ipC + edaCostC + foundryFees;
  const subtotalT = mask + designLaborT + ipT + edaCostT + foundryFees + titanToolCost;

  const contingencyC = subtotalC * contingencyPct;
  const contingencyT = subtotalT * contingencyPct;

  const nreC = subtotalC + contingencyC;
  const nreT = subtotalT + contingencyT;

  const nreSavings = nreC - nreT;
  const nreReductionPct = nreC > 0 ? (nreSavings / nreC) * 100 : 0;

  return {
    activities: activityResults,
    totals: {
      effortSaved: effortC - effortT,
      designTimeSavedMonths: monthsC - monthsT
    },
    nre: {
      conventional: {
        total: nreC,
        breakdown: { mask, designLabor: designLaborC, ipLicense: ipC, edaCost: edaCostC, foundryFees, contingency: contingencyC }
      },
      titan: {
        total: nreT,
        breakdown: { mask, designLabor: designLaborT, ipLicense: ipT, edaCost: edaCostT, foundryFees, titanToolCost, contingency: contingencyT }
      }
    },
    savings: {
      nreSavings,
      nreReductionPct,
      edaSaved: edaCostC - edaCostT,
      laborSaved: designLaborC - designLaborT,
      ipSaved: ipC - ipT,
      netProjectSavings: nreSavings
    }
  };
}

/**
 * Manufacturing parameters, computed once and shown identically for
 * Conventional and Titan Tecton — this model does not assume any
 * physical/manufacturing impact from Titan Tecton.
 */
function computeManufacturingParams({ areaMm2, waferCost, d0 }) {
  const dpw = diesPerWafer(areaMm2);
  const y = yieldPoisson(areaMm2, d0);
  const cpgd = costPerGoodDie({ waferCost, dieAreaMm2: areaMm2, d0, packagingYield: PACKAGING_YIELD });

  return {
    areaMm2,
    diesPerWafer: dpw,
    yield: y,
    packagingYield: PACKAGING_YIELD,
    waferCost,
    costPerGoodDie: cpgd
  };
}

module.exports = {
  computeActivityEffort,
  computeEngineeringImpact,
  computeManufacturingParams
};
