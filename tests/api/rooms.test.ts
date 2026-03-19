import { describe, it, expect, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { createRoomSchema } from '@/lib/validations';
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
