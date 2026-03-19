#!/usr/bin/env npx tsx
/**
 * CLI smoke test for the conversation engine.
 * Usage: npx tsx scripts/test-conversation.ts <roomId>
 *
 * Requires:
 * - A room with at least 2 agents assigned
 * - Provider API keys configured for those agents' providers
 *
 * What it does:
 * 1. Starts a conversation in the given room
 * 2. Waits for 2 agent messages to appear
 * 3. Stops the conversation
 * 4. Reports message count and token usage
 */

import { ConversationManager } from '../src/lib/conversation/manager';
import { db } from '../src/db';
import { rooms, messages, roomAgents } from '../src/db/schema';
import { eq, count } from 'drizzle-orm';

async function main() {
  const roomId = process.argv[2];
  if (!roomId) {
    console.error('Usage: npx tsx scripts/test-conversation.ts <roomId>');
    console.error('');
    console.error('Provide a room ID with at least 2 agents assigned.');
    console.error('Provider API keys must be configured in Settings.');
    process.exit(1);
  }

  // Verify room exists
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) {
    console.error(`Room "${roomId}" not found.`);
    process.exit(1);
  }

  // Verify agents assigned
  const agentRows = await db.query.roomAgents.findMany({ where: eq(roomAgents.roomId, roomId) });
  if (agentRows.length === 0) {
    console.error(`Room "${room.name}" has no agents assigned.`);
    process.exit(1);
  }

  console.log(`Room: "${room.name}" (${roomId})`);
  console.log(`Agents: ${agentRows.map(a => `${a.name} [${a.provider}/${a.model}]`).join(', ')}`);
  console.log(`Turn limit: ${room.turnLimit}, Strategy: ${room.speakerStrategy}`);
  console.log('');
  console.log('Starting conversation...');

  // Fire-and-forget — does NOT await full turn loop
  ConversationManager.start(roomId, db);

  // Wait for at least 2 messages
  const TARGET = 2;
  const TIMEOUT = 120_000; // 2 minutes
  const start = Date.now();

  while (Date.now() - start < TIMEOUT) {
    const [{ value: msgCount }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));

    if (msgCount >= TARGET) {
      console.log(`  ${msgCount} messages received.`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Stopping conversation...');
  await ConversationManager.stop(roomId, db);

  // Report results
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, roomId));

  console.log('');
  console.log('=== Results ===');
  console.log(`Total messages: ${allMessages.length}`);

  for (const msg of allMessages) {
    const agent = agentRows.find(a => a.id === msg.roomAgentId);
    const name = agent?.name ?? msg.role;
    const tokens = msg.inputTokens != null ? `(in:${msg.inputTokens} out:${msg.outputTokens})` : '';
    const preview = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
    console.log(`  [${name}] ${preview} ${tokens}`);
  }

  const totalIn = allMessages.reduce((s, m) => s + (m.inputTokens ?? 0), 0);
  const totalOut = allMessages.reduce((s, m) => s + (m.outputTokens ?? 0), 0);
  console.log(`Total tokens — input: ${totalIn}, output: ${totalOut}`);

  // Verify room is idle
  const finalRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  console.log(`Room status: ${finalRoom?.status}`);

  if (allMessages.length >= TARGET) {
    console.log('');
    console.log('SMOKE TEST PASSED');
    process.exit(0);
  } else {
    console.error('');
    console.error('SMOKE TEST FAILED — not enough messages produced');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
