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
const DEFAULT_PROFILE_CONTEXT = `Kirubel Adisu is a 4th year Software Engineering student at AMU, graduating in 2027 (2019 E.C.).
He is a designer/engineer focused on resilient systems, built on faith and clean code.

Core stats:
- Education: 4th Year Software Engineering @ AMU. Progress: 92%.
- Tech stack: Next.js, React, Java, Python (AI), PHP, and Unity/C#.
- Credentials: JS Algorithms (FreeCodeCamp), Python (UniAthena), Programming Fundamentals (Udacity).
- Philosophy: Coding with Empathy.
- Role: Counselor bridging tech with human support.

Personal resilience:
- Kirubel loved a girl once; she broke his heart and left.
- Through his faith in God, he found the strength to rise again, stronger than before.
- He now channels that pain into building resilient, unbreakable systems.

Projects:
- Emerald Car Dealership: Premium PHP/Tailwind commerce site.
- AR Dragon System: Unity/C# AR tracking app.
- Marburg Alert Ethiopia: Java epidemic monitoring system.
- Dormitory Management: Java/MySQL housing system.

Contact and links:
- Email: akirubel339@gmail.com
- LinkedIn: https://www.linkedin.com/in/kirubel-adisu-ns339
- Telegram: @officialkira
- Instagram: @kiras857`;
const PERSONAL_CONTEXT_FILES = new Set([
  'me-profile.txt',
  'me.txt',
  'about-me.txt',
  'bio.txt',
  'picture.txt',
  'photo.txt',
  'me-picture.txt',
]);

function isPictureQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('picture') ||
    normalized.includes('photo') ||
    normalized.includes('image') ||
    normalized.includes('look like') ||
    normalized.includes('your face') ||
    normalized.includes('about you') ||
    normalized.includes('about kirubel')
  );
}

function pickProfileImageUrl(files: string[]) {
  const preferred = ['me.jpg', 'me.jpeg', 'me.png', 'me.webp'];
  const lowerFiles = files.map(file => file.toLowerCase());

  for (const target of preferred) {
    const index = lowerFiles.indexOf(target);
    if (index >= 0) {
      return `/uploads/${files[index]}`;
    }
  }

  return '/me.jpg';
}

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
    let personalContext = '';
    let profileImageUrl = '/me.jpg';

    try {
      const files = await readdir(uploadDir);
      profileImageUrl = pickProfileImageUrl(files);

      for (const file of files) {
        if (file.endsWith('.txt')) {
          const content = await readFile(path.join(uploadDir, file), 'utf-8');
          rawContent += content;
          rawContent += '\n';

          if (PERSONAL_CONTEXT_FILES.has(file.toLowerCase())) {
            personalContext += content;
            personalContext += '\n';
          }
        }
      }
    } catch {
      // Ignore missing/empty upload folder and continue with empty context.
    }

    const specificContext = await findRelevantContent(lastMessage, rawContent);
    const contextForPrompt = specificContext.slice(0, 8000);
    const shouldUsePersonalContext = isPictureQuestion(lastMessage);
    const mergedProfileContext = personalContext.trim()
      ? `${DEFAULT_PROFILE_CONTEXT}\n\nUploaded profile additions:\n${personalContext.slice(0, 3000)}`
      : DEFAULT_PROFILE_CONTEXT;

    const personalContextInstruction = `Personal profile and photo description (trusted source):\n${mergedProfileContext}`;

    const contextInstruction = contextForPrompt
      ? `Context: ${contextForPrompt}`
      : 'No relevant uploaded context found. Answer from general knowledge.';

    const personaInstruction =
      'You are Kirubel\'s AI assistant. Never claim to be Kirubel. Speak about him in third person (he/him, Kirubel), unless the user explicitly asks for a quoted first-person introduction.';

    const pictureSafetyInstruction = shouldUsePersonalContext
      ? `For picture/photo questions: use only the personal profile/photo text. Do not invent visual details. Always include this direct image path in your answer: ${profileImageUrl}`
      : '';

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
${pictureSafetyInstruction}
${personaInstruction}
${personalContextInstruction}
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