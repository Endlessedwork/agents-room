import { notFound } from 'next/navigation';
import { db } from '@/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AgentForm } from '@/components/agents/AgentForm';
import { type Agent } from '@/stores/agentStore';

interface AgentEditPageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentEditPage({ params }: AgentEditPageProps) {
  const { agentId } = await params;
  const row = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });

  if (!row) notFound();

  const agent = row as unknown as Agent;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Edit Agent</h1>
      <AgentForm initialData={agent} />
    </div>
  );
}
