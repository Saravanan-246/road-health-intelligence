# Backend Implementation Plan — Road Health Intelligence

**Engineer:** Saravanan  
**Status:** Pre-implementation plan (inspection complete)  
**Date:** 2026-09-29

---

## Phase 0: Inspection Findings

### Existing Project State

**Frontend (React Native + Expo):**
- ✅ Complete type definitions in `src/types/defect.ts`
- ✅ Pure business logic services ready:
  - `priorityService.ts` — Deterministic 0–100 scoring formula (5 factors, weights locked)
  - `duplicateService.ts` — MERGE/REVIEW/DISTINCT analysis (GPS gate + type match logic)
  - `locationService.ts` — GPS + manual fallback
  - `detectionService.ts` — Interface stub (ready to plug detector)
  - `defectService.ts` — Defect/observation creation
- ✅ UI screens: HomeScreen, ReportScreen, DefectScreen
- ✅ Reusable components: DefectCard, PriorityBadge

**Team Structure:**
- Dhanush: Frontend (HomeScreen, ReportScreen, navigation)
- Dharshna: Frontend (DefectScreen, intelligence UI)
- Saravanan: Backend (this implementation)

**Existing Contracts (Locked):**
- `team/contracts/observation.contract.md` — Observation interface + immutability rules
- `team/contracts/defect.contract.md` — CanonicalDefect + status lifecycle
- `team/contracts/duplicate.contract.md` — MERGE/REVIEW/DISTINCT logic + thresholds
- `team/contracts/priority.contract.md` — Scoring formula + weights (35/15/20/15/15)
- `team/contracts/api.contract.md` — REST endpoints, request/response schemas

**What Backend Owns:**
- Observation persistence
- Canonical defect persistence
- Duplicate analysis execution (using frontend logic as reference)
- Priority recalculation
- Status lifecycle management
- API endpoints
- Database migrations

### Type Definitions to Leverage

From `src/types/defect.ts`:

```typescript
// Enums
DefectType: 'POTHOLE' | 'CRACK' | 'RUTTING' | 'SURFACE_WEAR' | 'OTHER'
Severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE'
LocationSource: 'EXIF' | 'DEVICE' | 'MANUAL' | 'UNLOCATED'
ClassificationSource: 'MODEL' | 'REPORTER'
DefectStatus: 'CANDIDATE' | 'CORROBORATED' | 'VERIFIED' | 'SCHEDULED' | 'REPAIRED' | 'RECURRED'
DuplicateDecision: 'MERGE' | 'REVIEW' | 'DISTINCT'

// Key interfaces
Observation {
  id, imageUri, defectType, severity, confidence (0-1 or null),
  classificationSource, latitude, longitude, accuracyMeters,
  locationSource, timestamp
}

CanonicalDefect {
  id, defectType, latitude, longitude, observations[],
  status, priority (0-100), priorityBreakdown, priorityComputedAt
}

PriorityResult {
  score: number,
  breakdown: PriorityBreakdown { severity, confidence, observationSupport, recency, roadContext }
}

DuplicateAnalysis {
  decision, score, distanceMeters, reasons[]
}
```

### Locked Configuration Values

**Priority Weights & Config** (from `priorityService.ts`):
```python
PRIORITY_WEIGHTS = {
  'severity': 0.35,
  'confidence': 0.15,
  'observationSupport': 0.20,
  'recency': 0.15,
  'roadContext': 0.15,
}

PRIORITY_CONFIG = {
  'severityValue': { 'LOW': 0.25, 'MEDIUM': 0.5, 'HIGH': 0.75, 'SEVERE': 1 },
  'unknownConfidence': 0.5,
  'supportSaturation': 5,  # obs count at which support saturates to 1
  'recencyHalfLifeDays': 14,
  'defaultRoadContext': 0.5,
  'tiers': { 'critical': 75, 'high': 55, 'medium': 35 },  # score thresholds
}
```

**Duplicate Analysis Config** (from `duplicateService.ts`):
```python
DUPLICATE_CONFIG = {
  'candidateRadiusMeters': 15,
  'maxUncertaintyInflationMeters': 25,
  'unknownAccuracyMeters': 30,
  'maxUncertaintyForAutoMergeMeters': 20,
  'mergeScore': 0.75,
  'reviewScore': 0.45,
  'weights': { 'spatial': 0.55, 'defectType': 0.45, 'visual': 0.0, 'roadSegment': 0.0 },
}
```

