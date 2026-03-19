'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';
import { AgentCard } from '@/components/agents/AgentCard';
import { AGENT_PRESETS } from '@/components/agents/AgentPresets';

export default function AgentsPage() {
  const { agents, fetchAgents } = useAgentStore();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  function handleDelete(id: string) {
    useAgentStore.setState((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
    }));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Agent Library</h1>
        <Link href="/agents/new" className={cn(buttonVariants())}>
          Create Agent
        </Link>
      </div>

      {/* Preset templates */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Preset Templates
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {AGENT_PRESETS.map((preset) => (
            <Card key={preset.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    style={{ backgroundColor: preset.avatarColor }}
                  />
                  <h3 className="text-sm font-semibold">{preset.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {preset.promptRole}
                </p>
                <Link
                  href={`/agents/new?preset=${preset.id}`}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full justify-center')}
                >
                  Use Template
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-semibold">No agents yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create an agent with a persona, then assign it to a room.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
