# Elite Dangerous Power Play Analyzer — Plan

## Top-Level Overview

Build a multi-user web application that ingests Elite Dangerous faction and Power Play data from two sources:
- **Spansh** (`factions.json.gz`) — faction presence/control data with 3D coordinates (bulk download, faction-centric)
- **EDSM API** — Power Play system states (Fortified, Undermined, Turmoil, Expansion, etc.) and faction influence percentages, queried **only for systems already in the DB** (not the full galaxy)

The app allows users to select a faction and a "center" system, then visualizes that faction's territory in three views (data table, 2D map, 3D map). It produces AI-assisted recommendations for which systems to **fortify** and which to **expand into**, backed by rule-based scoring and an LLM for natural-language summaries. Historical snapshots are stored in PostgreSQL to enable trend analysis and prediction over time.

**Stack:** Python FastAPI + PostgreSQL backend · React + TypeScript + Vite frontend · APScheduler for periodic data ingestion · Three.js / react-three-fiber for 3D · D3.js for 2D · LLM provider abstraction (matching knowledge-graph-app patterns)

**Auth model:** Read-only views are open access. Admin login (JWT) required to trigger refreshes or change settings.

---

## Data Source Roles

| What | Source | Why |
|---|---|---|
| Faction list, allegiance, government | Spansh bulk download | EDSM has no faction→systems endpoint |
| Which systems a faction has presence in | Spansh bulk download | Only available as bulk; not queryable by faction on EDSM |
| Which faction controls each system | Spansh (`isControllingFaction`) | Available directly in bulk file |
| System x/y/z coordinates | Spansh (already in faction records) | Free with the download, no extra API calls |
| Power Play state (Fortified/Undermined/etc.) | EDSM per-system API | Not in Spansh schema |
| Faction influence % per system | EDSM per-system API | Not in Spansh schema |

**Key constraint:** Spansh data lists a system **twice** within a faction's `systems` array when that faction controls it — once with `isControllingFaction: true` and once without. Must deduplicate on ingest (keep `isControllingFaction: true` version).

**EDSM filtering:** Only query EDSM for systems that exist in the `systems` table (populated by Spansh ingest). This limits EDSM calls to the subset of the galaxy that has faction activity — dramatically less than the full ~400k system galaxy.

---

## Architecture Overview

```
Spansh factions.json.gz        EDSM API (per-system)
        |                              |
        v                              v
  [Ingestion Service]         [EDSM Sync Service]
  (streaming, ijson)          (only DB-known systems,
        |                      rate-limited 1 req/sec)
        v                              |
  factions / systems /                 v
  faction_presence tables      pp_snapshots table
        |                              |
        +----------+----------+--------+
                   |
              FastAPI REST API
                   |
         React + TypeScript Frontend
         ┌─────────────────────────┐
         │  FactionSelector        │
         │  CenterSystemSelector   │
         │  TableView              │
         │  Map2DView (D3)         │
         │  Map3DView (Three.js)   │
         │  RecommendationPanel    │
         │  AdminPanel (JWT-gated) │
         └─────────────────────────┘
```

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Database Schema

**Status:** `[ ] pending`

**Intent:**
Create the `elite-powerplay-app/` project directory following the same conventions as `knowledge-graph-app/`. Set up the FastAPI backend skeleton, PostgreSQL schema via SQLAlchemy ORM, and the React/Vite frontend skeleton. Everything composes via `docker-compose.yml`.

**Expected Outcomes:**
- `elite-powerplay-app/backend/` with `main.py`, `db/session.py`, `models/models.py`, `models/schemas.py`, `routers/`, `services/`, `ai/` directories
- `elite-powerplay-app/frontend/` with Vite + React + TypeScript scaffold, `src/api/`, `src/components/`, `src/pages/`
- `docker-compose.yml` with postgres + backend + frontend (nginx) services
- `.env.example` with all required env vars
- All database tables created on startup via `Base.metadata.create_all`

**Database Schema:**

