# Observation Contract

**Owner:** Mobile Frontend (Dhanush)  
**Consumer:** Backend (Saravanan), Intelligence Layer  
**Status:** Agreed

## Definition

An **Observation** is one road problem report from one person at one moment. It is immutable evidence.

## Interface

```typescript
interface Observation {
  // Unique identifier
  id: string;
  
  // Image data
  imageUri: string;  // Path or URL to captured/selected image
  
  // Defect classification
  defectType: 'POTHOLE' | 'CRACK' | 'RUTTING' | 'SURFACE_WEAR' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
  
  // Classification confidence (0–1), or null if human-classified
  confidence: number | null;
  
  // Classification source
  classificationSource: 'MODEL' | 'REPORTER';
  
  // Geographic location (WGS84)
  latitude: number;
  longitude: number;
  
  // GPS accuracy estimate (meters), or null if unknown
  accuracyMeters: number | null;
  
  // Location data source
  locationSource: 'DEVICE' | 'MANUAL' | 'EXIF' | 'UNLOCATED';
  
  // Capture time (milliseconds since epoch)
  timestamp: number;
}
```

## Rules

1. **Immutable:** Once created, an observation never changes.
2. **Non-null fields:** All fields except `confidence` and `accuracyMeters` must be present.
3. **Location:** If `locationSource` is 'UNLOCATED', `latitude` and `longitude` must still be valid (use a sentinel or reject the observation).
4. **Timestamp:** Unix timestamp; can be current time or user-backdated (TBD).
5. **Image storage:** Frontend passes URI; backend fetches or stores the actual image bytes.

## Creation Flow

1. Mobile user captures or selects image
2. Optional: Run detection (MODEL) or classify manually (REPORTER)
3. Request device location (or manual fallback)
4. Create Observation object
5. POST to backend `/observations` endpoint
6. Backend creates or merges into CanonicalDefect
7. Mobile receives defect ID for reference

## No Future Changes
- Do not add `reporter_id`, `metadata`, or other fields without team agreement
- If new classification types needed, update `defectType` enum only
