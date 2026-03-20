import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/stores/chatStore';

// Reset the store before each test to ensure isolation
beforeEach(() => {
  useChatStore.getState().reset();
  vi.restoreAllMocks();
});

describe('chatStore cost accumulation — completeTurn', () => {
  it('accumulates dollars > 0 after completeTurn with a known anthropic model', () => {
    useChatStore.getState().startTurn({
      agentId: 'agent-1',
      agentName: 'Agent One',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      turnNumber: 1,
      totalTurns: 10,
    });

    useChatStore.getState().completeTurn({
      agentId: 'agent-1',
      messageId: 'msg-1',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState.dollars).toBeGreaterThan(0);
    expect(estimatedCostState.hasUnknown).toBe(false);
    expect(estimatedCostState.hasLocal).toBe(false);
  });

  it('sets hasUnknown=true and keeps dollars=0 for an unknown model', () => {
    useChatStore.getState().startTurn({
      agentId: 'agent-2',
      agentName: 'Agent Two',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'totally-fake-xyz',
      provider: 'anthropic',
      turnNumber: 1,
      totalTurns: 10,
    });

    useChatStore.getState().completeTurn({
      agentId: 'agent-2',
      messageId: 'msg-2',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState.dollars).toBe(0);
    expect(estimatedCostState.hasUnknown).toBe(true);
    expect(estimatedCostState.hasLocal).toBe(false);
  });

  it('sets hasLocal=true and keeps dollars=0 for ollama provider', () => {
    useChatStore.getState().startTurn({
      agentId: 'agent-3',
      agentName: 'Agent Three',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'llama3',
      provider: 'ollama',
      turnNumber: 1,
      totalTurns: 10,
    });

    useChatStore.getState().completeTurn({
      agentId: 'agent-3',
      messageId: 'msg-3',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState.dollars).toBe(0);
    expect(estimatedCostState.hasUnknown).toBe(false);
    expect(estimatedCostState.hasLocal).toBe(true);
  });

  it('accumulates dollars across two completeTurn calls with known models', () => {
    // First turn
    useChatStore.getState().startTurn({
      agentId: 'agent-1',
      agentName: 'Agent One',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      turnNumber: 1,
      totalTurns: 10,
    });
    useChatStore.getState().completeTurn({
      agentId: 'agent-1',
      messageId: 'msg-a1',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const afterFirstTurn = useChatStore.getState().estimatedCostState.dollars;
    expect(afterFirstTurn).toBeGreaterThan(0);

    // Second turn
    useChatStore.getState().startTurn({
      agentId: 'agent-1',
      agentName: 'Agent One',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      turnNumber: 2,
      totalTurns: 10,
    });
    useChatStore.getState().completeTurn({
      agentId: 'agent-1',
      messageId: 'msg-a2',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const afterSecondTurn = useChatStore.getState().estimatedCostState.dollars;
    expect(afterSecondTurn).toBeGreaterThan(afterFirstTurn);
  });
});

describe('chatStore cost accumulation — loadHistory', () => {
  it('rehydrates estimatedCostState dollars from message history with known model', async () => {
    const mockMessages = [
      {
        id: 'msg-h1',
        role: 'agent',
        content: 'Hello world',
        roomAgentId: 'agent-1',
        roomAgent: {
          name: 'Agent One',
          avatarColor: '#aabbcc',
          avatarIcon: 'robot',
          promptRole: 'assistant',
          provider: 'anthropic',
        },
        model: 'claude-3-5-haiku-20241022',
        inputTokens: 1000,
        outputTokens: 500,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockMessages),
      }),
    );

    await useChatStore.getState().loadHistory('room-1');

    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState.dollars).toBeGreaterThan(0);
    expect(estimatedCostState.hasUnknown).toBe(false);
    expect(estimatedCostState.hasLocal).toBe(false);
  });

  it('sets hasLocal=true when history has ollama agent messages', async () => {
    const mockMessages = [
      {
        id: 'msg-h2',
        role: 'agent',
        content: 'Local model response',
        roomAgentId: 'agent-2',
        roomAgent: {
          name: 'Agent Two',
          avatarColor: '#aabbcc',
          avatarIcon: 'cpu',
          promptRole: 'assistant',
          provider: 'ollama',
        },
        model: 'llama3',
        inputTokens: 1000,
        outputTokens: 500,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockMessages),
      }),
    );

    await useChatStore.getState().loadHistory('room-1');

    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState.dollars).toBe(0);
    expect(estimatedCostState.hasLocal).toBe(true);
  });
});

describe('chatStore cost accumulation — reset', () => {
  it('clears estimatedCostState to zero state on reset', () => {
    // First accumulate some cost
    useChatStore.getState().startTurn({
      agentId: 'agent-1',
      agentName: 'Agent One',
      avatarColor: '#aabbcc',
      avatarIcon: 'robot',
      promptRole: 'assistant',
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      turnNumber: 1,
      totalTurns: 10,
    });
    useChatStore.getState().completeTurn({
      agentId: 'agent-1',
      messageId: 'msg-r1',
      inputTokens: 1000,
      outputTokens: 500,
    });

    // Verify cost was accumulated
    expect(useChatStore.getState().estimatedCostState.dollars).toBeGreaterThan(0);

    // Reset
    useChatStore.getState().reset();

    // Verify reset to zero state
    const { estimatedCostState } = useChatStore.getState();
    expect(estimatedCostState).toEqual({ dollars: 0, hasUnknown: false, hasLocal: false });
  });
});
