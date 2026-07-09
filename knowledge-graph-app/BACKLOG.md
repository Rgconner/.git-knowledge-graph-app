# Knowledge Graph App — Feature Backlog

Potential enhancements for future development, grouped by area.
Items are not prioritized — order within each section is for readability only.

---

## Change History & Version Control

- [ ] **Full change history** — Every mutation to the graph (entity added/removed, relationship weight changed, sentiment score updated, action item status changed, document uploaded/deleted, weight hint applied) is recorded as an immutable event in a `change_log` table with: timestamp, user, change type, before-state (JSON), after-state (JSON).
- [ ] **Unlimited undo / revert** — Any past event can be reverted in any order. Reverting restores the before-state of that specific change without affecting unrelated changes. No limit on how far back a revert can reach.
- [ ] **Unlimited redo / reapply** — Any reverted event can be reapplied (re-applied forward) at any time, also without limit.
- [ ] **Change history timeline UI** — A side panel or dedicated page showing the full chronological log of changes with: timestamp, user, human-readable description (e.g. "AI re-scored 14 relationships after uploading meeting-notes.txt"), before/after diff view.
- [ ] **Per-entity / per-relationship history** — Click a node or edge in the graph and view the complete history of changes to that specific entity or relationship, with revert/reapply controls inline.
- [ ] **Named snapshots** — A user can tag the current state of the graph with a name and description (e.g. "Before Q3 review"). Named snapshots can be restored in full, branching the history.
- [ ] **Snapshot comparison** — Select two named snapshots and view a visual diff of the graph: nodes/edges added, removed, or changed between them, highlighted in the graph canvas.
- [ ] **Revert scope control** — Choose the scope of a revert: single change, all changes by a specific user, all changes from a specific document upload, or all changes since a named snapshot.
- [ ] **Team-visible change attribution** — Every change shows which user made it. Reverting another user's change is allowed but logged separately as a revert action, preserving full audit trail.
- [ ] **Change-aware AI re-scoring** — When reverting or reapplying, the pipeline re-scores only the affected relationships rather than the entire graph, keeping revert operations fast.

---

## Graph Intelligence

- [ ] **Document drill-through filtering** — When clicking a document node in Documents view, filter the entity graph to *only* the entities extracted from that document (currently shows the full team graph). Requires `GET /graph/team?document_id=X` backend filter.
- [ ] **Relationship explanation tooltips** — On edge hover, show an AI-generated one-sentence explanation of why the two entities are connected, derived from the source documents.
- [ ] **Trend view** — A timeline slider that shows how the graph evolved over time as documents were added. Replay the graph building up document by document.
- [ ] **Cluster detection** — Automatically identify and visually group tightly connected subgraphs (communities) using a graph clustering algorithm (e.g. Louvain method).
- [ ] **Shortest path highlighting** — Click two nodes and highlight the shortest relationship path between them.
- [ ] **Anomaly / surprise detection** — AI flags relationships or entities that appear unexpectedly disconnected or unusually strongly connected given their context.
- [ ] **Entity merging** — Allow users to manually merge two entity nodes that the AI treated as separate but refer to the same thing (e.g. "Bob" and "Robert Smith").
- [ ] **Configurable heat decay** — User-adjustable α/β weighting for the recency vs. frequency components of the heat score formula.

---

## File Sources (Watch Sources)

- [x] **Filesystem watcher** — Point a source at a local directory path with a configurable file glob; scan discovers new supported files and adds them to the approval inbox.
- [x] **GitHub watcher** — Point a source at a GitHub repo (public or private via PAT); the GitHub REST API tree endpoint is used — no `git clone` required. Filters by sub-directory.
- [x] **Pending inbox** — All discovered files appear in the Sources tab with status `pending`, awaiting user approval or rejection.
- [x] **Approve** — Approving a file reads the raw bytes (filesystem) or downloads the blob (GitHub), extracts text, creates a Document record, and runs the full AI pipeline in the background.
- [x] **Reject** — Rejecting marks the file and skips ingestion; the rejection is stored with an optional note.
- [x] **Reversible decisions** — Approved files can be rejected retroactively; rejected files can be approved (and will be ingested). Failed ingestions can be retried.
- [x] **Scan on demand** — Each source has a "Scan Now" button that immediately triggers a fresh discovery scan; new files found are added to the pending inbox.
- [x] **Source CRUD** — Sources can be added, edited (name, path, glob, token, enabled), and deleted (cascades to all watched file records).
- [ ] **Scheduled polling** — Add a background scheduler (APScheduler or Celery beat) to automatically scan enabled sources on a configurable interval (e.g., every 15 minutes) without user interaction.
- [ ] **GitHub webhook** — Instead of polling, receive a GitHub `push` event webhook to trigger an immediate scan when files are committed to the watched branch.
- [ ] **GitLab / Bitbucket support** — Extend the watcher to support GitLab projects and Bitbucket repos using their respective REST APIs.
- [ ] **S3 / object storage source** — Watch an AWS S3 bucket (or compatible object store) prefix for new objects.
- [ ] **SharePoint / OneDrive source** — Watch a SharePoint document library or OneDrive folder via Microsoft Graph API.
- [ ] **Secure token storage** — Encrypt GitHub PATs and other secrets at rest (e.g., using Fernet symmetric encryption keyed from an environment secret) rather than storing as plain text.
- [ ] **Per-file re-scan detection** — Detect when a previously-approved file has been modified (by comparing file mtime or GitHub blob SHA) and queue it for re-review as a new version.
- [ ] **Bulk approve / reject** — Checkbox multi-select in the inbox with "Approve selected" / "Reject selected" batch actions.
- [ ] **Approval notifications** — When a scan discovers new pending files, send an in-app notification (or email) to the source owner.

