# Requirements: Agents Room

**Defined:** 2026-03-21
**Core Value:** Agents must have meaningful conversations that produce genuinely useful insights — the room is only valuable if agent collaboration yields better outcomes than talking to one agent alone

## v1.1 Requirements

Requirements for v1.1 milestone. Each maps to roadmap phases.

### Conversation Quality

- [x] **QUAL-01**: Agents maintain distinct epistemic stances throughout conversation
- [x] **QUAL-02**: System injects anti-agreement prompts before round 2+
- [x] **QUAL-03**: Topic-lock reminders injected every N turns to prevent drift

### Cost Estimation

- [x] **COST-01**: User sees estimated cost per room based on model pricing
- [ ] **COST-02**: Cost updates in real-time as tokens stream
- [x] **COST-03**: Unknown models display "—" instead of $0.00

### Parallel First Round

- [ ] **PARA-01**: User can enable parallel first round per room (config toggle)
- [ ] **PARA-02**: All agents respond independently in round 1 without seeing peers
- [ ] **PARA-03**: Round 1 responses display in correct order after all complete

### Convergence Detection

- [ ] **CONV-01**: System detects consensus via cross-agent similarity + agreement phrases
- [ ] **CONV-02**: Auto-pause triggers only after minimum 6 turns
- [ ] **CONV-03**: System message explains why conversation was paused

### Tech Debt

- [ ] **DEBT-01**: Remove orphaned ConversationPanel.tsx
- [ ] **DEBT-02**: Fix test file TypeScript errors
- [ ] **DEBT-03**: Narrow room detail endpoint to avoid over-fetching

## Future Requirements

Deferred beyond v1.1. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: User receives in-app notification when conversation pauses or completes
- **NOTF-02**: User receives notification when token spend exceeds threshold

### Advanced Export

- **EXPO-01**: User can export conversation with cost breakdown
- **EXPO-02**: User can export agent configurations as shareable templates

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Dynamic pricing via external API | Pricing changes infrequently; API adds latency and failure mode. Static table sufficient. |
| LLM-as-judge for convergence | Doubles API cost per round. Jaccard + phrase detection is cheaper and sufficient. |
| Streaming parallel first round | Multiple simultaneous streams confuse UX. Buffer-then-display is cleaner. |
| Semantic embedding for convergence | Requires local embedding model or extra API call. Jaccard is good enough. |
| Per-agent cost breakdown | Marginal value over room total. Defer to future if requested. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUAL-01 | Phase 7 | Complete |
| QUAL-02 | Phase 7 | Complete |
| QUAL-03 | Phase 7 | Complete |
| COST-01 | Phase 8 | Complete |
| COST-02 | Phase 8 | Pending |
| COST-03 | Phase 8 | Complete |
| CONV-01 | Phase 9 | Pending |
| CONV-02 | Phase 9 | Pending |
| CONV-03 | Phase 9 | Pending |
| PARA-01 | Phase 10 | Pending |
| PARA-02 | Phase 10 | Pending |
| PARA-03 | Phase 10 | Pending |
| DEBT-01 | Phase 11 | Pending |
| DEBT-02 | Phase 11 | Pending |
| DEBT-03 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
