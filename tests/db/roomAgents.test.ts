import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { rooms, agents, roomAgents } from '@/db/schema';

describe('roomAgents', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  async function createLibraryAgent(dbInstance: typeof db) {
    const agentId = nanoid();
    await dbInstance.insert(agents).values({
      id: agentId,
      name: 'Library Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'brain',
      promptRole: 'You are a helpful assistant.',
      promptPersonality: 'Friendly and thorough.',
      promptRules: 'Always cite sources.',
      promptConstraints: 'Keep it concise.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.8,
    });
    return agentId;
  }

  async function createRoom(dbInstance: typeof db) {
    const roomId = nanoid();
    await dbInstance.insert(rooms).values({ id: roomId, name: 'Test Room' });
    return roomId;
  }

  it('copy-on-assign — create library agent, add to room via copy, verify all config columns match source', async () => {
    const agentId = await createLibraryAgent(db);
    const roomId = await createRoom(db);

    // Fetch source agent
    const source = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });
    expect(source).toBeDefined();

    // Copy agent to room
    const roomAgentId = nanoid();
    await db.insert(roomAgents).values({
      id: roomAgentId,
      roomId,
      sourceAgentId: agentId,
      name: source!.name,
      avatarColor: source!.avatarColor,
      avatarIcon: source!.avatarIcon,
      promptRole: source!.promptRole,
      promptPersonality: source!.promptPersonality,
      promptRules: source!.promptRules,
      promptConstraints: source!.promptConstraints,
      provider: source!.provider,
      model: source!.model,
      temperature: source!.temperature,
    });

    const roomAgent = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, roomAgentId),
    });

    expect(roomAgent).toBeDefined();
    // All config columns match source
    expect(roomAgent!.name).toBe(source!.name);
    expect(roomAgent!.avatarColor).toBe(source!.avatarColor);
    expect(roomAgent!.avatarIcon).toBe(source!.avatarIcon);
    expect(roomAgent!.promptRole).toBe(source!.promptRole);
    expect(roomAgent!.promptPersonality).toBe(source!.promptPersonality);
    expect(roomAgent!.promptRules).toBe(source!.promptRules);
    expect(roomAgent!.promptConstraints).toBe(source!.promptConstraints);
    expect(roomAgent!.provider).toBe(source!.provider);
    expect(roomAgent!.model).toBe(source!.model);
    expect(roomAgent!.temperature).toBe(source!.temperature);
    // sourceAgentId links back to library agent
    expect(roomAgent!.sourceAgentId).toBe(agentId);
  });

  it('remove agent from room — add agent to room, delete room_agent row, verify deleted, source library agent still exists', async () => {
    const agentId = await createLibraryAgent(db);
    const roomId = await createRoom(db);

    const roomAgentId = nanoid();
    await db.insert(roomAgents).values({
      id: roomAgentId,
      roomId,
      sourceAgentId: agentId,
      name: 'Library Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'brain',
      promptRole: 'You are a helpful assistant.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
    });

    // Verify room agent exists
    const before = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, roomAgentId),
    });
    expect(before).toBeDefined();

    // Delete the room agent (remove from room)
    await db.delete(roomAgents).where(eq(roomAgents.id, roomAgentId));

    // Room agent is gone
    const after = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, roomAgentId),
    });
    expect(after).toBeUndefined();

    // Source library agent still exists
    const sourceStillExists = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });
    expect(sourceStillExists).toBeDefined();
  });

  it('source agent deletion sets null — add agent to room, delete source library agent, verify roomAgent.sourceAgentId is null', async () => {
    const agentId = await createLibraryAgent(db);
    const roomId = await createRoom(db);

    const roomAgentId = nanoid();
    await db.insert(roomAgents).values({
      id: roomAgentId,
      roomId,
      sourceAgentId: agentId,
      name: 'Library Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'brain',
      promptRole: 'You are a helpful assistant.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
    });

    // Delete the source library agent
    await db.delete(agents).where(eq(agents.id, agentId));

    // Room agent still exists but sourceAgentId is null
    const roomAgent = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, roomAgentId),
    });
    expect(roomAgent).toBeDefined();
    expect(roomAgent!.sourceAgentId).toBeNull();
  });
});
