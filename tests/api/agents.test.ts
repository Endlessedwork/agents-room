import { describe, it, expect } from 'vitest';
import { createAgentSchema, updateAgentSchema } from '@/lib/validations';

const validAgentData = {
  name: 'Devil\'s Advocate',
  avatarColor: '#FF5733',
  avatarIcon: 'devil',
  promptRole: 'You are a devil\'s advocate who challenges assumptions.',
  provider: 'anthropic' as const,
  model: 'claude-3-haiku-20240307',
  temperature: 0.7,
};

describe('createAgentSchema', () => {
  it('accepts valid agent data with all required fields', () => {
    const result = createAgentSchema.safeParse(validAgentData);
    expect(result.success).toBe(true);
  });

  it('accepts valid agent data with all optional fields', () => {
    const result = createAgentSchema.safeParse({
      ...validAgentData,
      promptPersonality: 'Skeptical and questioning',
      promptRules: 'Always challenge the first assumption',
      promptConstraints: 'Do not be offensive',
      presetId: 'devils-advocate',
    });
    expect(result.success).toBe(true);
  });

  it('uses default temperature of 0.7 when not provided', () => {
    const { temperature: _, ...withoutTemp } = validAgentData;
    const result = createAgentSchema.safeParse(withoutTemp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.7);
    }
  });

  it('rejects missing name', () => {
    const { name: _, ...without } = validAgentData;
    const result = createAgentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 60 characters', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, name: 'A'.repeat(61) });
    expect(result.success).toBe(false);
  });

  it('rejects missing provider', () => {
    const { provider: _, ...without } = validAgentData;
    const result = createAgentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects invalid provider value', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, provider: 'invalid-provider' });
    expect(result.success).toBe(false);
  });

  it('accepts all 5 valid providers', () => {
    const providers = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'] as const;
    for (const provider of providers) {
      const result = createAgentSchema.safeParse({ ...validAgentData, provider });
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing model', () => {
    const { model: _, ...without } = validAgentData;
    const result = createAgentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects missing promptRole', () => {
    const { promptRole: _, ...without } = validAgentData;
    const result = createAgentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects invalid avatarColor — not hex format', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, avatarColor: 'red' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid avatarColor — wrong length', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, avatarColor: '#FF573' });
    expect(result.success).toBe(false);
  });

  it('accepts valid 6-digit hex avatarColor with uppercase', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, avatarColor: '#AABBCC' });
    expect(result.success).toBe(true);
  });

  it('accepts valid 6-digit hex avatarColor with lowercase', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, avatarColor: '#aabbcc' });
    expect(result.success).toBe(true);
  });

  it('rejects temperature below 0', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, temperature: -0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects temperature above 1', () => {
    const result = createAgentSchema.safeParse({ ...validAgentData, temperature: 1.1 });
    expect(result.success).toBe(false);
  });

  it('accepts temperature at boundary values 0 and 1', () => {
    expect(createAgentSchema.safeParse({ ...validAgentData, temperature: 0 }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgentData, temperature: 1 }).success).toBe(true);
  });
});

describe('updateAgentSchema', () => {
  it('accepts empty object (all fields optional for partial update)', () => {
    const result = updateAgentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only name', () => {
    const result = updateAgentSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only model and provider', () => {
    const result = updateAgentSchema.safeParse({ model: 'claude-3-sonnet-20240229', provider: 'anthropic' });
    expect(result.success).toBe(true);
  });

  it('still validates field constraints when provided — rejects invalid avatarColor', () => {
    const result = updateAgentSchema.safeParse({ avatarColor: 'not-hex' });
    expect(result.success).toBe(false);
  });

  it('still validates temperature range when provided', () => {
    const result = updateAgentSchema.safeParse({ temperature: 2.0 });
    expect(result.success).toBe(false);
  });
});
