'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';

function getMessageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

export default function Chat() {
  const { messages, sendMessage, error } = useChat();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          <span className="status-pill rounded-full px-3 py-1 text-xs font-semibold">
            Online
          </span>
        </div>
      </header>

      <div className="glass-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="chat-empty mx-auto mt-14 max-w-xl rounded-2xl p-5 text-center">
              Ask about your uploaded docs, brainstorm ideas, or request summaries.
            </div>
          ) : null}

          {messages.map(m => {
            const isUser = m.role === 'user';
            const content = getMessageText(m.parts);

            return (
              <article
                key={m.id}
                className={`chat-bubble max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-base ${
                  isUser ? 'chat-bubble-user ml-auto' : 'chat-bubble-assistant mr-auto'
                }`}
              >
                <p className="chat-bubble-label mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]">
                  {isUser ? 'You' : 'Assistant'}
                </p>
                {content || '...'}
              </article>
            );
          })}

          {isSending ? (
            <div className="thinking-pill mr-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <span className="thinking-dot h-2 w-2 animate-bounce rounded-full" />
              <span className="thinking-dot h-2 w-2 animate-bounce rounded-full [animation-delay:120ms]" />
              <span className="thinking-dot h-2 w-2 animate-bounce rounded-full [animation-delay:240ms]" />
              thinking
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
              disabled={isSending}
            />
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