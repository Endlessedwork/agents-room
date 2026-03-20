'use client';

import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface ThinkingBubbleProps {
  agentName: string;
  avatarColor: string;
  avatarIcon: string;
  promptRole: string;
}

export function ThinkingBubble({ agentName, avatarColor, avatarIcon, promptRole }: ThinkingBubbleProps) {
  const Icon = ICON_MAP[avatarIcon] ?? Brain;

  return (
    <div className="flex flex-row gap-3 px-4 py-2">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
        style={{ backgroundColor: avatarColor }}
      >
        <Icon size={14} className="text-white" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 max-w-[80%]">
        {/* Name + badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{agentName}</span>
          {promptRole && (
            <Badge variant="outline">{promptRole}</Badge>
          )}
        </div>

        {/* Bubble with bouncing dots */}
        <div
          className="bg-muted/50 rounded-lg p-3 border-l-[3px]"
          style={{ borderLeftColor: avatarColor }}
        >
          <span className="flex gap-1 items-center py-1">
            <span
              className="w-2 h-2 rounded-full animate-bounce [animation-delay:0ms]"
              style={{ backgroundColor: avatarColor }}
            />
            <span
              className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]"
              style={{ backgroundColor: avatarColor }}
            />
            <span
              className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]"
              style={{ backgroundColor: avatarColor }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
