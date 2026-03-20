import { describe, it, expect, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { ContextService, TOPIC_LOCK_INTERVAL } from '@/lib/conversation/context-service';
import { rooms, roomAgents, messages } from '@/db/schema';

type TestDb = ReturnType<typeof createTestDb>['db'];

let db: TestDb;
let roomId: string;
let agentId: string;
let otherAgentId: string;

// Helper: insert a message into DB
async function insertMessage(
  db: TestDb,
  opts: {
    roomId: string;
    roomAgentId?: string | null;
    role: 'user' | 'agent' | 'system';
    content: string;
    createdAt?: Date;
  }
) {
  const id = nanoid();
  await db.insert(messages).values({
    id,
    roomId: opts.roomId,
    roomAgentId: opts.roomAgentId ?? null,
    role: opts.role,
    content: opts.content,
    createdAt: opts.createdAt ?? new Date(),
  });
  return id;
}

beforeEach(async () => {
  ({ db } = createTestDb());
  roomId = nanoid();
  agentId = nanoid();
  otherAgentId = nanoid();

  // Create room
  await db.insert(rooms).values({
    id: roomId,
    name: 'Test Room',
    status: 'idle',
  });

  // Create agent rows
  await db.insert(roomAgents).values({
    id: agentId,
    roomId,
    name: 'Agent A',
    avatarColor: '#000000',
    avatarIcon: 'robot',
    promptRole: 'You are a helpful assistant.',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.7,
    position: 0,
  });

  await db.insert(roomAgents).values({
    id: otherAgentId,
    roomId,
    name: 'Agent B',
    avatarColor: '#ffffff',
    avatarIcon: 'brain',
    promptRole: 'You are a curious questioner.',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    position: 1,
  });
});

const baseAgent = () => ({
  id: agentId,
  promptRole: 'You are a helpful assistant.',
  promptPersonality: null,
  promptRules: null,
  promptConstraints: null,
});

describe('ContextService.buildContext', () => {
  it('seeds with room topic when no messages exist', async () => {
    // Set a topic on the room
    await db.update(rooms).set({ topic: 'AI safety' }).where(eq(rooms.id, roomId));
    const result = await ContextService.buildContext(db, roomId, baseAgent());
    expect(result.messages).toEqual([{ role: 'user', content: 'Discussion topic: AI safety' }]);
    expect(result.systemPrompt).toBe('You are a helpful assistant.');
  });

  it('seeds with generic prompt when no messages and no topic', async () => {
    const result = await ContextService.buildContext(db, roomId, baseAgent());
    expect(result.messages).toEqual([{ role: 'user', content: 'Begin the conversation.' }]);
  });

  it('returns all messages in chronological order when fewer than WINDOW_SIZE messages exist', async () => {
    const t0 = new Date(1000);
    const t1 = new Date(2000);
    const t2 = new Date(3000);
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'Hello!', createdAt: t0 });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'Hi!', createdAt: t1 });
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'How are you?', createdAt: t2 });

    const result = await ContextService.buildContext(db, roomId, baseAgent());
    // First message is assistant (agentId = self), so a seed user message is prepended
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0].role).toBe('user'); // seed
    expect(result.messages[1].content).toBe('Hello!');
    expect(result.messages[2].content).toBe('Hi!');
    expect(result.messages[3].content).toBe('How are you?');
  });

  it('does not prepend seed when messages start with user role', async () => {
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'Other speaks first', createdAt: new Date(1000) });
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'I reply', createdAt: new Date(2000) });

    const result = await ContextService.buildContext(db, roomId, baseAgent());
    // First message is from otherAgent → user role, no seed needed
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Other speaks first' });
    expect(result.messages[1]).toEqual({ role: 'assistant', content: 'I reply' });
  });

  it('filters out empty messages from failed turns', async () => {
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: '', createdAt: new Date(1000) });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'Real message', createdAt: new Date(2000) });

    const result = await ContextService.buildContext(db, roomId, baseAgent());
    // Empty message filtered out, only real message remains
    expect(result.messages.every((m) => m.content.trim().length > 0)).toBe(true);
    expect(result.messages.some((m) => m.content === 'Real message')).toBe(true);
  });

  it('returns only the last 20 messages (sliding window) when more than WINDOW_SIZE messages exist', async () => {
    // Insert 25 messages with timestamps to ensure ordering
    for (let i = 0; i < 25; i++) {
      await insertMessage(db, {
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content: `Message ${i}`,
        createdAt: new Date(i * 1000),
      });
    }

    const result = await ContextService.buildContext(db, roomId, baseAgent());
    // 20 DB messages + 1 seed (all are from self=assistant, so seed prepended)
    expect(result.messages).toHaveLength(21);
    expect(result.messages[0].role).toBe('user'); // seed
    expect(result.messages[1].content).toBe('Message 5');
    expect(result.messages[20].content).toBe('Message 24');
  });

  it('maps current agent messages as assistant, other agent messages as user', async () => {
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'I am current agent.', createdAt: new Date(1000) });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'I am other agent.', createdAt: new Date(2000) });

    const result = await ContextService.buildContext(db, roomId, baseAgent());
    // Seed prepended because first DB message is assistant (self)
    expect(result.messages[0].role).toBe('user'); // seed
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[2].role).toBe('user');
  });

  it('builds system prompt by joining non-null prompt fields with double newlines', async () => {
    const agent = {
      id: agentId,
      promptRole: 'You are a helpful assistant.',
      promptPersonality: 'You are friendly and concise.',
      promptRules: 'Never reveal personal data.',
      promptConstraints: null,
    };
    const result = await ContextService.buildContext(db, roomId, agent);
    expect(result.systemPrompt).toBe(
      'You are a helpful assistant.\n\nYou are friendly and concise.\n\nNever reveal personal data.'
    );
  });
});

