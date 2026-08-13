const mongoose = require("mongoose");

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
  cellLibraryMode: "standard" // 'standard' | 'optimized' — flat 75% design-cost reduction toggle
};

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
  cellLibraryMode: {
    type: String,
    enum: ["standard", "optimized"],
    default: DEFAULT_INPUTS.cellLibraryMode
  }
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
