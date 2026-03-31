function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(' ')
    .filter(token => token.length > 1);
}

export async function findRelevantContent(userQuery: string, allContent: string) {
  if (!userQuery || userQuery.trim().length === 0) return '';
  if (!allContent || allContent.trim().length === 0) return '';

  // Break content into paragraph-like chunks for simpler retrieval.
  const chunks = allContent
    .split(/\n{2,}|\r\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 10);

  if (chunks.length === 0) return '';

  const queryTokens = tokenize(userQuery);
  const uniqueQueryTokens = [...new Set(queryTokens)];

  const scoredChunks = chunks
    .map((chunk, index) => {
      const chunkTokens = tokenize(chunk);
      const chunkTokenSet = new Set(chunkTokens);

      let overlapScore = 0;
      for (const token of uniqueQueryTokens) {
        if (chunkTokenSet.has(token)) {
          overlapScore += 1;
        }
      }

      // Small boost for exact phrase match.
      const phraseBoost = normalizeText(chunk).includes(normalizeText(userQuery)) ? 2 : 0;

      return {
        chunk,
        index,
        score: overlapScore + phraseBoost,
      };
    })
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score));

  const relevant = scoredChunks.filter(item => item.score > 0).slice(0, 3);

  if (relevant.length > 0) {
    return relevant.map(item => item.chunk).join('\n\n');
  }

  // Fallback keeps chat grounded in user data even when token overlap is low.
  return chunks.slice(0, 2).join('\n\n');
}