/**
 * Rule-based fallback for the AI Copilot.
 * Runs deterministic checks against project state.
 * Fires if the LLM is unavailable or slow.
 */

const NODE_ORDER = ["180nm","130nm","65nm","40nm","28nm","22nm","16/14nm","10nm","7nm","5nm","3nm","2nm"];

function nodeIndex(node) {
  return NODE_ORDER.indexOf(node);
}

function fmt(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

function evaluateRules({ inputs, results }) {
  const insights = [];
  if (!inputs) return insights;

  // Rule 1: Advanced node + low volume mismatch
  if (nodeIndex(inputs.node) >= NODE_ORDER.indexOf("7nm") && inputs.volume < 100_000) {
    insights.push({
      type: "warning",
      title: "Volume-Node mismatch",
      message: `Your volume of ${inputs.volume.toLocaleString()} at ${inputs.node} may not amortize the high mask cost. Consider 16nm or 22nm for better economics at this volume.`
    });
  }

  // Rule 2: Team size vs category
  const teamMinByCategory = { mcu: 8, digital: 20, ai: 40, gpu: 80, rf: 15, automotive: 40 };
  const minTeam = teamMinByCategory[inputs.category];
  if (minTeam && inputs.teamSize < minTeam) {
    insights.push({
      type: "warning",
      title: "Team may be undersized",
      message: `Typical ${inputs.category} projects use ${minTeam}+ engineers. Your team of ${inputs.teamSize} may extend timeline significantly.`
    });
  }

  // Rule 3: Selling price vs cost
  if (inputs.sellingPrice && results?.cpgdFull && inputs.sellingPrice < results.cpgdFull * 1.3) {
    insights.push({
      type: "danger",
      title: "Margin concern",
      message: `Selling price of $${inputs.sellingPrice} is below 30% margin over unit cost of ${fmt(results.cpgdFull)}. Consider higher volume or a cheaper node.`
    });
  }

  // Rule 4: Small area + old node → MPW
  if (inputs.areaMm2 < 20 && nodeIndex(inputs.node) <= NODE_ORDER.indexOf("65nm")) {
    insights.push({
      type: "info",
      title: "Consider an MPW shuttle",
      message: `For ${inputs.areaMm2} mm² at ${inputs.node}, an MPW shuttle (Efabless, Muse, MOSIS) would cost ~$5K-50K instead of a full mask set.`
    });
  }

  // Rule 5: Cell library CTA (always show for meaningful projects)
  if (inputs.areaMm2 >= 50 && inputs.volume >= 50_000 && nodeIndex(inputs.node) >= NODE_ORDER.indexOf("16/14nm")) {
    insights.push({
      type: "cta",
      title: "AI-Optimized Cell Libraries",
      message: `Your project (${inputs.areaMm2} mm² at ${inputs.volume.toLocaleString()} units) could see significant savings from AI-optimized cell libraries. See the Cell Library Impact tab.`
    });
  }

  return insights;
}

/**
 * Build a canned response from rules when LLM is unavailable.
 */
function buildRuleFallbackResponse(insights) {
  if (!insights.length) {
    return "Based on your current project inputs, I don't have specific recommendations right now. Try adjusting your volume, node, or team size to see how it affects total cost.";
  }
  const lines = insights.map(i => `**${i.title}**: ${i.message}`);
  return lines.join("\n\n");
}

module.exports = { evaluateRules, buildRuleFallbackResponse };
