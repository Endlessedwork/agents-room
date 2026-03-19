import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap
} from 'lucide-react';

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

interface RoomAgent {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
}

interface ConversationPanelProps {
  room: {
    id: string;
    name: string;
    topic: string | null;
    roomAgents?: RoomAgent[];
  };
}

export function ConversationPanel({ room }: ConversationPanelProps) {
  const agents = room.roomAgents ?? [];

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h1 className="text-[28px] font-semibold leading-tight">{room.name}</h1>
        {room.topic && (
          <p className="text-sm text-muted-foreground mt-2">{room.topic}</p>
        )}

        {agents.length > 0 && (
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            {agents.map((agent) => {
              const Icon = ICON_MAP[agent.avatarIcon] ?? Brain;
              return (
                <div
                  key={agent.id}
                  title={agent.name}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: agent.avatarColor }}
                >
                  <Icon size={16} className="text-white" />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <p className="text-lg font-semibold">Ready when you are</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add agents to this room, then start a conversation in Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}
