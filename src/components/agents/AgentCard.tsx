'use client';

import { useState } from 'react';
import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { type Agent } from '@/stores/agentStore';

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

const PRESET_NAMES: Record<string, string> = {
  'devils-advocate': "Devil's Advocate",
  'code-reviewer': 'Code Reviewer',
  researcher: 'Researcher',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
};

interface AgentCardProps {
  agent: Agent;
  onDelete?: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = ICON_MAP[agent.avatarIcon] ?? Brain;

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      onDelete?.(agent.id);
      setDeleteOpen(false);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: agent.avatarColor }}
            >
              <Icon size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold truncate">{agent.name}</h3>
                {agent.presetId && PRESET_NAMES[agent.presetId] && (
                  <Badge variant="secondary" className="text-xs">
                    {PRESET_NAMES[agent.presetId]}
                  </Badge>
                )}
              </div>
              {agent.promptRole && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {agent.promptRole}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {PROVIDER_LABELS[agent.provider] ?? agent.provider}
                </Badge>
                <span className="text-xs text-muted-foreground">{agent.model}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  T: {agent.temperature.toFixed(1)}
                </span>
              </div>
              {agent.notes && (
                <p className="text-xs text-muted-foreground mt-2 border-t pt-2 line-clamp-3">
                  {agent.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              This will delete {agent.name} from your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
