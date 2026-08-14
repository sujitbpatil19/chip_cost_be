const mongoose = require("mongoose");

const DEFAULT_INPUTS = {
  node: "5nm",
  areaMm2: 400,
  category: "ai",
  volume: 100000,
  packageType: "cowos", // CoWoS/HBM — advanced packaging typical of a datacenter-class AI accelerator
  sellingPrice: 2500, // datacenter AI accelerator ASP with HBM/CoWoS packaging runs well above $500 — $500 sat below fully-loaded cost/die and made break-even impossible on either side
  cellLibraryMode: "standard", // 'standard' | 'optimized' — which side (Conventional vs Titan Tecton) drives the headline totals; defaults to the fully-manual Conventional flow
  titanTecton: {
    loadedSalaryPerYear: 350000, // fully-loaded $/engineer/yr — drives every labor cost directly (no region lookup); mid/high end of a senior US team's base-salary-plus-load-factor range
    activities: {
      // Sized for a real 5nm/400mm² AI accelerator program, not a placeholder: an
      // explicit verification line doesn't exist in this 5-activity model, so its
      // effort is folded into Integration and Other Engineering, which is why
      // those two are staffed well above a bare bring-up team.
      architecture: { team: 8, months: 5 },
      rtlDesign: { team: 35, months: 10 },
      integration: { team: 20, months: 6 },
      otherEngineering: { team: 15, months: 5 }
    },
    layoutGeneration: {
      cellsInLibrary: 100, // informational — size of the cell library
      totalLayoutsNeeded: 50000, // this project's target: the 100-cell library itself
      titanLayoutsGenerated: 50000, // benchmark: 100 cells x 500 layouts/cell, per license
      titanHoursTaken: 6, // benchmark duration, per license
      titanEngineers: 2, // supervisors, per license
      licenses: 1, // Titan Tecton licenses purchased, run in parallel — scales rate and supervisors, and multiplies titanToolLicenseCost
      convLayoutsPerEngineerDay: 6, // full-custom FinFET/GAA-node layout, even on derivative drive-strength/Vt variants, still needs real per-variant DRC/LVS debug time — 10/day read as too fast
      convTeamSize: 20 // right-sized for a single 100-cell base library; 40 fit a much larger multi-thousand-cell full production library
    },
    eda: {
      ratePerSeatPerYear: 200000,
      conventional: { seats: 30, months: 30 }, // sized to the new, larger Conventional program above
      titan: { seats: 3, months: 3 }
    },
    ip: {
      licenseAmount: 500000,
      titanReplacesIP: false
    },
    contingencyPct: 15,
    titanToolLicenseCost: 500000 // added only to the Titan Tecton NRE, never netted against savings
  }
};

const activitySchema = new mongoose.Schema({
  team: { type: Number, required: true },
  months: { type: Number, required: true }
}, { _id: false });

const titanTectonSchema = new mongoose.Schema({
  loadedSalaryPerYear: { type: Number, default: DEFAULT_INPUTS.titanTecton.loadedSalaryPerYear },
  activities: {
    architecture: { type: activitySchema, default: () => DEFAULT_INPUTS.titanTecton.activities.architecture },
    rtlDesign: { type: activitySchema, default: () => DEFAULT_INPUTS.titanTecton.activities.rtlDesign },
    integration: { type: activitySchema, default: () => DEFAULT_INPUTS.titanTecton.activities.integration },
    otherEngineering: { type: activitySchema, default: () => DEFAULT_INPUTS.titanTecton.activities.otherEngineering }
  },
  layoutGeneration: {
    cellsInLibrary: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.cellsInLibrary },
    totalLayoutsNeeded: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.totalLayoutsNeeded },
    titanLayoutsGenerated: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.titanLayoutsGenerated },
    titanHoursTaken: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.titanHoursTaken },
    titanEngineers: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.titanEngineers },
    licenses: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.licenses },
    convLayoutsPerEngineerDay: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.convLayoutsPerEngineerDay },
    convTeamSize: { type: Number, default: DEFAULT_INPUTS.titanTecton.layoutGeneration.convTeamSize }
  },
  eda: {
    ratePerSeatPerYear: { type: Number, default: DEFAULT_INPUTS.titanTecton.eda.ratePerSeatPerYear },
    conventional: {
      seats: { type: Number, default: DEFAULT_INPUTS.titanTecton.eda.conventional.seats },
      months: { type: Number, default: DEFAULT_INPUTS.titanTecton.eda.conventional.months }
    },
    titan: {
      seats: { type: Number, default: DEFAULT_INPUTS.titanTecton.eda.titan.seats },
      months: { type: Number, default: DEFAULT_INPUTS.titanTecton.eda.titan.months }
    }
  },
  ip: {
    licenseAmount: { type: Number, default: DEFAULT_INPUTS.titanTecton.ip.licenseAmount },
    titanReplacesIP: { type: Boolean, default: DEFAULT_INPUTS.titanTecton.ip.titanReplacesIP }
  },
  contingencyPct: { type: Number, default: DEFAULT_INPUTS.titanTecton.contingencyPct },
  titanToolLicenseCost: { type: Number, default: DEFAULT_INPUTS.titanTecton.titanToolLicenseCost }
}, { _id: false });

const inputsSchema = new mongoose.Schema({
  node: { type: String, default: DEFAULT_INPUTS.node },
  areaMm2: { type: Number, default: DEFAULT_INPUTS.areaMm2 },
  category: { type: String, default: DEFAULT_INPUTS.category },
  volume: { type: Number, default: DEFAULT_INPUTS.volume },
  packageType: { type: String, default: DEFAULT_INPUTS.packageType },
  sellingPrice: { type: Number, default: DEFAULT_INPUTS.sellingPrice },
  cellLibraryMode: {
    type: String,
    enum: ["standard", "optimized"],
    default: DEFAULT_INPUTS.cellLibraryMode
  },
  titanTecton: { type: titanTectonSchema, default: () => DEFAULT_INPUTS.titanTecton }
}, { _id: false });

const metaSchema = new mongoose.Schema({
  name: { type: String, default: "Untitled Project" },
  tags: { type: String, default: "" },
  description: { type: String, default: "" }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  meta: { type: metaSchema, default: () => ({}) },
  inputs: { type: inputsSchema, default: () => DEFAULT_INPUTS },
  results: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

projectSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

// Transform _id to id in JSON output (frontend expects `id`)
projectSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Project", projectSchema);
module.exports.DEFAULT_INPUTS = DEFAULT_INPUTS;
