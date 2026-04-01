import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, streamText } from 'ai';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
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
- Telegram: https://t.me/officialkira
- Instagram: https://instagram.com/kiras857
- Portfolio: https://kira-portfolio-bice.vercel.app/`;
const PERSONAL_CONTEXT_FILES = new Set([
  'me-profile.txt',
  'me.txt',
  'about-me.txt',
  'bio.txt',
  'picture.txt',
  'photo.txt',
  'me-picture.txt',
]);
const IMAGE_URL_REGEX = /(?:https?:\/\/[^\s]+|\/uploads\/[^\s]+)\.(?:png|jpe?g|webp|gif)/gi;

function isPictureQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('picture') ||
    normalized.includes('pic') ||
    normalized.includes('photo') ||
    normalized.includes('image') ||
    normalized.includes('profile picture') ||
    normalized.includes('profile photo') ||
    normalized.includes('look like') ||
    normalized.includes('your face')
  );
}

function isCvQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('cv') ||
    normalized.includes('resume') ||
    normalized.includes('curriculum vitae')
  );
}

function isAboutKirubelQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('about kirubel') ||
    normalized.includes('tell me about kirubel') ||
    normalized.includes('who is kirubel') ||
    normalized.includes('about him') ||
    normalized.includes('about me')
  );
}

function wantsAnotherPicture(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('another') ||
    normalized.includes('other one') ||
    normalized.includes('different') ||
    normalized.includes('not this') ||
    normalized.includes('next one')
  );
}

function isContactQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('contact') ||
    normalized.includes('reach') ||
    normalized.includes('get kirubel') ||
    normalized.includes('how can i get') ||
    normalized.includes('email') ||
    normalized.includes('linkedin') ||
    normalized.includes('telegram') ||
    normalized.includes('instagram') ||
    normalized.includes('portfolio') ||
    normalized.includes('website')
  );
}

function isRelationshipQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('relationship') ||
    normalized.includes('girlfriend') ||
    normalized.includes('boyfriend') ||
    normalized.includes('love life') ||
    normalized.includes('single') ||
    normalized.includes('dating')
  );
}

function isLocationQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('where he live') ||
    normalized.includes('where does he live') ||
    normalized.includes('where is he living') ||
    normalized.includes('where does kirubel live') ||
    normalized.includes('where is kirubel now') ||
    normalized.includes('current location') ||
    normalized.includes('where he stay') ||
    normalized.includes('residence')
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

function listUploadedImageUrls(files: string[]) {
  return files
    .filter(file => /\.(png|jpe?g|webp|gif)$/i.test(file))
    .map(file => `/uploads/${file}`);
}

function toUploadUrl(file: string) {
  const encoded = encodeURIComponent(file)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `/uploads/${encoded}`;
}

function pickCvUrl(files: string[]) {
  const pdfFiles = files.filter(file => /\.(pdf|docx?)$/i.test(file));

  if (pdfFiles.length === 0) {
    return '';
  }

  const prioritized = [...pdfFiles].sort((a, b) => {
    const aScore = /(cv|resume|curriculum)/i.test(a) ? 1 : 0;
    const bScore = /(cv|resume|curriculum)/i.test(b) ? 1 : 0;
    return bScore - aScore;
  });

  return toUploadUrl(prioritized[0]);
}

function normalizeToPath(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function collectShownImagePaths(messages: UIMessage[]) {
  const shown = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.parts)) {
      continue;
    }

    for (const part of message.parts) {
      if (part.type === 'text' && typeof part.text === 'string') {
        const matches = part.text.match(IMAGE_URL_REGEX) ?? [];
        for (const match of matches) {
          shown.add(normalizeToPath(match));
        }
      }
    }
  }

  return shown;
}

