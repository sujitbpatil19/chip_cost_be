/**
 * Titan Tecton model — Conventional vs Titan Tecton, side by side.
 *
 * This REPLACES the old flat-75%-off-design-cost mechanism
 * (`cellLibraryDesignCost.js`) with a bottom-up engineering model: five
 * named activities (Architecture, RTL Design, Layout Generation, Integration,
 * Other Engineering), each with its own team size and duration. Only Layout
 * Generation is affected by Titan Tecton — it generates layouts that are
 * already LVS/DRC-clean, so its conventional-vs-Titan duration is *derived*
 * from an editable throughput benchmark, not typed in as a fixed number.
 * Architecture, RTL Design, Integration, and Other Engineering are always
 * identical on both sides (1x — Titan Tecton doesn't touch them).
 *
 * Fabrication, yield, dies/wafer, packaging, test, mask, and foundry fees
 * are computed elsewhere (costEngine.js) and are NOT touched by this module.
 *
 * A calendar month is defined as 176 hours (22 working days x 8 hrs/day) —
 * this is the single conversion factor used everywhere hours need to become
 * engineer-months.
 */

const HOURS_PER_MONTH = 176;

/**
 * Layout Generation throughput sub-model.
 *
 * Titan Tecton's rate is set by a benchmark (layouts generated / hours
 * taken). Conventional time is derived the same way, from an editable
 * per-engineer throughput assumption — neither side is a fixed duration.
 *
 * @param {number} totalLayoutsNeeded         Total layouts required for this project
 * @param {number} titanLayoutsGenerated      Layouts generated in the Titan Tecton benchmark
 * @param {number} titanHoursTaken            Hours taken for that benchmark
 * @param {number} titanEngineers             Engineers supervising Titan Tecton
 * @param {number} convLayoutsPerEngineerDay  Conventional throughput assumption
 * @param {number} convTeamSize               Conventional team size
 * @param {number} hoursPerDay                Working hours per day (default 8)
 */
function computeLayoutGeneration({
  totalLayoutsNeeded,
  titanLayoutsGenerated,
  titanHoursTaken,
  titanEngineers,
  convLayoutsPerEngineerDay,
  convTeamSize,
  hoursPerDay = 8
}) {
  const titanRate = titanLayoutsGenerated / titanHoursTaken; // layouts/hr
  const titanHours = totalLayoutsNeeded / titanRate;

  const convRatePerEngHr = convLayoutsPerEngineerDay / hoursPerDay; // layouts/hr/engineer
  const convHours = totalLayoutsNeeded / (convTeamSize * convRatePerEngHr);

  const speedup = titanHours > 0 ? convHours / titanHours : 0;

  return {
    conv: { team: convTeamSize, hours: convHours, ratePerEngHr: convRatePerEngHr },
    titan: { team: titanEngineers, hours: titanHours, rate: titanRate },
    speedup
  };
}

/**
 * Roll up the 5 activities into engineer-months and calendar-months totals
 * for both Conventional and Titan Tecton.
 */
function computeActivityEffort({ activities, layoutGeneration }) {
  const lg = computeLayoutGeneration(layoutGeneration);
  const convLayoutMonths = lg.conv.hours / HOURS_PER_MONTH;
  const titanLayoutMonths = lg.titan.hours / HOURS_PER_MONTH;

  const { architecture, rtlDesign, integration, otherEngineering } = activities;

  const rows = [
    {
      key: 'architecture', label: 'Architecture', unit: 'months', editable: true,
      convTeam: architecture.team, convDuration: architecture.months,
      titanTeam: architecture.team, titanDuration: architecture.months
    },
    {
      key: 'rtlDesign', label: 'RTL Design', unit: 'months', editable: true,
      convTeam: rtlDesign.team, convDuration: rtlDesign.months,
      titanTeam: rtlDesign.team, titanDuration: rtlDesign.months
    },
    {
      key: 'layoutGeneration', label: 'Layout Generation (LVS/DRC-clean)', unit: 'hours', editable: false,
      convTeam: lg.conv.team, convDuration: lg.conv.hours,
      titanTeam: lg.titan.team, titanDuration: lg.titan.hours
    },
    {
      key: 'integration', label: 'Integration', unit: 'months', editable: true,
      convTeam: integration.team, convDuration: integration.months,
      titanTeam: integration.team, titanDuration: integration.months
    },
    {
      key: 'otherEngineering', label: 'Other Engineering', unit: 'months', editable: true,
      convTeam: otherEngineering.team, convDuration: otherEngineering.months,
      titanTeam: otherEngineering.team, titanDuration: otherEngineering.months
    }
  ].map(row => ({
    ...row,
    speedup: row.titanDuration > 0 ? row.convDuration / row.titanDuration : 0
  }));

  const engineerMonthsConv =
    architecture.team * architecture.months +
    rtlDesign.team * rtlDesign.months +
    lg.conv.team * convLayoutMonths +
    integration.team * integration.months +
    otherEngineering.team * otherEngineering.months;

  const engineerMonthsTitan =
    architecture.team * architecture.months +
    rtlDesign.team * rtlDesign.months +
    lg.titan.team * titanLayoutMonths +
    integration.team * integration.months +
    otherEngineering.team * otherEngineering.months;

  const durationMonthsConv =
    architecture.months + rtlDesign.months + convLayoutMonths + integration.months + otherEngineering.months;

  const durationMonthsTitan =
    architecture.months + rtlDesign.months + titanLayoutMonths + integration.months + otherEngineering.months;

  return { rows, layoutGeneration: lg, engineerMonthsConv, engineerMonthsTitan, durationMonthsConv, durationMonthsTitan };
}

