# Knowledge Graph Application — Plan

## Top-Level Overview

Build a web application that ingests unstructured documents of any type, uses an AI pipeline to extract people, ideas, projects, keywords, organizations, dates, locations, and action items, and renders an interactive visual knowledge graph showing the relationships between those entities. The graph uses visual encoding (line thickness, color, node color) to communicate connection strength, recency/frequency heat, and sentiment. Users can provide weight hints — either numeric multipliers or qualitative language — that the AI incorporates on every re-score. The system supports a small team (5–20 people) with both a shared team graph and a personal graph layer per user.

**Recommended stack:**
- **Backend:** Python + FastAPI — best fit for AI pipeline integration, async file processing, and rapid iteration
- **Frontend:** React + D3.js — D3 is the most capable library for fully custom graph visual encoding (thickness, color gradients, zoom/pan, force-directed layout)
- **Database:** SQLite for local dev (easy migration to PostgreSQL later)
- **AI Layer:** Abstracted provider interface — swap between OpenAI, Anthropic, IBM watsonx, or others via config

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Repository Structure

**Intent:** Establish the monorepo layout, tooling, and local dev environment so all subsequent sub-tasks have a consistent foundation to build on.

**Expected Outcomes:**
- A `backend/` directory with a FastAPI app that starts cleanly
- A `frontend/` directory with a React + Vite app that starts cleanly
- A root-level `docker-compose.yml` (optional, for local dev convenience)
- A `.env.example` file documenting all required environment variables
- README with setup instructions

**Todo List:**
1. Create root directory structure: `backend/`, `frontend/`, `docs/`
2. Scaffold FastAPI backend with `pyproject.toml` or `requirements.txt`, `main.py`, and folder structure: `routers/`, `services/`, `models/`, `db/`, `ai/`
3. Scaffold React + Vite frontend with TypeScript, folder structure: `src/components/`, `src/pages/`, `src/hooks/`, `src/api/`, `src/graph/`
4. Add `.env.example` with keys: `AI_PROVIDER`, `AI_API_KEY`, `DATABASE_URL`, `SECRET_KEY`
5. Add root `README.md` with local dev setup steps
6. Configure CORS in FastAPI to allow the Vite dev server origin

**Relevant Context:**
- No existing application code — greenfield project
- Keep SQLite as the default `DATABASE_URL` for local dev

**Status:** [x] done

---

### Sub-Task 2 — Database Schema & Models

**Intent:** Define the data model that persists documents, extracted entities (people, ideas, projects, keywords), relationships between entities, user weight hints, and graph scores. This schema underpins every other feature.

**Expected Outcomes:**
- All tables created and migrated via Alembic (or equivalent)
- SQLAlchemy ORM models defined for every table
- Pydantic schemas for API serialization

**Todo List:**
1. Define `users` table: `id`, `name`, `email`, `created_at`
2. Define `documents` table: `id`, `uploader_user_id`, `filename`, `raw_text`, `file_type`, `created_at`, `processed_at`, `ai_category`
3. Define `entities` table: `id`, `type` (enum: `person` | `idea` | `project` | `keyword` | `organization` | `location` | `date`), `canonical_name`, `created_at`
4. Define `action_items` table: `id`, `document_id`, `description`, `assignee_entity_id` (nullable FK → entities), `status` (enum: `open` | `in_progress` | `closed`), `due_date` (nullable), `created_at`, `updated_at`
5. Define `entity_document_mentions` table: `entity_id`, `document_id`, `mention_count` — tracks how many times an entity appears in a document
6. Define `relationships` table: `id`, `entity_a_id`, `entity_b_id`, `base_weight` (AI-computed), `heat_score` (recency + frequency composite), `sentiment_score` (AI-computed, -1.0 to 1.0), `last_updated`
7. Define `user_weight_hints` table: `id`, `user_id`, `relationship_id`, `hint_weight` (nullable numeric multiplier, e.g. 2.0), `qualitative_hint` (nullable free-text, e.g. "more important"), `note`, `created_at`
8. Define `node_display` table (computed cache): `entity_id`, `sentiment_color`, `display_weight`, `last_computed` — rebuilt on every re-score
9. Set up Alembic for migrations
10. Write Pydantic response schemas for graph API payloads

