import { create } from 'zustand';

export interface Agent {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
  promptRole: string;
  promptPersonality: string | null;
  promptRules: string | null;
  promptConstraints: string | null;
  provider: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';
  model: string;
  temperature: number;
  presetId: string | null;
  notes: string | null;
  createdAt: Date;
}

type CreateAgentBody = Omit<Agent, 'id' | 'createdAt'>;

interface AgentStore {
  agents: Agent[];
  loading: boolean;
  fetchAgents: () => Promise<void>;
  createAgent: (data: CreateAgentBody) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Omit<Agent, 'id' | 'createdAt'>>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  loading: false,
  fetchAgents: async () => {
    set({ loading: true });
    const res = await fetch('/api/agents');
    const agents = await res.json();
    set({ agents, loading: false });
  },
  createAgent: async (data) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const agent = await res.json();
    set((s) => ({ agents: [...s.agents, agent] }));
    return agent;
  },
  updateAgent: async (id, data) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update agent');
    const updated = await res.json();
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
    return updated;
  },
  deleteAgent: async (id) => {
    await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },
}));