describe('ContextService.buildContext injection', () => {
  it('does not inject anti-sycophancy on turnCount 0', async () => {
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 0);
    expect(result.systemPrompt).not.toContain('CONVERSATION INTEGRITY RULES');
  });

  it('injects anti-sycophancy on turnCount 1', async () => {
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 1);
    expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
    expect(result.systemPrompt).toContain('great point');
  });

  it('injects topic-lock at TOPIC_LOCK_INTERVAL with room topic', async () => {
    await db.update(rooms).set({ topic: 'AI safety' }).where(eq(rooms.id, roomId));
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 5);
    expect(result.systemPrompt).toContain('TOPIC REMINDER');
    expect(result.systemPrompt).toContain('AI safety');
  });

  it('does not inject topic-lock on non-interval turns', async () => {
    await db.update(rooms).set({ topic: 'AI safety' }).where(eq(rooms.id, roomId));
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 3);
    expect(result.systemPrompt).not.toContain('TOPIC REMINDER');
    expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
  });

  it('injects both anti-sycophancy and topic-lock at interval turns', async () => {
    await db.update(rooms).set({ topic: 'climate policy' }).where(eq(rooms.id, roomId));
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 10);
    expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
    expect(result.systemPrompt).toContain('TOPIC REMINDER');
    expect(result.systemPrompt).toContain('climate policy');
  });

  it('skips topic-lock when room has no topic', async () => {
    const result = await ContextService.buildContext(db, roomId, baseAgent(), 5);
    expect(result.systemPrompt).not.toContain('TOPIC REMINDER');
    expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
  });

  it('exports TOPIC_LOCK_INTERVAL as 5', () => {
    expect(TOPIC_LOCK_INTERVAL).toBe(5);
  });
});

describe('ContextService.detectRepetition', () => {
  it('returns false when fewer than REPETITION_WINDOW messages exist', async () => {
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'Hello world foo bar baz', createdAt: new Date(1000) });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'Hello world foo bar baz', createdAt: new Date(2000) });

    const result = await ContextService.detectRepetition(db, roomId);
    expect(result).toBe(false);
  });

  it('returns true when last message has Jaccard similarity >= 0.85 with a previous message', async () => {
    const base = 'the quick brown fox jumps over the lazy dog near the river';
    // Insert 5 messages: first 4 different, last very similar to first
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: base, createdAt: new Date(1000) });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'completely different content here', createdAt: new Date(2000) });
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: 'something else entirely different', createdAt: new Date(3000) });
    await insertMessage(db, { roomId, roomAgentId: otherAgentId, role: 'agent', content: 'yet another different message here', createdAt: new Date(4000) });
    // Last message nearly identical to first
    await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: base, createdAt: new Date(5000) });

    const result = await ContextService.detectRepetition(db, roomId);
    expect(result).toBe(true);
  });

  it('returns false when messages are sufficiently different (Jaccard < 0.85)', async () => {
    // Insert 5 clearly distinct messages
    const msgs = [
      'the quick brown fox jumps over the lazy dog',
      'artificial intelligence machine learning deep neural networks',
      'cooking recipes ingredients kitchen restaurant food',
      'sports basketball football soccer tennis player team',
      'music concert guitar piano violin orchestra symphony',
    ];
    for (let i = 0; i < msgs.length; i++) {
      await insertMessage(db, { roomId, roomAgentId: agentId, role: 'agent', content: msgs[i], createdAt: new Date(i * 1000) });
    }

    const result = await ContextService.detectRepetition(db, roomId);
    expect(result).toBe(false);
  });
});

