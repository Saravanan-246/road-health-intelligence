# Team Workspace Setup — TECHKATHON 2026 SC-S03

**Project:** Smartphone-Based Road Health Intelligence  
**Date:** 2026-09-29  
**Status:** ✅ Team structure and ownership contracts established

---

## Summary

Three developers have been assigned clear, non-overlapping responsibilities with documented contracts. The existing `src/` application code remains untouched; the `team/` directory provides organizational structure and integration documentation.

---

## Team Assignments

### 1. Dhanush — Frontend (Mobile UX)
**Owner:** Home screen, reporting flow, navigation  
**Primary files:**
- `src/screens/HomeScreen.tsx`
- Report flow UI components
- Navigation state management

**Responsibility:** User-facing mobile experience for reporting road problems  
**Contact:** See `team/dhanush/frontend/README.md`

---

### 2. Dharshna — Frontend (Defect Intelligence UI)
**Owner:** Defect detail, evidence, duplicate review, priority breakdown  
**Primary files:**
- `src/screens/DefectScreen.tsx`
- Defect intelligence UI components
- Evidence/observation visualization
- Duplicate analysis result display

**Responsibility:** Defect detail screens and evidence-based decision presentation  
**Contact:** See `team/dharshna/frontend/README.md`

---

### 3. Saravanan — Backend (API, Database, Persistence)
**Owner:** FastAPI backend, database, REST API, persistence  
**Primary directory:**
- `backend/` (to be created)

**Responsibility:** Observation/defect persistence, API endpoints, data integrity  
**Contact:** See `team/saravanan/backend/README.md`

---

## Conflict Avoidance

| Scenario | Dhanush | Dharshna | Saravanan |
|---|---|---|---|
| Modifying HomeScreen | ✅ Primary owner | ❌ Do not touch | N/A |
| Modifying DefectScreen | ❌ Do not touch | ✅ Primary owner | N/A |
| Creating new components | Discuss first | Discuss first | N/A |
| Modifying `src/services/` | Read-only | Read-only | ✅ Coordinate |
| Creating API endpoints | N/A | N/A | ✅ Primary owner |
| Database design | N/A | N/A | ✅ Primary owner |

**Rule:** If two developers need to edit the same file, stop and coordinate first.

---

## Shared Contracts (Read-Only Unless Agreed)

1. **[observation.contract.md](contracts/observation.contract.md)**
   - One-time road report
   - Immutable evidence
   - Interface: `Observation`

2. **[defect.contract.md](contracts/defect.contract.md)**
   - Persistent defect record
   - Multiple observations = evidence
   - Interface: `CanonicalDefect`
   - Status lifecycle: CANDIDATE → CORROBORATED → VERIFIED → SCHEDULED → REPAIRED → RECURRED

3. **[duplicate.contract.md](contracts/duplicate.contract.md)**
   - MERGE / REVIEW / DISTINCT analysis
   - GPS gate + type agreement
   - Interface: `DuplicateAnalysis`

4. **[priority.contract.md](contracts/priority.contract.md)**
   - Deterministic 0–100 score
   - Engineered formula (5 factors, 35%/15%/20%/15%/15% weights)
   - Interface: `PriorityResult` with breakdown

5. **[api.contract.md](contracts/api.contract.md)**
   - REST API endpoints
   - Request/response schemas
   - Error handling

---

## Existing Application Structure

**Preserved (Do NOT modify):**
```
src/
├── types/defect.ts             ← Data model types
├── services/
│   ├── priorityService.ts      ← Pure priority function
│   ├── duplicateService.ts     ← Pure duplicate analysis
│   ├── locationService.ts      ← GPS + manual fallback
│   ├── detectionService.ts     ← Detection interface (stub ready)
│   └── defectService.ts        ← Defect/observation creation
├── screens/
│   ├── HomeScreen.tsx          ← Dhanush primary
│   ├── ReportScreen.tsx        ← Dhanush primary
│   └── DefectScreen.tsx        ← Dharshna primary
└── components/
    ├── DefectCard.tsx          ← Dhanush primary
    └── PriorityBadge.tsx       ← Dharshna primary

App.tsx                         ← Shared (navigation state)
```

---

## Team Workspace Structure

```
team/
├── dhanush/
│   └── frontend/
│       ├── screens/            ← Ownership documentation
│       ├── components/         ← Ownership documentation
│       ├── navigation/         ← Ownership documentation
│       └── README.md           ← Dhanush's responsibility doc
├── dharshna/
│   └── frontend/
│       ├── screens/            ← Ownership documentation
│       ├── components/         ← Ownership documentation
│       ├── services/           ← Ownership documentation
│       └── README.md           ← Dharshna's responsibility doc
├── saravanan/
│   └── backend/
│       ├── api/                ← Ownership documentation
│       ├── models/             ← Ownership documentation
│       ├── services/           ← Ownership documentation
│       ├── database/           ← Ownership documentation
│       ├── schemas/            ← Ownership documentation
│       └── README.md           ← Saravanan's responsibility doc
├── contracts/
│   ├── README.md               ← Master contract index
│   ├── observation.contract.md
│   ├── defect.contract.md
│   ├── duplicate.contract.md
│   ├── priority.contract.md
│   └── api.contract.md
├── intelligence/
│   └── README.md               ← Reserved for shared logic
└── SETUP_SUMMARY.md            ← This file
```

