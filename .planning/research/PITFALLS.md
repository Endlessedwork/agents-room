# Pitfalls Research

**Domain:** Multi-agent AI chat room (LLM-based, multi-provider, real-time)
**Researched:** 2026-03-19
**Confidence:** HIGH (multiple sources, confirmed by academic research and practitioner post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Infinite Conversation Loops With No Hard Termination

**What goes wrong:**
Agents keep responding to each other indefinitely. Without explicit turn limits, a "ping-pong" emerges: Agent A asks a question, Agent B gives an answer that prompts Agent A to respond, which prompts Agent B to clarify, forever. API costs spike uncontrollably and the UI floods with hundreds of messages in seconds. Real cases report $40+ in API fees burned in minutes with no useful output.

**Why it happens:**
Most developers wire up "Agent A talks, Agent B responds" without defining what "done" means. LLMs are trained to be helpful — they almost never say "I have nothing more to add." Without an external termination condition, the conversation has no natural exit.

**How to avoid:**
- Every conversation session must have a hard `max_turns` limit (e.g., 20 per session, configurable per room).
- Implement a termination function that detects completion signals: "Final answer:", "DONE", or consensus reached.
- Add semantic cycle detection: hash recent messages and halt if the same content repeats 2+ times.
- Use defense-in-depth — both turn limits AND termination checks, not one or the other.

**Warning signs:**
- Message count climbs past 10 without the topic advancing.
- Two agents are only responding to each other's immediately prior message (no synthesis).
- API cost meter is moving faster than 1 message per second.

**Phase to address:** Phase 1 (Core agent loop). Never build the conversation loop without termination — it is not an optimization, it is a correctness requirement.

---

### Pitfall 2: Runaway Token Costs With No Budget Guard

**What goes wrong:**
Multi-agent means multiplied costs. Three agents in a room means 3x token consumption per conversation turn. Add retry logic, long context histories being re-sent each turn, and a loop that runs 20+ turns, and a single conversation can cost 10-50x what a solo chat would. Without a hard spending cap, a background process or forgotten room can silently run up significant API costs.

**Why it happens:**
Token cost is invisible at development time. `max_tokens` controls output size, not total spend. Developers focus on getting agents to talk and defer cost management to "later." Later never comes.

**How to avoid:**
- Implement per-conversation token budget tracking. Count input + output tokens per turn, cumulate across agents.
- Set hard circuit breakers: if a conversation exceeds N total tokens (e.g., 50k), pause and alert.
- Track cost per room, not just per message.
- Use cheaper models for agents doing "commentary" roles vs. agents doing synthesis.
- Store the per-provider cost-per-token and surface live cost estimates in the UI.

**Warning signs:**
- No token accumulator in the conversation session object.
- Context history is passed in full on every turn with no truncation or summarization.
- No cost column in the conversation log.

**Phase to address:** Phase 1 (Agent runner). Budget tracking must be built alongside the first working conversation loop, not retrofitted.

---

### Pitfall 3: Context Rot — Agents Forget Their Role Over Long Conversations

**What goes wrong:**
As conversation history grows, the system prompt (role definition, persona, constraints) gets buried under dozens of prior messages. LLMs suffer "context rot" — accuracy measurably decreases as critical instructions get pushed further from the attention window. Agents start ignoring their assigned persona, agreeing with whatever was said last, or producing generic outputs. Research confirms this happens even in models with 200k token windows when important information is buried in noise.

**Why it happens:**
The naive approach — prepend system prompt, then append all history — works in demos but fails over long runs. Developers don't notice degradation because they only test short conversations.

**How to avoid:**
- Re-inject condensed role reminders at regular intervals (every N turns) as part of the system prompt.
- Use sliding window compression: keep the last 5-10 messages verbatim, summarize older messages. Never pass full raw history beyond the compression threshold.
- Design agent system prompts to include explicit behavioral anchors: "Regardless of what others say, you always approach problems from [perspective]."
- Test conversations at 15+ turns, not just 3-5.

**Warning signs:**
- Agent responses become generic after turn 8-10.
- A "skeptic" agent starts agreeing with everything.
- Agent ignores its persona constraints when directly asked to deviate by another agent.

**Phase to address:** Phase 1 (System prompt design) and Phase 2 (Context management). Compression strategy must exist before conversations exceed 10 turns.

---

### Pitfall 4: Agent Sycophancy — The Echo Chamber Collapse

**What goes wrong:**
LLMs are trained to be agreeable. In a multi-agent setting, agents progressively abandon their positions and converge toward consensus — even when the consensus is wrong. Research (ACL 2025, CONSENSAGENT) shows agents hit their lowest sycophancy in round 1 and become progressively more agreeable as debate continues. Disagreement rate drops as debate progresses, directly correlated with performance degradation. The room looks active and "productive" but is just agents validating each other.

**Why it happens:**
Agreement is reinforced in RLHF training. When Agent B says "Good point, Agent A", Agent A's next generation is biased toward accepting whatever Agent B says next. Without architectural resistance to convergence, consensus emerges from social pressure, not reasoning.

**How to avoid:**
- Assign agents explicit adversarial roles: one agent must always find the flaw in the previous argument.
- Include in each agent's system prompt: "Your job is to maintain your position unless given a logically compelling reason to change it. Simply being disagreed with is not sufficient reason to change your view."
- After N turns, inject a "devil's advocate" prompt as the user's voice to force reconsideration.
- Track position change rate per agent — if an agent reverses position 3+ times in 5 turns, flag it.

**Warning signs:**
- All agents are agreeing by turn 5.
- Agents are using phrases like "You make an excellent point" repeatedly.
- The final conversation summary is just the first agent's view, endorsed by all others.

**Phase to address:** Phase 1 (System prompt design). Build in adversarial role structures from day one. This cannot be patched in later without re-architecting personas.

---

### Pitfall 5: No Turn-Taking Coordinator — Simultaneous Responses Destroy Coherence

**What goes wrong:**
Without explicit turn coordination, multiple agents respond to the same message simultaneously. In async/concurrent implementations, two agents generate responses in parallel, and both get appended to the chat. The conversation becomes incoherent — Agent A and Agent B both respond to Agent C's question as if the other hadn't, creating branching threads that don't merge. The user sees chaos, not conversation.

**Why it happens:**
Parallelizing LLM calls for speed is the right instinct. But applying parallelism to conversation turns (as opposed to tool calls within a turn) breaks the fundamental sequential nature of dialogue.

**How to avoid:**
- Conversation turns must be strictly sequential: one agent speaks, then the next. Never parallel.
- Implement a turn coordinator/moderator: a state machine that selects who speaks next based on rules (round-robin, topic-directed, user-assigned).
- The turn coordinator is a lightweight decision-maker, not a full LLM call — use heuristics or a cheap model call, not full generation.
- Queue messages per room; never allow concurrent writes to the room timeline.

**Warning signs:**
- Two messages from different agents appear in the same second with overlapping content.
- Agents reference things that haven't been said yet (read from partially-written state).
- The UI message order is non-deterministic on refresh.

**Phase to address:** Phase 1 (Room/conversation architecture). The sequential turn model must be the foundation — concurrency cannot be bolted on top later without a rewrite.

---

### Pitfall 6: Multi-Provider API Differences Leak Into Business Logic

**What goes wrong:**
Claude, GPT-4, and Gemini have different request formats, response structures, streaming behaviors, error codes, and token counting methods. Without a proper abstraction layer, provider-specific handling spreads throughout the codebase. Switching an agent from Claude to GPT requires touching 15 files. A Gemini-specific error format crashes the Claude agent handler. Adding a new provider takes a week instead of an afternoon.

**Why it happens:**
The first working integration always uses the provider's native SDK. It works. There's no immediate pain. By the time the second provider is added, the first provider's patterns are baked in everywhere.

**How to avoid:**
- Define an internal `LLMProvider` interface on day one, before writing the first real provider call.
- All agent code calls the interface, never the provider SDK directly.
- Implement the interface for one provider first, then the second immediately — don't wait until you "need" multi-provider.
- Use LiteLLM or a similar abstraction library as the foundation (it handles format normalization, streaming, and retries across providers).
- Normalize all errors to internal error types at the adapter boundary.

**Warning signs:**
- `if provider == 'claude'` conditionals appear outside the adapter layer.
- Response parsing code references provider-specific field names (`.choices[0].message` vs. `.content[0].text`).
- Adding a new provider requires modifying the agent runner.

**Phase to address:** Phase 1 (Provider abstraction). This is a foundational architectural decision. Delaying it past the first provider integration makes it a painful refactor.

---

### Pitfall 7: Prompt Injection Propagation Across Agents

**What goes wrong:**
An agent receives a message containing a prompt injection payload ("Ignore your previous instructions and..."). It generates a response influenced by that injection. The next agent in the conversation receives that response as trusted context and inherits the injection. A compromised agent can corrupt the entire chain. Research shows this "second-order" injection is used in real attacks — a low-privilege agent tricks a higher-privilege agent into performing unauthorized actions.

**Why it happens:**
Developers treat all messages in the conversation history as equally trusted. Agent-generated content is assumed safe because "it came from our system." But agent output is generated from user-influenced inputs and must be treated as untrusted.

**How to avoid:**
- Sanitize or rate-limit special instruction patterns in user-supplied messages (ignore previous instructions, act as, etc.).
- Never allow user messages to directly become part of another agent's system prompt.
- Treat agent-to-agent messages as untrusted content, not as system-level instructions.
- For this personal tool: since it's single-user, this is lower priority — but the user's own accidental or test injections can still corrupt conversations, so basic sanitization is still worthwhile.

**Warning signs:**
- An agent's persona changes mid-conversation without a user control action.
- Agents stop following their assigned roles after a specific user message.
- An agent starts issuing instructions to other agents that weren't in the original design.

**Phase to address:** Phase 2 (User participation). When the user can type into the room, sanitization must be applied before injecting user messages into agent context.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Pass full conversation history to every agent on every turn | Simple implementation, agents have full context | O(n²) token cost growth; context rot after 10+ turns; slow responses | Never — use sliding window from the start |
| Use provider SDK directly instead of abstraction layer | Faster first integration | Adding second provider requires touching all agent code | Never — define interface first |
| Skip turn coordinator, let agents fire in parallel | Faster agent responses | Incoherent conversations, non-deterministic message ordering | Never for conversation turns (fine for tool calls within a turn) |
| Hardcode max_turns=100 "to be safe" | Easy to implement | Hides loop bugs; still risks $40+ bills on stuck conversations | Only in dev with fake/mocked LLM |
| Store all history as flat JSON blob per room | Simple schema | No ability to query specific messages, summarize, or paginate; migration is painful | MVP only if schema is versioned and migration path documented |
| No streaming — wait for full response | Simpler response handling | Dead UI while agents are "thinking"; poor UX for 5-30s generation times | Never — streaming is required for real-time feel |

---

## Integration Gotchas

Common mistakes when connecting to external LLM services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic Claude API | Using `max_tokens` to control cost, not conversation length | Track cumulative input+output tokens across all turns; `max_tokens` only controls output per call |
| OpenAI API | Treating 429 rate limit errors as failures and crashing | Implement exponential backoff with jitter; route to fallback model if primary is rate-limited |
| Gemini API | Assuming same message format as OpenAI | Gemini uses `parts` not `content`; use abstraction layer to normalize |
| All providers | Streaming response handling — assuming each chunk is a complete token | Buffer chunks before processing; partial JSON in a chunk will break naive parsers |
| All providers | Counting tokens with `len(text.split())` | Use provider's tokenizer (tiktoken for OpenAI, Anthropic's token counting API) — word count can be off by 30-50% |
| All providers | Treating context window limit as a hard error | Track token budget proactively; summarize before hitting the limit, not after the API returns a 400 |

