import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { presets } from '@/db/schema';
import { AgentForm } from '@/components/agents/AgentForm';
import { type AgentPreset } from '@/components/agents/AgentPresets';

interface AgentsNewPageProps {
  searchParams: Promise<{ preset?: string }>;
}

export default async function AgentsNewPage({ searchParams }: AgentsNewPageProps) {
  const params = await searchParams;
  const presetId = params.preset;
  const preset = presetId
    ? ((await db.select().from(presets).where(eq(presets.id, presetId)))[0] ?? null)
    : null;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">
        {preset ? `Create Agent from ${preset.name} template` : 'Create Agent'}
      </h1>
      <AgentForm preset={preset as unknown as AgentPreset} />
    </div>
  );
}
