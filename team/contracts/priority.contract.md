# Priority Scoring Contract

**Owner:** Intelligence Layer (TBD; coordinate Dhanush/Dharshna/Saravanan)  
**Consumer:** Backend (calculation), Frontend (display)  
**Status:** Engineered weights; ready for tuning

## Definition

**Priority** is a deterministic, explainable score (0–100) that ranks which defects should be repaired first. No AI/ML; pure engineering formula.

## Formula

```
Priority = 0.35×severity + 0.15×confidence + 0.20×observationSupport
         + 0.15×recency + 0.15×roadContext
```

All factors normalized to 0–1 before weighting.

## Factors

### Severity (35%)
**Input:** Worst severity observed across all observations  
**Mapping:**
```
LOW → 0.25
MEDIUM → 0.50
HIGH → 0.75
SEVERE → 1.00
```
**Rationale:** Direct impact on safety/ride comfort

### Confidence (15%)
**Input:** Highest detector confidence among observations (if model-classified); else neutral  
**Mapping:**
```
Model result: use confidence value (0–1)
Reporter-classified: 0.50 (neutral)
No classification yet: 0.50 (neutral)
```
**Rationale:** More evidence of a defect → higher urgency

### Observation Support (20%)
**Input:** Number of distinct observations corroborating the defect  
**Mapping:**
```
1 observation → 1 ÷ 5 = 0.20
2 observations → 2 ÷ 5 = 0.40
3 observations → 3 ÷ 5 = 0.60
5+ observations → 1.00 (saturates)
```
**Rationale:** Multiple reports = established defect, not one-off

### Recency (15%)
**Input:** Time since most recent observation  
**Mapping:**
```
Exponential decay with half-life 14 days:
value = 0.5 ^ (ageDays ÷ 14)

0 days → 1.00
7 days → 0.71
14 days → 0.50
28 days → 0.25
```
**Rationale:** Newer defects may worsen faster; old defects may have healed

### Road Context (15%)
**Input:** Road type, traffic volume, municipal priority (TBD)  
**Mapping:**
```
Currently: default 0.50 (neutral)
Future: incorporate road class / traffic data
```
**Rationale:** High-traffic roads need faster repair

## Tier Classification

```
Score ≥ 75 → Critical (repair ASAP)
Score ≥ 55 → High (urgent)
Score ≥ 35 → Medium (schedule soon)
Score < 35 → Low (backlog)
```

## Frontend Display (Dharshna)

Show:
- Overall score (0–100)
- Tier label (Critical / High / Medium / Low)
- Breakdown table showing each factor, its value, weight, and contribution
- Clear note: "Deterministic engineering formula; weights are configurable"

## Configuration

```python
PRIORITY_CONFIG = {
  severityValue: { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, SEVERE: 1 },
  unknownConfidence: 0.5,
  supportSaturation: 5,
  recencyHalfLifeDays: 14,
  defaultRoadContext: 0.5,
  tiers: { critical: 75, high: 55, medium: 35 },
}

PRIORITY_WEIGHTS = {
  severity: 0.35,
  confidence: 0.15,
  observationSupport: 0.20,
  recency: 0.15,
  roadContext: 0.15,
}
```

## Important

- **NOT** learned from real repair data (yet)
- **NOT** an official government formula
- **Engineering choice:** Each weight is a knob to tune

## Recalculation Trigger

- New observation added
- Defect status changes
- (Future) Road context data updated
- (Future) Municipal priorities updated

## Backend Responsibility (Saravanan)

- Implement pure calculation function
- Recalculate whenever needed
- Store breakdown with defect for audit trail
- Expose weights via config/admin endpoint for tuning
