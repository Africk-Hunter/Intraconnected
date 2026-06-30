# Intraconnected — CLAUDE.md

## CRITICAL: Git Commits
**NEVER create a git commit unless the user explicitly tells you to commit.**

## Project Overview
Node-based mind-mapping app. Users create hierarchical idea trees, navigate into nodes, drag to reparent/delete, rename/link via modals.

## Commands
```bash
npm run dev    # start dev server
npm run build  # production build
```

## Tech Stack
- **React 19**, **TypeScript** (strict), **Vite**, **SCSS**
- **Firebase** — Auth (email/password) + Firestore
- **@dnd-kit/core** — drag and drop
- **React Router v7** — `/` (login) and `/main`

## Architecture

### Data Flow
1. Login → fetch from Firestore → write to `localStorage`
2. All reads: `localStorage` via utility functions
3. All writes: `localStorage` + Firestore simultaneously
4. `newIdeaSwitch` toggle triggers re-reads — toggle **after** writing to localStorage, never before

### State Management
Global state in `src/context/IdeaContext.tsx` via `useIdeaContext()`. Key fields:
- `checklistModalId: number | null` — which checklist is open; `null` = closed
- `newIdeaSwitch: boolean` — toggle after any localStorage write to force re-reads
- `ideas` — **only current root's direct children**, NOT all ideas. Use `fetchFullIdeaList()` for all ideas.

### Idea Data Shape (`src/utilities/types.ts`)
```ts
interface ChecklistItem {
  id: string;        // String(Date.now())
  text: string;
  checked: boolean;
  link?: string;
}

interface StandardIdea {
  type?: 'standard'; // undefined = standard (backward-compat)
  id: number;
  content: string;
  parentID: number;
  link: string;
  priority?: 1 | 2 | 3;  // 1=High, 2=Medium, 3=Low
}

interface ChecklistIdea {
  type: 'checklist';
  id: number;
  content: string;
  parentID: number;
  items: ChecklistItem[];
  priority?: 1 | 2 | 3;
}

type IdeaType = StandardIdea | ChecklistIdea;
```

### Navigation Model
- `rootId` — currently displayed idea (its children fill the grid)
- `rootIdStack` — `useRef<number[]>` history stack; push on zoom-in, pop on back (desktop only)
- Root always `id: 1`, never deletable

### Node Types (render-time, `IdeaNode.tsx`)
- **leaf** — no children, no link → green (`$leaf`)
- **parent** — has children → blue (`$sky`)
- **link** — has URL → yellow (`$link`)
- **checklist** — `type === 'checklist'` → indigo; not navigable, no DnD drops

## Critical Gotchas

### Always use `getIdeaLink()` — never `.link` directly
`ChecklistIdea` has no `link` field. Use `getIdeaLink(idea)` from `utilities/idea/helpers.tsx`.

### `ideas` state is not the full list
Use `fetchFullIdeaList()` (reads localStorage) to get all ideas. Never assume `ideas` contains anything outside the current view.

### `rootIdStack` is a ref, not state
Mutations don't trigger re-renders. `MobileMindMap` uses local `currentId` state instead.

### `updateIdeaParentId` syncs Firebase automatically
Do not add a separate Firebase call after — it double-writes.

### Priority writes require both calls
```ts
updateIdeaPriority(id, priority);           // localStorage only
schedulePriorityFirebaseWrite(id, priority); // debounced Firestore sync
```
Never call `updateIdeaPriorityInFirebase` directly from a component.

### Checklist items are encrypted in Firestore
`updateChecklistItemsInFirebase` encrypts both `items[].text` and `items[].link`. Never write raw item text/link to Firestore directly.

### `setNewIdeaSwitch` must be called inside Firebase `.then()`
Not in the button's `onClick`.

### Modal `min-height` specificity
`.neobrutal.modal` has `min-height: 18rem`. Override: `.neobrutal.modal.confirmModal { min-height: auto; }` at all three breakpoints.

### `setIdeas` accepts functional updates
`setIdeas((prev) => prev.filter(...))` works despite the loose `(ideas: any) => void` typing.

### Firebase collection path
Ideas at `users/{uid}/ideas/{ideaId}`. Config hardcoded in `src/firebaseConfig.ts` (no `.env`).

### Password change requires DEK re-wrap
If adding "change password" via `updatePassword()`, re-wrap the DEK with the new password and update `encryptedDEK` in Firestore — otherwise next login throws on `unwrapDEK` and sends user to recovery screen.

### E2E Encryption
All idea `content` and `link` fields AES-256-GCM encrypted before Firestore writes. Ciphertext stored as `enc:<base64>`. `decryptField` passes plaintext through unchanged (backward-compat). DEK in module-level `_dek` (dekStore.ts) + `sessionStorage` key `dek_session`. `clearDEK()` wipes both on sign-out.