**Relevant Context:**
- `base_weight` = structural importance of the relationship (AI-scored, not time-decayed)
- `heat_score` = recency + frequency composite (drives connection color/temperature)
- `sentiment_score` on `relationships` is used for people-node coloring (how a person perceives ideas/projects/people around them)
- Idea/project node color comes from `sentiment_score` on the entity itself (is the idea perceived favorably?)
- `user_weight_hints` supports both modes: a numeric `hint_weight` is applied as a direct multiplier to `base_weight` before the AI re-score; a `qualitative_hint` string is passed as natural language context in the re-score prompt. Both may be set simultaneously on the same hint.
- `action_items` are first-class nodes in the graph — connected to their document, their assignee entity, and any related idea/project entities mentioned in the same context. They are NOT scored for sentiment but do carry an urgency signal from their `status` field.

**Status:** [x] done

---

### Sub-Task 3 — Document Upload API

**Intent:** Allow users to upload any unstructured document. The API accepts the file, stores it, extracts raw text from it, and queues it for AI processing.

**Expected Outcomes:**
- `POST /documents/upload` endpoint accepts multipart file upload
- Supports `.txt`, `.md`, `.docx`, `.pdf` and any plain-text format
- Raw text is extracted and stored in the `documents` table
- Upload triggers the AI processing pipeline (Sub-Task 4) asynchronously
- `GET /documents` returns a user's uploaded documents with status

**Todo List:**
1. Create `routers/documents.py` with upload and list endpoints
2. Implement text extraction service `services/extractor.py`:
   - `.txt`, `.md` — read directly
   - `.docx` — use `python-docx`
   - `.pdf` — use `pdfminer.six` or `pypdf`
   - Fallback: attempt UTF-8 decode for unknown types
3. Store document record with `processed_at = None` (pending)
4. After storage, dispatch async AI processing task (use FastAPI `BackgroundTasks` for local dev; can be upgraded to Celery/Redis later)
5. Add `GET /documents/{id}` to retrieve document metadata and AI category
6. Write Pydantic request/response schemas

**Relevant Context:**
- Keep async dispatch simple with `BackgroundTasks` for local dev — do not add Celery yet
- Text extraction is pre-AI — it just produces a clean string for the AI pipeline

**Status:** [x] done

---

### Sub-Task 4 — AI Provider Abstraction Layer

**Intent:** Build a provider-agnostic AI interface so the application can call OpenAI, Anthropic, IBM watsonx, or any other LLM without changing application logic. All AI calls go through this layer.

**Expected Outcomes:**
- `ai/provider.py` defines an abstract `AIProvider` base class with standard methods
- At least one concrete implementation: `ai/providers/openai_provider.py`
- Provider is selected at startup from the `AI_PROVIDER` env variable
- A single `get_ai_provider()` factory function used everywhere

**Todo List:**
1. Define abstract base class `AIProvider` in `ai/provider.py` with methods:
   - `extract_entities(text: str) -> EntityExtractionResult`
   - `extract_action_items(text: str, known_entities: list) -> list[ActionItemCandidate]`
   - `infer_relationships(entities: list, text: str) -> list[RelationshipCandidate]`
   - `score_sentiment(entity: str, context: str) -> float`
   - `categorize_document(text: str) -> str`
   - `rescore_graph(graph_snapshot: dict, user_hints: list) -> GraphScoreResult`
2. Implement `OpenAIProvider` in `ai/providers/openai_provider.py` using structured output / JSON mode
3. Add stub `AnthropicProvider` and `WatsonxProvider` (raise `NotImplementedError`) for future implementation
4. Write `ai/factory.py` with `get_ai_provider()` reading `AI_PROVIDER` env var
5. Define shared result dataclasses: `EntityExtractionResult`, `ActionItemCandidate`, `RelationshipCandidate`, `GraphScoreResult`

