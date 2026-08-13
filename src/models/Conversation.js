const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema({
  title: String,
  url: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true
  },
  content: { type: String, required: true },
  sources: { type: [sourceSchema], default: [] },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Conversation", conversationSchema);
