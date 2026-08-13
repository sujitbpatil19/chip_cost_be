const mongoose = require("mongoose");
const {
  DEFAULT_ACTIVITIES,
  DEFAULT_EDA_CONVENTIONAL,
  DEFAULT_EDA_TITAN,
  DEFAULT_IP_LICENSE,
  DEFAULT_TITAN_TOOL_COST,
  DEFAULT_CONTINGENCY_PCT,
  DEFAULT_LOADED_SALARY_PER_YEAR
} = require("../seed/titanActivities");

const DEFAULT_TITAN_INPUTS = {
  activities: DEFAULT_ACTIVITIES,
  edaConventional: DEFAULT_EDA_CONVENTIONAL,
  edaTitan: DEFAULT_EDA_TITAN,
  ipLicense: DEFAULT_IP_LICENSE,
  titanReplacesIp: false,
  ipLicenseReplacementValue: 0,
  titanToolCost: DEFAULT_TITAN_TOOL_COST,
  contingencyPct: DEFAULT_CONTINGENCY_PCT,
  loadedSalaryPerYear: DEFAULT_LOADED_SALARY_PER_YEAR
};

const DEFAULT_INPUTS = {
  node: "5nm",
  areaMm2: 400,
  category: "ai",
  volume: 100000,
  teamSize: 40,
  region: "us_sv",
  designMonths: 24,
  packageType: "cowos",
  sellingPrice: 500,
  titan: DEFAULT_TITAN_INPUTS
};

// Activities are heterogeneous by `type` (team/duration "effort" activities vs
// unit-throughput activities like layout generation), so they're stored as
// free-form objects rather than a single rigid subschema.
const edaSchema = new mongoose.Schema({
  seats: { type: Number, required: true },
  months: { type: Number, required: true },
  annualPerSeat: { type: Number, required: true }
}, { _id: false });

const titanSchema = new mongoose.Schema({
  activities: { type: [mongoose.Schema.Types.Mixed], default: () => DEFAULT_TITAN_INPUTS.activities },
  edaConventional: { type: edaSchema, default: () => DEFAULT_TITAN_INPUTS.edaConventional },
  edaTitan: { type: edaSchema, default: () => DEFAULT_TITAN_INPUTS.edaTitan },
  ipLicense: { type: Number, default: DEFAULT_TITAN_INPUTS.ipLicense },
  titanReplacesIp: { type: Boolean, default: DEFAULT_TITAN_INPUTS.titanReplacesIp },
  ipLicenseReplacementValue: { type: Number, default: DEFAULT_TITAN_INPUTS.ipLicenseReplacementValue },
  titanToolCost: { type: Number, default: DEFAULT_TITAN_INPUTS.titanToolCost },
  contingencyPct: { type: Number, default: DEFAULT_TITAN_INPUTS.contingencyPct },
  loadedSalaryPerYear: { type: Number, default: DEFAULT_TITAN_INPUTS.loadedSalaryPerYear }
}, { _id: false });

const inputsSchema = new mongoose.Schema({
  node: { type: String, default: DEFAULT_INPUTS.node },
  areaMm2: { type: Number, default: DEFAULT_INPUTS.areaMm2 },
  category: { type: String, default: DEFAULT_INPUTS.category },
  volume: { type: Number, default: DEFAULT_INPUTS.volume },
  teamSize: { type: Number, default: DEFAULT_INPUTS.teamSize },
  region: { type: String, default: DEFAULT_INPUTS.region },
  designMonths: { type: Number, default: DEFAULT_INPUTS.designMonths },
  packageType: { type: String, default: DEFAULT_INPUTS.packageType },
  sellingPrice: { type: Number, default: DEFAULT_INPUTS.sellingPrice },
  titan: { type: titanSchema, default: () => DEFAULT_TITAN_INPUTS }
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