**Relevant Context:**
- Use JSON-mode or structured output in every LLM call — never parse free-form prose
- `extract_entities` should extract: persons, ideas, projects, keywords, organizations, locations, dates
- `extract_action_items` runs after entity extraction so it can link action items to known entities by canonical name
- `rescore_graph` receives: current graph state, all user weight hints (both numeric multipliers and qualitative strings). Numeric hints are pre-applied before the call; qualitative hints are included in the prompt as natural language context.

**Status:** [x] done

---

### Sub-Task 5 — AI Processing Pipeline

**Intent:** Implement the end-to-end pipeline that runs after a document upload: extract entities, infer relationships, score sentiment, categorize the document, then persist results and trigger a full graph re-score.

**Expected Outcomes:**
- On document upload, the pipeline runs asynchronously
- New entities are upserted into the `entities` table
- New or updated relationships are written to `relationships`
- Document gets its `ai_category` and `processed_at` set
- All existing graph scores are recomputed after each upload
- User weight hints are included in the re-score call

**Todo List:**
1. Create `services/pipeline.py` with `run_pipeline(document_id: int)` function
2. Step 1 — Entity extraction: call `provider.extract_entities(raw_text)`, upsert entities by canonical name (types: person, idea, project, keyword, organization, location, date)
3. Step 2 — Action item extraction: call `provider.extract_action_items(raw_text, known_entities)`, upsert `action_items` rows, link to assignee entity and document
4. Step 3 — Mention logging: write `entity_document_mentions` rows
5. Step 4 — Relationship inference: call `provider.infer_relationships(entities, raw_text)`, upsert relationships; also create relationships between action items and their linked entities
6. Step 5 — Sentiment scoring: for each entity (ideas, projects, people, organizations), call `provider.score_sentiment(entity, context)` and store. Skip sentiment scoring for date, keyword, location, and action item nodes.
7. Step 6 — Document categorization: call `provider.categorize_document(raw_text)`, update `documents.ai_category`
8. Step 7 — Heat score computation: for each relationship, compute `heat_score` from recency (document `created_at`) and frequency (`mention_count` across all documents). Formula: `heat = α * recency_score + β * frequency_score` where `α` and `β` are configurable constants (default 0.5 / 0.5)
9. Step 8 — Full graph re-score: load graph snapshot + all user weight hints. Apply numeric `hint_weight` multipliers directly to `base_weight` before calling `provider.rescore_graph(...)`. Pass qualitative hints as prompt context. Update `relationships.base_weight` and `node_display` cache.
10. Mark document `processed_at = now()`

**Relevant Context:**
- Recency score: normalize document age relative to oldest and newest document in the corpus
- Frequency score: normalize mention count relative to the most-mentioned relationship in the corpus
- Numeric user hints (`hint_weight`) are applied as direct multipliers to `base_weight` before the AI sees the graph — they shift the baseline that the AI then refines
- Qualitative user hints (`qualitative_hint`) are injected into the re-score prompt as natural language, e.g. "User note: the relationship between Alice and Project Apollo is considered more important than the data suggests"
- Action items do not participate in heat scoring or sentiment scoring but appear as nodes with a status badge (open / in_progress / closed)

**Status:** [x] done

---

### Sub-Task 6 — Graph API

**Intent:** Expose the computed graph data to the frontend in a format that carries all visual encoding signals — node types, colors, connection weights, heat scores — ready to render without further computation on the client.

**Expected Outcomes:**
- `GET /graph/team` returns the full shared team graph
- `GET /graph/personal` returns the current user's personal graph layer
- Both endpoints return nodes and edges with all display properties pre-computed
- `POST /graph/hints` allows a user to submit weight hints for a relationship