/**
 * Full Conventional vs Titan Tecton comparison: design/verification labor,
 * EDA, IP license, and the Titan Tecton tool license itself. Does NOT
 * include mask, foundry fees, or manufacturing — those are shared/unchanged
 * and are added by the caller (calc.js) exactly as before.
 *
 * @param {object} inputs
 * @param {number} inputs.loadedSalaryPerYear     Fully-loaded $/engineer/yr — drives every labor cost
 * @param {object} inputs.activities               { architecture, rtlDesign, integration, otherEngineering }, each { team, months }
 * @param {object} inputs.layoutGeneration          See computeLayoutGeneration()
 * @param {object} inputs.eda                       { ratePerSeatPerYear, conventional: {seats, months}, titan: {seats, months} }
 * @param {object} inputs.ip                        { licenseAmount, titanReplacesIP }
 * @param {number} inputs.contingencyPct            e.g. 15 (percent, not fraction)
 * @param {number} inputs.titanToolLicenseCost      Cost of licensing Titan Tecton itself — added only to the Titan side, not netted against savings
 * @param {number} inputs.mask                      Mask cost (shared, unchanged)
 * @param {number} inputs.foundryFees                Foundry fees (shared, unchanged)
 */
function computeTitanTectonComparison(inputs) {
  const {
    loadedSalaryPerYear, activities, layoutGeneration, eda, ip,
    contingencyPct, titanToolLicenseCost, mask, foundryFees
  } = inputs;

  const monthlyLoaded = loadedSalaryPerYear / 12;
  const effort = computeActivityEffort({ activities, layoutGeneration });

  const laborCostConv = effort.engineerMonthsConv * monthlyLoaded;
  const laborCostTitan = effort.engineerMonthsTitan * monthlyLoaded;

  const edaMonthlyRate = eda.ratePerSeatPerYear / 12;
  const edaCostConv = eda.conventional.seats * eda.conventional.months * edaMonthlyRate;
  const edaCostTitan = eda.titan.seats * eda.titan.months * edaMonthlyRate;

  const ipCostConv = ip.licenseAmount;
  const ipCostTitan = ip.titanReplacesIP ? 0 : ip.licenseAmount;

  // Contingency is computed independently on each side's own subtotal —
  // both sides are now fully independent bottom-up calculations, not a
  // baseline with a discount applied on top.
  const subtotalConv = mask + laborCostConv + edaCostConv + ipCostConv + foundryFees;
  const subtotalTitan = mask + laborCostTitan + edaCostTitan + ipCostTitan + foundryFees;

  const contingencyConv = subtotalConv * (contingencyPct / 100);
  const contingencyTitan = subtotalTitan * (contingencyPct / 100);

  // Titan Tecton's own license/tool cost is added on top of the Titan NRE
  // only — it is never netted away against the savings it produces.
  const nreConv = subtotalConv + contingencyConv;
  const nreTitan = subtotalTitan + contingencyTitan + titanToolLicenseCost;

  return {
    activityRows: effort.rows,
    layoutGeneration: effort.layoutGeneration,
    designEffort: {
      engineerMonths: {
        conventional: effort.engineerMonthsConv,
        titan: effort.engineerMonthsTitan,
        improvement: effort.engineerMonthsConv - effort.engineerMonthsTitan
      },
      durationMonths: {
        conventional: effort.durationMonthsConv,
        titan: effort.durationMonthsTitan,
        improvement: effort.durationMonthsConv - effort.durationMonthsTitan
      },
      laborCost: {
        conventional: laborCostConv,
        titan: laborCostTitan,
        improvement: laborCostConv - laborCostTitan
      }
    },
    eda: {
      seatsMonths: {
        conventional: `${eda.conventional.seats} × ${eda.conventional.months}mo`,
        titan: `${eda.titan.seats} × ${eda.titan.months}mo`
      },
      cost: {
        conventional: edaCostConv,
        titan: edaCostTitan,
        improvement: edaCostConv - edaCostTitan
      }
    },
    ip: {
      conventional: ipCostConv,
      titan: ipCostTitan,
      unchanged: !ip.titanReplacesIP
    },
    titanToolLicenseCost,
    contingency: { conventional: contingencyConv, titan: contingencyTitan },
    nre: { conventional: nreConv, titan: nreTitan }
  };
}

module.exports = {
  HOURS_PER_MONTH,
  computeLayoutGeneration,
  computeActivityEffort,
  computeTitanTectonComparison
};
