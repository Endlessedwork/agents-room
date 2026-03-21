import { eq, count, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { rooms, roomAgents, messages, providerKeys } from '@/db/schema';
import { nanoid } from 'nanoid';
import { streamLLM } from '@/lib/llm/gateway';
import type { ProviderName } from '@/lib/llm/providers';
import { ContextService } from './context-service';
import { SpeakerSelector } from './speaker-selector';
import { emitSSE } from '@/lib/sse/stream-registry';

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// In-memory registry of active AbortControllers (per room).
// An entry in this map means a turn loop is running or about to run for that room.
const activeControllers = new Map<string, AbortController>();

async function getProviderConfig(
  provider: string,
  db: DrizzleDB
): Promise<{ apiKey?: string; baseUrl?: string }> {
  const row = await db.query.providerKeys.findFirst({
    where: eq(providerKeys.provider, provider),
  });
  return { apiKey: row?.apiKey ?? undefined, baseUrl: row?.baseUrl ?? undefined };
}

/**
 * Run the parallel first round: all agents independently build context and generate
 * their opening responses before any message is persisted.
 *
 * Invariants:
 *  - Promise.all for contexts happens BEFORE Promise.allSettled for LLM calls
 *    (structural guarantee that no agent sees peers' responses)
 *  - Abort check is AFTER Promise.allSettled — no partial persistence
 *  - Messages persisted in agent position order (agents must be sorted by position)
 *  - parallel:end emitted AFTER all turn:start/token/turn:end sequences
 */
async function runParallelRound(
  roomId: string,
  agents: (typeof schema.roomAgents.$inferSelect)[],
  db: DrizzleDB,
  controllers: Map<string, AbortController>,
  turnLimit: number,
): Promise<{ succeeded: boolean; turnsCompleted: number }> {
  // 1. Emit parallel:start
  emitSSE(roomId, 'parallel:start', { agentCount: agents.length });

  // 2. Build ALL contexts BEFORE any LLM call (structural isolation guarantee)
  const contexts = await Promise.all(
    agents.map((agent) => ContextService.buildContext(db, roomId, agent, 0)),
  );

  // 3. Get provider configs for all agents
  const configs = await Promise.all(agents.map((agent) => getProviderConfig(agent.provider, db)));

  // 4. Create a shared abort controller for the parallel round, replacing the sentinel
  const controller = new AbortController();
  controllers.set(roomId, controller);

  // 5. Run all LLM calls concurrently, capturing full text in memory
  const settled = await Promise.allSettled(
    agents.map(async (_agent, i) => {
      let fullText = '';
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      const result = streamLLM({
        provider: agents[i].provider as ProviderName,
        model: agents[i].model,
        config: configs[i],
        system: contexts[i].systemPrompt,
        messages: contexts[i].messages,
        temperature: agents[i].temperature,
        abortSignal: controller.signal,
      });

      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      const usage = await result.usage;
      inputTokens = usage?.inputTokens ?? null;
      outputTokens = usage?.outputTokens ?? null;

      return { fullText, inputTokens, outputTokens };
    }),
  );

  // 6. Check abort AFTER allSettled — if aborted, discard everything
  if (controller.signal.aborted) {
    emitSSE(roomId, 'parallel:cancel', {});
    controllers.delete(roomId);
    return { succeeded: false, turnsCompleted: 0 };
  }

  // 7. Persist and emit in agent position order (agents are already sorted by position)
  let turnsCompleted = 0;
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const agent = agents[i];
    if (outcome.status === 'fulfilled' && outcome.value.fullText.trim().length > 0) {
      const { fullText, inputTokens, outputTokens } = outcome.value;

      // Emit turn:start for this agent
      emitSSE(roomId, 'turn:start', {
        agentId: agent.id,
        agentName: agent.name,
        avatarColor: agent.avatarColor,
        avatarIcon: agent.avatarIcon,
        promptRole: agent.promptRole,
        model: agent.model,
        provider: agent.provider,
        turnNumber: turnsCompleted + 1,
        totalTurns: turnLimit,
      });

      // Emit all tokens at once (buffered, not streamed)
      emitSSE(roomId, 'token', { agentId: agent.id, text: fullText });

      // Persist message
      const msgId = nanoid();
      await db.insert(messages).values({
        id: msgId,
        roomId,
        roomAgentId: agent.id,
        role: 'agent',
        content: fullText,
        model: agent.model,
        inputTokens,
        outputTokens,
      });

      // Emit turn:end
      emitSSE(roomId, 'turn:end', {
        agentId: agent.id,
        messageId: msgId,
        inputTokens,
        outputTokens,
      });

      turnsCompleted++;
    }
  }

  // 8. Update lastActivityAt
  if (turnsCompleted > 0) {
    await db.update(rooms).set({ lastActivityAt: new Date() }).where(eq(rooms.id, roomId));
  }

  // 9. Emit parallel:end AFTER all turn events
  emitSSE(roomId, 'parallel:end', {});

  // 10. Clean up controller
  if (controllers.get(roomId) === controller) {
    controllers.delete(roomId);
  }

  return { succeeded: true, turnsCompleted };
}

