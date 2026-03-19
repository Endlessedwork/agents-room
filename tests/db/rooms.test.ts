import { describe, it, expect, beforeEach } from 'vitest';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { rooms, roomAgents, messages } from '@/db/schema';

describe('rooms', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('create room — insert room with name+topic, query back, verify all fields', async () => {
    const id = nanoid();
    const now = new Date();

    await db.insert(rooms).values({
      id,
      name: 'Strategy Debate',
      topic: 'Should we rewrite the frontend in SolidJS?',
    });

    const result = await db.query.rooms.findFirst({
      where: eq(rooms.id, id),
    });

    expect(result).toBeDefined();
    expect(result!.id).toBe(id);
    expect(result!.name).toBe('Strategy Debate');
    expect(result!.topic).toBe('Should we rewrite the frontend in SolidJS?');
    expect(result!.status).toBe('idle');
    expect(result!.createdAt).toBeInstanceOf(Date);
  });

  it('list rooms — insert 3 rooms, query all, verify count=3 and order by lastActivityAt desc', async () => {
    // Insert 3 rooms with different lastActivityAt timestamps
    const room1Id = nanoid();
    const room2Id = nanoid();
    const room3Id = nanoid();

    await db.insert(rooms).values([
      {
        id: room1Id,
        name: 'Room Alpha',
        lastActivityAt: new Date(2026, 0, 1), // oldest
      },
      {
        id: room2Id,
        name: 'Room Beta',
        lastActivityAt: new Date(2026, 0, 3), // newest
      },
      {
        id: room3Id,
        name: 'Room Gamma',
        lastActivityAt: new Date(2026, 0, 2), // middle
      },
    ]);

    const allRooms = await db
      .select()
      .from(rooms)
      .orderBy(desc(rooms.lastActivityAt));

    expect(allRooms).toHaveLength(3);
    // Most recent first
    expect(allRooms[0].id).toBe(room2Id);
    expect(allRooms[1].id).toBe(room3Id);
    expect(allRooms[2].id).toBe(room1Id);
  });

  it('delete room cascades — insert room + roomAgent + message, delete room, verify rows gone', async () => {
    const roomId = nanoid();
    const agentId = nanoid();
    const msgId = nanoid();

    // Create room
    await db.insert(rooms).values({ id: roomId, name: 'Cascade Test Room' });

    // Create a room agent
    await db.insert(roomAgents).values({
      id: agentId,
      roomId,
      name: 'Test Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'brain',
      promptRole: 'You are a test agent.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
    });

    // Create a message
    await db.insert(messages).values({
      id: msgId,
      roomId,
      role: 'user',
      content: 'Hello!',
    });

    // Verify they exist
    const agentBefore = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, agentId),
    });
    expect(agentBefore).toBeDefined();

    const msgBefore = await db.query.messages.findFirst({
      where: eq(messages.id, msgId),
    });
    expect(msgBefore).toBeDefined();

    // Delete the room
    await db.delete(rooms).where(eq(rooms.id, roomId));

    // Verify cascade: room_agents and messages are gone
    const agentAfter = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.id, agentId),
    });
    expect(agentAfter).toBeUndefined();

    const msgAfter = await db.query.messages.findFirst({
      where: eq(messages.id, msgId),
    });
    expect(msgAfter).toBeUndefined();
  });

  it('room conversation history — insert room, query with messages relation, verify empty array', async () => {
    const roomId = nanoid();
    await db.insert(rooms).values({ id: roomId, name: 'Empty Room' });

    const result = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: { messages: true },
    });

    expect(result).toBeDefined();
    expect(result!.messages).toHaveLength(0);
  });
});
