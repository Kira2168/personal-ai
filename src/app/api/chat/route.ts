import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, streamText } from 'ai';
import type { UIMessage } from 'ai';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { findRelevantContent } from '@/lib/vector-store';

const ollama = createOpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1',
  apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
  name: 'ollama',
});

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
const OLLAMA_MAX_OUTPUT_TOKENS = Number(process.env.OLLAMA_MAX_OUTPUT_TOKENS ?? '1024');

function getMessageText(message: unknown): string {
  if (!message || typeof message !== 'object') {
    return '';
  }

  const typedMessage = message as {
    content?: unknown;
    parts?: Array<{ type?: string; text?: string }>;
  };

  if (typeof typedMessage.content === 'string') {
    return typedMessage.content;
  }

  if (Array.isArray(typedMessage.parts)) {
    return typedMessage.parts
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join(' ')
      .trim();
  }

  return '';
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("INCOMING BODY:", JSON.stringify(body, null, 2));
    const { messages } = body as { messages?: UIMessage[] };
    const safeMessages = Array.isArray(messages) ? messages : [];
    const lastMessage = getMessageText(safeMessages[safeMessages.length - 1]);
    const messagesWithoutIds = safeMessages.map(message => {
      const { id, ...rest } = message;
      void id;
      return rest;
    });
    const modelMessages = await convertToModelMessages(messagesWithoutIds);

    // Read uploaded text files to build context for retrieval.
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    let rawContent = '';
    let personaProfile = '';

    try {
      const files = await readdir(uploadDir);

      for (const file of files) {
        if (file.endsWith('.txt')) {
          const content = await readFile(path.join(uploadDir, file), 'utf-8');
          rawContent += content;
          rawContent += '\n';

          if (file.toLowerCase() === 'me-profile.txt' || file.toLowerCase() === 'me.txt') {
            personaProfile += content;
            personaProfile += '\n';
          }
        }
      }
    } catch {
      // Ignore missing/empty upload folder and continue with empty context.
    }

    const specificContext = await findRelevantContent(lastMessage, rawContent);
    const contextForPrompt = specificContext.slice(0, 8000);

    const contextInstruction = contextForPrompt
      ? `Context: ${contextForPrompt}`
      : 'No relevant uploaded context found. Answer from general knowledge.';

    const personaInstruction = personaProfile.trim()
      ? `Persona profile (speak in this style when answering):\n${personaProfile.slice(0, 2500)}`
      : 'If the user asks for first-person answers, respond as Kirubel in a friendly and clear style.';

    const result = await streamText({
      model: ollama.chat(OLLAMA_MODEL),
      messages: modelMessages,
      system: `You are a helpful assistant.
Respond in clear and natural English.
Do not repeat the same sentence or paragraph.
Use short paragraphs or bullets and keep the answer focused.
Provide complete answers and avoid cutting off mid-sentence.
Use the provided context only when it is relevant to the user question.
If the context is not sufficient, say what is missing clearly.
${personaInstruction}
${contextInstruction}`,
      temperature: 0.15,
      topP: 0.85,
      frequencyPenalty: 0.8,
      maxOutputTokens: OLLAMA_MAX_OUTPUT_TOKENS,
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse({
      onError: error => {
        const message = error instanceof Error ? error.message : String(error);
        const modelNotFound = message.includes('model') && message.toLowerCase().includes('not found');
        const ollamaOffline =
          message.includes('ECONNREFUSED') ||
          message.toLowerCase().includes('connect') ||
          message.toLowerCase().includes('fetch failed');

        if (modelNotFound) {
          return `Configured Ollama model was not found. Pull it with: ollama pull ${OLLAMA_MODEL}`;
        }

        if (ollamaOffline) {
          return 'Ollama server is not reachable. Start it with: ollama serve';
        }

        return 'The chat request failed. Please try again in a moment.';
      },
    });
  } catch (error: unknown) {
    console.error('FULL ERROR STACK:', error instanceof Error ? error.stack ?? error.message : error);
    const message = error instanceof Error ? error.message : 'Unknown chat error';
    const modelNotFound = message.includes('model') && message.toLowerCase().includes('not found');
    const ollamaOffline =
      message.includes('ECONNREFUSED') ||
      message.toLowerCase().includes('connect') ||
      message.toLowerCase().includes('fetch failed');

    if (modelNotFound) {
      return Response.json(
        {
          error: 'Configured Ollama model was not found. Pull the configured model for this language first.',
        },
        { status: 400 },
      );
    }

    if (ollamaOffline) {
      return Response.json(
        {
          error: 'Ollama server is not reachable. Start it with: ollama serve',
        },
        { status: 503 },
      );
    }

    return Response.json({ error: message }, { status: 500 });
  }
}