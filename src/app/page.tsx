'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import Image from 'next/image';
import {
  FileText,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';

const IMAGE_PATH_REGEX = /(?:https?:\/\/[^\s]+|\/\/[^\s]+|\/(?:uploads\/)?[^\s]+)\.(?:png|jpe?g|webp|gif)/gi;

function getMessageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

function dedupeRepeatedBlocks(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return normalized;
  }

  const blocks = normalized.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  const seen = new Set<string>();
  const uniqueBlocks: string[] = [];

  for (const block of blocks) {
    const key = block.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBlocks.push(block);
    }
  }

  return uniqueBlocks.join('\n\n');
}

function extractImagePaths(text: string) {
  const matches = text.match(IMAGE_PATH_REGEX) ?? [];
  return [...new Set(matches.map(match => match.trim()))];
}

function normalizeImageSrc(src: string) {
  const trimmed = src.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `http:${trimmed}`;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function removeImagePaths(text: string) {
  return text
    .replace(IMAGE_PATH_REGEX, '')
    .replace(/(^|\n)\s*https?:\s*(?=\n|$)/gi, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderTextWithLinks(text: string) {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s]+|www\.[^\s]+)\)/gi;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  function getLinkIcon(href: string) {
    const lowerHref = href.toLowerCase();

    if (lowerHref.startsWith('mailto:') || lowerHref.includes('@')) return <Mail className="h-3.5 w-3.5" />;
    if (lowerHref.startsWith('tel:') || lowerHref.includes('+251')) return <Phone className="h-3.5 w-3.5" />;
    if (lowerHref.includes('linkedin.com')) return <Linkedin className="h-3.5 w-3.5" />;
    if (lowerHref.includes('instagram.com')) return <Instagram className="h-3.5 w-3.5" />;
    if (lowerHref.includes('t.me') || lowerHref.includes('telegram')) return <MessageCircle className="h-3.5 w-3.5" />;
    if (lowerHref.endsWith('.pdf')) return <FileText className="h-3.5 w-3.5" />;

    return <Globe className="h-3.5 w-3.5" />;
  }

  function renderLink(label: string, rawHref: string, key: string) {
    const href = rawHref.startsWith('http') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')
      ? rawHref
      : `https://${rawHref}`;

    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 underline decoration-white/40 underline-offset-4 hover:opacity-80"
      >
        {getLinkIcon(href)}
        <span>{label}</span>
      </a>
    );
  }

  const markdownParts = text.split(markdownLinkRegex);

  return markdownParts.flatMap((part, index) => {
    // Split result shape for regex with two captures is: text, label, url, text, ...
    if (index % 3 === 1) {
      const label = part;
      const rawHref = markdownParts[index + 1] ?? '';

      return renderLink(label, rawHref, `md-link-${index}-${rawHref}`);
    }

    // Skip URL capture slot; it is consumed together with label.
    if (index % 3 === 2) {
      return [];
    }

    const parts = part.split(urlRegex);

    return parts.map((urlPart, innerIndex) => {
      if (urlPart.match(urlRegex)) {
        return renderLink(urlPart, urlPart, `link-${index}-${innerIndex}-${urlPart}`);
      }

      return <span key={`text-${index}-${innerIndex}`}>{urlPart}</span>;
    });
  });
}

function isLikelyTruncated(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.endsWith('...')) {
    return true;
  }

  // Unclosed markdown code block commonly indicates cut-off output.
  const fenceCount = (trimmed.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) {
    return true;
  }

  const lastChar = trimmed[trimmed.length - 1];
  const endsCleanly = ['.', '!', '?', '"', '\'', '`', ')', ']', '}'].includes(lastChar);

  if (!endsCleanly) {
    return true;
  }

  return false;
}

export default function Chat() {
  const { messages, sendMessage, error } = useChat();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const avatarSrc = '/me.jpg';
  const endRef = useRef<HTMLDivElement>(null);
  const latestAssistantMessage = [...messages].reverse().find(message => message.role === 'assistant');
  const latestAssistantText = latestAssistantMessage ? getMessageText(latestAssistantMessage.parts) : '';
  const showContinue = !!latestAssistantMessage && isLikelyTruncated(latestAssistantText);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, error]);

  async function submitCurrentMessage() {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return;
    }

    setIsSending(true);
    setInput('');

    try {
      await sendMessage({ text: trimmedInput });
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrentMessage();
  }

  async function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;

    if (isDesktop && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (!isSending && input.trim()) {
        await submitCurrentMessage();
      }
    }
  }

  async function handleContinue() {
    setIsSending(true);

    try {
      await sendMessage({ text: 'Please continue from your previous answer exactly where you stopped.' });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl flex-col px-3 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
      <header className="glass-card relative mb-3 rounded-3xl px-4 py-4 sm:mb-4 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="chat-kicker text-xs uppercase tracking-[0.24em]">Kirubel Personal AI</p>
            <h1 className="chat-title mt-1 text-2xl font-bold sm:text-3xl">
              Kirubel Personal AI Chat
            </h1>
          </div>
          <span className="status-pill rounded-full px-3 py-1 text-xs font-semibold">Online</span>
        </div>
      </header>

      <div className="glass-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="chat-empty mx-auto mt-14 max-w-xl rounded-2xl p-5 text-center">
              Ask me about Kirubel or anything else.
            </div>
          ) : null}

          {messages.map(m => {
            const isUser = m.role === 'user';
            const rawContent = getMessageText(m.parts);
            const content = isUser ? rawContent : dedupeRepeatedBlocks(rawContent);
            const imagePaths = isUser ? [] : extractImagePaths(content);
            const textContent = isUser ? content : removeImagePaths(content);

            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <Image
                    src={avatarSrc}
                    alt="Kirubel"
                    width={36}
                    height={36}
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
                  />
                )}
                <article
                  className={`chat-bubble max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-base ${
                    isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  }`}
                >
                  <p className="chat-bubble-label mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">
                    {isUser ? 'You' : 'Assistant'}
                  </p>
                  {textContent ? <p>{renderTextWithLinks(textContent)}</p> : null}
                  {imagePaths.length > 0 ? (
                    <div className={textContent ? 'mt-3 space-y-2' : 'space-y-2'}>
                      {imagePaths.map(src => (
                        <img
                          key={`${m.id}-${src}`}
                          src={normalizeImageSrc(src)}
                          alt="Shared image"
                          className="h-auto w-full max-w-[440px] rounded-xl border border-white/20 object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  ) : null}
                  {!textContent && imagePaths.length === 0 ? '...' : null}
                </article>
              </div>
            );
          })}

          {isSending ? (
            <div className="flex items-start gap-2 sm:gap-3 justify-start">
              <Image
                src={avatarSrc}
                alt="Kirubel"
                width={36}
                height={36}
                className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
              />
              <div className="thinking-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <span className="thinking-dot h-2 w-2 animate-bounce rounded-full" />
                <span className="thinking-dot h-2 w-2 animate-bounce rounded-full [animation-delay:120ms]" />
                <span className="thinking-dot h-2 w-2 animate-bounce rounded-full [animation-delay:240ms]" />
                thinking
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="chat-error rounded-2xl p-4 text-sm">
              {error.message || 'The request failed. Please try again.'}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="composer-shell px-2.5 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-end gap-2 sm:gap-3">
            <textarea
              className="composer-textarea max-h-36 min-h-12 w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2"
              value={input}
              placeholder="Message your AI..."
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isSending}
            />
            {showContinue ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={isSending}
                className="h-12 shrink-0 rounded-xl border border-white/15 px-4 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="send-button h-12 shrink-0 rounded-xl px-5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}