describe('ContextService.detectConvergence', () => {
  // Shared content for similar messages (high cross-agent Jaccard)
  const similarContent = [
    'machine learning algorithms improve prediction accuracy through iterative training',
    'machine learning algorithms enhance prediction accuracy using iterative training methods',
    'learning algorithms improve accuracy prediction through iterative machine training process',
    'machine learning improves prediction accuracy through algorithms and iterative training',
    'algorithms for machine learning improve prediction accuracy with iterative training cycles',
    'machine learning prediction accuracy improves through iterative algorithm training steps',
    'iterative training machine learning algorithms significantly improve prediction accuracy results',
    'machine learning uses iterative training algorithms that improve prediction accuracy greatly',
  ];

  it('Test 1 (AND logic true): returns true when agreement phrase AND cross-agent Jaccard >= 0.35 are present', async () => {
    // Insert 8 messages alternating between agentId and otherAgentId with similar content
    for (let i = 0; i < 8; i++) {
      const agId = i % 2 === 0 ? agentId : otherAgentId;
      let content = similarContent[i];
      // Add agreement phrase in message from second agent at index 7
      if (i === 7) {
        content = 'i completely agree that ' + content;
      }
      await insertMessage(db, {
        roomId,
        roomAgentId: agId,
        role: 'agent',
        content,
        createdAt: new Date((i + 1) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(true);
  });

  it('Test 2 (phrase only): returns false when agreement phrase present but Jaccard < 0.35', async () => {
    // Agent A talks about cooking, Agent B talks about quantum physics — entirely disjoint content
    const cookingMsgs = [
      'bake the bread flour butter eggs sugar yeast oven temperature',
      'sauté onions garlic olive oil salt pepper herbs kitchen',
      'boil pasta water sauce tomato basil mozzarella cheese recipe',
      'grill chicken marinade lemon thyme rosemary barbecue outdoor',
    ];
    const physicsMsgs = [
      'quantum entanglement superposition photon electron particle wave',
      'relativity spacetime curvature gravity black hole singularity',
      'i agree with your approach nuclear fusion plasma reactor tokamak',
      'uncertainty principle heisenberg wave function collapse measurement',
    ];

    for (let i = 0; i < 4; i++) {
      await insertMessage(db, {
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content: cookingMsgs[i],
        createdAt: new Date((i * 2 + 1) * 1000),
      });
      await insertMessage(db, {
        roomId,
        roomAgentId: otherAgentId,
        role: 'agent',
        content: physicsMsgs[i],
        createdAt: new Date((i * 2 + 2) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(false);
  });

  it('Test 3 (similarity only): returns false when cross-agent Jaccard >= 0.35 but no agreement phrase', async () => {
    // Both agents discuss neural networks (high similarity) but no agreement phrases used
    const neuralContent = [
      'neural networks classify images using convolutional layers deep learning',
      'convolutional neural networks deep learning image classification layers',
      'deep neural networks for image classification using convolutional architecture',
      'image classification neural network convolutional layers deep learning model',
      'convolutional deep neural networks classify images learning representation',
      'neural network image classification deep convolutional learning features',
      'deep learning neural networks convolutional layers image classification task',
      'neural networks deep learning convolutional image classification performance',
    ];

    for (let i = 0; i < 8; i++) {
      const agId = i % 2 === 0 ? agentId : otherAgentId;
      await insertMessage(db, {
        roomId,
        roomAgentId: agId,
        role: 'agent',
        content: neuralContent[i],
        createdAt: new Date((i + 1) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(false);
  });

  it('Test 4 (single agent): returns false when all messages from same roomAgentId', async () => {
    // Insert 8 messages all from agentId (single agent scenario)
    for (let i = 0; i < 8; i++) {
      let content = similarContent[i];
      if (i === 7) {
        content = 'i completely agree that ' + content;
      }
      await insertMessage(db, {
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content,
        createdAt: new Date((i + 1) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(false);
  });

  it('Test 5 (turn guard at 4): returns false even with valid convergence conditions at turnCount=4', async () => {
    // Same setup as Test 1 but turnCount=4 (below minimum)
    for (let i = 0; i < 8; i++) {
      const agId = i % 2 === 0 ? agentId : otherAgentId;
      let content = similarContent[i];
      if (i === 7) {
        content = 'i completely agree that ' + content;
      }
      await insertMessage(db, {
        roomId,
        roomAgentId: agId,
        role: 'agent',
        content,
        createdAt: new Date((i + 1) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 4);
    expect(result).toBe(false);
  });

  it('Test 6 (turn guard boundary at 5): returns true with valid conditions at turnCount=5', async () => {
    // Same setup as Test 1 — confirms turnCount=5 is the exact boundary
    for (let i = 0; i < 8; i++) {
      const agId = i % 2 === 0 ? agentId : otherAgentId;
      let content = similarContent[i];
      if (i === 7) {
        content = 'i completely agree that ' + content;
      }
      await insertMessage(db, {
        roomId,
        roomAgentId: agId,
        role: 'agent',
        content,
        createdAt: new Date((i + 1) * 1000),
      });
    }

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(true);
  });

  it('Test 7 (insufficient messages): returns false with only 1 message in room', async () => {
    await insertMessage(db, {
      roomId,
      roomAgentId: agentId,
      role: 'agent',
      content: 'i completely agree machine learning algorithms improve prediction accuracy',
      createdAt: new Date(1000),
    });

    const result = await ContextService.detectConvergence(db, roomId, 5);
    expect(result).toBe(false);
  });
});