---

## Phase 1: Architecture & Setup

### Stack Choice

**Technology Stack:**
- **Framework:** FastAPI (async, Pydantic validation, automatic OpenAPI docs)
- **ORM:** SQLAlchemy (declarative, flexible, tested)
- **Database:** SQLite for MVP (easy development; upgrade to PostgreSQL for production)
- **Server:** Uvicorn (ASGI server for FastAPI)
- **Validation:** Pydantic (schemas + automatic request validation)
- **Testing:** pytest + httpx

**Why these choices:**
- FastAPI is async-native and fast
- SQLAlchemy decouples database logic
- SQLite requires zero setup; schema migrations via Alembic
- Pydantic auto-validates incoming JSON against contracts
- pytest is industry standard

### Directory Structure

```
backend/
├── main.py                      # Entry point; app initialization
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── config.py            # Settings (DB URL, debug mode, etc.)
│   │   ├── constants.py         # Enums, thresholds (mirror frontend)
│   │   └── errors.py            # Custom exceptions
│   ├── api/
│   │   ├── __init__.py
│   │   ├── health.py            # GET /health
│   │   ├── observations.py      # POST /observations, GET /observations/*
│   │   └── defects.py           # GET /defects/*, PATCH /defects/:id/status
│   ├── models/
│   │   ├── __init__.py
│   │   ├── observation.py       # SQLAlchemy Observation model
│   │   ├── defect.py            # SQLAlchemy CanonicalDefect model
│   │   └── user.py              # User (for future auth)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── observation.py       # Pydantic request/response schemas
│   │   └── defect.py            # Pydantic defect schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── duplicate_service.py # Duplicate analysis (mirror frontend logic)
│   │   ├── priority_service.py  # Priority calculation (mirror frontend)
│   │   ├── detection_service.py # Detector interface (stub + fallback)
│   │   ├── observation_service.py # Observation persistence + validation
│   │   └── defect_service.py    # Defect creation, merge, status lifecycle
│   ├── database/
│   │   ├── __init__.py
│   │   ├── db.py                # SQLAlchemy engine, session factory
│   │   ├── base.py              # Base model for all ORM models
│   │   └── seed.py              # Optional test data
│   └── utils/
│       ├── __init__.py
│       ├── distance.py          # Haversine distance (mirror frontend)
│       └── id_gen.py            # ID generation (RD-*, OB-*)
├── tests/
│   ├── __init__.py
│   ├── test_health.py
│   ├── test_observations.py
│   ├── test_defects.py
│   ├── test_duplicate.py
│   └── conftest.py              # pytest fixtures (DB, app client)
├── requirements.txt             # Python dependencies
├── .env                         # (local) Environment variables
├── .env.example                 # Template for .env
└── README.md                    # Setup & running instructions
```

---

## Phase 2: Data Models (SQLAlchemy)

### Observation Model

```python
class Observation(Base):
    __tablename__ = "observations"
    
    id: str = Column(String, primary_key=True)  # OB-xxx (generated)
    defect_id: str = Column(String, ForeignKey("defects.id"), nullable=False)
    
    # Image
    image_uri: str = Column(String, nullable=False)  # File path or URL
    
    # Classification
    defect_type: str = Column(String, nullable=False)  # POTHOLE, CRACK, etc.
    severity: str = Column(String, nullable=False)  # LOW, MEDIUM, HIGH, SEVERE
    confidence: float | None = Column(Float)  # 0–1 or None (reporter-classified)
    classification_source: str = Column(String, nullable=False)  # MODEL or REPORTER
    
    # Location
    latitude: float = Column(Float, nullable=False)
    longitude: float = Column(Float, nullable=False)
    accuracy_meters: float | None = Column(Float)
    location_source: str = Column(String, nullable=False)  # DEVICE, MANUAL, EXIF
    
    # Metadata
    timestamp: int = Column(Integer, nullable=False)  # Unix ms
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    defect = relationship("CanonicalDefect", back_populates="observations")
```

**Constraints:**
- `id` is immutable PK
- `defect_id` FK ensures observation belongs to exactly one defect
- Timestamps in milliseconds (match frontend)
- Never update; only create or read

### CanonicalDefect Model

