# Roadmap: Agents Room

## Milestones

- ✅ **v1.0 Agents Room MVP** — Phases 1-6 (shipped 2026-03-20)
- ✅ **v1.1 Conversation Quality & Polish** — Phases 7-11 (shipped 2026-03-21)
- 🚧 **v1.2 Agent Management** — Phases 12-15 (in progress)

## Phases

<details>
<summary>✅ v1.0 Agents Room MVP (Phases 1-6) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-19
- [x] Phase 2: Conversation Engine (3/3 plans) — completed 2026-03-19
- [x] Phase 3: Real-Time UI (3/3 plans) — completed 2026-03-20
- [x] Phase 4: Insights (3/3 plans) — completed 2026-03-20
- [x] Phase 5: Foundation Verification (1/1 plans) — completed 2026-03-20
- [x] Phase 6: Room Configuration UI (2/2 plans) — completed 2026-03-20

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Conversation Quality & Polish (Phases 7-11) — SHIPPED 2026-03-21</summary>

- [x] Phase 7: Conversation Quality (2/2 plans) — completed 2026-03-20
- [x] Phase 8: Cost Estimation (2/2 plans) — completed 2026-03-20
- [x] Phase 9: Convergence Detection (2/2 plans) — completed 2026-03-20
- [x] Phase 10: Parallel First Round (3/3 plans) — completed 2026-03-21
- [x] Phase 11: Tech Debt Cleanup (2/2 plans) — completed 2026-03-21

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.2 Agent Management (In Progress)

**Milestone Goal:** Make agents fully manageable — edit existing agents, pick models from a live provider dropdown, manage reusable presets, and annotate agents with notes. Providers get a dedicated page out of Settings.

## Phases

- [ ] **Phase 12: Agent Notes + Store Foundation** - Add notes field to agents table and fix missing updateAgent store action
- [ ] **Phase 13: Agent Editing** - Dual-mode AgentForm enables editing any field on an existing agent
- [ ] **Phase 14: Providers Page + Model Picker** - Dedicated /providers page and live model dropdown in AgentForm
- [ ] **Phase 15: Presets CRUD** - Create, save, edit, and delete agent presets with three seeded system presets

## Phase Details

### Phase 12: Agent Notes + Store Foundation
**Goal**: Agents can be annotated with notes visible in the library, and the store can update agents without a page reload
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: NOTE-01, NOTE-02
**Success Criteria** (what must be TRUE):
  1. User can type and save a notes field on any agent (create or edit form)
  2. Notes text is visible on the agent card in the library without clicking into the agent
  3. Saving a notes change updates the agent card immediately without a page reload
  4. An agent with no notes shows no notes section on its card (graceful empty state)
**Plans**: 2 plans

Plans:
- [ ] 12-01: Schema migration — add nullable notes column to agents table; extend Zod schemas; add updateAgent to agentStore
- [ ] 12-02: Notes UI — notes textarea in AgentForm (create mode); notes display on AgentCard

### Phase 13: Agent Editing
**Goal**: Users can update any field on an existing agent and see the change reflected in the library immediately
**Depends on**: Phase 12
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. User can click Edit on any agent card and open a pre-populated form with all current field values
  2. Saving the edit form updates the agent in the library immediately without a page reload
  3. The edit form shows a visible banner: "Editing this agent won't affect rooms already using it"
  4. User can edit every field: name, role, personality, rules, constraints, provider, model, avatar, and notes
**Plans**: TBD

Plans:
- [ ] 13-01: Edit route and AgentForm dual-mode — /agents/[agentId]/edit page; AgentForm accepts initialData prop; Edit button on AgentCard
- [ ] 13-02: Edit UX polish — copy-on-assign disclosure banner; notes field active in edit mode; store sync on save

### Phase 14: Providers Page + Model Picker
**Goal**: Provider keys have a dedicated management page and agent model selection uses a live dropdown instead of free-text input
**Depends on**: Phase 13
**Requirements**: PROV-01, PROV-02, MODL-01, MODL-02, MODL-03, MODL-04, MODL-05
**Success Criteria** (what must be TRUE):
  1. Navigating to /providers shows full CRUD for all provider API keys (replaces Settings page provider section)
  2. Provider management is absent from the Settings page
  3. The model field in AgentForm is a dropdown populated by fetching the selected provider's available models
  4. Typing in the model dropdown filters the list client-side (handles OpenRouter's 400+ models)
  5. When a provider API is unreachable, the model field falls back to free-text input with no silent failure
  6. Provider connection status (configured / not configured) is shown next to the provider selector in AgentForm
  7. Model capability tags (e.g., vision, large context) appear next to model names when the provider API returns them
**Plans**: TBD

Plans:
- [ ] 14-01: providerStore + /providers page — Zustand providerStore; /providers route reusing ProviderCard; Sidebar link; Settings redirect
- [ ] 14-02: /api/providers/[provider]/models route + model-fetcher — server-side proxy; per-provider adapters; 5s timeout; static fallback
- [ ] 14-03: Model combobox in AgentForm — replace text input with combobox; loading state; fallback to free-text; provider status indicator; capability tags

### Phase 15: Presets CRUD
**Goal**: Users can create, save, edit, and delete reusable agent presets; three system presets are available out of the box
**Depends on**: Phase 13
**Requirements**: PRST-01, PRST-02, PRST-03, PRST-04
**Success Criteria** (what must be TRUE):
  1. Three system presets (Devil's Advocate, Code Reviewer, Researcher) are available in the presets list on first run
  2. User can create a new preset by filling in agent configuration fields and saving it as a preset
  3. User can save an existing agent's current configuration as a preset from the agent edit form
  4. User can edit the name and configuration fields of any user-created preset
  5. User can delete any user-created preset; system presets cannot be deleted
**Plans**: TBD

Plans:
- [ ] 15-01: Presets schema + API — new presets DB table; seed 3 system presets; GET/POST /api/presets; PUT/DELETE /api/presets/[id]
- [ ] 15-02: Presets management UI — preset list page or panel; create/edit/delete UI; "Save as preset" action on agent edit form; apply-preset confirmation dialog

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-19 |
| 2. Conversation Engine | v1.0 | 3/3 | Complete | 2026-03-19 |
| 3. Real-Time UI | v1.0 | 3/3 | Complete | 2026-03-20 |
| 4. Insights | v1.0 | 3/3 | Complete | 2026-03-20 |
| 5. Foundation Verification | v1.0 | 1/1 | Complete | 2026-03-20 |
| 6. Room Configuration UI | v1.0 | 2/2 | Complete | 2026-03-20 |
| 7. Conversation Quality | v1.1 | 2/2 | Complete | 2026-03-20 |
| 8. Cost Estimation | v1.1 | 2/2 | Complete | 2026-03-20 |
| 9. Convergence Detection | v1.1 | 2/2 | Complete | 2026-03-20 |
| 10. Parallel First Round | v1.1 | 3/3 | Complete | 2026-03-21 |
| 11. Tech Debt Cleanup | v1.1 | 2/2 | Complete | 2026-03-21 |
| 12. Agent Notes + Store Foundation | 1/2 | In Progress|  | - |
| 13. Agent Editing | v1.2 | 0/2 | Not started | - |
| 14. Providers Page + Model Picker | v1.2 | 0/3 | Not started | - |
| 15. Presets CRUD | v1.2 | 0/2 | Not started | - |
