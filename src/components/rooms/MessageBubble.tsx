'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@/stores/chatStore';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  brain: Brain,
  code: Code,
  'book-open': BookOpen,
  flame: Flame,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  shield: Shield,
  eye: Eye,
  search: Search,
  heart: Heart,
  star: Star,
  zap: Zap,
};

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const timestamp = (() => {
    try {
      return formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  // Agent message
  if (message.role === 'agent') {
    const Icon = ICON_MAP[message.avatarIcon ?? ''] ?? Brain;
    return (
      <div className="flex flex-row gap-3 px-4 py-2">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
          style={{ backgroundColor: message.avatarColor ?? '#6b7280' }}
        >
          <Icon size={14} className="text-white" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1 max-w-[80%]">
          {/* Name + badge + model */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{message.agentName}</span>
            {message.promptRole && (
              <Badge variant="outline">{message.promptRole}</Badge>
            )}
            {message.model && (
              <span className="text-xs text-muted-foreground">{message.model}</span>
            )}
          </div>

          {/* Bubble */}
          <div
            className="bg-muted/50 rounded-lg p-3 border-l-[3px] text-sm whitespace-pre-wrap"
            style={{ borderLeftColor: message.avatarColor ?? '#6b7280' }}
          >
            {message.content}
            {isStreaming && (
              <span className="animate-blink ml-px">|</span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {timestamp && <span>{timestamp}</span>}
            {message.inputTokens !== null && message.outputTokens !== null && (
              <span>{message.inputTokens}/{message.outputTokens} tokens</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // User message
  if (message.role === 'user') {
    return (
      <div className="flex flex-row-reverse px-4 py-2">
        <div className="flex flex-col gap-1 max-w-[80%]">
          <span className="text-sm font-medium text-right">You</span>
          <div className="bg-primary text-primary-foreground rounded-lg p-3 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
          {timestamp && (
            <span className="text-xs text-muted-foreground text-right">{timestamp}</span>
          )}
        </div>
      </div>
    );
  }

  // System message
  return (
    <div className="w-full text-center py-2 px-4 bg-muted/30 text-muted-foreground text-sm rounded my-1">
      {message.content}
    </div>
  );
}