```python
class CanonicalDefect(Base):
    __tablename__ = "canonical_defects"
    
    id: str = Column(String, primary_key=True)  # RD-xxx (generated)
    
    # Base info
    defect_type: str = Column(String, nullable=False)  # POTHOLE, CRACK, etc.
    
    # Computed location (mean of observations)
    latitude: float = Column(Float, nullable=False)
    longitude: float = Column(Float, nullable=False)
    
    # Status & priority
    status: str = Column(String, default="CANDIDATE", nullable=False)
    priority_score: int = Column(Integer, nullable=False)  # 0–100
    priority_breakdown: dict = Column(JSON, nullable=False)  # PriorityBreakdown
    priority_computed_at: int = Column(Integer, nullable=False)  # Unix ms
    
    # Evidence
    observation_count: int = Column(Integer, default=0)
    
    # Metadata
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    observations = relationship("Observation", back_populates="defect", cascade="all, delete-orphan")
```

**Constraints:**
- Status can only progress: CANDIDATE → CORROBORATED → VERIFIED → SCHEDULED → REPAIRED → RECURRED
- Location auto-updates as mean of observations
- Priority auto-recalculates on change
- `observation_count` is denormalized for query performance

---

## Phase 3: Pydantic Schemas

### Request Schemas (What frontend sends)

```python
class CreateObservationRequest(BaseModel):
    image_uri: str
    defect_type: str  # One of: POTHOLE, CRACK, RUTTING, SURFACE_WEAR, OTHER
    severity: str  # One of: LOW, MEDIUM, HIGH, SEVERE
    confidence: float | None = None  # 0–1 or None
    classification_source: str  # MODEL or REPORTER
    latitude: float  # -90 to 90
    longitude: float  # -180 to 180
    accuracy_meters: float | None = None
    location_source: str  # DEVICE, MANUAL, EXIF
    timestamp: int  # Unix milliseconds
    
    @field_validator('latitude')
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('latitude must be -90 to 90')
        return v
    
    @field_validator('longitude')
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('longitude must be -180 to 180')
        return v
    
    @field_validator('confidence')
    def validate_confidence(cls, v):
        if v is not None and not 0 <= v <= 1:
            raise ValueError('confidence must be 0–1 or None')
        return v
```

### Response Schemas (What backend returns)

```python
class ObservationResponse(BaseModel):
    id: str
    image_uri: str
    defect_type: str
    severity: str
    confidence: float | None
    classification_source: str
    latitude: float
    longitude: float
    accuracy_meters: float | None
    location_source: str
    timestamp: int
    
    model_config = ConfigDict(from_attributes=True)

class PriorityBreakdownResponse(BaseModel):
    severity: dict  # { value, weight, points, note }
    confidence: dict
    observation_support: dict
    recency: dict
    road_context: dict

class DefectResponse(BaseModel):
    id: str
    defect_type: str
    latitude: float
    longitude: float
    status: str
    priority_score: int
    priority_breakdown: PriorityBreakdownResponse
    observation_count: int
    observations: list[ObservationResponse]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class CreateObservationResponse(BaseModel):
    defect_id: str
    defect: DefectResponse
    duplicate_analysis: DuplicateAnalysisResponse | None
```

---

## Phase 4: Core Services (Mirror Frontend Logic)

### duplicate_service.py

**Goal:** Reimplement frontend's `duplicateService.ts` in Python

**Import config from `core/constants.py`:**
- `DUPLICATE_CONFIG` (thresholds, gates, weights)
- All constants mirror frontend exactly

**Core function:**

```python
def analyze_duplicate(observation: Observation, defect: CanonicalDefect) -> DuplicateAnalysis:
    """
    Returns one of: MERGE, REVIEW, DISTINCT
    
    Pipeline:
    1. GPS candidate gate (Haversine + uncertainty)
    2. Defect-type agreement
    3. Evidence score (spatial + type)
    4. Decision rules
    """
    # ... implementation mirrors duplicateService.ts
```

**Key:** Use same Haversine formula, same thresholds, same decision logic.

### priority_service.py

**Goal:** Reimplement frontend's `priorityService.ts` in Python

**Core function:**

```python
def calculate_priority(observations: list[Observation], road_context: float | None = None, now: int = None) -> PriorityResult:
    """
    Deterministic score 0–100.
    
    Formula: 0.35×severity + 0.15×confidence + 0.20×observationSupport + 0.15×recency + 0.15×roadContext
    """
    # ... implementation mirrors priorityService.ts
```

**Returns:** PriorityResult with breakdown (for display).

