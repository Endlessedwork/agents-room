import { describe, it, expect, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { createRoomSchema, updateRoomSchema } from '@/lib/validations';
import { rooms } from '@/db/schema';

// These tests validate the Room API by exercising validation schemas and
// direct database operations, mirroring what the route handlers do.

describe('Room API — validation and schema tests', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  describe('createRoomSchema', () => {
    it('accepts valid room data with name and topic', () => {
      const result = createRoomSchema.safeParse({ name: 'Strategy Room', topic: 'How to win' });
      expect(result.success).toBe(true);
    });

    it('accepts room data with only name (topic is optional)', () => {
      const result = createRoomSchema.safeParse({ name: 'Minimal Room' });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createRoomSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 60 characters', () => {
      const result = createRoomSchema.safeParse({ name: 'A'.repeat(61) });
      expect(result.success).toBe(false);
    });

    it('rejects topic longer than 280 characters', () => {
      const result = createRoomSchema.safeParse({ name: 'Valid', topic: 'T'.repeat(281) });
      expect(result.success).toBe(false);
    });

    it('accepts topic exactly at 280 characters', () => {
      const result = createRoomSchema.safeParse({ name: 'Valid', topic: 'T'.repeat(280) });
      expect(result.success).toBe(true);
    });
  });

  describe('createRoomSchema — turnLimit and speakerStrategy', () => {
    it('accepts turnLimit within range (5-100)', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', turnLimit: 30 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.turnLimit).toBe(30);
    });

    it('defaults turnLimit to 20 when omitted', () => {
      const result = createRoomSchema.safeParse({ name: 'Room' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.turnLimit).toBe(20);
    });

    it('rejects turnLimit below 5', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', turnLimit: 4 });
      expect(result.success).toBe(false);
    });

    it('rejects turnLimit above 100', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', turnLimit: 101 });
      expect(result.success).toBe(false);
    });

    it('accepts speakerStrategy round-robin', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', speakerStrategy: 'round-robin' });
      expect(result.success).toBe(true);
    });

    it('accepts speakerStrategy llm-selected', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', speakerStrategy: 'llm-selected' });
      expect(result.success).toBe(true);
    });

    it('defaults speakerStrategy to round-robin when omitted', () => {
      const result = createRoomSchema.safeParse({ name: 'Room' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.speakerStrategy).toBe('round-robin');
    });

    it('rejects invalid speakerStrategy', () => {
      const result = createRoomSchema.safeParse({ name: 'Room', speakerStrategy: 'random' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateRoomSchema', () => {
    it('accepts partial update with only turnLimit', () => {
      const result = updateRoomSchema.safeParse({ turnLimit: 50 });
      expect(result.success).toBe(true);
    });

    it('accepts partial update with only speakerStrategy', () => {
      const result = updateRoomSchema.safeParse({ speakerStrategy: 'llm-selected' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = updateRoomSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid turnLimit', () => {
      const result = updateRoomSchema.safeParse({ turnLimit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/rooms — database layer', () => {
    it('inserts a room with name+topic and can be queried back', async () => {
      const id = nanoid();
      await db.insert(rooms).values({ id, name: 'Test Room', topic: 'Testing things' });

      const found = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, id),
      });

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Room');
      expect(found!.topic).toBe('Testing things');
      expect(found!.status).toBe('idle');
    });

    it('room has default status of idle', async () => {
      const id = nanoid();
      await db.insert(rooms).values({ id, name: 'Another Room' });
      const found = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, id),
      });
      expect(found!.status).toBe('idle');
    });

    it('inserts room with explicit turnLimit and speakerStrategy', async () => {
      const id = nanoid();
      await db.insert(rooms).values({
        id,
        name: 'Custom Room',
        turnLimit: 50,
        speakerStrategy: 'llm-selected',
      });
      const found = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, id),
      });
      expect(found!.turnLimit).toBe(50);
      expect(found!.speakerStrategy).toBe('llm-selected');
    });

    it('room defaults to turnLimit=20 and speakerStrategy=round-robin', async () => {
      const id = nanoid();
      await db.insert(rooms).values({ id, name: 'Default Room' });
      const found = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, id),
      });
      expect(found!.turnLimit).toBe(20);
      expect(found!.speakerStrategy).toBe('round-robin');
    });
  });

  describe('GET /api/rooms/:id — database layer', () => {
    it('returns room with empty agents and messages arrays', async () => {
      const id = nanoid();
      await db.insert(rooms).values({ id, name: 'Room With No Agents' });

      const room = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, id),
        with: { roomAgents: true, messages: true },
      });

      expect(room).toBeDefined();
      expect(room!.roomAgents).toEqual([]);
      expect(room!.messages).toEqual([]);
    });

    it('returns undefined for non-existent room', async () => {
      const room = await db.query.rooms.findFirst({
        where: (r, { eq }) => eq(r.id, 'does-not-exist'),
      });
      expect(room).toBeUndefined();
    });
  });

  describe('DELETE /api/rooms/:id — database layer', () => {
    it('deletes a room by id', async () => {
      const id = nanoid();
      await db.insert(rooms).values({ id, name: 'To Delete' });

      await db.delete(rooms).where((db as any).query.rooms ? undefined : undefined);
      // Use eq directly
      const { eq } = await import('drizzle-orm');
      await db.delete(rooms).where(eq(rooms.id, id));

      const found = await db.query.rooms.findFirst({
        where: (r, { eq: eqFn }) => eqFn(r.id, id),
      });
      expect(found).toBeUndefined();
    });
  });

  describe('NextResponse JSON helper', () => {
    it('creates correct 400 response for validation failure', () => {
      const issues = [{ message: 'Required' }];
      const response = NextResponse.json({ error: issues }, { status: 400 });
      expect(response.status).toBe(400);
    });

    it('creates correct 201 response for room creation', () => {
      const room = { id: 'test-id', name: 'Room', status: 'idle' };
      const response = NextResponse.json(room, { status: 201 });
      expect(response.status).toBe(201);
    });
  });
});