---

## Integration Flow

### Observation Creation (Dhanush → Saravanan)
1. Dhanush: User captures/selects image, enters location, classifies defect
2. Dhanush: Calls `POST /observations` with observation data
3. Saravanan: Runs duplicate analysis (contract: `duplicate.contract.md`)
4. Saravanan: Creates or merges defect record
5. Saravanan: Calculates priority (contract: `priority.contract.md`)
6. Dhanush: Receives defect ID; navigates to DefectScreen

### Defect Display (Saravanan → Dharshna)
1. Dharshna: Loads defect via `GET /defects/:id`
2. Saravanan: Returns CanonicalDefect with all observations and priority breakdown
3. Dharshna: Displays defect detail, evidence history, priority breakdown, status

### Duplicate Review (Dhanush ↔ Dharshna)
- Dhanush: Shows duplicate panel during report flow
- If REVIEW decision: User can see the existing defect candidate
- Dhanush: User chooses MERGE or DISTINCT
- Dharshna: Shows final evidence accumulation on DefectScreen

---

## Conflicts to Watch

### ✅ Prevented (Clear Ownership)
- Dhanush won't touch DefectScreen (Dharshna owns)
- Dharshna won't touch HomeScreen (Dhanush owns)
- Saravanan won't implement UI (backend only)

### ⚠️ Needs Coordination
- Both Dhanush and Dharshna use ReportScreen components
  - **Solution:** Dhanush owns report flow; Dharshna adds duplicate panel in ReportScreen (coordinate)
- Both use shared services (priority, duplicate, location)
  - **Solution:** Read-only; discuss before changing signatures
- All three depend on contracts
  - **Solution:** Update contracts with team agreement before modifying

---

## Communication Protocol

1. **Before modifying shared files:** Open an issue or discussion
2. **Before changing contract interfaces:** Get team agreement
3. **Before starting implementation:** Confirm no overlap with other developer
4. **Pull requests:** Require code review from at least one other team member

---

## Files Created

**Ownership READMEs:**
- `team/dhanush/frontend/README.md`
- `team/dharshna/frontend/README.md`
- `team/saravanan/backend/README.md`

**Contracts:**
- `team/contracts/README.md` (master index + ownership matrix)
- `team/contracts/observation.contract.md`
- `team/contracts/defect.contract.md`
- `team/contracts/duplicate.contract.md`
- `team/contracts/priority.contract.md`
- `team/contracts/api.contract.md`

**Intelligence:**
- `team/intelligence/README.md`

---

## First Implementation Tasks

### Dhanush (Frontend — Mobile UX)
1. Ensure HomeScreen displays defects from app state
2. Build Report flow UI (image picker, location, type/severity selection)
3. Integrate with duplicate review panel
4. Test end-to-end: Report → Defect created → Shown in list

### Dharshna (Frontend — Defect Intelligence UI)
1. Implement DefectScreen component (display defect detail)
2. Build priority breakdown visualization
3. Build observation evidence card list
4. Integrate duplicate analysis result display
5. Test: Tap defect card → see full detail with evidence

### Saravanan (Backend — Persistence)
1. Set up FastAPI + SQLAlchemy + database
2. Implement Observation and CanonicalDefect models
3. Create `/observations` POST endpoint
4. Implement duplicate analysis logic (reference `duplicate.contract.md`)
5. Implement priority calculation (reference `priority.contract.md`)
6. Create `/defects` GET and `/defects/:id` GET endpoints
7. Test: Mobile POST → backend stores → GET retrieves correctly

---

## Git Setup

**Recommended branches:**
- `main` — Stable, tested
- `feature/dhanush-frontend` — Dhanush's work
- `feature/dharshna-frontend` — Dharshna's work
- `feature/saravanan-backend` — Saravanan's work

**Rule:** Always create a pull request before merging to main.

---

## Important Notes

✅ **Existing application preserved:** All `src/` code unchanged  
✅ **No duplicate projects:** One codebase, clear ownership  
✅ **No packages installed:** Team ready to implement  
✅ **Contracts documented:** Integration points explicit  
❌ **Features NOT implemented:** Only structure established  
❌ **Backend NOT created:** Saravanan starts fresh  
❌ **Database NOT initialized:** Schema TBD  

---

## Next Step

Each developer reads their assigned README:
- Dhanush: `team/dhanush/frontend/README.md`
- Dharshna: `team/dharshna/frontend/README.md`
- Saravanan: `team/saravanan/backend/README.md`

Then: Start implementation following first tasks above.

---

**Team workspace ready for TECHKATHON 2026. Let's build! 🚀**