export class ConversationManager {
  /**
   * Start the turn loop for a room. Fire-and-forget.
   * If the room is already running (controller exists), returns immediately.
   */
  static async start(roomId: string, db: DrizzleDB, _turnLimitOverride?: number): Promise<void> {
    // Prevent double-start — sentinel controller registered before the loop begins
    if (activeControllers.has(roomId)) return;

    // Register sentinel immediately so double-start check works
    const sentinelController = new AbortController();
    activeControllers.set(roomId, sentinelController);

    // Load room
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    if (!room) {
      activeControllers.delete(roomId);
      throw new Error(`Room not found: ${roomId}`);
    }

    const turnLimit = _turnLimitOverride ?? room.turnLimit;

    // Set status to running
    await db.update(rooms).set({ status: 'running' }).where(eq(rooms.id, roomId));
    emitSSE(roomId, 'status', { status: 'running' });

    // Load agents ordered by position
    const agents = await db.query.roomAgents.findMany({
      where: eq(roomAgents.roomId, roomId),
      orderBy: (ra, { asc }) => [asc(ra.position)],
    });
    if (agents.length === 0) {
      activeControllers.delete(roomId);
      throw new Error(`No agents in room: ${roomId}`);
    }

    // Create speaker selector
    const selector = new SpeakerSelector(
      agents,
      room.speakerStrategy,
      (provider) => getProviderConfig(provider, db)
    );

    // Fire-and-forget turn loop
    (async () => {
      let turnCount = 0;

      try {
        // Parallel first round: all agents respond independently before seeing peers
        if (room.parallelFirstRound && turnCount === 0) {
          const parallelResult = await runParallelRound(
            roomId,
            agents,
            db,
            activeControllers,
            turnLimit,
          );
          if (!parallelResult.succeeded) {
            // Aborted or failed — exit turn loop
            return;
          }
          turnCount = parallelResult.turnsCompleted;
          // Re-register sentinel so sequential loop's double-start guard works correctly
          activeControllers.set(roomId, new AbortController());
        }

        while (turnCount < turnLimit) {
          // Re-check room status each iteration
          const currentRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
          if (!currentRoom || currentRoom.status !== 'running') break;

          // Select next speaker
          const agent = await selector.next(roomId);

          // Build context for this agent
          const context = await ContextService.buildContext(db, roomId, agent, turnCount);

          // Get provider config for this agent
          const config = await getProviderConfig(agent.provider, db);

          // Emit turn:start before LLM call
          emitSSE(roomId, 'turn:start', {
            agentId: agent.id,
            agentName: agent.name,
            avatarColor: agent.avatarColor,
            avatarIcon: agent.avatarIcon,
            promptRole: agent.promptRole,
            model: agent.model,
            provider: agent.provider,
            turnNumber: turnCount + 1,
            totalTurns: turnLimit,
          });

          // Create per-turn abort controller, replacing the sentinel
          const controller = new AbortController();
          activeControllers.set(roomId, controller);

          let fullText = '';
          let inputTokens: number | null = null;
          let outputTokens: number | null = null;
          let aborted = false;

          try {
            const result = streamLLM({
              provider: agent.provider as ProviderName,
              model: agent.model,
              config,
              system: context.systemPrompt,
              messages: context.messages,
              temperature: agent.temperature,
              abortSignal: controller.signal,
            });

            // Consume the text stream
            for await (const chunk of result.textStream) {
              fullText += chunk;
              emitSSE(roomId, 'token', { agentId: agent.id, text: chunk });
            }

            // Await token usage
            const usage = await result.usage;
            inputTokens = usage?.inputTokens ?? null;
            outputTokens = usage?.outputTokens ?? null;
          } catch (err) {
            if (
              err instanceof Error &&
              (err.name === 'AbortError' || (err as DOMException).name === 'AbortError')
            ) {
              aborted = true;
              emitSSE(roomId, 'turn:cancel', { agentId: agent.id });
            } else {
              // Non-abort error: persist system error message and break
              const errMsg = err instanceof Error ? err.message : String(err);
              await db.insert(messages).values({
                id: nanoid(),
                roomId,
                roomAgentId: null,
                role: 'system',
                content: `[Error: ${errMsg}]`,
                model: null,
                inputTokens: null,
                outputTokens: null,
              });
              emitSSE(roomId, 'system', { content: `[Error: ${errMsg}]` });
              break;
            }
          } finally {
            // Remove controller only if it's the one we set (stop() may have already removed it)
            if (activeControllers.get(roomId) === controller) {
              activeControllers.delete(roomId);
            }
          }

          if (aborted) break;

          // Skip persisting empty responses — they poison context for subsequent turns
          if (fullText.trim().length === 0) {
            emitSSE(roomId, 'turn:cancel', { agentId: agent.id });
            turnCount++;
            continue;
          }

          // Persist the agent message
          const msgId = nanoid();
          await db.insert(messages).values({
            id: msgId,
            roomId,
            roomAgentId: agent.id,
            role: 'agent',
            content: fullText,
            model: agent.model,
            inputTokens,
            outputTokens,
          });
          emitSSE(roomId, 'turn:end', {
            agentId: agent.id,
            messageId: msgId,
            inputTokens,
            outputTokens,
          });

          // Update lastActivityAt
          await db.update(rooms).set({ lastActivityAt: new Date() }).where(eq(rooms.id, roomId));

          // Check for repetition
          const isRepetitive = await ContextService.detectRepetition(db, roomId);
          if (isRepetitive) {
            await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
            emitSSE(roomId, 'status', { status: 'paused' });
            await db.insert(messages).values({
              id: nanoid(),
              roomId,
              roomAgentId: null,
              role: 'system',
              content: '[Auto-paused: agents are repeating themselves]',
              model: null,
              inputTokens: null,
              outputTokens: null,
            });
            emitSSE(roomId, 'system', { content: '[Auto-paused: agents are repeating themselves]' });
            break;
          }

          // Check for convergence (cross-agent agreement — distinct from verbatim repetition)
          const hasConverged = await ContextService.detectConvergence(db, roomId, turnCount);
          if (hasConverged) {
            await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
            emitSSE(roomId, 'status', { status: 'paused' });
            await db.insert(messages).values({
              id: nanoid(),
              roomId,
              roomAgentId: null,
              role: 'system',
              content: '[Auto-paused: agents reached consensus]',
              model: null,
              inputTokens: null,
              outputTokens: null,
            });
            emitSSE(roomId, 'system', { content: '[Auto-paused: agents reached consensus]' });
            break;
          }

          turnCount++;
        }
      } finally {
        // Clean up any remaining controller entry for this room
        activeControllers.delete(roomId);
        // If room is still 'running' after loop exits, set to idle
        const finalRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
        if (finalRoom?.status === 'running') {
          await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
          emitSSE(roomId, 'status', { status: 'idle' });
        }
      }
    })().catch((err) => {
      console.error('[ConversationManager]', err);
    });
  }