| Table | Key Columns | Notes |
|---|---|---|
| `factions` | `id`, `name` (unique), `allegiance`, `government` | Upserted from Spansh |
| `systems` | `id`, `system_id64` (unique), `name`, `x`, `y`, `z` | Upserted from Spansh |
| `faction_presence` | `id`, `faction_id`, `system_id`, `is_controlling`, `ingestion_run_id` | Per ingestion run snapshot |
| `pp_snapshots` | `id`, `system_id`, `pp_power`, `pp_state`, `influence`, `snapshot_time`, `ingestion_run_id` | One row per system per EDSM sync |
| `ingestion_runs` | `id`, `source` (spansh/edsm), `started_at`, `completed_at`, `status`, `records_processed` | Audit log |
| `admin_settings` | `id`, `key` (unique), `value` | Scoring weights and config |
| `admin_users` | `id`, `email`, `hashed_password`, `created_at` | JWT auth for admin panel |

**Todo List:**
1. Create directory structure `elite-powerplay-app/backend/` and `elite-powerplay-app/frontend/` mirroring `knowledge-graph-app/`
2. Write `db/session.py` — SQLAlchemy engine from `DATABASE_URL`, `SessionLocal`, `Base`
3. Write `models/models.py` — all ORM tables listed above with relationships
4. Write `models/schemas.py` — Pydantic v2 schemas (`ConfigDict(from_attributes=True)`) for all API responses
5. Write `main.py` — FastAPI app, CORS middleware, include routers placeholder, call `Base.metadata.create_all`
6. Write `routers/deps.py` — `get_db()` yield dependency, `get_current_admin()` JWT dependency, `AdminUser` type alias
7. Write `routers/auth.py` — `POST /api/auth/login` admin login endpoint, issues HS256 JWT
8. Scaffold frontend: Vite + React + TypeScript, basic `src/App.tsx` with three tab placeholders
9. Write `docker-compose.yml` — postgres 16-alpine, backend (Python 3.12-slim), frontend (node build → nginx alpine)
10. Write `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` (SPA + API proxy)
11. Write `.env.example` with all env vars and `README.md` with setup instructions

**Relevant Context:**
- Follow `knowledge-graph-app/backend/db/session.py`, `models/models.py`, `routers/deps.py`, `routers/auth.py` patterns exactly
- JWT: HS256, `SECRET_KEY` env var, 8-hour expiry, claims: `{sub, email, is_admin}`
- `pp_snapshots` rows are **never updated** — each sync inserts new rows for historical trend analysis
- `faction_presence` rows are replaced per ingestion run (not appended) — foreign key to `ingestion_runs`

---

### Sub-Task 2 — Spansh Data Ingestion Service

**Status:** `[ ] pending`

**Intent:**
Build the service that downloads `factions.json.gz` from `https://downloads.spansh.co.uk/factions.json.gz`, streams and decompresses it in chunks, parses each faction record with `ijson` (streaming JSON parser — avoids loading hundreds of MB into RAM), and upserts into the `factions`, `systems`, and `faction_presence` tables. Wire APScheduler to run this on a configurable interval.

**Expected Outcomes:**
- `services/ingestion.py` — streaming download + streaming JSON parse + upsert logic
- `routers/admin.py` — `POST /api/admin/ingest/spansh` (manual trigger, admin-only), runs as `BackgroundTasks`
- APScheduler job in `main.py` startup, interval controlled by `SPANSH_INGEST_INTERVAL_HOURS` env var (default: 24)
- `ingestion_runs` record created at start, updated to `completed` or `failed` at end
- Duplicate system entries within a faction deduplicated: same `systemId64` → keep `isControllingFaction: true` version, merge if only one exists

