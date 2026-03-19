'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
};

const STEPS = ['1. Name', '2. Agents', '3. Review'] as const;

export function RoomWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 state
  const [roomName, setRoomName] = useState('');
  const [topic, setTopic] = useState('');
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // Step 2 state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [step2Error, setStep2Error] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Step 3 state
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (step === 1 && agents.length === 0) {
      setLoadingAgents(true);
      fetch('/api/agents')
        .then((r) => r.json())
        .then((data: Agent[]) => {
          setAgents(data);
          setLoadingAgents(false);
        })
        .catch(() => setLoadingAgents(false));
    }
  }, [step]);

  function handleStep1Next() {
    const errs: Record<string, string> = {};
    if (!roomName.trim()) errs.roomName = 'This field is required.';
    if (Object.keys(errs).length > 0) {
      setStep1Errors(errs);
      return;
    }
    setStep1Errors({});
    setStep(1);
  }

  function handleStep2Next() {
    if (selectedAgentIds.size === 0) {
      setStep2Error('Please select at least one agent to continue.');
      return;
    }
    setStep2Error('');
    setStep(2);
  }

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  async function handleCreate() {
    setCreating(true);
    try {
      // 1. Create room
      const roomRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          topic: topic.trim() || undefined,
        }),
      });
      const room = await roomRes.json();

      // 2. Assign agents via copy-on-assign
      for (const agentId of selectedAgentIds) {
        await fetch(`/api/rooms/${room.id}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId }),
        });
      }

      router.push(`/rooms/${room.id}`);
    } catch {
      setCreating(false);
    }
  }

  const selectedAgents = agents.filter((a) => selectedAgentIds.has(a.id));

  // Sort agents by most recently created for suggestions (top 3 highlighted)
  const sortedAgents = [...agents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const suggestedIds = new Set(sortedAgents.slice(0, 3).map((a) => a.id));

  return (
    <div className="max-w-xl mx-auto py-12 px-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEPS.map((label, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold',
                idx === step
                  ? 'bg-primary text-primary-foreground'
                  : idx < step
                    ? 'bg-primary/60 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {idx + 1}
            </div>
            <span
              className={cn(
                'text-xs font-semibold',
                idx === step ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {label.split('. ')[1]}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="w-8 h-px bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Name */}
      {step === 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Name your room</h2>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Room name <span className="text-destructive">*</span>
            </label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Strategy Debate"
              className={step1Errors.roomName ? 'border-destructive' : ''}
              onKeyDown={(e) => e.key === 'Enter' && handleStep1Next()}
            />
            {step1Errors.roomName && (
              <p className="text-xs text-destructive mt-1">{step1Errors.roomName}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Topic / question (optional)
            </label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={280}
              rows={4}
              placeholder="e.g. Should we use microservices?"
            />
          </div>
          <Button onClick={handleStep1Next}>Next</Button>
        </div>
      )}

      {/* Step 2: Pick agents */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Pick agents</h2>
          {loadingAgents ? (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold">No agents yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create an agent first, then come back to create a room.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => {
                const Icon = ICON_MAP[agent.avatarIcon] ?? Brain;
                const isSelected = selectedAgentIds.has(agent.id);
                const isSuggested = suggestedIds.has(agent.id);

                return (
                  <div
                    key={agent.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent'
                    )}
                    onClick={() => toggleAgent(agent.id)}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: agent.avatarColor }}
                    >
                      <Icon size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-medium flex-1">{agent.name}</span>
                    {isSuggested && !isSelected && (
                      <Badge variant="secondary" className="text-xs">
                        Suggested
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {PROVIDER_LABELS[agent.provider] ?? agent.provider}
                    </Badge>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAgent(agent.id)}
                      className="w-4 h-4 rounded border-border"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {step2Error && (
            <p className="text-xs text-destructive">{step2Error}</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={handleStep2Next}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Review and create</h2>
          <div className="space-y-4 bg-muted/30 rounded-lg p-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Room
              </p>
              <p className="text-sm font-medium">{roomName}</p>
              {topic && (
                <p className="text-xs text-muted-foreground mt-0.5">{topic}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Agents ({selectedAgents.length})
              </p>
              <div className="space-y-2">
                {selectedAgents.map((agent) => {
                  const Icon = ICON_MAP[agent.avatarIcon] ?? Brain;
                  return (
                    <div key={agent.id} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        <Icon size={10} className="text-white" />
                      </div>
                      <span className="text-sm">{agent.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
