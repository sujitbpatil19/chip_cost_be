/**
 * Cost data tables. Compiled from public sources.
 * Each value is presented as a range (low, high) with midpoint for calculations.
 */

module.exports = {
  masks: {
    "180nm":   { low: 100_000,    high: 200_000,    mid: 150_000 },
    "130nm":   { low: 150_000,    high: 300_000,    mid: 225_000 },
    "65nm":    { low: 300_000,    high: 500_000,    mid: 400_000 },
    "40nm":    { low: 500_000,    high: 900_000,    mid: 700_000 },
    "28nm":    { low: 1_000_000,  high: 2_000_000,  mid: 1_500_000 },
    "22nm":    { low: 1_500_000,  high: 2_500_000,  mid: 2_000_000 },
    "16/14nm": { low: 3_000_000,  high: 5_000_000,  mid: 4_000_000 },
    "10nm":    { low: 5_000_000,  high: 8_000_000,  mid: 6_500_000 },
    "7nm":     { low: 10_000_000, high: 15_000_000, mid: 12_500_000 },
    "5nm":     { low: 15_000_000, high: 20_000_000, mid: 17_500_000 },
    "3nm":     { low: 20_000_000, high: 30_000_000, mid: 25_000_000 },
    "2nm":     { low: 25_000_000, high: 40_000_000, mid: 32_500_000 }
  },
  wafers: {
    "180nm":   { low: 500,   high: 1000,  mid: 750 },
    "130nm":   { low: 1000,  high: 1500,  mid: 1250 },
    "65nm":    { low: 1500,  high: 2500,  mid: 2000 },
    "40nm":    { low: 2500,  high: 3500,  mid: 3000 },
    "28nm":    { low: 3000,  high: 4500,  mid: 3750 },
    "22nm":    { low: 4000,  high: 5500,  mid: 4750 },
    "16/14nm": { low: 5500,  high: 7500,  mid: 6500 },
    "10nm":    { low: 7000,  high: 9000,  mid: 8000 },
    "7nm":     { low: 9000,  high: 12000, mid: 10500 },
    "5nm":     { low: 14000, high: 17000, mid: 15500 },
    "3nm":     { low: 18000, high: 22000, mid: 20000 },
    "2nm":     { low: 22000, high: 30000, mid: 26000 }
  },
  defectDensity: {
    "180nm":   { mature: 0.08, ramp: 0.15 },
    "130nm":   { mature: 0.10, ramp: 0.18 },
    "65nm":    { mature: 0.12, ramp: 0.20 },
    "40nm":    { mature: 0.15, ramp: 0.25 },
    "28nm":    { mature: 0.17, ramp: 0.30 },
    "22nm":    { mature: 0.17, ramp: 0.30 },
    "16/14nm": { mature: 0.20, ramp: 0.35 },
    "10nm":    { mature: 0.20, ramp: 0.35 },
    "7nm":     { mature: 0.20, ramp: 0.40 },
    "5nm":     { mature: 0.20, ramp: 0.40 },
    "3nm":     { mature: 0.25, ramp: 0.50 },
    "2nm":     { mature: 0.30, ramp: 0.55 }
  },
  labor: {
    us_sv:    { base: 230000, loaded: 375000, label: "US (Silicon Valley)" },
    us_other: { base: 180000, loaded: 295000, label: "US (other)" },
    europe:   { base: 120000, loaded: 205000, label: "Europe" },
    india:    { base: 60000,  loaded: 105000, label: "India" },
    china:    { base: 105000, loaded: 175000, label: "China (Tier-1)" },
    sea:      { base: 75000,  loaded: 130000, label: "Southeast Asia" }
  },
  category: {
    mcu:        { teamMin: 8,  teamMax: 15,  monthsMin: 9,  monthsMax: 15, label: "MCU / IoT SoC" },
    digital:    { teamMin: 20, teamMax: 40,  monthsMin: 12, monthsMax: 18, label: "Consumer digital SoC" },
    ai:         { teamMin: 40, teamMax: 80,  monthsMin: 18, monthsMax: 30, label: "AI accelerator" },
    gpu:        { teamMin: 80, teamMax: 200, monthsMin: 24, monthsMax: 36, label: "GPU-class" },
    rf:         { teamMin: 15, teamMax: 30,  monthsMin: 12, monthsMax: 20, label: "RF / mixed-signal" },
    automotive: { teamMin: 40, teamMax: 100, monthsMin: 24, monthsMax: 36, label: "Automotive SoC" }
  },
  packaging: {
    qfn:       { low: 0.3,  high: 1.5,  mid: 0.9,   label: "QFN" },
    bga:       { low: 2.0,  high: 15,   mid: 8.5,   label: "BGA (standard)" },
    bga_high:  { low: 15,   high: 50,   mid: 32.5,  label: "BGA (high pin count)" },
    wlcsp:     { low: 0.3,  high: 2,    mid: 1.15,  label: "Wafer-level CSP" },
    flipchip:  { low: 5,    high: 30,   mid: 17.5,  label: "Flip-chip BGA" },
    cowos:     { low: 50,   high: 500,  mid: 275,   label: "Advanced (CoWoS/HBM)" }
  },
  sources: {
    masks: [
      { title: "SemiWiki mask cost analyses", url: "https://semiwiki.com" },
      { title: "SemiAnalysis wafer/mask economics", url: "https://www.semianalysis.com" },
      { title: "IBS Handel Jones reports (summaries)", url: "https://www.ibs-inc.net" },
      { title: "eBeam Initiative photomask surveys", url: "https://www.ebeam.org" }
    ],
    wafers: [
      { title: "TSMC quarterly earnings ASP data", url: "https://investor.tsmc.com" },
      { title: "SemiAnalysis wafer cost breakdowns", url: "https://www.semianalysis.com" },
      { title: "DIGITIMES industry pricing coverage", url: "https://www.digitimes.com" }
    ],
    labor: [
      { title: "Levels.fyi chip designer compensation", url: "https://www.levels.fyi" },
      { title: "IEEE salary surveys", url: "https://www.ieee.org/membership/salary-surveys.html" }
    ],
    defectDensity: [
      { title: "VLSI Symposium foundry presentations", url: "https://www.vlsisymposium.org" },
      { title: "IEDM defect density papers", url: "https://www.ieee-iedm.org" },
      { title: "IRDS roadmap", url: "https://irds.ieee.org" }
    ],
    packaging: [
      { title: "TechInsights teardown reports", url: "https://www.techinsights.com" },
      { title: "ASE Group public materials", url: "https://www.aseglobal.com" },
      { title: "Yole packaging market reports", url: "https://www.yolegroup.com" }
    ]
  }
};