  /**
   * Pause the turn loop. The current turn completes; loop exits on next iteration.
   */
  static async pause(roomId: string, db: DrizzleDB): Promise<void> {
    await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
    emitSSE(roomId, 'status', { status: 'paused' });
  }

  /**
   * Stop the turn loop immediately. Aborts in-flight stream and sets status to idle.
   */
  static async stop(roomId: string, db: DrizzleDB): Promise<void> {
    await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
    emitSSE(roomId, 'status', { status: 'idle' });
    const controller = activeControllers.get(roomId);
    if (controller) {
      controller.abort();
      activeControllers.delete(roomId);
    }
  }

  /**
   * Resume a paused conversation. Calculates remaining turns from existing
   * agent message count and re-enters the turn loop.
   */
  static async resume(roomId: string, db: DrizzleDB): Promise<void> {
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    if (!room) throw new Error(`Room not found: ${roomId}`);

    // Count existing agent messages (not system/user messages)
    const [{ value: existingCount }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(and(eq(messages.roomId, roomId), eq(messages.role, 'agent')));

    const remainingTurns = room.turnLimit - existingCount;
    if (remainingTurns <= 0) return;

    await ConversationManager.start(roomId, db, remainingTurns);
  }

  // --- Test helpers ---

  /** Exposed for testing: get the active AbortController for a room. */
  static _getActiveController(roomId: string): AbortController | undefined {
    return activeControllers.get(roomId);
  }

  /** Exposed for testing: clear all active controllers (test teardown). */
  static _clearControllers(): void {
    activeControllers.clear();
  }
}
