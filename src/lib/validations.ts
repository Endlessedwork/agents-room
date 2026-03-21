import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  topic: z.string().max(280).optional(),
  turnLimit: z.number().int().min(5).max(100).default(20),
  speakerStrategy: z.enum(['round-robin', 'llm-selected']).default('round-robin'),
  parallelFirstRound: z.boolean().default(false),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  topic: z.string().max(280).optional(),
  turnLimit: z.number().int().min(5).max(100).optional(),
  speakerStrategy: z.enum(['round-robin', 'llm-selected']).optional(),
  parallelFirstRound: z.boolean().optional(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(60),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  avatarIcon: z.string().min(1),
  promptRole: z.string().min(1),
  promptPersonality: z.string().nullable().optional(),
  promptRules: z.string().nullable().optional(),
  promptConstraints: z.string().nullable().optional(),
  provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'ollama']),
  model: z.string().min(1),
  temperature: z.number().min(0).max(1).default(0.7),
  presetId: z.string().nullable().optional(),
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

export const startConversationSchema = z.object({
  topic: z.string().min(1).max(1000).optional(),
});