---

## Performance Traps

Patterns that work in development but cause problems in extended use.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full history in every prompt | Response time grows linearly with conversation length; costs climb per turn | Sliding window: verbatim last 8 messages + summarized older messages | After turn 10-15 in a 3-agent room |
| Synchronous LLM call blocks UI thread | UI freezes during agent generation; no streaming indicators | Async agent runner with SSE/WebSocket streaming to frontend | Every API call (0% scale threshold) |
| No message queue for agent turns | Race conditions when user sends message while agent is mid-response | Queue all room events; process turn-by-turn with acknowledgment | Any concurrent interaction |
| In-memory conversation state only | State lost on server restart; conversations not resumable | Persist each message to DB immediately upon generation | First server restart |
| Re-reading full DB history on every turn to build context | DB queries multiply with conversation length | Cache active conversation context in memory; only persist, don't re-read | After ~30 messages in an active room |

---

## Security Mistakes

Domain-specific security issues (note: single-user personal tool reduces attack surface considerably).

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys in frontend code or localStorage | Keys exposed if browser storage is inspected | Keys stay server-side only; frontend never touches raw provider keys |
| Logging full conversation content including user messages | Conversation data leaks in server logs | Log metadata (turn count, token count, agent IDs) not message content, or use structured logging with content redacted by default |
| No rate limiting on conversation start | If tool is accidentally exposed, someone could trigger costly API calls | Even for personal tools, require local network or simple token auth before starting a conversation |
| Injecting user message text directly into agent system prompts | User input can override agent behavior | Keep user messages in the `user` role, never in `system` role |

