# Duplicate Analysis Contract

**Owner:** Intelligence Layer (TBD; coordinate Dhanush/Dharshna/Saravanan)  
**Consumer:** Backend (for merge logic), Frontend (for display)  
**Status:** Architecture ready

## Definition

**Duplicate Analysis** determines if a new observation is evidence for an existing defect (MERGE), requires human review (REVIEW), or is a new problem (DISTINCT).

## Interface

```typescript
interface DuplicateAnalysis {
  decision: 'MERGE' | 'REVIEW' | 'DISTINCT';
  score: number;           // 0–1; higher = more likely to be same defect
  distanceMeters: number;  // Haversine distance between observation and defect
  reasons: string[];       // Human-readable explanation of decision
}
```

## Decision Logic (MVP)

### GPS Candidate Gate
- Compute Haversine distance between observation and existing defect
- Base radius: 15 m
- Add uncertainty: `Math.hypot(observation.accuracy, defect.best_accuracy)`
- Max uncertainty inflation: ±25 m
- **Fail gate → DISTINCT**

### Defect-Type Agreement
- If observation type matches defect type: +evidence
- If types differ: blocks auto-merge (→ REVIEW instead of MERGE)

### Evidence Scoring
- Spatial: 55% weight (distance within gate)
- Defect-type: 45% weight (match/mismatch)
- Score = weighted average

### Decision Rules
```
if score >= 0.75 AND type_match AND low_uncertainty
  → MERGE (automatic)
else if score >= 0.45
  → REVIEW (human decides)
else
  → DISTINCT (new defect)
```

## Future Extensions (Not MVP)

- Visual similarity (compare image embeddings)
- Road segment matching (check if same road segment)
- Historical patterns (defect recurrence)
- Temporal clustering (observations close in time)

## Frontend Display (Dharshna)

Show user:
- Decision (MERGE / REVIEW / DISTINCT)
- Score (0–100)
- Distance from existing defect
- Reasons (list of analysis steps)
- Action button: "Add as evidence" or "Create new defect"

## Backend Responsibility (Saravanan)

- Implement duplicate analysis when observation POST arrives
- If MERGE: automatically add to defect, update priority
- If REVIEW: flag for human review (TBD workflow)
- If DISTINCT: create new defect
- Return result to frontend for confirmation if needed

## Configuration

All thresholds in one place; adjustable without code change:

```
DUPLICATE_CONFIG = {
  candidateRadiusMeters: 15,
  maxUncertaintyInflationMeters: 25,
  unknownAccuracyMeters: 30,
  maxUncertaintyForAutoMergeMeters: 20,
  mergeScore: 0.75,
  reviewScore: 0.45,
  weights: { spatial: 0.55, defectType: 0.45, ... }
}
```
