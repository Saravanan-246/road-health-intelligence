# Team Contracts

This directory documents shared contracts between team members and layers.

**Purpose:** Prevent conflicts by making integration points explicit.  
**Rule:** Before modifying any contract, discuss with team and update all references.

---

## Contract Index

### Data Models
- **[observation.contract.md](observation.contract.md)** — One road report (mobile → backend)
- **[defect.contract.md](defect.contract.md)** — One persistent defect record (backend → frontend)

### Business Logic
- **[duplicate.contract.md](duplicate.contract.md)** — MERGE/REVIEW/DISTINCT analysis
- **[priority.contract.md](priority.contract.md)** — Deterministic 0–100 score

### Integration
- **[api.contract.md](api.contract.md)** — REST endpoints (backend → mobile)

---

## Developer Responsibilities

| Responsibility | Developer | Primary Code | Notes |
|---|---|---|---|
| **Mobile UX** | Dhanush | `src/screens/HomeScreen.tsx`<br>`src/components/`<br>`navigation/` | Do not modify DefectScreen or intelligence UI |
| **Defect Intelligence UI** | Dharshna | `src/screens/DefectScreen.tsx`<br>Evidence/duplicate/priority UI | Do not modify HomeScreen or report flow |
| **Backend / API** | Saravanan | `backend/` (FastAPI)<br>Database<br>Persistence | Do not implement frontend UI |

---

## Shared Code

These files are read-only unless discussed first:

- `src/types/defect.ts` — Data model types (contract enforcement)
- `src/services/priorityService.ts` — Priority calculation (pure function)
- `src/services/duplicateService.ts` — Duplicate analysis (pure function)
- `src/services/locationService.ts` — GPS + fallback
- `src/services/detectionService.ts` — Detection interface (stub)

**Rule:** Before changing any shared service signature, open an issue/discussion.

---

## File Ownership Matrix

```
src/
├── types/
│   └── defect.ts                           SHARED (read-only unless agreed)
├── services/
│   ├── priorityService.ts                  SHARED (pure function)
│   ├── duplicateService.ts                 SHARED (pure function)
│   ├── locationService.ts                  SHARED (read-only)
│   ├── detectionService.ts                 SHARED (interface stub)
│   └── defectService.ts                    SHARED (creation logic)
├── screens/
│   ├── HomeScreen.tsx                      DHANUSH (primary)
│   ├── ReportScreen.tsx                    DHANUSH (primary)
│   └── DefectScreen.tsx                    DHARSHNA (primary)
├── components/
│   ├── DefectCard.tsx                      DHANUSH (primary)
│   ├── PriorityBadge.tsx                   DHARSHNA (primary)
│   └── [new components]                    Agree before creating
└── utils/
    └── distance.ts                         SHARED (read-only)

App.tsx                                     SHARED (navigation state)
```

---

## Integration Points

### Dhanush ↔ Dharshna
- **Handoff:** HomeScreen → DefectScreen (via navigation)
- **Data:** Defect list from app state
- **Rule:** Dhanush does NOT modify DefectScreen; Dharshna does NOT modify HomeScreen

### Dhanush ↔ Saravanan
- **Handoff:** Mobile POST /observations → Backend
- **Data:** Image, location, classification
- **Contract:** observation.contract.md

### Dharshna ↔ Saravanan
- **Handoff:** GET /defects/:id → Display full record
- **Data:** Defect, observations, priority breakdown, status
- **Contract:** defect.contract.md

### All Three ↔ Intelligence Layer
- **Duplicate Analysis:** Backend runs; frontend displays
- **Priority Scoring:** Backend calculates; frontend displays breakdown
- **Contracts:** duplicate.contract.md, priority.contract.md

---

## Conflict Resolution

**If two developers need the same file:**

1. **Stop.** Do not both edit.
2. **Discuss.** Determine if you can split responsibility or if it's truly shared.
3. **Document.** Add to this README if new shared space needed.
4. **Implement.** One developer, or coordinate pull requests.

---

## Git Branches

- `main` — Stable, tested code
- `feature/dhanush-frontend` — Dhanush's work
- `feature/dharshna-frontend` — Dharshna's work
- `feature/saravanan-backend` — Saravanan's work

**Rule:** Always create a pull request for review before merging to main.

---

## Communication

Use these channels:
- **Code:** Comments and docstrings in shared files
- **Decisions:** Update contracts and README
- **Questions:** Open an issue / discussion

---

## Version Control

Current contract versions:
- Observation: 1.0 (stable)
- CanonicalDefect: 1.0 (stable)
- Duplicate Analysis: 1.0 (architecture ready; logic TBD)
- Priority: 1.0 (formula agreed; weights may tune)
- API: 1.0 (MVP endpoints; future endpoints TBD)