**Todo List:**
1. Write `services/ingestion.py`:
   - Open HTTPS stream to Spansh URL with `requests` (stream=True)
   - Wrap response content in `gzip.GzipFile` for on-the-fly decompression
   - Use `ijson.items(stream, 'item')` to parse one faction at a time
   - For each faction: upsert into `factions` (PostgreSQL `ON CONFLICT DO UPDATE`)
   - For each system in faction: deduplicate by `systemId64` (if same ID appears twice, keep `isControllingFaction=True` record), upsert into `systems`, insert `faction_presence` row linked to current `ingestion_run_id`
   - Create `ingestion_runs` row at start with `status='running'`, update to `'completed'` or `'failed'`
2. Add `POST /api/admin/ingest/spansh` to `routers/admin.py`
3. Register `AsyncIOScheduler` in `main.py` `startup_event`, add spansh job
4. Add `SPANSH_INGEST_INTERVAL_HOURS=24` to `.env.example`
5. Add `ijson`, `requests` to `requirements.txt`

**Relevant Context:**
- Schema note: `isControllingFaction` is **optional** in the Spansh schema — treat absent as `false`
- The file format is "one faction per line" per schema description — `ijson` can efficiently stream item-by-item
- `faction_presence` rows for a given `ingestion_run_id` are inserted fresh each run; previous runs' rows remain for historical reference
- `systems` table uses `system_id64` as the unique key for upserts (not the name, which can theoretically change)

---

### Sub-Task 3 — EDSM Power Play Sync Service

**Status:** `[ ] pending`

**Intent:**
Build the service that queries EDSM for Power Play state and faction influence for each system already in the `systems` table. This is filtered to only known systems (populated by Spansh ingest), not the full galaxy. Results are stored as time-stamped rows in `pp_snapshots` — never updated, always appended — so historical trends accumulate over time.

