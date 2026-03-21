import { describe, it, expect, beforeEach } from 'vitest';
import { eq, desc, asc } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { presets } from '@/db/schema';

describe('presets', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('insert system preset — persists with isSystem=true', async () => {
    await db.insert(presets).values({
      id: 'devils-advocate',
      name: "Devil's Advocate",
      avatarColor: '#EF4444',
      avatarIcon: 'flame',
      promptRole: 'You challenge every idea.',
      promptPersonality: 'Contrarian, sharp.',
      promptRules: 'Always counter-argue.',
      promptConstraints: 'Stay logical.',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.8,
      isSystem: true,
    });

    const result = await db.select().from(presets).where(eq(presets.id, 'devils-advocate'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('devils-advocate');
    expect(result[0].name).toBe("Devil's Advocate");
    expect(result[0].avatarColor).toBe('#EF4444');
    expect(result[0].avatarIcon).toBe('flame');
    expect(result[0].promptRole).toBe('You challenge every idea.');
    expect(result[0].provider).toBe('anthropic');
    expect(result[0].model).toBe('claude-sonnet-4-20250514');
    expect(result[0].temperature).toBe(0.8);
    expect(result[0].isSystem).toBe(true);
  });

  it('insert user preset — persists with isSystem=false', async () => {
    await db.insert(presets).values({
      id: 'my-custom-preset',
      name: 'My Custom Preset',
      avatarColor: '#10B981',
      avatarIcon: 'star',
      promptRole: 'You help me brainstorm ideas.',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      isSystem: false,
    });

    const result = await db.select().from(presets).where(eq(presets.id, 'my-custom-preset'));
    expect(result).toHaveLength(1);
    expect(result[0].isSystem).toBe(false);
    expect(result[0].name).toBe('My Custom Preset');
  });

  it('delete user preset — removes the row', async () => {
    await db.insert(presets).values({
      id: 'to-delete',
      name: 'To Delete',
      avatarColor: '#AABBCC',
      avatarIcon: 'trash',
      promptRole: 'A preset to be deleted.',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      isSystem: false,
    });

    await db.delete(presets).where(eq(presets.id, 'to-delete'));
    const result = await db.select().from(presets).where(eq(presets.id, 'to-delete'));
    expect(result).toHaveLength(0);
  });

  it('query ordering — system presets appear before user presets', async () => {
    // Insert user preset first (older)
    await db.insert(presets).values({
      id: 'user-preset',
      name: 'User Preset',
      avatarColor: '#AABBCC',
      avatarIcon: 'user',
      promptRole: 'User preset role.',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      isSystem: false,
    });

    // Insert system preset second (newer)
    await db.insert(presets).values({
      id: 'system-preset',
      name: 'System Preset',
      avatarColor: '#EF4444',
      avatarIcon: 'flame',
      promptRole: 'System preset role.',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.8,
      isSystem: true,
    });

    const result = await db
      .select()
      .from(presets)
      .orderBy(desc(presets.isSystem), asc(presets.createdAt));

    // System preset should be first despite being inserted second
    expect(result[0].id).toBe('system-preset');
    expect(result[0].isSystem).toBe(true);
    expect(result[1].id).toBe('user-preset');
    expect(result[1].isSystem).toBe(false);
  });
});