function createFixedTextResponse(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const writePart = (part: Parameters<typeof writer.write>[0]) => writer.write(part);

      writePart({ type: 'start' });
      writePart({ type: 'start-step' });
      writePart({ type: 'text-start', id: '0' });
      writePart({ type: 'text-delta', id: '0', delta: text });
      writePart({ type: 'text-end', id: '0' });
      writePart({ type: 'finish-step' });
      writePart({ type: 'finish', finishReason: 'stop' });
    },
  });

  return createUIMessageStreamResponse({ stream });
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
    let cvUrl = '';
    let noAlternativeImage = false;
    let userAskedPicture = isPictureQuestion(lastMessage);
    const userAskedAnotherPicture = wantsAnotherPicture(lastMessage);

    try {
      const files = await readdir(uploadDir);
      profileImageUrl = pickProfileImageUrl(files);
      cvUrl = pickCvUrl(files);
      const uploadedImageUrls = listUploadedImageUrls(files);
      const shownImagePaths = collectShownImagePaths(safeMessages);

      if (!userAskedPicture && userAskedAnotherPicture && shownImagePaths.size > 0) {
        userAskedPicture = true;
      }

      if (uploadedImageUrls.length > 0 && userAskedPicture) {
        if (userAskedAnotherPicture) {
          const nextImage = uploadedImageUrls.find(url => !shownImagePaths.has(url));
          if (nextImage) {
            profileImageUrl = nextImage;
          } else {
            noAlternativeImage = true;
          }
        } else {
          profileImageUrl = uploadedImageUrls[0];
        }
      }

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
    const shouldUseContactMode = isContactQuestion(lastMessage);
    const shouldUseCvMode = isCvQuestion(lastMessage);
    const shouldUseAboutMode = isAboutKirubelQuestion(lastMessage);
    const shouldUseRelationshipMode = isRelationshipQuestion(lastMessage);
    const shouldUseLocationMode = isLocationQuestion(lastMessage);
    const requestOrigin = new URL(req.url).origin;
    const profileImageAbsoluteUrl = profileImageUrl ? `${requestOrigin}${profileImageUrl}` : '';
    const cvAbsoluteUrl = cvUrl ? `${requestOrigin}${cvUrl}` : '';

    // Deterministic picture replies avoid model hallucinations.
    if (userAskedPicture) {
      if (noAlternativeImage) {
        return createFixedTextResponse('There is no other image available besides the one already shown.');
      }

      return createFixedTextResponse(`Kirubel's picture:\n${profileImageAbsoluteUrl}`);
    }

    if (shouldUseLocationMode) {
      return createFixedTextResponse(
        "Kirubel is currently based in Ethiopia and studying Software Engineering at AMU. His exact current residence is private and not publicly shared.",
      );
    }

    if (shouldUseCvMode) {
      if (!cvAbsoluteUrl) {
        return createFixedTextResponse('Kirubel\'s CV is not uploaded yet. Please upload a CV file (PDF/DOCX) to public/uploads first.');
      }

      return createFixedTextResponse(`[Click here to see Kirubel's CV](${cvAbsoluteUrl})`);
    }

    if (shouldUseAboutMode || shouldUseContactMode) {
      const cvLine = cvAbsoluteUrl
        ? `- CV: [Click here to see Kirubel's CV](${cvAbsoluteUrl})`
        : '- CV: Not uploaded yet.';

      return createFixedTextResponse(`Kirubel Adisu Firew is a 4th year Software Engineering student at AMU, focused on resilient systems, clean code, and practical AI/web products.\n\nContact and links:\n- Email: akirubel339@gmail.com\n- LinkedIn: https://www.linkedin.com/in/kirubel-adisu-ns339\n- Telegram: https://t.me/officialkira\n- Instagram: https://instagram.com/kiras857\n- Portfolio: https://kira-portfolio-bice.vercel.app/\n${cvLine}`);
    }
    const mergedProfileContext = personalContext.trim()
      ? `${DEFAULT_PROFILE_CONTEXT}\n\nUploaded profile additions:\n${personalContext.slice(0, 3000)}`
      : DEFAULT_PROFILE_CONTEXT;

    const personalContextInstruction = `Personal profile and photo description (trusted source):\n${mergedProfileContext}`;

    const contextInstruction = contextForPrompt
      ? `Context: ${contextForPrompt}`
      : 'Use general profile knowledge and answer confidently in assistant tone.';

    const personaInstruction =
      'You are Kirubel\'s AI assistant. Never claim to be Kirubel. Speak about him in third person (he/him, Kirubel), unless the user explicitly asks for a quoted first-person introduction.';

    const pictureSafetyInstruction = shouldUsePersonalContext
      ? profileImageAbsoluteUrl
        ? `For picture/photo questions: never say you cannot display images. Reply in exactly two lines:
Line 1: Kirubel's picture:
Line 2: ${profileImageAbsoluteUrl}
    Do not add extra text. Do not send Instagram or any other external link for picture requests.`
        : `For picture/photo questions asking for another image: reply exactly this line and nothing else:
There is no other image available besides the one already shown.`
      : '';

    const contactInstruction = shouldUseContactMode
      ? `For contact questions about Kirubel: output exactly this list and nothing else:
- Email: akirubel339@gmail.com
- LinkedIn: https://www.linkedin.com/in/kirubel-adisu-ns339
- Telegram: https://t.me/officialkira
    - Instagram: https://instagram.com/kiras857
    - Portfolio: https://kira-portfolio-bice.vercel.app/`
      : '';

    const relationshipInstruction = shouldUseRelationshipMode
      ? 'For relationship questions: answer in assistant voice about Kirubel only. State this clearly: he loved a girl once, she left and broke his heart, and through faith in God he rose again stronger and now channels that pain into resilient systems. Do not speculate beyond this.'
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
Never mention uploads, hidden context, internal sources, or retrieval process.
If a detail is unknown, answer gracefully and naturally without saying "based on context".
For private personal details, give a respectful privacy-safe answer.
    Never claim you are unable to display images; provide the configured image path when asked for Kirubel's picture.
${pictureSafetyInstruction}
${contactInstruction}
    ${relationshipInstruction}
${personaInstruction}
${personalContextInstruction}
${contextInstruction}`,
  temperature: shouldUsePersonalContext || shouldUseContactMode ? 0 : 0.15,
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