const { GoogleGenerativeAI } = require("@google/generative-ai");

let chatModel = null;

function getModel() {
  if (!chatModel) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "your-gemini-key-here") {
      throw new Error("GEMINI_API_KEY not set. Get one free at https://aistudio.google.com/apikey");
    }
    const genAI = new GoogleGenerativeAI(key);
    chatModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.4
      }
    });
  }
  return chatModel;
}

/**
 * Ask Gemini with a system instruction + user message.
 */
async function askAI({ systemPrompt, userMessage }) {
  const model = getModel();

  // Gemini accepts system instruction via systemInstruction param
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  });

  return result.response.text();
}

module.exports = { askAI };
