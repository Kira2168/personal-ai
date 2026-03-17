export async function findRelevantContent(userQuery: string, allContent: string) {
  if (!userQuery || userQuery.trim().length === 0) return "";

  // Split your file into chunks
  const chunks = allContent.split('\n').filter(c => c.trim().length > 5);
  
  // Clean the user query to get keywords
  const keywords = userQuery.toLowerCase()
    .replace(/[?.,!]/g, '')
    .split(' ')
    .filter(w => w.length > 3);

  // Find chunks that contain ANY of your keywords
  const relevantChunks = chunks.filter(chunk => {
    const lowerChunk = chunk.toLowerCase();
    return keywords.some(word => lowerChunk.includes(word));
  });

  // Return only the top 2 relevant paragraphs (keeps tokens low!)
  return relevantChunks.slice(0, 2).join('\n\n');
}