**Expected Outcomes:**
- `services/edsm_sync.py` — iterates DB systems, calls EDSM, stores snapshots
- `routers/admin.py` — `POST /api/admin/ingest/edsm` (admin-only, BackgroundTask)
- APScheduler job, interval controlled by `EDSM_SYNC_INTERVAL_HOURS` env var (default: 6)
- Each sync inserts one `pp_snapshots` row per system with `pp_power`, `pp_state`, `influence` (controlling faction's influence at time of snapshot)
- Rate-limited to ~1 request/second to respect EDSM limits

**EDSM endpoints:**
- `GET https://www.edsm.net/api-v1/system?systemName={name}&showPowerPlay=1&showInformation=1` — returns coords, `powers`, `powerState`, controlling faction
- `GET https://www.edsm.net/api-system-v1/factions?systemName={name}` — returns all factions in system with `influence` and `isControllingFaction`

**Todo List:**
1. Write `services/edsm_sync.py`:
   - Query all unique system names from `systems` table
   - For each system, call both EDSM endpoints (with `asyncio.sleep(1)` between systems to rate-limit)
   - Extract: `pp_power` (from `powers[0]` if present), `pp_state` (from `powerState`), controlling faction `influence` (from factions endpoint, `isControllingFaction=true` faction's influence value)
   - Insert row into `pp_snapshots` — never upsert, always insert for history
   - Handle missing/null gracefully (unpopulated or unexplored systems return empty PP fields)
2. Add `POST /api/admin/ingest/edsm` to `routers/admin.py`
3. Register EDSM sync APScheduler job in `main.py`
4. Add `EDSM_SYNC_INTERVAL_HOURS=6` to `.env.example`
5. Add `httpx` (async HTTP client) to `requirements.txt` — use `httpx.AsyncClient` for async EDSM calls

**Relevant Context:**
- `pp_state` values from EDSM: `"Fortified"`, `"Undermined"`, `"Turmoil"`, `"Expansion"`, `"Contested"`, `"HomeSystem"`, `"InPrepareRadius"`, `"Prepared"`, `"Exploited"` — store as-is (varchar)
- EDSM returns `influence` as a float 0.0–1.0; store as float, display as percentage (×100)
- The number of unique systems in the DB is bounded by Spansh faction presence data — typically tens of thousands, not 400k
- EDSM sync of 10,000 systems at 1 req/sec ≈ ~3 hours; schedule EDSM after Spansh ingest completes

---

### Sub-Task 4 — Factions & Systems API Endpoints

**Status:** `[ ] pending`

**Intent:**
Build the read-only REST API endpoints that power all three frontend views. These endpoints are publicly accessible (no auth). Key capabilities: list/search factions, get all systems for a faction with latest PP state, search systems by name (for center system selector), get historical PP snapshots for trend display.

**Expected Outcomes:**
- `routers/factions.py` — faction list, search, detail with systems + latest PP state
- `routers/systems.py` — system name search, system detail with PP history
- Pydantic response schemas in `models/schemas.py`
- No N+1 queries — use DB joins and `DISTINCT ON` (PostgreSQL) for latest snapshot per system

**Key Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/factions` | None | Paginated list (name, allegiance, government, system_count) |
| GET | `/api/factions/search?q=` | None | Search faction names (for selector dropdown) |
| GET | `/api/factions/{name}/systems` | None | All systems for faction with latest PP state, coords, is_controlling |
| GET | `/api/factions/{name}/recommendations` | None | Scored fortify + expand recommendations (calls scoring service) |
| GET | `/api/systems/search?q=` | None | Search system names (for center system selector) |
| GET | `/api/systems/{system_id64}/history` | None | PP snapshots over time for trend charts |
| GET | `/api/factions/powers` | None | Distinct PP powers present in data |

**Todo List:**
1. Write `routers/factions.py` with all faction endpoints listed above
2. Write `routers/systems.py` with system search and history endpoints
3. Write Pydantic schemas:
   - `FactionListItem`: `name`, `allegiance`, `government`, `system_count`
   - `FactionSystemEntry`: `system_name`, `system_id64`, `is_controlling`, `coords` (x/y/z), `pp_state`, `pp_power`, `influence`, `distance_from_center` (computed when `center` query param provided)
   - `SystemHistoryPoint`: `snapshot_time`, `pp_state`, `pp_power`, `influence`
4. "Latest PP state per system" query: PostgreSQL `DISTINCT ON (system_id) ORDER BY system_id, snapshot_time DESC` subquery
5. Include routers in `main.py`
6. Write `src/api/factions.ts` and `src/api/systems.ts` typed fetch wrappers in frontend

**Relevant Context:**
- `distance_from_center` is computed in Python (Euclidean: `sqrt((x2-x1)²+(y2-y1)²+(z2-z1)²)`) when `?center_id={system_id64}` param is provided
- Faction search should be case-insensitive substring match: `WHERE name ILIKE '%{q}%'`
- Return max 20 results for search endpoints (selector dropdowns don't need more)

---

### Sub-Task 5 — Recommendation Engine (Rule-Based Scoring)

**Status:** `[ ] pending`

**Intent:**
Implement the rule-based scoring engine that produces per-system recommendations for a selected faction. Two recommendation types: **Fortify** (defend systems you control that are vulnerable) and **Expand** (move into nearby uncontrolled systems). Scores are computed from PP state, influence level, historical trend, and proximity to center. Scoring weights are loaded from `admin_settings` table with hardcoded defaults as fallback.

**Expected Outcomes:**
- `services/scoring.py` — `compute_recommendations(faction_name, center_system_id64, db)` returns ranked fortify + expand lists
- `GET /api/factions/{name}/recommendations?center={system_id64}` returns both lists
- Each item includes: system name, score, type, list of human-readable reasons, distance from center, current PP state, influence, and influence trend direction
- Scoring weights are configurable via admin settings

**Scoring Rules:**

**Fortify Score** (higher = more urgent to fortify; only for systems faction has presence in):

| Condition | Default Weight | Setting Key |
|---|---|---|
| `pp_state` = `"Undermined"` | +50 | `fortify_undermined` |
| `pp_state` = `"Turmoil"` | +40 | `fortify_turmoil` |
| Faction influence < 40% | +20 | `fortify_low_influence` |
| Influence trending downward (last 3 snapshots) | +15 | `fortify_trend_down` |
| Faction does NOT control the system | +25 | `fortify_not_controlling` |
| Distance from center < 15 LY | +10 | `fortify_near_center` |

**Expand Score** (higher = better expansion target; systems NOT in faction's current presence list):

| Condition | Default Weight | Setting Key |
|---|---|---|
| System has no controlling faction | +40 | `expand_uncontrolled` |
| Nearest faction-controlled system < 20 LY | +20 | `expand_proximity` |
| `pp_state` = `"Expansion"` or `"InPrepareRadius"` | +30 | `expand_pp_state` |
| No other faction with same allegiance controls it | +10 | `expand_allegiance_gap` |
| Fewer than 3 other factions present | +15 | `expand_low_competition` |

**Todo List:**
1. Write `services/scoring.py`:
   - `load_weights(db)` — reads `admin_settings` for weight overrides, falls back to defaults dict
   - `get_influence_trend(system_id, db)` — queries last 3 `pp_snapshots` for system, returns `"rising"` / `"falling"` / `"stable"` / `"unknown"`
   - `compute_fortify_scores(faction_name, center_system, db, weights)` → list of `RecommendationItem`
   - `compute_expand_scores(faction_name, center_system, db, weights)` → list of `RecommendationItem` (queries nearby systems within 30 LY of any faction-controlled system that the faction is NOT already present in)
   - `compute_recommendations(faction_name, center_system_id64, db)` → `{fortify: [...], expand: [...]}`
2. Add recommendations endpoint to `routers/factions.py`: `GET /api/factions/{name}/recommendations?center={system_id64}`
3. Write `RecommendationItem` Pydantic schema: `{system_name, system_id64, score, type, reasons: list[str], distance_from_center, pp_state, influence, influence_trend}`
4. Write `src/api/recommendations.ts` typed fetch wrapper

**Relevant Context:**
- Influence trend: compare `influence` values across last 3 `pp_snapshots` ordered by `snapshot_time`; if each is less than the previous → `"falling"`; all increasing → `"rising"`; otherwise `"stable"`
- Expand candidates: query `systems` joined with `faction_presence` to find systems within 30 LY of any system the faction controls, minus systems already in faction's presence list
- Distance: standard Euclidean `sqrt((x2-x1)²+(y2-y1)²+(z2-z1)²)` — equal to in-game LY distance

---

### Sub-Task 6 — LLM Summary Integration

**Status:** `[ ] pending`

**Intent:**
Integrate an LLM provider (same abstraction pattern as `knowledge-graph-app/backend/ai/`) to generate a natural-language tactical briefing from the top recommendations. The LLM receives structured data (top 5 fortify + top 5 expand items with scores and reasons) and returns a paragraph-length plain-text summary. Rule-based scoring always runs first; the LLM summary is optional and additive.

**Expected Outcomes:**
- `ai/provider.py` — abstract base with `summarize_recommendations(...)` method
- `ai/factory.py` — singleton factory reading `AI_PROVIDER` env var
- `ai/providers/openai_provider.py` — concrete OpenAI implementation
- `GET /api/factions/{name}/recommendations` response includes optional `llm_summary: str | null`
- If LLM is disabled (`LLM_ENABLED=false`) or call fails, response still returns with `llm_summary: null`

**Todo List:**
1. Write `ai/provider.py` — abstract base class with one abstract method: `summarize_recommendations(faction_name: str, center_system: str, fortify_list: list, expand_list: list) -> str`
2. Write `ai/factory.py` — singleton, reads `AI_PROVIDER` (default `"openai"`), lazy-loads provider
3. Write `ai/providers/openai_provider.py`:
   - System prompt: explains Elite Dangerous Power Play context (fortification = defending controlled systems from undermining, expansion = claiming new systems for the Power)
   - User message: structured summary of top 5 fortify items and top 5 expand items (name, score, reasons, PP state)
   - Returns plain-text paragraph
4. Update `services/scoring.py` `compute_recommendations()` to call LLM provider after scoring if `LLM_ENABLED=true`
5. Wrap LLM call in `try/except` — on failure, log warning and set `llm_summary=None`
6. Add `LLM_ENABLED`, `AI_PROVIDER`, `AI_API_KEY`, `OPENAI_MODEL`, `AI_MAX_TOKENS` to `.env.example`

**Relevant Context:**
- Follow `knowledge-graph-app/backend/ai/` directory structure and patterns exactly
- `AI_MAX_TOKENS` default 512 is sufficient for a brief tactical summary (short output)
- Prompt should remind the LLM that in Elite Dangerous PP, "fortify" costs merits and protects income, "expand" claims new systems for the Power

---

### Sub-Task 7 — Frontend: Faction/System Selectors & Table View

**Status:** `[ ] pending`

**Intent:**
Build the core frontend shell and the table view. Faction selector and center system selector are searchable dropdowns backed by the API. The table view lists all systems for the selected faction with their current PP state, influence, controlling status, distance from center, and recommendation type. Recommendation panel shows the top fortify/expand lists and LLM summary.

**Expected Outcomes:**
- `src/components/FactionSelector.tsx` — searchable async dropdown, debounced 300ms
- `src/components/CenterSystemSelector.tsx` — searchable async dropdown for system names
- `src/pages/TableView.tsx` — sortable table with color-coded PP states
- `src/components/RecommendationPanel.tsx` — top 10 fortify + top 10 expand + LLM summary
- `src/hooks/useSelectionState.ts` — faction + center system synced to URL query params (`?faction=X&center=Y`) for shareable links
- `src/App.tsx` — three-tab layout (Table / 2D Map / 3D Map) + admin icon

**Table Columns:**
System Name | Controls? | PP State | PP Power | Influence % | Trend | Distance (LY) | Recommendation

**PP State color scheme (used across all views):**
- Fortified = `#4AD94A` (green)
- Undermined = `#D94A4A` (red)
- Turmoil = `#FF8C00` (orange)
- Expansion = `#4A90D9` (blue)
- Contested = `#D9D94A` (yellow)
- Other/null = `#999999` (grey)

**Todo List:**
1. Write `src/components/FactionSelector.tsx` — calls `/api/factions/search?q=`, debounce, clear button
2. Write `src/components/CenterSystemSelector.tsx` — calls `/api/systems/search?q=`, same pattern
3. Write `src/pages/TableView.tsx` — table with sortable columns, PP state badge with color, influence % bar or number, trend arrow (↑ ↓ —), distance column (only shown when center selected), recommendation badge (Fortify/Expand/—)
4. Write `src/components/RecommendationPanel.tsx` — collapsible panel, two sections, LLM summary in italic text at top if present
5. Write `src/hooks/useSelectionState.ts` — reads/writes `?faction=` and `?center=` URL params via `useSearchParams`
6. Write `src/App.tsx` — three tabs using React state, admin icon top-right that opens AdminPage
7. Wire API calls: `src/api/factions.ts` (getSystems, searchFactions), `src/api/recommendations.ts` (getRecommendations)
8. Add color constants to `src/constants/ppColors.ts` — shared across Table, 2D, and 3D views

**Relevant Context:**
- Table should sort by distance (ascending) by default when center system is selected; by system name otherwise
- Influence trend: show `↑` (rising), `↓` (falling), `—` (stable or unknown)
- The `RecommendationPanel` should be collapsible and docked to the right or bottom of the view

---

### Sub-Task 8 — Frontend: 2D Map View

**Status:** `[ ] pending`

**Intent:**
Build the 2D spatial map using D3.js. Systems are plotted as circles using their actual x/y/z coordinates projected onto a 2D plane. The user can choose which two axes to display. The center system is highlighted as a distinct marker. Nodes are color-coded by PP state. Recommendation overlays (shield icon for fortify, arrow for expand) are drawn on relevant systems.

**Expected Outcomes:**
- `src/pages/Map2DView.tsx` — D3 scatter plot with zoom/pan
- Axis projection selector: XZ (default, galactic top-down) | XY | YZ
- Layout mode selector: **Actual Coords** | **Distance Radial** | **Force-Directed** (shared component `src/components/LayoutModeSelector.tsx`)
- Center system rendered as a star/diamond marker
- Hover tooltip: system name, PP state, influence, controlling faction
- Fortify systems: shield (🛡) SVG overlay; Expand systems: arrow (→) SVG overlay
- Zoom + pan via D3 zoom behavior

**Todo List:**
1. Write `src/pages/Map2DView.tsx`:
   - Use D3 `scaleLinear` to map x/z coords to SVG pixel space
   - Draw each system as a `<circle>` colored by PP state (using `ppColors.ts`)
   - Draw center system as a `<polygon>` star shape
   - Add D3 zoom behavior wrapping all elements in a `<g>` transform group
2. Write `src/components/AxisSelector.tsx` — XZ / XY / YZ radio buttons
3. Write `src/components/LayoutModeSelector.tsx` — Actual Coords / Distance Radial / Force-Directed toggle (shared with 3D view)
4. Implement **Distance Radial** mode: place center system at origin, all others at distance radius, angle from faction expansion direction
5. Implement **Force-Directed** mode: use D3 `forceSimulation` with link forces between systems within 20 LY
6. Add SVG text or icon overlays for fortify/expand recommendations
7. Add hover tooltip (D3 `title` or floating `div`)
8. Connect to `useSelectionState` hook for faction/center selection

**Relevant Context:**
- Galactic top-down view = XZ plane (x=left/right, z=forward/backward in ED; y=up/down is the vertical axis)
- XZ is the most navigable default for Elite Dangerous players
- D3.js is already used in `knowledge-graph-app` — follow the same canvas/SVG patterns from `GraphCanvas.tsx`
- Normalize coordinates: subtract center system's coords so center system is always at (0,0) in screen space

---

### Sub-Task 9 — Frontend: 3D Map View

**Status:** `[ ] pending`

**Intent:**
Build the interactive 3D map using `react-three-fiber` (React wrapper for Three.js). Systems rendered as colored spheres in 3D space. Supports orbit controls (rotate, zoom, pan). Center system shown as a glowing beacon. Recommendation highlights rendered as colored rings around system spheres. Supports the same three layout modes as the 2D view via the shared `LayoutModeSelector` component.

**Expected Outcomes:**
- `src/pages/Map3DView.tsx` — react-three-fiber `<Canvas>` with orbit controls
- Systems as colored spheres, sized slightly by influence (larger sphere = higher influence)
- Center system as a glowing/pulsing emissive sphere
- Fortify recommendations: red torus ring around sphere
- Expand recommendations: blue torus ring around sphere
- Click sphere → opens system detail popup
- Layout modes: Actual Coords | Distance Radial | Force-Directed (uses `LayoutModeSelector`)
- Background star field via `@react-three/drei` `<Stars>` component

**Todo List:**
1. Add `@react-three/fiber`, `@react-three/drei`, `three` to `frontend/package.json`
2. Write `src/pages/Map3DView.tsx` — `<Canvas>` with `<OrbitControls />`, `<Stars />`, ambient + point lighting
3. Write `src/components/SystemSphere.tsx` — mesh sphere with `MeshStandardMaterial` colored by PP state, scale by influence, `onClick` and `onPointerOver` handlers
4. Write `src/components/CenterBeacon.tsx` — larger emissive sphere with `MeshStandardMaterial emissive` set to gold/white and `emissiveIntensity={2}` for glow effect
5. Write `src/components/RecommendationRing.tsx` — `<Torus>` mesh around a system, red for fortify, blue for expand
6. Add `<Html>` label from `@react-three/drei` on sphere hover showing system name + PP state
7. Implement layout modes: Actual Coords (use raw x/y/z normalized ÷50), Distance Radial (spherical coords from center), Force-Directed (spring simulation in `useEffect` before render)
8. Connect `LayoutModeSelector` component (shared with 2D)
9. Normalize 3D coordinates: divide all coords by a scale factor so the scene fits within ±100 units

**Relevant Context:**
- `@react-three/drei` provides: `OrbitControls`, `Html`, `Stars`, `Sphere`, `Torus`, `Text`
- Force-directed 3D layout: run a simple iterative spring simulation in `useMemo` (not a web worker — system counts for a single faction are typically 5–200, well within main thread budget)
- Emissive glow doesn't require post-processing (Bloom) for an acceptable result — `emissiveIntensity` alone is sufficient
- Scale factor: compute `max(abs(x), abs(y), abs(z))` across all displayed systems, divide all coords by that max to fit in ±1 unit, then multiply by 50

---

### Sub-Task 10 — Admin Panel & Ingestion Status UI

**Status:** `[ ] pending`

**Intent:**
Build the admin UI panel gated behind JWT login. Shows ingestion run history, allows manual Spansh and EDSM sync triggers, displays next scheduled run times, and provides a scoring weight editor so rule weights can be tuned without code changes.

**Expected Outcomes:**
- `src/pages/AdminPage.tsx` — login form + admin panel (shown after login)
- Ingestion history table: source, started_at, completed_at, status, records_processed
- "Run Now" buttons for Spansh and EDSM triggers (calls admin API, shows loading/success state)
- Scoring weight sliders — one per scoring rule key, saves to `/api/admin/settings`
- `GET /api/admin/status` — last ingestion runs + scheduler next run times
- `GET` / `PATCH /api/admin/settings` — scoring weights CRUD

**Todo List:**
1. Add `GET /api/admin/status` to `routers/admin.py` — returns last 10 ingestion runs + APScheduler next run times
2. Add `GET /api/admin/settings` and `PATCH /api/admin/settings` to `routers/admin.py`
3. Update `services/scoring.py` to call `load_weights(db)` at the start of each recommendation computation — reads `admin_settings` table, falls back to hardcoded defaults
4. Write `src/pages/AdminPage.tsx`:
   - Login form: email + password → `POST /api/auth/login` → store JWT in localStorage
   - After login: ingestion history table, Run Now buttons, scoring weight sliders
   - Logout clears JWT
5. Write `src/api/admin.ts` — `getStatus()`, `triggerSpanshIngest()`, `triggerEdsmSync()`, `getSettings()`, `updateSettings()`
6. Write `src/hooks/useAdminAuth.ts` — manages admin JWT in localStorage, exposes `login()`, `logout()`, `isAuthenticated`

**Relevant Context:**
- Admin JWT is separate from general user auth — only admin credentials are stored in `admin_users` table
- The three main tabs (Table / 2D / 3D) remain accessible without login — only AdminPage requires auth
- Scoring weight keys match the `Setting Key` column in Sub-Task 5's scoring tables
- APScheduler's `get_jobs()` returns next run time for each job — expose this in the status endpoint

---

## Key Decisions & Constraints

| Decision | Choice | Rationale |
|---|---|---|
| Spansh still required | Yes | Only source with faction→systems mapping; EDSM has no equivalent endpoint |
| EDSM scope | Only DB-known systems | Limits EDSM calls to systems with faction activity; avoids querying the full galaxy |
| Streaming parse | `ijson` | `factions.json.gz` may be hundreds of MB; never load fully into RAM |
| EDSM rate limit | 1 req/sec via `asyncio.sleep(1)` | Conservative; respects undocumented ~60 req/min soft limit |
| Historical data | Insert-only `pp_snapshots` | Never update — each sync appends new rows; enables trend charts and predictions |
| LLM call failure | Graceful fallback | Recommendations return fully populated; `llm_summary` is null if LLM unavailable |
| 3D coordinates | Divide by max range, fit ±50 units | ED coords span ±20,000 LY; must normalize for Three.js scene |
| Auth model | Admin JWT only | Read views are public; only admin actions (ingest trigger, settings) need auth |
| Scoring weights | DB-stored with code defaults | Allows in-app tuning without redeploy; code defaults ensure app works with empty settings table |
