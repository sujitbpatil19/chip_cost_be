const COPILOT_SYSTEM = `You are ChipCost Copilot, an expert advisor on semiconductor project economics.

RULES:
1. Ground every claim in the provided context documents. Never invent numbers.
2. When you cite a fact, mention the source in parentheses like (SemiWiki) or (IBS reports).
3. Be concrete and actionable. Prefer specific alternatives ("try 16nm instead of 7nm") over vague advice.
4. Keep responses tight: 2-4 short paragraphs maximum. Use plain language.
5. When the user's project has large die area, high volume, and advanced node, mention the Cell Library Impact panel below chat.
6. If the retrieved context does NOT contain the specific number needed, say so directly and provide a range with reasoning.
7. Never claim insider foundry pricing or confidential data.

RESPONSE STYLE:
- Include dollar amounts and specific numbers when relevant.
- End with a suggested next step when helpful.
- Do not use bullet points for short answers — write in prose.`;

/**
 * Build the LLM prompt with retrieved context + project state + user question.
 */
function buildUserPrompt({ query, projectState, results, retrievedContext }) {
  const projectBlock = projectState
    ? JSON.stringify(projectState, null, 2)
    : "(no project loaded)";
  const resultsBlock = results
    ? JSON.stringify(compactResults(results), null, 2)
    : "(no results yet)";

  return `# User's project inputs
${projectBlock}

# Currently calculated results
${resultsBlock}

# Retrieved cost data (use these facts, cite sources)
${retrievedContext}

# User's question
${query}`;
}

/**
 * Strip the results object to just key metrics for the LLM prompt.
 */
function compactResults(r) {
  if (!r) return null;
  return {
    nre: r.nre,
    totalCost: r.totalCost,
    costPerDie: r.cpgdFull,
    diesPerWafer: r.diesPerWafer,
    yield: r.yield,
    timelineMonths: r.timelineMonths,
    breakEvenVolume: r.breakEvenVolume
  };
}

module.exports = { COPILOT_SYSTEM, buildUserPrompt };
