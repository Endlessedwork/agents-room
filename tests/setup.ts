import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/db/schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // Create tables from schema using raw SQL matching schema.ts definitions
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      topic TEXT,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'paused')),
      turn_limit INTEGER NOT NULL DEFAULT 20,
      speaker_strategy TEXT NOT NULL DEFAULT 'round-robin' CHECK(speaker_strategy IN ('round-robin', 'llm-selected')),
      parallel_first_round INTEGER NOT NULL DEFAULT 0,
      last_activity_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      avatar_icon TEXT NOT NULL,
      prompt_role TEXT NOT NULL,
      prompt_personality TEXT,
      prompt_rules TEXT,
      prompt_constraints TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.7,
      preset_id TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS room_agents (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      source_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      avatar_icon TEXT NOT NULL,
      prompt_role TEXT NOT NULL,
      prompt_personality TEXT,
      prompt_rules TEXT,
      prompt_constraints TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.7,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      room_agent_id TEXT REFERENCES room_agents(id) ON DELETE SET NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'agent', 'system')),
      content TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS provider_keys (
      provider TEXT PRIMARY KEY,
      api_key TEXT,
      base_url TEXT,
      status TEXT NOT NULL DEFAULT 'unconfigured' CHECK(status IN ('unconfigured', 'configured', 'verified', 'failed')),
      last_tested_at INTEGER,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  return { db, sqlite };
}