## Key Conventions

### Modals
```tsx
<section className="overlay">
  <div className="modal neobrutal [modifier]">
    <section className="modalButtons">
      <button className="modalButton cancel neobrutal-button">Cancel</button>
      <button className="modalButton continue neobrutal-button">Action</button>
    </section>
  </div>
</section>
```
`cancel` → yellow (`$link`), `continue` → green (`$leaf`), `delete` → red (`$danger`).
Add `confirmModal` to `.modal` for modals without a textarea (fixes `min-height`).

### Rename Flow (Desktop)
`currentNameChangeId === -1` = renaming root. `setNewIdeaSwitch` must be called inside the Firebase `.then()` after `updateIdeaName`.

### Delete Flow
Dragging to trash sets `pendingDeleteId` → `DeleteConfirmModal` → `recursivelyDeleteChildren(id)` (localStorage + Firestore) → filter `ideas` state.

### Priority System
`priority?: 1 | 2 | 3` (1=High/red, 2=Medium/orange, 3=Low/yellow). Corner ribbon in top-left of each node. Always write both calls (see Critical Gotchas above).

Sorting via `sortIdeas(ideas, mode)` in `parsing.tsx`: `'priority'` (P1→P2→P3→none) or `'recent'` (ascending `id`). Persisted to localStorage as `idea_sort_mode`.

### Drag and Drop (Desktop only)
Disabled on mobile. Drop targets: `trash`, `last-idea`, `idea-{id}`. Checklist nodes cannot receive drops. `PointerSensor` requires 10px movement.

Custom collision detection: `trash`/`last-idea` use rect intersection; idea nodes use pointer-proximity with 10px buffer. Custom drag modifier constrains left/right/top edges but leaves bottom open (so trash is reachable). Do not restore `restrictToWindowEdges`.

### Desktop Navbar
Left sidebar: **Create** (green, top) → **Home** (burnt-orange; grays out + disabled when `rootId === 1`, triggers fade transition via `setNodesVisible`) → **Mind Map toggle** (pink, `MindMapBlack.svg`; wraps in `.nav-btn-group` which gets `--active` class). Right sidebar: log out, help, patch notes.

`returnToRoot()` from `utilities/idea/helpers` handles stack clearing.

### Desktop Node Overflow
Both checklist item lists and leaf-node content truncate when overflowing with a "Show more ▾" fade overlay; "Show less ▴" collapses. State resets on navigation.

### Mobile UI (`MobileMindMap`, shown ≤576px)
Rendered at bottom of `Idea.tsx`; CSS swaps desktop/mobile at 576px. Mobile-specific sub-components live in `src/components/mobile/` (`MobileChecklistItemSheet`, `SortableMobileChecklistItem`, `mobileTypes.ts`).

Key differences from desktop:
- **Navigation**: local `currentId` state, not `rootIdStack`; breadcrumb bar at top; navigation is instant (`setCurrentId` directly — no fade/timeout)
- **Sheets**: local `sheet` state (`SheetState` union from `mobileTypes.ts`) — does **not** use context modal flags
- **Sheet types**: `rename | edit | move | link | confirmDelete | checklist` (`actions` sheet removed; `edit` replaces separate rename+link sheets)
- **Edit sheet**: single sheet with auto-growing textarea (name) + optional URL input (leaf only); `commitEdit()` saves both in one pass
- **Swipe-to-reveal**: swipe left on any node slides it to expose three buttons — edit (blue), move (yellow), delete (red); swiping back or tapping elsewhere dismisses; one node revealed at a time; tracked via `swipeRevealedId` state
- **Mind map**: `showMindMap` boolean (not a SheetState); rendered by `MobileMindMapSheet` (◎ FAB button)
- **Drag-and-drop**: long-press (360ms, `pressingNodeId` state) initiates drag with a ghost element (`isDragging`/`dragPos`); drop onto sibling reparents; "↑ Move to parent" zone slides in at list top when dragging inside a nested level (`parentZoneRef`); auto-scrolls near edges (80px, 250ms delay, 4px/frame); checklist/link nodes excluded as drop targets; `touchmove` prevented on document during drag
- **Checklist nodes**: tap = inline accordion (`expandedChecklists` Set); tap OpenIcon = open `checklist` sheet
- **FAB**: patch notes, ◎ (mind map), + (create) — edit mode and ✎ button removed
- **Keyboard**: `keyboardInset` state tracks `visualViewport` resize to lift sheets above software keyboard

### Changelog & DEVLOG
- `src/CHANGELOG.md` — only significant new features get entries; bug fixes are silent `.x` patches
- Format: `## TAG | Title\nDescription`
- `DEVLOG.md` at project root — tracks every update before pushing; concise; collapse same-feature issues into one point; do not commit yourself
