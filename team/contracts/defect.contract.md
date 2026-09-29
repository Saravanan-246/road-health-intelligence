# CanonicalDefect Contract

**Owner:** Backend (Saravanan)  
**Consumer:** Frontend (Dhanush, Dharshna), Intelligence Layer  
**Status:** Agreed

## Definition

A **CanonicalDefect** is the persistent truth record for one physical road problem. Multiple observations are its evidence.

## Interface

```typescript
interface CanonicalDefect {
  // Unique identifier
  id: string;
  
  // Defect type (unanimous across merged observations)
  defectType: 'POTHOLE' | 'CRACK' | 'RUTTING' | 'SURFACE_WEAR' | 'OTHER';
  
  // Geo location (mean of all observations)
  latitude: number;
  longitude: number;
  
  // All evidence for this defect
  observations: Observation[];
  
  // Lifecycle status
  status: 'CANDIDATE' | 'CORROBORATED' | 'VERIFIED' | 'SCHEDULED' | 'REPAIRED' | 'RECURRED';
  
  // Priority score (0–100)
  priority: number;
  
  // Priority factor breakdown (for display)
  priorityBreakdown: {
    severity: { value: number; weight: number; points: number; note: string };
    confidence: { value: number; weight: number; points: number; note: string };
    observationSupport: { value: number; weight: number; points: number; note: string };
    recency: { value: number; weight: number; points: number; note: string };
    roadContext: { value: number; weight: number; points: number; note: string };
  };
}
```

## Status Lifecycle

```
CANDIDATE (1 observation)
    ↓
CORROBORATED (2+ observations, evidence strong)
    ↓
VERIFIED (human review confirmed)
    ↓
SCHEDULED (repair scheduled)
    ↓
REPAIRED (repair completed)
    ↓
RECURRED (defect reappeared after repair)
```

## Rules

1. **Auto-derived statuses:** CANDIDATE → CORROBORATED based on observation count
2. **Workflow-driven statuses:** VERIFIED, SCHEDULED, REPAIRED, RECURRED set by backend workflow (not auto)
3. **Location:** Recomputed as mean of all observations whenever a new observation is added
4. **Priority:** Recalculated whenever observations change or status changes
5. **Immutability of observations:** Individual observations never change once created; defect can accumulate more

## Creation Flow

1. Backend receives first Observation via POST `/observations`
2. Duplicate analysis determines: MERGE into existing defect OR CREATE new defect
3. If CREATE: New CanonicalDefect with status CANDIDATE
4. If MERGE: Add observation to existing defect, recalculate priority, update status if 2+ observations

## Frontend Display

- **Dhanush (HomeScreen):** Show defect card with ID, type, status, location, observation count, priority badge
- **Dharshna (DefectScreen):** Show full defect record with all observations, priority breakdown, lifecycle status

## Backend Persistence

- Store in database
- Never delete (consider archived/inactive status instead)
- Track creation timestamp and last-updated timestamp
- Maintain audit trail of status changes