### observation_service.py

**Core operations:**

```python
def create_observation(req: CreateObservationRequest, session: Session) -> tuple[Observation, CanonicalDefect, DuplicateAnalysis]:
    """
    Main POST /observations flow:
    
    1. Validate input (Pydantic already did this)
    2. Generate observation ID
    3. Find candidate defects (spatial query)
    4. Run duplicate analysis on each
    5. MERGE / REVIEW / DISTINCT decision
    6. Create or update defect
    7. Recalculate priority
    8. Persist
    9. Return complete result
    """
```

### defect_service.py

**Core operations:**

```python
def create_defect(observation: Observation, now: int) -> CanonicalDefect:
    """Creates new CANDIDATE defect with first observation."""

def add_observation_to_defect(defect: CanonicalDefect, observation: Observation, now: int) -> CanonicalDefect:
    """Adds observation as evidence; updates location (mean), status, priority."""

def update_status(defect_id: str, new_status: str, session: Session) -> CanonicalDefect:
    """Updates status; validates lifecycle progression."""
```

### detection_service.py

```python
def detect_road_defect(image_uri: str) -> DetectionResult:
    """
    Interface for real detector.
    
    MVP: Return stub with clear messaging (source='UNAVAILABLE')
    Future: Call on-device TFLite or hosted API endpoint
    """
    return {
        'source': 'UNAVAILABLE',
        'is_defect': None,
        'defect_type': None,
        'severity': None,
        'confidence': None,
        'message': 'Detector not connected — classification handled by reporter.',
    }
```

---

## Phase 5: API Endpoints

### health.py

```python
@router.get("/health")
async def health():
    return { "status": "ok" }
```

### observations.py

**POST /observations** (CORE ENDPOINT)

```
Request: CreateObservationRequest
Response: 201 Created + CreateObservationResponse
Logic:
  1. Validate request (Pydantic)
  2. Call observation_service.create_observation()
  3. Return defect + duplicate analysis
Errors:
  - 400: Invalid coordinates, confidence out of range, missing field
  - 500: Database error, detector error
```

**GET /observations?limit=50&offset=0**

```
Response: 200 OK + list of ObservationResponse
```

**GET /observations/{id}**

```
Response: 200 OK + ObservationResponse
Error: 404 if not found
```

### defects.py

**GET /defects?status=ACTIVE&sort=priority&limit=50&offset=0**

```
Response: 200 OK + list of DefectResponse + pagination metadata
Query params:
  - status: Filter by CANDIDATE, CORROBORATED, VERIFIED, SCHEDULED, REPAIRED, RECURRED
  - sort: Sort by 'priority' (default), 'recency', 'distance'
  - limit, offset: Pagination
```

**GET /defects/{id}**

```
Response: 200 OK + DefectResponse (with all observations)
Error: 404 if not found
```

**PATCH /defects/{id}/status**

```
Request: { "status": "VERIFIED" }
Response: 200 OK + DefectResponse
Logic:
  - Validate status transition
  - Update database
  - Return updated defect
Errors:
  - 400: Invalid transition (e.g., VERIFIED → CANDIDATE)
  - 404: Defect not found
```

---

## Phase 6: Testing

### Test Structure (pytest)

```
tests/
├── conftest.py              # Fixtures: DB session, app client, test data
├── test_health.py           # Health check
├── test_observations.py      # POST /observations, GET /observations/*
├── test_defects.py          # GET /defects/*, PATCH status
├── test_duplicate.py        # Duplicate analysis logic
└── test_priority.py         # Priority calculation logic
```

### Test Cases (Priority Order)

**Phase 1: Foundation**
1. Health check works
2. Create single observation → creates CANDIDATE defect
3. Get defects list → shows created defect
4. Get defect detail → shows observation evidence

**Phase 2: Duplicate Logic**
5. Create second observation near first → duplicate analysis runs
6. If MERGE: same defect, observation_count=2, status=CORROBORATED
7. If REVIEW: same defect (but flagged for review)
8. If DISTINCT: new defect created

**Phase 3: Priority & Status**
9. Priority score calculated on creation
10. Priority recalculated when observation added
11. Status updates (CANDIDATE → CORROBORATED, etc.)
12. Invalid status transition rejected

**Phase 4: Error Handling**
13. Invalid coordinates rejected (400)
14. Missing image rejected (400)
15. Database error handled gracefully (500)
16. Defect not found returns 404

