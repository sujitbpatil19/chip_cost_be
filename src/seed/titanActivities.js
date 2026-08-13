/**
 * Default activity-level engineering effort assumptions for the
 * Conventional vs Titan Tecton comparison. All editable in the UI —
 * these are placeholder benchmarks pending validated Titan Tecton data.
 */

const DEFAULT_ACTIVITIES = [
  {
    key: "architecture",
    label: "Architecture",
    category: "design",
    conventional: { team: 5, duration: 3, unit: "months" },
    titan: { team: 5, duration: 3, unit: "months" }
  },
  {
    key: "rtlDesign",
    label: "RTL Design",
    category: "design",
    conventional: { team: 15, duration: 8, unit: "months" },
    titan: { team: 15, duration: 8, unit: "months" }
  },
  {
    key: "layoutGeneration",
    label: "Layout Generation (LVS/DRC-clean)",
    category: "verification",
    type: "throughput",
    // Titan Tecton benchmark: a 100-cell library generates 500,000 LVS/DRC-clean
    // layouts in 6 hours. Conventional throughput per engineer is an industry-standard
    // placeholder (semi-manual layout with DRC/LVS closure) — edit as real data comes in.
    cellsInLibrary: 100,
    totalLayouts: 500000,
    titanLayoutsGenerated: 500000,
    titanHoursTaken: 6,
    titanTeamSize: 2,
    conventionalThroughputPerEngineerPerDay: 10,
    conventionalTeamSize: 40
  },
  {
    key: "integration",
    label: "Integration",
    category: "integration",
    conventional: { team: 4, duration: 4, unit: "months" },
    titan: { team: 4, duration: 4, unit: "months" }
  },
  {
    key: "otherEngineering",
    label: "Other Engineering",
    category: "design",
    conventional: { team: 4, duration: 4, unit: "months" },
    titan: { team: 4, duration: 4, unit: "months" }
  }
];

const DEFAULT_EDA_CONVENTIONAL = { seats: 24, months: 24, annualPerSeat: 200000 };
const DEFAULT_EDA_TITAN = { seats: 2, months: 2, annualPerSeat: 200000 };

const DEFAULT_IP_LICENSE = 500000;
const DEFAULT_TITAN_TOOL_COST = 500000;
const DEFAULT_CONTINGENCY_PCT = 0.15;
const DEFAULT_LOADED_SALARY_PER_YEAR = 375000;

module.exports = {
  DEFAULT_ACTIVITIES,
  DEFAULT_EDA_CONVENTIONAL,
  DEFAULT_EDA_TITAN,
  DEFAULT_IP_LICENSE,
  DEFAULT_TITAN_TOOL_COST,
  DEFAULT_CONTINGENCY_PCT,
  DEFAULT_LOADED_SALARY_PER_YEAR
};
