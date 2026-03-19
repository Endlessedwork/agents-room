import { AgentForm } from '@/components/agents/AgentForm';
import { AGENT_PRESETS } from '@/components/agents/AgentPresets';

interface AgentsNewPageProps {
  searchParams: Promise<{ preset?: string }>;
}

export default async function AgentsNewPage({ searchParams }: AgentsNewPageProps) {
  const params = await searchParams;
  const presetId = params.preset;
  const preset = presetId
    ? (AGENT_PRESETS.find((p) => p.id === presetId) ?? null)
    : null;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">
        {preset ? `Create Agent from ${preset.name} template` : 'Create Agent'}
      </h1>
      <AgentForm preset={preset} />
    </div>
  );
}