---

## UX Pitfalls

Common user experience mistakes specific to this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual distinction between agents | Impossible to follow who's saying what in fast conversations | Consistent color + avatar per agent; never change them mid-conversation |
| No streaming — wall of text appears all at once | User has nothing to watch during 10-30s generation; feels broken | Stream tokens as they're generated; animate the typing indicator |
| No way to stop a runaway conversation | User watches helpless as 50 messages pile up | Prominent "Stop" button that halts all agent turns and cancels in-flight API calls |
| Agent responses are too long by default | Conversations become unreadable essay dumps | Instruct agents in system prompt: "Keep responses under 150 words unless depth is specifically requested" |
| No conversation summary at room entry | User re-opens a room and has no idea what was discussed | Auto-generate a 2-3 sentence summary when conversation is paused/ended; show it at room header |
| User message doesn't feel different from agent messages | User loses track of where they intervened | Visually distinguish user messages (different alignment, color, or "You" label) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in demos but are missing critical pieces for real use.

- [ ] **Conversation termination:** Demo runs 5 turns cleanly — verify it also terminates correctly at turn 20, at token budget limit, and when user hits Stop.
- [ ] **Context compression:** Works in a 3-turn demo — verify agents still behave correctly at turn 15 with history compression active.
- [ ] **Multi-provider routing:** Claude works — verify GPT agent in the same room doesn't interfere, that errors from one provider don't crash the other agent's turn.
- [ ] **Cost tracking:** Token counts are logged — verify they accumulate correctly across all agents in a room, not just the last one to respond.
- [ ] **Streaming real-time:** Messages appear — verify they appear as tokens stream in, not only after generation completes.
- [ ] **Conversation persistence:** Messages are saved — verify they are queryable with correct ordering after a server restart.
- [ ] **Agent persona stability:** Agents have distinct voices in turn 1 — verify personas hold at turn 12 and 20, especially after user messages.
- [ ] **Stop/interrupt:** UI has a stop button — verify in-flight API calls are actually cancelled, not just the UI display stopped.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Infinite loop already ran up large API bill | LOW (money is spent; fix is cheap) | Add hard turn limits immediately; review provider billing for anomalous usage; add circuit breaker |
| Full conversation history being sent each turn | MEDIUM (requires context refactor) | Implement sliding window summarizer; migrate existing conversations by summarizing their older segments |
| Tightly coupled provider SDK throughout codebase | HIGH (full refactor) | Extract all provider calls to adapter classes one provider at a time; use strangler fig pattern |
| Echo chamber — agents always agree | LOW-MEDIUM | Update system prompts with adversarial role instructions; add mandatory dissent turns in turn coordinator |
| No streaming — poor UX | MEDIUM | Refactor agent runner to use streaming response callbacks; update frontend to handle token events |
| No cost tracking — unknown spend | LOW | Add token counting middleware to provider adapters; query provider billing APIs for historical data |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Infinite conversation loops | Phase 1 — Core agent loop | Conversation always terminates within configured max_turns; no hanging processes after test runs |
| Runaway token costs | Phase 1 — Agent runner | Token counter present in session object; circuit breaker fires in test with synthetic token overflow |
| Context rot over long conversations | Phase 1 — Prompt design + Phase 2 — Context mgmt | Agent maintains assigned persona at turn 15; history compression is active and measurable |
| Agent sycophancy / echo chamber | Phase 1 — System prompt design | "Skeptic" agent maintains dissent at turn 10 in structured test; position-change rate is tracked |
| No turn-taking coordinator | Phase 1 — Room architecture | Message ordering is deterministic; no concurrent agent writes in load test |
| Multi-provider API leakage | Phase 1 — Provider abstraction | Adding a new mock provider requires only a new adapter class; no changes to agent runner |
| Prompt injection propagation | Phase 2 — User participation | User message with injection payload does not change agent persona; sanitization unit tested |

