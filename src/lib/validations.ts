import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  topic: z.string().max(280).optional(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(60),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  avatarIcon: z.string().min(1),
  promptRole: z.string().min(1),
  promptPersonality: z.string().optional(),
  promptRules: z.string().optional(),
  promptConstraints: z.string().optional(),
  provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'ollama']),
  model: z.string().min(1),
  temperature: z.number().min(0).max(1).default(0.7),
  presetId: z.string().optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

export const addAgentToRoomSchema = z.object({
  agentId: z.string().min(1),
});

export const removeAgentFromRoomSchema = z.object({
  roomAgentId: z.string().min(1),
});

export const saveProviderKeySchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
});
