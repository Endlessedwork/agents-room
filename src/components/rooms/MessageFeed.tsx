'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { MessageBubble } from './MessageBubble';
import { ThinkingBubble } from './ThinkingBubble';
import type { ChatMessage } from '@/stores/chatStore';

export function MessageFeed() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const summary = useChatStore((s) => s.summary);
  const summaryLoading = useChatStore((s) => s.summaryLoading);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    setIsAtBottom(true);
  };

  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages.length, streaming?.text, isAtBottom]);

  // Build streaming synthetic message when text has started
  const streamingMessage: ChatMessage | null =
    streaming && streaming.text !== ''
      ? {
          id: 'streaming',
          role: 'agent',
          content: streaming.text,
          agentId: streaming.agentId,
          agentName: streaming.agentName,
          avatarColor: streaming.avatarColor,
          avatarIcon: streaming.avatarIcon,
          promptRole: streaming.promptRole,
          model: streaming.model,
          provider: streaming.provider,
          inputTokens: null,
          outputTokens: null,
          createdAt: new Date().toISOString(),
        }
      : null;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto h-full flex flex-col gap-1 py-2"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator: streaming started but no text yet */}
        {streaming && streaming.text === '' && (
          <ThinkingBubble
            agentName={streaming.agentName}
            avatarColor={streaming.avatarColor}
            avatarIcon={streaming.avatarIcon}
            promptRole={streaming.promptRole}
          />
        )}

        {/* Streaming message: text has begun */}
        {streamingMessage && (
          <MessageBubble message={streamingMessage} isStreaming={true} />
        )}

        {/* Summary loading banner */}
        {summaryLoading && (
          <div className="w-full text-center py-3 px-4 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm rounded my-2 animate-pulse">
            Generating summary...
          </div>
        )}

        {/* Summary result banner */}
        {summary && !summaryLoading && (
          <div className="w-full py-3 px-4 bg-blue-50 dark:bg-blue-950/30 text-sm rounded my-2 border border-blue-200 dark:border-blue-800">
            <div className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Summary</div>
            <div className="text-foreground whitespace-pre-wrap">{summary}</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors z-10"
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
