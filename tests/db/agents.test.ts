import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { agents } from '@/db/schema';

describe('agents', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('create agent — insert agent with all structured prompt fields, verify all fields persisted', async () => {
    const id = nanoid();

    await db.insert(agents).values({
      id,
      name: 'Devil\'s Advocate',
      avatarColor: '#3B82F6',
      avatarIcon: 'brain',
      promptRole: 'You are a senior software architect with 15 years of experience.',
      promptPersonality: 'Direct, skeptical, challenges assumptions before accepting them.',
      promptRules: 'Always ask for evidence. Never agree without examining the premise.',
      promptConstraints: 'Keep responses under 200 words. No jargon.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.8,
    });

    const result = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    expect(result).toBeDefined();
    expect(result!.id).toBe(id);
    expect(result!.name).toBe('Devil\'s Advocate');
    expect(result!.avatarColor).toBe('#3B82F6');
    expect(result!.avatarIcon).toBe('brain');
    expect(result!.promptRole).toBe('You are a senior software architect with 15 years of experience.');
    expect(result!.promptPersonality).toBe('Direct, skeptical, challenges assumptions before accepting them.');
    expect(result!.promptRules).toBe('Always ask for evidence. Never agree without examining the premise.');
    expect(result!.promptConstraints).toBe('Keep responses under 200 words. No jargon.');
    expect(result!.provider).toBe('anthropic');
    expect(result!.model).toBe('claude-3-haiku-20240307');
    expect(result!.temperature).toBe(0.8);
    expect(result!.createdAt).toBeInstanceOf(Date);
    expect(result!.updatedAt).toBeInstanceOf(Date);
  });

  it('create agent with notes — verify notes persisted', async () => {
    const id = nanoid();

    await db.insert(agents).values({
      id,
      name: 'Noted Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'note',
      promptRole: 'You are an agent with notes.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
      notes: 'Test notes about this agent',
    });

    const result = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    expect(result).toBeDefined();
    expect(result!.notes).toBe('Test notes about this agent');
  });

  it('create agent without notes — verify notes is null', async () => {
    const id = nanoid();

    await db.insert(agents).values({
      id,
      name: 'No Notes Agent',
      avatarColor: '#3B82F6',
      avatarIcon: 'plain',
      promptRole: 'You are an agent without notes.',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
    });

    const result = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    expect(result).toBeDefined();
    expect(result!.notes).toBeNull();
  });

  it('list agents — insert 2 agents, query all, verify count=2', async () => {
    await db.insert(agents).values([
      {
        id: nanoid(),
        name: 'Code Reviewer',
        avatarColor: '#10B981',
        avatarIcon: 'code',
        promptRole: 'You are an expert code reviewer.',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.3,
      },
      {
        id: nanoid(),
        name: 'Researcher',
        avatarColor: '#8B5CF6',
        avatarIcon: 'search',
        promptRole: 'You are a thorough researcher.',
        provider: 'google',
        model: 'gemini-2.0-flash',
        temperature: 0.5,
      },
    ]);

    const allAgents = await db.select().from(agents);
    expect(allAgents).toHaveLength(2);
  });
});
