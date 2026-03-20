import { generateLLM } from '@/lib/llm/gateway';
import type { ProviderName } from '@/lib/llm/providers';

export type RoomAgentRow = {
  id: string;
  name: string;
  position: number;
  provider: string;
  model: string;
  temperature: number;
  promptRole: string;
  promptPersonality?: string | null;
  promptRules?: string | null;
  promptConstraints?: string | null;
  avatarColor?: string | null;
  avatarIcon?: string | null;
};

export class SpeakerSelector {
  private agents: RoomAgentRow[];
  private strategy: 'round-robin' | 'llm-selected';
  private turnIndex = 0;
  private getProviderConfig: (provider: string) => Promise<{ apiKey?: string; baseUrl?: string }>;

  constructor(
    agents: RoomAgentRow[],
    strategy: 'round-robin' | 'llm-selected',
    getProviderConfig: (provider: string) => Promise<{ apiKey?: string; baseUrl?: string }>
  ) {
    this.agents = agents;
    this.strategy = strategy;
    this.getProviderConfig = getProviderConfig;
  }

  async next(roomId: string): Promise<RoomAgentRow> {
    if (this.strategy === 'llm-selected') {
      return this.llmSelectNext(roomId);
    }
    return this.roundRobinNext();
  }

  private roundRobinNext(): RoomAgentRow {
    const agent = this.agents[this.turnIndex % this.agents.length];
    this.turnIndex++;
    return agent;
  }

  private async llmSelectNext(roomId: string): Promise<RoomAgentRow> {
    try {
      const firstAgent = this.agents[0];
      const config = await this.getProviderConfig(firstAgent.provider);

      const agentList = this.agents
        .map((a, i) => `${i}: ${a.name} — ${a.promptRole}`)
        .join('\n');

      const responseText = await generateLLM({
        provider: firstAgent.provider as ProviderName,
        model: firstAgent.model,
        config,
        system: 'You are a conversation facilitator. Select the most appropriate agent to speak next.',
        messages: [
          {
            role: 'user',
            content: `Room ID: ${roomId}\n\nAvailable agents:\n${agentList}\n\nRespond with ONLY the numeric index (0-${this.agents.length - 1}) of the agent who should speak next. No other text.`,
          },
        ],
        temperature: 0.3,
      });

      const index = parseInt(responseText.trim(), 10);

      if (isNaN(index) || index < 0 || index >= this.agents.length) {
        // Invalid index — fall back to round-robin
        return this.roundRobinNext();
      }

      // Successful LLM selection — advance turnIndex to stay in sync for potential fallbacks
      this.turnIndex++;
      return this.agents[index];
    } catch {
      // Any error — fall back to round-robin
      return this.roundRobinNext();
    }
  }
}
