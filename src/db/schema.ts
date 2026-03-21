import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// --- Global agent library ---
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(), // nanoid
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull(), // hex color
  avatarIcon: text('avatar_icon').notNull(), // icon name
  // Structured system prompt fields (separate columns, not one blob)
  promptRole: text('prompt_role').notNull(),
  promptPersonality: text('prompt_personality'),
  promptRules: text('prompt_rules'),
  promptConstraints: text('prompt_constraints'),
  provider: text('provider').notNull(), // 'anthropic'|'openai'|'google'|'openrouter'|'ollama'
  model: text('model').notNull(),
  temperature: real('temperature').notNull().default(0.7),
  presetId: text('preset_id'), // null = custom, named = from template
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Rooms ---
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), // nanoid
  name: text('name').notNull(),
  topic: text('topic'),
  status: text('status', { enum: ['idle', 'running', 'paused'] })
    .notNull()
    .default('idle'),
  turnLimit: integer('turn_limit').notNull().default(20),
  speakerStrategy: text('speaker_strategy', {
    enum: ['round-robin', 'llm-selected'],
  })
    .notNull()
    .default('round-robin'),
  parallelFirstRound: integer('parallel_first_round', { mode: 'boolean' })
    .notNull()
    .default(false),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Room agent instances (copy-on-assign) ---
// Each row is an independent copy of an agent assigned to a room.
// Changing the library agent does NOT affect existing room_agents rows.
export const roomAgents = sqliteTable('room_agents', {
  id: text('id').primaryKey(), // nanoid
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  sourceAgentId: text('source_agent_id').references(() => agents.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(), // copied at assignment time
  avatarColor: text('avatar_color').notNull(),
  avatarIcon: text('avatar_icon').notNull(),
  promptRole: text('prompt_role').notNull(),
  promptPersonality: text('prompt_personality'),
  promptRules: text('prompt_rules'),
  promptConstraints: text('prompt_constraints'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  temperature: real('temperature').notNull().default(0.7),
  position: integer('position').notNull().default(0), // turn order
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Messages (empty panel in Phase 1, full use in Phase 2+) ---
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(), // nanoid
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  roomAgentId: text('room_agent_id').references(() => roomAgents.id, {
    onDelete: 'set null',
  }),
  role: text('role', { enum: ['user', 'agent', 'system'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'), // model used for this message
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Provider API keys ---
export const providerKeys = sqliteTable('provider_keys', {
  provider: text('provider').primaryKey(), // 'anthropic'|'openai'|'google'|'openrouter'|'ollama'
  apiKey: text('api_key'), // null = not configured
  baseUrl: text('base_url'), // for Ollama custom host
  status: text('status', {
    enum: ['unconfigured', 'configured', 'verified', 'failed'],
  })
    .notNull()
    .default('unconfigured'),
  lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Relations ---
export const roomsRelations = relations(rooms, ({ many }) => ({
  roomAgents: many(roomAgents),
  messages: many(messages),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  roomAgents: many(roomAgents),
}));

export const roomAgentsRelations = relations(roomAgents, ({ one, many }) => ({
  room: one(rooms, { fields: [roomAgents.roomId], references: [rooms.id] }),
  sourceAgent: one(agents, {
    fields: [roomAgents.sourceAgentId],
    references: [agents.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
  roomAgent: one(roomAgents, {
    fields: [messages.roomAgentId],
    references: [roomAgents.id],
  }),
}));
