const express = require("express");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// All project endpoints require auth
router.use(authMiddleware);

/**
 * GET /api/projects
 * Returns array of user's projects (summary).
 */
router.get("/", async (req, res) => {
  try {
    const projects = await Project
      .find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .select("meta inputs results updatedAt createdAt");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:id
 * Returns full project.
 */
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid project id" });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects
 * body: { meta: { name, tags?, description? } }
 * Creates a new project with default inputs.
 */
router.post("/", async (req, res) => {
  try {
    const { meta = {} } = req.body;
    const project = await Project.create({
      userId: req.userId,
      meta: {
        name: meta.name || "Untitled Project",
        tags: meta.tags || "",
        description: meta.description || ""
      }
    });
    res.json(project);
  } catch (err) {
    console.error("[project.create]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:id/inputs
 * Updates project inputs.
 */
router.put("/:id/inputs", async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { inputs: req.body, updatedAt: new Date() } },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:id/meta
 * Updates project meta (name, tags, description).
 */
router.put("/:id/meta", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (req.body.name !== undefined) project.meta.name = req.body.name;
    if (req.body.tags !== undefined) project.meta.tags = req.body.tags;
    if (req.body.description !== undefined) project.meta.description = req.body.description;
    await project.save();

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/projects/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    await Project.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
