import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { convertToModelMessages, streamText } from 'ai';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { findRelevantContent } from '@/lib/vector-store';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content || '';
    const modelMessages = await convertToModelMessages(messages);

    // Read uploaded text files to build context for retrieval.
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    let rawContent = '';

    try {
      const files = await readdir(uploadDir);

      for (const file of files) {
        if (file.endsWith('.txt')) {
          rawContent += await readFile(path.join(uploadDir, file), 'utf-8');
          rawContent += '\n';
        }
      }
    } catch {
      // Ignore missing/empty upload folder and continue with empty context.
    }

    const specificContext = await findRelevantContent(lastMessage, rawContent);

    const result = await streamText({
      model: google(GEMINI_MODEL),
      messages: modelMessages,
      system: `You are a helpful assistant. Context: ${specificContext}`,
      maxOutputTokens: 300,
      maxRetries: 0,
    });

    return result.toUIMessageStreamResponse({
      onError: error => {
        const message = error instanceof Error ? error.message : String(error);
        const modelNotFound =
          message.includes('not found for API version') ||
          message.includes('NOT_FOUND') ||
          message.includes('404');
        const quotaExceeded =
          message.toLowerCase().includes('quota') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('429');

        if (modelNotFound) {
          return `Configured Gemini model "${GEMINI_MODEL}" is unavailable for this API version. Set GEMINI_MODEL to a supported model (for example gemini-2.0-flash).`;
        }

        if (quotaExceeded) {
          return 'Gemini quota exceeded for this API key/project. Add billing or use another key/project with quota to restore responses.';
        }

        return 'The chat request failed. Please try again in a moment.';
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown chat error';
    const modelNotFound =
      message.includes('not found for API version') ||
      message.includes('NOT_FOUND') ||
      message.includes('404');
    const quotaExceeded =
      message.toLowerCase().includes('quota') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('429');

    if (modelNotFound) {
      return Response.json(
        {
          error: `Configured Gemini model "${GEMINI_MODEL}" is unavailable for this API version. Set GEMINI_MODEL to a supported model (for example gemini-2.0-flash).`,
        },
        { status: 400 },
      );
    }

    if (quotaExceeded) {
      return Response.json(
        {
          error:
            'Gemini quota exceeded for this API key/project. Add billing or use another key/project with quota to restore responses.',
        },
        { status: 429 },
      );
    }

    return Response.json({ error: message }, { status: 500 });
  }
}