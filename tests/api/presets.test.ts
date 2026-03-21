import { describe, it, expect } from 'vitest';
import { createPresetSchema, updatePresetSchema } from '@/lib/validations';

const validPresetData = {
  name: "Devil's Advocate",
  avatarColor: '#EF4444',
  avatarIcon: 'flame',
  promptRole: 'You challenge every idea presented in the conversation.',
  promptPersonality: 'Contrarian, sharp, intellectually honest.',
  promptRules: 'Always present the strongest counter-argument.',
  promptConstraints: 'Do not be rude or dismissive.',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-4-20250514',
  temperature: 0.8,
};

describe('createPresetSchema', () => {
  it('accepts valid full preset data', () => {
    const result = createPresetSchema.safeParse(validPresetData);
    expect(result.success).toBe(true);
  });

  it('strips isSystem field — it should not appear in parsed output', () => {
    const dataWithIsSystem = { ...validPresetData, isSystem: true };
    const result = createPresetSchema.safeParse(dataWithIsSystem);
    // isSystem is not in the schema so it gets stripped (not a parse error)
    expect(result.success).toBe(true);
    if (result.success) {
      expect('isSystem' in result.data).toBe(false);
    }
  });

  it('rejects payload with missing required name', () => {
    const { name: _name, ...withoutName } = validPresetData;
    const result = createPresetSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required avatarColor', () => {
    const { avatarColor: _avatarColor, ...withoutColor } = validPresetData;
    const result = createPresetSchema.safeParse(withoutColor);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required avatarIcon', () => {
    const { avatarIcon: _avatarIcon, ...withoutIcon } = validPresetData;
    const result = createPresetSchema.safeParse(withoutIcon);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required promptRole', () => {
    const { promptRole: _promptRole, ...withoutRole } = validPresetData;
    const result = createPresetSchema.safeParse(withoutRole);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required provider', () => {
    const { provider: _provider, ...withoutProvider } = validPresetData;
    const result = createPresetSchema.safeParse(withoutProvider);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required model', () => {
    const { model: _model, ...withoutModel } = validPresetData;
    const result = createPresetSchema.safeParse(withoutModel);
    expect(result.success).toBe(false);
  });

  it('accepts minimal preset data (only required fields)', () => {
    const minimal = {
      name: 'Minimal Preset',
      avatarColor: '#3B82F6',
      avatarIcon: 'code',
      promptRole: 'You are a helpful assistant.',
      provider: 'openai' as const,
      model: 'gpt-4o',
    };
    const result = createPresetSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      // temperature defaults to 0.7
      expect(result.data.temperature).toBe(0.7);
    }
  });
});

describe('updatePresetSchema', () => {
  it('accepts partial data (just name)', () => {
    const result = updatePresetSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updatePresetSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial temperature update', () => {
    const result = updatePresetSchema.safeParse({ temperature: 0.3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.3);
    }
  });
});