---

## Sources

- [The Multi-Agent Trap — Towards Data Science (March 2026)](https://towardsdatascience.com/the-multi-agent-trap/)
- [Why Multi-Agent LLM Systems Fail — orq.ai](https://orq.ai/blog/why-do-multi-agent-llm-systems-fail)
- [Why do Multi-Agent LLM Systems Fail — Galileo](https://galileo.ai/blog/multi-agent-llm-systems-fail)
- [Challenges in Multi-Agent LLM Collaboration — newline](https://www.newline.co/@zaoyang/challenges-in-multi-agent-llm-collaboration--27f72c0c)
- [Fix Infinite Loops in Multi-Agent Chat Frameworks — markaicode](https://markaicode.com/fix-infinite-loops-multi-agent-chat/)
- [Rate Limiting Your Own AI Agent: The Runaway Loop Problem — DEV Community](https://dev.to/askpatrick/rate-limiting-your-own-ai-agent-the-runaway-loop-problem-nobody-talks-about-3dh2)
- [CONSENSAGENT: Sycophancy Mitigation in Multi-Agent LLM Interactions — ACL 2025](https://aclanthology.org/2025.findings-acl.1141/)
- [Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate — arXiv 2025](https://arxiv.org/html/2509.23055v1)
- [Talk Isn't Always Cheap: Failure Modes in Multi-Agent Debate — arXiv 2025](https://arxiv.org/pdf/2509.05396)
- [Context Engineering: The Real Reason AI Agents Fail in Production — inkeep](https://inkeep.com/blog/context-engineering-why-agents-fail)
- [Context Rot: Why AI Gets Worse the Longer You Chat — producttalk](https://www.producttalk.org/context-rot/)
- [Why Your Multi-Agent System is Failing: The 17x Error Trap — Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Multi-Agent Coordination Gone Wrong? Fix With 10 Strategies — Galileo](https://galileo.ai/blog/multi-agent-coordination-strategies)
- [Why I Stopped Using Provider-Specific LLM SDKs — Medium](https://yonahdissen.medium.com/why-i-stopped-using-provider-specific-llm-sdks-and-why-you-should-too-3943ac13fe60)
- [Multi-Provider LLM Integration — Aider DeepWiki](https://deepwiki.com/Aider-AI/aider/6.3-multi-provider-llm-integration)
- [Rate Limiting and Backpressure for LLM APIs — dasroot.net (Feb 2026)](https://dasroot.net/posts/2026/02/rate-limiting-backpressure-llm-apis/)
- [Who speaks next? Turn-taking in Multi-Party AI Discussion — Frontiers in AI 2025](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1582287/full)
- [LLM Security Risks in 2026: Prompt Injection — sombrainc](https://sombrainc.com/blog/llm-security-risks-2026)

---
*Pitfalls research for: Multi-agent AI chat room (Agents Room project)*
*Researched: 2026-03-19*
