import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeakerSelector, type RoomAgentRow } from '@/lib/conversation/speaker-selector';

// Mock the LLM gateway module
vi.mock('@/lib/llm/gateway', () => ({
  generateLLM: vi.fn(),
}));

import { generateLLM } from '@/lib/llm/gateway';

const mockGenerateLLM = vi.mocked(generateLLM);

// Mock getProviderConfig — returns a test API key
const mockGetProviderConfig = vi.fn().mockResolvedValue({ apiKey: 'test-key' });

// Helper to create a minimal RoomAgentRow
function makeAgent(id: string, position: number): RoomAgentRow {
  return {
    id,
    name: `Agent ${id}`,
    position,
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.7,
    promptRole: `You are agent ${id}.`,
    promptPersonality: null,
    promptRules: null,
    promptConstraints: null,
  };
}

const agentA = makeAgent('a', 0);
const agentB = makeAgent('b', 1);
const agentC = makeAgent('c', 2);

const ROOM_ID = 'test-room-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SpeakerSelector — round-robin', () => {
  it('cycles through agents [A, B, C] in order: A, B, C, A, B, C', async () => {
    const selector = new SpeakerSelector([agentA, agentB, agentC], 'round-robin', mockGetProviderConfig);

    expect((await selector.next(ROOM_ID)).id).toBe('a');
    expect((await selector.next(ROOM_ID)).id).toBe('b');
    expect((await selector.next(ROOM_ID)).id).toBe('c');
    expect((await selector.next(ROOM_ID)).id).toBe('a');
    expect((await selector.next(ROOM_ID)).id).toBe('b');
    expect((await selector.next(ROOM_ID)).id).toBe('c');
  });

  it('returns same agent every time when only 1 agent exists', async () => {
    const selector = new SpeakerSelector([agentA], 'round-robin', mockGetProviderConfig);

    for (let i = 0; i < 5; i++) {
      expect((await selector.next(ROOM_ID)).id).toBe('a');
    }
  });
});

describe('SpeakerSelector — llm-selected', () => {
  it('calls generateLLM and parses response index to select agent', async () => {
    mockGenerateLLM.mockResolvedValue('1');

    const selector = new SpeakerSelector([agentA, agentB, agentC], 'llm-selected', mockGetProviderConfig);
    const selected = await selector.next(ROOM_ID);

    expect(mockGenerateLLM).toHaveBeenCalledOnce();
    expect(selected.id).toBe('b'); // index 1 = agentB
  });

  it('falls back to round-robin when generateLLM throws an error', async () => {
    mockGenerateLLM.mockRejectedValue(new Error('LLM service unavailable'));

    const selector = new SpeakerSelector([agentA, agentB, agentC], 'llm-selected', mockGetProviderConfig);
    const first = await selector.next(ROOM_ID);
    const second = await selector.next(ROOM_ID);

    // Should fall back to round-robin: A then B
    expect(first.id).toBe('a');
    expect(second.id).toBe('b');
  });

  it('falls back to round-robin when generateLLM returns an invalid (non-numeric) response', async () => {
    mockGenerateLLM.mockResolvedValue('invalid-response');

    const selector = new SpeakerSelector([agentA, agentB, agentC], 'llm-selected', mockGetProviderConfig);
    const first = await selector.next(ROOM_ID);
    const second = await selector.next(ROOM_ID);

    // Should fall back to round-robin: A then B
    expect(first.id).toBe('a');
    expect(second.id).toBe('b');
  });
});