---

## Phase 7: Deployment & Running

### Setup

```bash
# 1. Create backend directory (already done)
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env
cp .env.example .env
# Edit .env with local values (DB URL, debug mode, etc.)

# 5. Initialize database
python -c "from app.database.db import init_db; init_db()"

# 6. Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 7. Test
# Navigate to http://localhost:8000/docs (OpenAPI)
# Or run: pytest -v
```

### requirements.txt

```
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.0
python-dotenv==1.0.0
pytest==7.4.3
httpx==0.25.2
pytest-asyncio==0.21.1
```

---

## Implementation Order (Minimum Viable Path)

1. **Setup & Models** (1 hour)
   - Create Python project structure
   - Write SQLAlchemy models (Observation, CanonicalDefect)
   - Write Pydantic schemas

2. **Core Services** (1.5 hours)
   - Copy frontend constants (priority, duplicate thresholds)
   - Implement `duplicate_service.py` (mirror frontend)
   - Implement `priority_service.py` (mirror frontend)
   - Implement `distance.py` (Haversine)

3. **Observation Creation** (1.5 hours)
   - Implement `observation_service.create_observation()`
   - POST /observations endpoint
   - Database persistence
   - Basic testing

4. **Defect Management** (1 hour)
   - Implement `defect_service.py`
   - GET /defects, GET /defects/:id endpoints
   - Status update logic
   - Testing

5. **Polish & Testing** (1 hour)
   - Error handling for all endpoints
   - Test duplicate MERGE/REVIEW/DISTINCT
   - Test priority recalculation
   - Test status lifecycle

**Total: ~6 hours** for MVP (first milestone: POST obs → persisted defect with priority)

---

## Key Decisions & Non-Negotiables

### Code Reuse from Frontend

✅ **COPY** (don't reference):
- Duplicate analysis logic (Python implementation)
- Priority calculation logic (Python implementation)
- Haversine distance formula
- Constants (thresholds, weights, enums)

❌ **DO NOT CALL** (backend can't call frontend):
- Frontend services are TypeScript; backend is Python
- Backend implements separate logic; ensures server-side validation

### Data Integrity

- Observations are **immutable** once created
- Defect location is **auto-computed** (mean of observations)
- Priority is **auto-computed** (deterministic formula)
- Status can only **progress** (never backwards)

### Error Handling Philosophy

- **Never silently convert failures to success**
- Invalid input → 400 Bad Request + clear error message
- Missing data → 400 Bad Request
- Logic error → 500 Internal Server Error + request ID for debugging
- Detector unavailable → continue with reporter classification

### Database Choice

**SQLite (MVP):**
- Zero setup
- Suitable for testing
- File-based (.db in project root)
- Can upgrade to PostgreSQL later without schema changes

**Production Upgrade Path:**
- Replace `SQLALCHEMY_DATABASE_URL` in config
- Use Alembic for migrations
- No code changes needed (SQLAlchemy is database-agnostic)

---

## Dependencies & Constraints

**Must NOT:**
- Modify frontend TypeScript code (except contracts if necessary)
- Create circular dependencies (backend depends on frontend)
- Add complex infrastructure (auth, caching, queues) for MVP
- Claim fake AI / detection accuracy

**Must:**
- Implement all functions in `duplicate_service.py` exactly as frontend
- Implement priority calculation exactly as frontend
- Use same thresholds, weights, enums as frontend
- Return responses matching API contract
- Handle all error cases gracefully

---

## Success Criteria (First Milestone)

✅ Backend starts without errors  
✅ POST /observations persists observation + creates/merges defect  
✅ GET /defects returns list  
✅ GET /defects/:id returns detail with observations  
✅ Priority calculated and returned  
✅ Duplicate analysis runs (MERGE/REVIEW/DISTINCT)  
✅ Status auto-progression works (CANDIDATE → CORROBORATED)  
✅ All tests pass  
✅ Error handling covers all cases  

---

## Next Steps

1. **Approve this plan** ← You are here
2. **Create Python project structure & install dependencies**
3. **Write SQLAlchemy models**
4. **Write Pydantic schemas**
5. **Implement services (duplicate, priority, observation, defect)**
6. **Implement API endpoints**
7. **Write tests**
8. **Run & verify end-to-end flow**
9. **Report results**

---

**Ready to implement backend. Awaiting approval to proceed.** ✅
