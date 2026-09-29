# REST API Contract

**Owner:** Backend (Saravanan)  
**Consumer:** Mobile Frontend (Dhanush, Dharshna)  
**Status:** MVP endpoints finalized; extension endpoints TBD

## Base URL
```
http://[backend-host]:[port]/api
```

## Core Endpoints (MVP)

### 1. Create Observation
```
POST /observations
Content-Type: application/json

Request:
{
  "imageUri": "file:///storage/.../photo.jpg",
  "defectType": "POTHOLE",
  "severity": "HIGH",
  "confidence": 0.87,
  "classificationSource": "MODEL",
  "latitude": 12.96,
  "longitude": 77.64,
  "accuracyMeters": 5.2,
  "locationSource": "DEVICE",
  "timestamp": 1727619234567
}

Response (201 Created):
{
  "defectId": "RD-a1b2c3d4",
  "defect": { ... CanonicalDefect ... }
}
```

**Logic:**
1. Run duplicate analysis
2. If MERGE: Add to existing defect, recalculate priority
3. If DISTINCT or REVIEW: Create new defect
4. Return defect record to mobile

---

### 2. List Defects
```
GET /defects?status=ACTIVE&sort=priority&limit=50&offset=0

Response (200 OK):
{
  "defects": [
    {
      "id": "RD-a1b2c3d4",
      "defectType": "POTHOLE",
      "latitude": 12.96,
      "longitude": 77.64,
      "status": "CORROBORATED",
      "priority": 78,
      "observationCount": 3,
      "lastUpdated": 1727619234567
    },
    ...
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Query params:**
- `status`: Filter by status (CANDIDATE, CORROBORATED, VERIFIED, SCHEDULED, REPAIRED, RECURRED)
- `sort`: Sort by priority (default), recency, distance
- `limit`, `offset`: Pagination

---

### 3. Get Defect Detail
```
GET /defects/:id

Response (200 OK):
{
  "id": "RD-a1b2c3d4",
  "defectType": "POTHOLE",
  "latitude": 12.96,
  "longitude": 77.64,
  "status": "CORROBORATED",
  "priority": 78,
  "priorityBreakdown": {
    "severity": { "value": 0.75, "weight": 0.35, "points": 26.25, "note": "..." },
    "confidence": { "value": 0.87, "weight": 0.15, "points": 13.05, "note": "..." },
    ...
  },
  "observations": [
    { id: "OB-...", timestamp: ..., defectType: "POTHOLE", severity: "HIGH", ... },
    { id: "OB-...", timestamp: ..., defectType: "POTHOLE", severity: "MEDIUM", ... },
  ]
}
```

---

### 4. Add Observation to Defect
```
POST /defects/:id/observations
Content-Type: application/json

Request:
{
  "imageUri": "file:///storage/.../photo2.jpg",
  "defectType": "POTHOLE",
  "severity": "MEDIUM",
  "confidence": 0.65,
  "classificationSource": "REPORTER",
  "latitude": 12.960,
  "longitude": 77.641,
  "accuracyMeters": 8.0,
  "locationSource": "DEVICE",
  "timestamp": 1727619450123
}

Response (200 OK):
{
  "defectId": "RD-a1b2c3d4",
  "defect": { ... updated CanonicalDefect ... },
  "duplicateAnalysis": {
    "decision": "MERGE",
    "score": 0.88,
    "distanceMeters": 4.5,
    "reasons": ["GPS distance 4.5 m within gate", "Defect type matches", ...]
  }
}
```

**Logic:**
- Verify observation belongs to this defect
- Recalculate priority
- Update status if needed (1→2 observations = CANDIDATE→CORROBORATED)

---

### 5. Update Defect Status
```
PATCH /defects/:id/status
Content-Type: application/json

Request:
{
  "status": "VERIFIED"  // or SCHEDULED, REPAIRED, RECURRED
}

Response (200 OK):
{
  "id": "RD-a1b2c3d4",
  "status": "VERIFIED",
  "updatedAt": 1727619500000
}
```

**Allowed transitions:**
- CANDIDATE → CORROBORATED (automatic on 2+ observations)
- CORROBORATED → VERIFIED (manual)
- VERIFIED → SCHEDULED (manual)
- SCHEDULED → REPAIRED (manual)
- REPAIRED → RECURRED (if new observation)

---

## Error Responses

```
400 Bad Request:
{
  "error": "Invalid request",
  "details": "latitude must be between -90 and 90"
}

404 Not Found:
{
  "error": "Defect not found",
  "id": "RD-a1b2c3d4"
}

500 Internal Server Error:
{
  "error": "Server error",
  "requestId": "req-12345"
}
```

---

## Future Endpoints (Not MVP)

### Duplicate Analysis Endpoint
```
POST /analyze-duplicate
→ { decision, score, distanceMeters, reasons }
```
(Currently embedded in POST /observations)

### Priority Recalculation
```
POST /defects/:id/recalculate-priority
→ { priority, breakdown }
```
(Currently automatic)

### Map/Spatial Queries
```
GET /defects/spatial?lat=12.96&lon=77.64&radiusMeters=500
→ { defects: [...] within radius }
```

### Analytics
```
GET /analytics/defect-density
GET /analytics/repair-rate
GET /analytics/priority-distribution
```

---

## Authorization

**MVP:** No authentication; internal API only.  
**Future:** Add API keys or OAuth tokens.

## Rate Limiting

**MVP:** None.  
**Future:** Implement based on mobile user behavior.

## Versioning

All endpoints prefixed with `/api` (not `/api/v1` yet).  
Breaking changes require endpoint version bump.
