# Requirements: Agents Room

**Defined:** 2026-03-21
**Core Value:** Agents must have meaningful conversations that produce genuinely useful insights — the room is only valuable if agent collaboration yields better outcomes than talking to one agent alone

## v1.2 Requirements

Requirements for Agent Management milestone. Each maps to roadmap phases.

### Agent Editing

- [ ] **EDIT-01**: User can edit any field of an existing agent (name, role, personality, rules, constraints, provider, model, avatar)
- [ ] **EDIT-02**: Edit form shows copy-on-assign warning: "Editing this agent won't affect rooms already using it"
- [ ] **EDIT-03**: Agent library updates immediately after save without page reload

### Model Selection

- [ ] **MODL-01**: User can select model from a dropdown populated by the provider's available models
- [ ] **MODL-02**: Model picker includes search/filter for large model lists (OpenRouter 400+)
- [ ] **MODL-03**: Model picker falls back to free-text input when provider API is unreachable
- [ ] **MODL-04**: Provider connection status (connected/not configured) shown next to provider select
- [ ] **MODL-05**: Model capabilities shown as tags when available from provider API (e.g. vision, large context)

### Agent Presets

- [ ] **PRST-01**: User can create a new preset with agent configuration fields
- [ ] **PRST-02**: User can save an existing agent as a preset
- [ ] **PRST-03**: User can edit and delete presets
- [ ] **PRST-04**: System presets (Devil's Advocate, Code Reviewer, Researcher) seeded into DB

### Provider Management

- [ ] **PROV-01**: Dedicated /providers page with full CRUD for provider API keys
- [ ] **PROV-02**: Provider management moved out of Settings page

### Agent Notes

- [ ] **NOTE-01**: User can add/edit notes on any agent to describe purpose and strengths
- [ ] **NOTE-02**: Notes visible on agent card in the library view

## Future Requirements

### Deferred from Research

- **DEFER-01**: Agent versioning — track history of prompt changes per agent
- **DEFER-02**: Agent import/export as JSON — share configs across instances
- **DEFER-03**: Bulk agent operations — delete multiple, assign multiple to room
- **DEFER-04**: Room agent editing — edit room-specific copy without touching library
- **DEFER-05**: Agent tags/categories — organize larger libraries

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-save on blur | Partial saves during multi-field edits cause invalid states |
| Real-time model list refresh | Provider APIs can be slow/rate-limited; fetch once + manual refresh |
| Sync library edits to room agents | Breaks copy-on-assign design; room conversations would mutate mid-run |
| Live typeahead against provider API | Rate limiting and latency make this impractical; filter client-side |
| Settings page redesign | No concrete settings to add yet; defer until needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDIT-01 | Phase 13 | Pending |
| EDIT-02 | Phase 13 | Pending |
| EDIT-03 | Phase 13 | Pending |
| MODL-01 | Phase 14 | Pending |
| MODL-02 | Phase 14 | Pending |
| MODL-03 | Phase 14 | Pending |
| MODL-04 | Phase 14 | Pending |
| MODL-05 | Phase 14 | Pending |
| PRST-01 | Phase 15 | Pending |
| PRST-02 | Phase 15 | Pending |
| PRST-03 | Phase 15 | Pending |
| PRST-04 | Phase 15 | Pending |
| PROV-01 | Phase 14 | Pending |
| PROV-02 | Phase 14 | Pending |
| NOTE-01 | Phase 12 | Pending |
| NOTE-02 | Phase 12 | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
