# Task 1 Check-In: DB + Loader + GET Profile

## ✅ Implementation Complete

### **Database DDL**

**Migration:** `supabase/migrations/018_capper_settings.sql`

```sql
CREATE TABLE capper_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capper TEXT NOT NULL,
  sport TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  profile_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  
  CONSTRAINT capper_settings_active_unique 
    UNIQUE (capper, sport, is_active) 
    WHERE is_active = true
);
```

**Indexes:**
- `idx_capper_settings_active` on `(capper, sport, is_active)`
- `idx_capper_settings_created` on `created_at DESC`

---

### **Zod Schema**

**File:** `src/lib/cappers/shiva-v1/profile.ts`

```typescript
export const ProfileJSONSchema = z.object({
  capper: z.string(),
  sport: z.enum(['NBA', 'MLB', 'NFL']),
  version: z.string(),
  providers: z.object({
    step3: z.enum(['perplexity', 'openai']),
    step4: z.enum(['perplexity', 'openai']),
  }).strict(),
  searchMode: z.enum(['quick', 'deep']),
  factors: z.array(z.object({
    key: z.string(),
    enabled: z.boolean(),
    weight: z.number().min(0).max(1),
  }).strict()),
  caps: z.object({
    h2hPer100: z.number(),
    newsEdgePer100: z.number(),
    homePer100: z.number(),
  }).strict(),
  market: z.object({
    weight: z.number(),
    sideCap: z.number(),
    totalCap: z.number(),
    adjMax: z.number(),
  }).strict(),
  thresholds: z.object({
    passLt: z.number(),
    oneUnit: z.number(),
    twoUnits: z.number(),
    maxUnits: z.number(),
  }).strict(),
  behavior: z.object({
    seasonDefault: z.string(),
    pinnedSeasonFallback: z.string(),
    probableImpact: z.number(),
  }).strict(),
}).strict()
```

---

### **Profile Loader**

**Function:** `getCapperProfile(capper, sport)`

**Logic:**
1. Query `capper_settings` for active row matching `(capper, sport)`
2. If found, validate `profile_json` with Zod
3. Convert to `CapperProfile` interface
4. If DB fails or empty, fall back to in-memory `shivaProfileV1`

**Backward Compatibility:**
- `getCapperProfileSync()` - returns in-memory only (for non-async contexts)

---

### **GET Profile API**

**Endpoint:** `GET /api/cappers/profile?capper=SHIVA&sport=NBA`

**Response (200):**
```json
{
  "capper": "SHIVA",
  "version": "v1",
  "weights": {
    "f1_net_rating": 0.21,
    "f2_recent_form": 0.175,
    "f3_h2h_matchup": 0.14,
    "f4_ortg_diff": 0.07,
    "f5_news_injury": 0.07,
    "f6_home_court": 0.035,
    "f7_three_point": 0.021
  },
  "caps": {
    "h2h_per100": 6,
    "side_points": 6,
    "total_points": 12,
    "news_edge_per100": 3,
    "market_adj_max": 1.2
  },
  "constants": {
    "home_edge_per100": 1.5,
    "league_ortg": 114
  },
  "units": {
    "pass_below": 2.5,
    "one_unit_max": 3,
    "two_units_max": 4
  },
  "providers": {
    "step3_default": "perplexity",
    "step4_default": "openai",
    "timeout_ms": 6000,
    "max_retries": 2
  },
  "news": {
    "window_hours_default": 48,
    "window_hours_extended": 72,
    "extend_threshold_hours": 12
  }
}
```

**Response (404):**
```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "No profile found for capper=UNKNOWN, sport=NBA"
  }
}
```

---

### **Sample Profile JSON**

**File:** `fixtures/profiles/shiva-nba-v1.json`

Matches current `shivaProfileV1` exactly - **no behavior change**.

Ready to seed into `capper_settings` table for testing.

---

### **Postman Test**

**Request:**
```
GET {{baseUrl}}/api/cappers/profile?capper=SHIVA&sport=NBA
```

**Expected (without DB seed):**
- Status: 200
- Body: SHIVA v1 profile (from in-memory fallback)
- Console: `[Profile:GET] { capper: 'SHIVA', sport: 'NBA', version: 'v1', source: 'db_or_fallback' }`

**After seeding DB:**
```sql
INSERT INTO capper_settings (capper, sport, version, is_active, profile_json)
VALUES (
  'SHIVA',
  'NBA',
  'v1',
  true,
  '<paste fixtures/profiles/shiva-nba-v1.json here>'
);
```

- Status: 200
- Body: Same profile (from DB this time)
- Console: `[Profile:GET] { source: 'db_or_fallback' }`

---

## ✅ Task 1 Complete

**Delivered:**
- ✅ DDL for `capper_settings` table
- ✅ Zod schema with `.strict()` validation
- ✅ Profile loader (DB-first, fallback to memory)
- ✅ GET `/api/cappers/profile` endpoint
- ✅ Sample profile JSON matching current behavior

**Ready for Task 2:** UI header filters + Step 0 factor controls

