Status: ready-for-agent

# Note-Mode Rendering for Standard Ideas

## Problem Statement

Users sometimes want to capture much longer, free-form text on an idea — a paragraph of context, a draft, a scratch thought — than the app's idea model currently supports well. Standard ideas cap `content` at 200 characters and are designed to read as short labels on a node face. There's no way to hold substantial written content on a node without it looking and behaving like a cramped, truncated label, and no distinct visual treatment that signals "this node is a note, not a short idea."

## Solution

Standard ideas automatically become notes once they've grown long enough — no new idea type, no new creation flow. Once an idea's `content` exceeds 150 characters, its card renders in "note mode": the long text becomes a scrollable, inline-editable body (typewriter-style font, distinct color, widened to 2 grid columns once it's substantial), and a new optional header field (`noteTitle`) provides the short, always-visible label that the rest of the app already expects every idea to have (mind map, breadcrumbs, navigate/move sheets). Shrinking the content back below the threshold reverts the card to normal leaf/parent rendering automatically — note mode is a live rendering decision, not a stored flag.

## User Stories

1. As a user, I want to type a long thought into a regular idea and have it automatically become a note once it's long enough, so that I don't have to pick a special "note" type up front.
2. As a user, I want a note's card to look visually distinct (color, font) from standard/checklist/link nodes, so that I can tell at a glance which nodes hold long-form content.
3. As a user, I want the note's distinct color to still feel related to the leaf-node green, so that the palette reads as a family rather than a clash.
4. As a user, I want the note body rendered in a typewriter/monospace-style font, so that it feels like a written note rather than a short label.
5. As a user, I want to give a note a short header title, so that I can identify it in the mind map, breadcrumbs, and navigation sheets without reading the whole body.
6. As a user, I want an unnamed note's header to show nothing at rest and only hint "Untitled" on hover, so that the card doesn't look cluttered before I've named it.
7. As a user on mobile (or anywhere hover isn't available — breadcrumbs, mind map overlay, move/navigate sheets), I want an unnamed note to show a static "Untitled" label, so that it's always identifiable somewhere hover can't help.
8. As a user, I want clicking a note's header to navigate into its children, exactly like clicking any other parent/leaf idea, so that notes remain full first-class nodes in the tree.
9. As a user, I want clicking inside a note's body text to never navigate, so that I can interact with long text without accidentally leaving the view.
10. As a user, I want to click directly into an expanded note's body text and start editing immediately, so that editing a note doesn't require opening a separate modal.
11. As a user, I want my note body edits to save automatically when I click away, so that I don't have to find a save button.
12. As a user, I want a collapsed note's body to truncate with a "Show more" affordance (matching the existing leaf-node overflow pattern), so that long notes don't dominate the grid until I choose to expand them.
13. As a user, I want an expanded note to offer "Show less" to collapse it back, so that I can tidy the grid back up after reading.
14. As a user, I want the note's header to be editable the same way other node titles are edited (the existing rename button/flow), so that the interaction is familiar rather than a new pattern to learn.
15. As a user, I want a note card to widen to span two grid columns once its body is long enough, so that substantial notes get more visible space instead of being squeezed into a standard tile.
16. As a user, I want the 2-column widening to only kick in once the body is genuinely long (not right at the note-mode threshold), so that moderately-long notes don't unnecessarily disrupt the grid layout.
17. As a user, I want the note's content textarea to allow much more text than a standard idea (up to 2000 characters), so that I can write several paragraphs before hitting a limit.
18. As a user, I want note content to be end-to-end encrypted exactly like all other idea content, so that my notes get the same privacy guarantees as everything else in the app.
19. As a user, I want a note's new title field to also be end-to-end encrypted, so that naming a note doesn't leak plaintext to Firestore.
20. As a user, I want a note to keep working with priority (P1/P2/P3 ribbon), drag-and-drop reparenting, and deletion exactly as any other idea does, so that notes aren't a second-class node type with missing features.
21. As a user, I want notes to work the same way on mobile as on desktop (header tap navigates, body tap expands/edits inline), so that the feature isn't desktop-only.
22. As a user, I want a note that's a leaf (no children) to still be navigable into an empty grid, exactly like any other empty standard idea, so that I can later add children under a note.
23. As a user, I want the note-mode threshold to apply consistently regardless of how the content got long (typed directly, pasted, or edited after creation), so that the behavior is predictable.
24. As a user creating a new idea, I want the same "Idea" creation tab I use today (no separate "Note" tab), so that creating a note doesn't add a new decision to the creation flow.

## Implementation Decisions

- **No new `IdeaType`.** `StandardIdea` gains one new optional field: `noteTitle?: string`. `content` keeps its existing role and meaning; only its allowed length changes.
- **Note-mode trigger is computed at render time**, not stored: `content.length > 150` renders the card in note mode. There is no persisted "is this a note" flag — shrinking `content` back under the threshold reverts the card to standard leaf/parent rendering on the next render.
- **2-column grid span trigger is a separate, higher threshold**: `content.length > 500` adds `grid-column: span 2` to the idea's grid wrapper. Below that, a note-mode card stays a normal single-column tile (just with note styling).
- **Creation flow unchanged**, except the Idea tab's textarea max length increases from 200 to 2000 characters (the new global cap for `content`). No new tab, no new modal state.
- **Card layout mirrors the existing Checklist header/body split**:
  - **Header** = `noteTitle`. Always visible. Click navigates into the idea's children, same as any other node — this is a real navigation target, not a modal trigger (unlike the Checklist header, which opens a modal).
  - **Body** = `content`. Click never navigates (event propagation stopped the same way the checklist items area already does). Truncated by default using the existing leaf-node "Show more ▾ / Show less ▴" fade-overlay pattern. Clicking directly into the visible text swaps it to an editable textarea in place; blur commits the change (write to localStorage + debounced/direct Firestore write, no confirmation modal).
- **Header editing reuses the existing rename affordance** (the pencil/edit button already present on every node, backed by `RenameModal` + `currentNameChangeId`). When the target idea is in note mode, that flow is repointed to read/write `noteTitle` instead of `content`.
- **Empty-header display**: on the node card itself, an empty `noteTitle` renders no text at rest; hovering reveals a ghost "Untitled" placeholder (CSS/hover-state only, not written to data). Everywhere else the label is read outside a hover context — mind map overlay, breadcrumbs, move/navigate sheets, and all of mobile (no hover available on touch) — an empty `noteTitle` resolves to the literal static string `"Untitled"`.
- **Styling**: background color `$neo-green` (`#2B701D`) for note-mode cards — deliberately close to `$leaf` to read as a related, not competing, color. Body text uses a typewriter/monospace font (e.g. Courier Prime), which is not currently loaded anywhere in the app and needs to be added (Google Fonts import or self-hosted), scoped to the note body only — it should not affect the app's base `DM Sans` typography elsewhere.
- **Firebase**:
  - `content` encryption path is unchanged — it already goes through the existing `encryptField`/`decryptField` calls used for Standard ideas.
  - `noteTitle` is a new field and needs its own encrypt-on-write / decrypt-on-read handling added wherever Standard idea `content` is currently handled (idea creation, full-list fetch).
  - A new update path is needed for editing `noteTitle` in isolation (mirroring how idea renames and link changes each have their own dedicated Firestore update function) — write to localStorage first, then Firestore, then flip the app's re-read toggle in the Firestore `.then()`, consistent with how every other write in this app is sequenced.
- **Mobile parity assumption (flagged, not user-confirmed)**: mobile mirrors the desktop split — tapping the header navigates, tapping the body expands/edits inline in place. This was a synthesized design decision to keep behavior consistent across platforms rather than forking the interaction model for touch; it was not explicitly confirmed by the user and should be revisited if it doesn't feel right in practice.

## Testing Decisions

- **No automated test framework currently exists on `main`.** There is prior art for one: an in-progress, unmerged worktree (`unified-navigation`) has adopted Vitest for pure-function unit tests (e.g. a test suite for an ancestor-path helper), but this hasn't landed on `main` and there's no `test` script wired up yet at the root.
- **If Vitest is adopted**, this feature's pure logic is the natural first candidate for unit tests, following that worktree's existing pattern (`describe`/`it`/`expect`, testing input/output of a pure function, not component internals): a note-mode detector (`content.length` past threshold), a 2-column-span detector, and the "Untitled" label-resolution fallback are all pure functions of an idea's data and can be tested without rendering anything.
- **UI and interaction behavior — card rendering, inline body editing, the header/body click split, hover-only ghost text, expand/collapse — has no existing component-test precedent in this repo** and should be verified manually in the browser per the project's existing convention for frontend changes (start the dev server, exercise the golden path and edge cases directly).

## Out of Scope

- Rich text or markdown formatting in the note body (plain text only).
- A separate, explicit "Note" idea type or creation tab — note-ness stays a length-derived rendering state of Standard ideas.
- A manual toggle to force an idea in or out of note mode independent of its content length.
- Any change to drag-and-drop, deletion, or reparenting behavior for note-mode ideas — they behave exactly like any other Standard idea for those flows.
- Search functionality (no search feature exists in the app today; only the label-fallback behavior for existing label-consuming surfaces is addressed here).
- Data migration — no existing ideas need backfilling, since note mode is purely derived from `content` at read/render time.

## Further Notes

- The mobile behavior (item 21 / the flagged assumption above) is the one open design question that wasn't explicitly settled with the user before this PRD was written, per this skill's synthesize-don't-interview instruction. Worth a quick confirmation pass before or during implementation.
- This repo has not had `setup-matt-pocock-skills` run yet — there's no configured issue tracker or triage label mapping (the template files under `.agents/skills/setup-matt-pocock-skills/` are still defaults). The repo has a GitHub remote (`Africk-Hunter/Intraconnected`), but the `gh` CLI isn't available in this environment, so this PRD was written to local markdown (`.scratch/note-mode-rendering/PRD.md`) instead of published as a GitHub issue. Run `/setup-matt-pocock-skills` to wire up a real tracker, or move this file to a GitHub issue manually.