---

## Document Management

- [ ] **Document versioning** — When a newer version of a document is uploaded, link it to the previous version and diff the extracted entities/relationships.
- [ ] **Bulk upload** — Upload multiple files at once via the drop zone; queue them for sequential pipeline processing.
- [ ] **URL ingestion** — Paste a URL and have the backend fetch and extract text from a web page.
- [ ] **Document tagging** — Allow users to manually tag documents with custom labels in addition to the AI-assigned category.
- [ ] **Re-process document** — Button to re-run the AI pipeline on an existing document (useful after model or prompt changes).
- [ ] **Document preview** — Click a document in the list to view its raw extracted text in a side panel.
- [ ] **Folder / collection grouping** — Organize documents into named collections; filter the graph to a single collection.
- [ ] **OCR support** — Extract text from scanned PDFs and image files (PNG, JPG) using an OCR service.

---

## Action Items

- [ ] **Due date alerts** — Visual indicator on action item nodes and the panel when a due date is approaching or overdue.
- [ ] **Action item assignment UI** — Allow users to reassign an action item to a different person entity from the panel.
- [ ] **Action item export** — Export open action items to CSV or copy to clipboard.
- [ ] **Action item linking** — Manually link an action item to an additional entity (project, idea, person) beyond what the AI extracted.
- [ ] **Action item comments** — Add a notes/comments field to each action item for tracking progress.

---

## User Experience

- [ ] **Saved graph views** — Save the current zoom/pan position and filter state as a named view that can be recalled.
- [ ] **Node pinning** — Drag a node to a fixed position that persists across sessions (currently positions reset on reload).
- [ ] **Graph search** — Type-ahead search box that highlights matching nodes and centers the view on them.
- [ ] **Mini-map** — Small overview map in the corner showing the full graph extent when zoomed in.
- [ ] **Dark mode** — Full dark theme for the graph canvas and UI chrome.
- [ ] **Keyboard shortcuts** — Escape to close panels, arrow keys to navigate between connected nodes, `/` to focus search.
- [ ] **Node hiding / filtering** — Toggle visibility of entity types (hide all keywords, hide dates, etc.) without removing them from the graph.
- [ ] **Graph export** — Export the current graph view as SVG or PNG for use in presentations.

---

## Collaboration & Access

- [ ] **Shared annotations** — Team members can add notes to nodes or edges visible to all users.
- [ ] **Role-based access** — Admin vs. regular user roles; admins can delete any document, manage users.
- [ ] **Document-level permissions** — Mark individual documents as private (visible only to uploader) or shared.
- [ ] **Activity feed** — A log of recent uploads, pipeline completions, and weight hint changes visible to the team.
- [ ] **@mention notifications** — When a person entity is extracted from a new document, notify the matching user account (if email matches).

---

## AI & Pipeline

- [ ] **Anthropic Claude provider** — Implement the stubbed `AnthropicProvider` using the Anthropic Python SDK.
- [ ] **IBM watsonx provider** — Implement the stubbed `WatsonxProvider` using the IBM watsonx.ai SDK.
- [ ] **Prompt customization** — Allow admins to edit the system prompts used for entity extraction, sentiment scoring, and re-scoring from a settings page.
- [ ] **Confidence scores** — Have the AI return a confidence score for each extracted entity and relationship; use it as an additional visual signal.
- [ ] **Multi-language support** — Pipeline handles documents in languages other than English; entity extraction is language-aware.
- [ ] **Pipeline status websocket** — Replace polling with a websocket push so the upload page updates instantly when processing completes.
- [ ] **Celery / Redis task queue** — Replace `BackgroundTasks` with a proper task queue for reliability and visibility into pipeline job status.

---

## Infrastructure & Operations

- [ ] **PostgreSQL migration** — Swap SQLite for PostgreSQL for multi-user concurrent write safety.
- [ ] **Alembic migration workflow** — Add a documented process for generating and applying Alembic migrations as the schema evolves.
- [ ] **OAuth / SSO login** — Add Google or Microsoft SSO as an alternative to email/password.
- [ ] **JWT refresh tokens** — Implement refresh token rotation so users are not logged out every 8 hours.
- [ ] **Rate limiting** — Add per-user rate limits on document uploads and AI pipeline triggers.
- [ ] **Deployment pipeline** — GitHub Actions CI/CD that builds and pushes Docker images on merge to main.
- [ ] **Health dashboard** — Admin page showing pipeline queue depth, average processing time, AI API error rate, and database size.
- [ ] **Backup / restore** — Scheduled SQLite (or PostgreSQL) backup to object storage with a restore procedure.
- [ ] **Audit logging** — Immutable log of all document uploads, deletions, and user actions for compliance.