**Todo List:**
1. Create `routers/graph.py`
2. Define response schema `GraphPayload`: `{ nodes: Node[], edges: Edge[] }`
3. `Node` schema: `id`, `label`, `type` (person | idea | project | keyword | organization | location | date | action_item), `sentiment_color` (hex), `size` (importance signal), `layer` (team | personal), `status` (nullable — only set for action_item nodes: open | in_progress | closed)
4. `Edge` schema: `id`, `source`, `target`, `weight` (thickness signal), `heat_score` (color temperature signal), `heat_color` (pre-computed hex)
5. Implement color mapping service `services/color_mapper.py`:
   - Edge heat color: blue (cold, low recency+frequency) → red (hot, high recency+frequency)
   - Idea/project/organization node sentiment: red (negative) → green (positive), neutral = grey
   - Person node sentiment: computed as average sentiment of all their connected entities
   - Action item node color: open = amber (#F5A623), in_progress = blue (#4A90D9), closed = grey (#999)
   - Date/location/keyword nodes: neutral grey (#CCCCCC), sized by connection count only
6. Implement `GET /graph/team` — query from `node_display` cache and `relationships`
7. Implement `GET /graph/personal` — same as team graph but filtered to documents uploaded by the requesting user, merged with team graph
8. Implement `POST /graph/hints` — write to `user_weight_hints`, trigger async re-score

**Relevant Context:**
- Pre-compute all colors server-side so the frontend is a pure renderer
- Edge thickness maps `base_weight` → pixel width (e.g., 1px to 8px range, normalized)
- Heat color is a separate property from thickness — a connection can be thick (strong) but cool (old/infrequent)

**Status:** [x] done

---

### Sub-Task 7 — Frontend: Document Upload UI

**Intent:** Build the document upload page where users can drag-and-drop or browse for files, see upload progress, and view AI-assigned categories after processing.

**Expected Outcomes:**
- Upload page with drag-and-drop zone accepting any file type
- File list showing upload status (pending, processing, done, error)
- After processing, each document shows its AI-assigned category
- Polling or websocket to update status without page reload

**Todo List:**
1. Create `src/pages/UploadPage.tsx`
2. Build `src/components/DropZone.tsx` — drag-and-drop file input using native HTML5 drag events
3. Build `src/components/DocumentList.tsx` — table of uploaded docs with status badge and category label
4. Implement `src/api/documents.ts` — typed API client functions: `uploadDocument()`, `listDocuments()`, `getDocument()`
5. Add polling in `DocumentList` (every 3 seconds) to refresh status of pending/processing documents
6. Handle upload errors gracefully with inline error messages

**Relevant Context:**
- Use native HTML5 drag events — do not add a third-party upload library
- Polling is sufficient for local dev; websocket upgrade can come later

**Status:** [x] done

---

### Sub-Task 8 — Frontend: Interactive Knowledge Graph Visualization

**Intent:** Build the core graph canvas using D3.js with a force-directed layout. This is the primary UI of the application — an infinite, zoomable, pannable canvas where nodes and edges carry all the visual signals.

**Expected Outcomes:**
- Renders the full graph fetched from `GET /graph/team`
- Nodes sized by importance, colored by sentiment (ideas/projects) or relationship perception (people)
- Edges colored by heat score (blue → red gradient) and weighted by thickness
- Zoom in/out with mouse wheel, pan by drag
- Clicking a node shows a detail panel with connected documents and relationship breakdown
- Toggle between team graph and personal graph layer

**Todo List:**
1. Create `src/graph/GraphCanvas.tsx` — React component that owns a D3 force simulation
2. Implement D3 force-directed layout: `forceLink`, `forceManyBody`, `forceCenter`
3. Render edges as SVG `<line>` elements with `strokeWidth` mapped from `edge.weight` and `stroke` color from `edge.heat_color`
4. Render nodes as SVG `<circle>` elements with `r` (radius) mapped from `node.size` and `fill` from `node.sentiment_color`
5. Add node labels as SVG `<text>` elements, visible at zoom level > 0.5
6. Implement zoom + pan using `d3.zoom()` bound to the SVG container
7. Add node click handler — on click, display `src/components/NodeDetailPanel.tsx` showing: entity name, type, connected documents, top 5 strongest connections
8. Build `src/components/GraphToolbar.tsx` — toggle team/personal layer, reset zoom, legend
9. Implement `src/api/graph.ts` — typed API client: `fetchTeamGraph()`, `fetchPersonalGraph()`, `submitWeightHint()`
10. Build `src/components/WeightHintModal.tsx` — form to submit a weight hint on a selected edge with two input modes:
    - **Numeric multiplier** — slider or number input (0.1–3.0), applied directly before re-score
    - **Qualitative comment** — free-text field (e.g. "this relationship is more significant than it appears"), passed as prompt context in re-score
    - Both fields are optional but at least one must be filled
11. Build `src/components/ActionItemPanel.tsx` — list view of all action items extracted from documents, filterable by status (open / in_progress / closed), with inline status update control that calls `PATCH /action-items/{id}/status`

**Relevant Context:**
- D3 force simulation runs in a `useEffect` with a `useRef` to the SVG DOM element — do not try to make D3 state React-reactive
- Re-fetch graph data after a weight hint is submitted and re-run the simulation with new data
- Node `size` signal: keyword nodes smallest, idea/project nodes medium, person nodes largest (also scaled by connection count)

**Status:** [x] done

---

### Sub-Task 9 — Authentication & User Identity

**Intent:** Add lightweight authentication so each user has an identity that ties to their personal graph layer and weight hints. Keep it simple for local dev.

**Expected Outcomes:**
- Login page with email + password (no OAuth required for v1)
- JWT-based session stored in `localStorage`
- All API endpoints require a valid JWT
- User identity flows through to document ownership and personal graph filtering

**Todo List:**
1. Add `POST /auth/login` and `POST /auth/register` endpoints in `routers/auth.py`
2. Hash passwords with `bcrypt`
3. Issue signed JWTs with `python-jose`, include `user_id` in payload
4. Add FastAPI dependency `get_current_user` that validates JWT from `Authorization: Bearer` header
5. Apply `get_current_user` dependency to all protected routes
6. Build `src/pages/LoginPage.tsx` and `src/pages/RegisterPage.tsx`
7. Implement `src/hooks/useAuth.ts` — stores JWT, exposes `login()`, `logout()`, `currentUser`
8. Add React Router with protected route wrapper that redirects to login if no JWT

**Relevant Context:**
- Do not add OAuth, SSO, or password reset flows in v1 — keep scope minimal
- JWT expiry: 8 hours for local dev

**Status:** [x] done

---

## Visual Encoding Reference

| Signal | Visual Property | Mapping |
|---|---|---|
| Connection strength | Edge thickness | `base_weight` → 1px–8px |
| Relationship heat | Edge color | `heat_score` → blue (#4A90D9) to red (#D94A4A) |
| Idea/project sentiment | Node fill color | `sentiment_score` → red (#D94A4A) to green (#4AD94A), neutral grey (#999) |
| Person perception | Node fill color | Average sentiment of connected entities → same red–grey–green scale |
| Entity importance | Node radius | Connection count + weight sum → 8px–32px |
| Node type | Node border/shape | Person = solid border, Idea = dashed, Project = double border, Keyword = no border, Organization = thick solid, Location = dotted, Date = square shape, Action Item = diamond shape |
| Action item status | Node color | open = amber, in_progress = blue, closed = grey |

---

## Non-Goals (v1)

- No real-time collaboration or live graph updates via websocket (polling only)
- No OAuth / SSO authentication
- No Celery / Redis task queue (BackgroundTasks only)
- No deployment pipeline (local dev only)
- No mobile-responsive design
- No manual drag-repositioning of graph nodes that persists across sessions

---

## Open Decisions (Resolved)

- Age affects **color/temperature only** — not structural connection weight ✓
- Temperature = recency + frequency composite ✓
- Idea/project nodes colored by **sentiment** (favorable perception) ✓
- Person nodes colored by **average sentiment of connected entities** ✓
- User weight hints: numeric multipliers applied directly to base_weight; qualitative hints passed as prompt context. Both supported simultaneously. ✓
- AI provider abstracted — OpenAI as default, others stubbed ✓
- Stack: Python FastAPI + React + D3.js + SQLite ✓
- Entity types: person, idea, project, keyword, organization, location, date ✓
- Action items are first-class nodes with open / in_progress / closed status, manageable from a dedicated panel ✓
