import { NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY ?? 'ollama';

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ online: false, reason: 'model-server-unreachable' });
    }

    return NextResponse.json({ online: true });
  } catch {
    return NextResponse.json({ online: false, reason: 'model-server-unreachable' });
  } finally {
    clearTimeout(timeout);
  }
}
