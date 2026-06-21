# Intraconnected — CLAUDE.md

## CRITICAL: Git Commits
**NEVER create a git commit unless the user explicitly tells you to commit.** This applies unconditionally — no exceptions for "commit all changes", "save this", "push", or any ambiguous phrasing. If in doubt, do not commit. Ask first.

## Project Overview

A node-based mind-mapping / idea-tracking web app. Users create a hierarchical tree of ideas, navigate into any node to treat it as the current root, drag nodes to reparent or delete them, and rename/link nodes via modals.

## Commands

```bash
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview production build
```

## Tech Stack

- **React 19** with hooks — no class components
- **TypeScript** (strict mode)
- **Vite** — build tool
- **SCSS** — all styling, no CSS modules
- **Firebase** — Auth (email/password) + Firestore (idea storage)
- **@dnd-kit/core** — drag and drop
- **React Router v7** — `/` (login) and `/main` routes

## Architecture

### Data Flow

1. On login, ideas are fetched from Firestore and written to `localStorage`
2. All reads come from `localStorage` via utility functions
3. All writes go to both `localStorage` and Firestore simultaneously
4. `newIdeaSwitch` (boolean toggle in context) triggers re-reads from `localStorage` — always toggle it **after** writing to `localStorage`, never before

### State Management

Global state lives in `src/context/IdeaContext.tsx` via React Context. All components consume it via `useIdeaContext()`. No Redux or Zustand.

Notable context fields beyond the obvious modal flags:
- `checklistModalId: number | null` — which checklist is open in `ChecklistModal`; `null` = closed
- `newIdeaSwitch: boolean` — toggled after any write to force re-reads from localStorage; always toggle **after** the write

### Idea Data Shape

`IdeaType` is a **discriminated union** in `src/utilities/types.ts`:

```ts
interface ChecklistItem {
  id: string;        // String(Date.now()) at creation
  text: string;
  checked: boolean;
}

interface StandardIdea {
  type?: 'standard'; // optional — undefined means standard (backward-compat)
  id: number;        // Date.now() for new ideas, 1 for the root
  content: string;
  parentID: number;
  link: string;      // external URL or empty string
}

interface ChecklistIdea {
  type: 'checklist';
  id: number;
  content: string;   // the checklist title — used by all name helpers unchanged
  parentID: number;
  items: ChecklistItem[];
}

type IdeaType = StandardIdea | ChecklistIdea;
```

Both types share `content` as the primary label so all existing name-display helpers (`getNameFromID`, rename flow, tree views) work without change. Checklist ideas have no `link` field — always use `getIdeaLink(idea)` instead of accessing `.link` directly.

### End-to-End Encryption

All idea `content` and `link` fields are AES-256-GCM encrypted before being written to Firestore. The server only ever sees ciphertext.

**Two-layer key scheme** (same pattern as Bitwarden/ProtonMail):
- Each user has a random **DEK** (Data Encryption Key) that encrypts their data. It never changes.
- The DEK is stored encrypted in Firestore at `users/{uid}/meta/encryption`, wrapped three ways:
  1. `encryptedDEK` — wrapped with a password-derived KEK (PBKDF2, 100k iterations, UID as salt)
  2. `recoveryEncryptedDEK` — wrapped with a recovery-code-derived KEK (same derivation, `-recovery` salt suffix)
  3. `emailEncryptedDEK` — wrapped with an email-derived KEK (`-email` salt suffix); no email is sent — Firebase Auth ownership of the email is the proof of identity
- `recoveryCodeAcknowledged: boolean` is stored alongside. While `false` (or missing), every login generates a fresh recovery code, re-wraps the DEK with it, and shows the recovery code screen before navigating to `/main`. Once the user clicks "I've saved it", it's set to `true` — no more prompts.

**DEK lifecycle:**
- In memory: module-level `_dek` in `dekStore.ts`
- Across page reloads: exported raw bytes stored in `sessionStorage` under key `dek_session`; restored via `loadDEKFromSession()` on mount and on `visibilitychange`
- On sign-out: `clearDEK()` wipes both `_dek` and `sessionStorage`

**`enc:` prefix:** Encrypted ciphertext is stored as `enc:<base64>`. `decryptField` checks for the prefix — plaintext legacy values pass through unchanged, enabling backward-compatible migration.

**Auth screens in `Auth.tsx`** (three mutually exclusive render paths before the normal login form):
1. `showRecoveryInput` — enter recovery code after a password reset; "Sign Out" and "Restore Access" buttons
2. `pendingRecoveryCode` — display new recovery code; copy, download, and "I've saved it" buttons; context message varies by `recoveryCodeContext`: `'signup'` (welcome), `'migration'` (encryption added to existing account), `'restore'` (after password-reset recovery)
3. Normal login/signup form

**Navigation guards:**
- `isSigningIn` ref — blocks `onAuthStateChanged` auto-redirect while login async work is in flight
- `isShowingRecoveryCode` ref — blocks auto-redirect while recovery code screen is displayed
- `Idea.tsx` `visibilitychange` listener — when tab regains focus, checks DEK in memory/session and redirects to `/` if missing

**Firestore rules required** (must be set in Firebase Console):
```
match /users/{userId}/meta/{document} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### Navigation Model

- `rootId` — the currently displayed idea (its children fill the grid)
- `rootIdStack` — a `useRef<number[]>` acting as a history stack; push on zoom-in, pop on back
- Root idea always has `id: 1` and is never deletable

### Node Types

Determined at render time in `IdeaNode.tsx`:
- **leaf** — no children, no link → green (`$leaf`)
- **parent** — has children → blue (`$sky`)
- **link** — has a URL → yellow (`$link`)
- **checklist** — `type === 'checklist'` → indigo (`$indigo`); not navigable, cannot receive DnD drops; clicking the header opens `ChecklistModal`

## Directory Structure

```
src/
├── pages/
│   ├── Idea.tsx              # main page — DnD context, navigation state, drag handler
│   └── Login.tsx             # login page wrapper
├── components/
│   ├── IdeaNode.tsx              # draggable/droppable idea card
│   ├── MindMap.tsx               # desktop full-tree overlay; pan/zoom; clicking a node navigates to it
│   ├── MobileMindMap.tsx         # mobile-only UI orchestrator (shown ≤576px, hidden on desktop)
│   ├── MobileHelpSheet.tsx       # mobile help carousel (3 screens); owns helpScreen state
│   ├── MobileMoveSheet.tsx       # mobile move-tree sheet; owns expandedMoveNodes state + auto-scroll
│   ├── MobileNavigateSheet.tsx   # mobile full-tree jump sheet (◎ button); navigate-only, no move
│   ├── MobilePatchNotesSheet.tsx # mobile patch notes bottom sheet
│   ├── PatchNotes.tsx            # desktop "What's New" popup panel (right Navbar)
│   ├── TooltipButton.tsx         # button wrapper with 1000ms delayed hover tooltip
│   ├── Navbar.tsx                # left + right sidebars
│   ├── DepthIndicator.tsx        # breadcrumb dot in right sidebar
│   ├── Trash.tsx                 # drop zone for deletion
│   ├── Help.tsx                  # 3-screen help carousel
│   ├── LastIdea.tsx              # drop zone to move idea to parent
│   ├── MessageBox.tsx            # toast notifications
│   ├── Auth.tsx                  # login/signup form
│   └── modals/
│       ├── CreationModal.tsx       # create new idea (tabs: Idea | Checklist)
│       ├── ChecklistModal.tsx      # full-view checklist modal (desktop); opened via checklistModalId context
│       ├── RenameModal.tsx         # rename idea or current root; says "Rename Checklist" for checklist nodes
│       ├── LinkChangeModal.tsx     # add/change external link
│       └── DeleteConfirmModal.tsx  # confirm before deleting
├── context/
│   └── IdeaContext.tsx       # all global state
├── utilities/
│   ├── index.ts              # barrel export
│   ├── types.ts              # IdeaType discriminated union (StandardIdea | ChecklistIdea) + ChecklistItem
│   ├── parseChangelog.ts     # parses CHANGELOG.md into ChangelogEntry[]
│   ├── crypto.ts             # AES-256-GCM encryption primitives + DEK/KEK key scheme
│   ├── dekStore.ts           # in-memory + sessionStorage DEK persistence
│   ├── firebase/
│   │   ├── firebaseHelpers.tsx   # Firestore CRUD (encrypts/decrypts all idea fields)
│   │   └── authFirebase.tsx      # sign out (clears DEK)
│   └── idea/
│       ├── helpers.tsx       # navigation helpers, name/link lookups, cleanLink(), getIdeaLink()
│       ├── storage.tsx       # localStorage CRUD; updateChecklistItems() for checklist item writes
│       ├── parsing.tsx       # getIdeasByParentID, recursive delete
│       ├── creation.tsx      # handleIdeaCreation, handleChecklistCreation
│       └── organizers.tsx    # fetchFromFirebaseAndOrganizeIdeas
├── styles/
│   ├── variables.scss        # colors, breakpoints
│   ├── index.scss            # global styles + imports
│   ├── idea.scss             # main page + node styles
│   ├── mindmap.scss          # desktop MindMap overlay styles
│   ├── mobileMindMap.scss    # mobile UI styles
│   ├── navbar.scss           # sidebar styles
│   ├── depth.scss            # breadcrumb indicators
│   ├── ideaCreationModal.scss # all modal styles (shared)
│   ├── auth.scss
│   └── help.scss
├── CHANGELOG.md              # source of truth for patch notes (parsed at build time)
└── firebaseConfig.ts         # Firebase init
```

## Critical Gotchas

### `ideas` state vs `fetchFullIdeaList()`
`ideas` in context only holds the **current root's direct children** (populated via `getIdeasByParentID(rootId)`). It is NOT a full list of all ideas. To read all ideas, use `fetchFullIdeaList()` which reads from `localStorage`. Never assume `ideas` contains anything outside the current view.

### `rootIdStack` is a ref (desktop only)
`rootIdStack` is a `useRef<number[]>`, not state. Pushing/popping does not trigger re-renders. The stack is mutated directly (`rootIdStack.current.push(id)`). Re-renders are driven by `setRootId` / `setRootName` calls alongside stack mutations. `MobileMindMap` does **not** use `rootIdStack` — it tracks navigation with a local `currentId` state instead.

### Modal `min-height` specificity
`.neobrutal.modal` has `min-height: 18rem` (and overrides in media queries). A plain `.confirmModal {}` rule will lose the specificity battle. The correct override is `.neobrutal.modal.confirmModal { min-height: auto; }` applied at all three breakpoints.

### `setIdeas` functional updates
`setIdeas` is typed in context as `(ideas: any) => void` but the underlying setter is a React `useState` dispatcher that accepts functional updates. `setIdeas((prev) => prev.filter(...))` works fine at runtime despite the loose typing.

### Firebase collection path
Ideas are stored at `users/{uid}/ideas/{ideaId}` in Firestore. The Firebase config is hardcoded in `src/firebaseConfig.ts` (no `.env` file).

### Always use `getIdeaLink()` — never access `.link` directly
`ChecklistIdea` has no `link` field. Accessing `idea.link` directly on an `IdeaType` will cause a TypeScript error (and a runtime `undefined`). Always use `getIdeaLink(idea)` from `utilities/idea/helpers.tsx`, which returns `''` for checklists and unknown ideas.

### Checklist items are encrypted in Firestore
`firebaseHelpers.tsx` branches on `data.type === 'checklist'`: for checklists it encrypts/decrypts `items[].text` instead of `link`. `updateChecklistItemsInFirebase` encrypts each item's text before writing. Never write raw item text to Firestore directly.

### Email change breaks email recovery
`emailEncryptedDEK` is derived from the user's email address at account creation. If a user ever changes their email (not currently a feature), `emailEncryptedDEK` must be re-derived with the new address and updated in Firestore. Failing to do so means "Recover via email" will silently fail — `unwrapDEKWithEmail` will throw because the derived KEK no longer matches.

### Password change requires DEK re-wrap
If you ever add a "change password" feature using Firebase's `updatePassword()`, you **must** also re-wrap the DEK with the new password and update `encryptedDEK` in Firestore. Failing to do so means the next login will successfully authenticate with Firebase but `unwrapDEK` will throw (wrong KEK) — which is the same code path as a password reset, incorrectly sending the user to the recovery code input screen.

### `updateIdeaParentId` syncs Firebase automatically
`updateIdeaParentId(id, newParentId)` in `storage.tsx` writes to both `localStorage` **and** calls `updateIdeaParentIdInFirebase` internally. Do not add a separate Firebase call after using it — that would double-write.

## Key Conventions

### Modals

All modals share styles from `ideaCreationModal.scss`. Structure:
```tsx
<section className="overlay">
  <div className="modal neobrutal [modifier]">
    {/* content */}
    <section className="modalButtons">
      <button className="modalButton cancel neobrutal-button">Cancel</button>
      <button className="modalButton continue neobrutal-button">Action</button>
    </section>
  </div>
</section>
```

Button colors: `cancel` → yellow (`$link`), `continue` → green (`$leaf`), `delete` → red (`$danger`).

Add `confirmModal` class to `.modal` for modals without a textarea (overrides `min-height`).

### Rename Flow

`currentNameChangeId === -1` means renaming the root. Any other value targets a child node. `RenameModal` uses `editRootOrNot` to distinguish. `setNewIdeaSwitch` must be called **inside** the Firebase `.then()` after `updateIdeaName`, not in the button's `onClick`.

### Delete Flow

Dragging to trash sets `pendingDeleteId` and opens `DeleteConfirmModal`. The modal runs `recursivelyDeleteChildren(id)` (handles both localStorage and Firestore) then filters the `ideas` state array.

### Mobile UI (`MobileMindMap`)

`MobileMindMap` is rendered at the bottom of `Idea.tsx` alongside all desktop components. CSS (`mobileMindMap.scss`) shows it only on `≤$mobile` (576px) and the desktop layout hides itself at the same breakpoint.

Key differences from desktop:
- **Navigation**: local `currentId` state replaces `rootIdStack`; breadcrumb bar at top replaces depth indicators
- **Interaction**: tap navigates into a node (or opens link if it has one); long-press (360ms) opens an actions bottom sheet; edit mode (pencil button) makes a single tap open the actions sheet instead; long-press also works on the current root header
- **Sheets**: uses a local `sheet` state (`SheetState` discriminated union) for bottom sheets — does **not** use context modal flags (`renameModalOpen`, etc.)
- **Sheet types**: `actions` | `rename` | `move` | `link` | `confirmDelete` | `navigate` | `checklist`
- **Move tree**: rendered by `MobileMoveSheet`; owns `expandedMoveNodes` state and auto-scroll logic; scrollable tree with expand/collapse; auto-scrolls to current parent on open; descendants and current parent are disabled as move targets
- **Navigate tree**: rendered by `MobileNavigateSheet` (◎ button in FAB area); same tree UI as move but for jumping to any node; link nodes are disabled as destinations; auto-scrolls to the current node on open
- **Patch notes**: rendered by `MobilePatchNotesSheet` (patch notes button in FAB area); reuses the help-sheet shell; parses `CHANGELOG.md` via `parseChangelog`
- **FAB area**: four buttons — patch notes, ◎ (navigate), + (create), ✎ (edit mode toggle)
- **Checklist nodes (mobile)**: tap = toggle inline accordion (expand/collapse items in place); tap the `OpenIcon.svg` button in the header row = open the `checklist` full-view sheet. The `checklist` sheet has its own `sheetItems`/`sheetItemDraft` state initialized fresh from localStorage on open. Sheet items support drag-to-reorder (via `@dnd-kit/sortable`) and inline text editing (pen icon). Checklist nodes cannot be navigated into and cannot receive drops or be moved into. In the move/navigate trees they appear disabled with `mmobile-move-btn--checklist` styling.
- **Rename vs. rewrite**: the actions sheet and rename sheet label the action "Rename Idea" when the node has children, "Rewrite Idea" when it's a leaf, "Rename Checklist" for checklist nodes; new ideas use an auto-resizing `<textarea>`, existing renames use a single-line `<input>`
- **Help carousel**: rendered by `MobileHelpSheet`; owns its own `helpScreen` state (1–3); receives only an `onClose` prop
- **Link cleaning**: `cleanLink()` in `utilities/idea/helpers.tsx` normalizes URLs — upgrades `http://` to `https://`, passes through any other existing protocol unchanged, prepends `https://` if no protocol present, and appends `.com` only when the hostname has no TLD (no dot). Never double-adds a protocol.
- **No DnD**: doesn't use `@dnd-kit` at all; touch events handle long-press detection with `touchMoved` guard to cancel on scroll

### Desktop MindMap (`MindMap.tsx`)

Toggled by the logo button in the left Navbar (`showMindMap` state in `Idea.tsx`). When open, the main grid is hidden and `MindMap` renders as a full overlay inside the `.left` column area.

- **Pan**: mouse drag on the canvas background (ignored if target is a button)
- **Zoom**: scroll wheel (non-passive listener so `preventDefault` works); clamped to 0.2–4×
- **TreeNode**: recursive component; expand/collapse per node (`collapsed` state); highlights current `rootId` with `mm-node-btn--current`
- **Navigation**: clicking any node rebuilds `rootIdStack` from scratch (walks up the tree to reconstruct the full path), then calls `setRootId` + `setRootName` + `onClose`
- **Initial expand state**: ancestors of the current `rootId` start expanded; all others start collapsed
- Styles live in `mindmap.scss`; BEM-style classes prefixed with `mm-`

Navbar accepts `setShowMindMap`, `showMindMap`, and `setShowPatchNotes` props. When `showMindMap` is true: the `+` (create) button and depth indicators are hidden; the logo button gets a `logo-map-box` wrapper class. All nav buttons use `TooltipButton` instead of plain `<button>`.

### Patch Notes

`src/CHANGELOG.md` is the single source of truth. Format — each entry is a `##` section:

```md
## TAG | Title
Description text.
```

`parseChangelog(raw)` in `utilities/parseChangelog.ts` splits on `^## `, then splits each section's first line on `|` to extract `{ tag, title, description }`.

- **Desktop**: `PatchNotes` component (right column of `Idea.tsx`); toggled by the patch notes button in the right Navbar; `showPatchNotes` state lives in `Idea.tsx`
- **Mobile**: `MobilePatchNotesSheet` bottom sheet; toggled by the patch notes button in the FAB area; `showPatchNotes` state is local to `MobileMindMap`
- Both parse `changelog` at module load (outside the component), not on each render.

**What belongs in CHANGELOG.md:** Only significant new features warrant a changelog entry. Bug fixes and small additions are shipped as `.x` patch version increments and do **not** get a changelog entry — they are silent updates.

**Private dev log:** `DEVLOG.md` at the project root tracks every update (features, bug fixes, small additions). It is never imported or displayed. Changes should only be made just before the update is pushed. Do not commit yourself, the user will commit the changes. The changes should be concise and not overly complex. Multiple issues dealing with the same feature should be collapsed into one hyphen-point. Make sure every update is given a name that summarizes it in a few words.

### TooltipButton

`TooltipButton` wraps a `<button>` in a `div.tooltip-wrapper` and shows a floating label after a 1000ms hover delay.

Props:
- `tooltip: string` — the label text
- `tooltipSide?: 'left' | 'right'` — defaults to `'right'`; controls which side the tip appears on

While visible the button also receives a `tooltip-highlighted` class. All other `<button>` props pass through unchanged. Use this for every nav button; don't add raw `title` attributes alongside it.

### Checklist Ideas

Created via the "Checklist" tab in `CreationModal`. Uses `handleChecklistCreation` in `creation.tsx`.

- **Desktop card** (`IdeaNode.tsx`): renders inline with checkboxes + hover-visible trash and edit icons per item + add-item input + drag-to-reorder via `@dnd-kit/sortable`. Clicking the header opens `ChecklistModal` (full-view modal). The card is not clickable-to-navigate and cannot receive DnD drops (`useDroppable` disabled for checklists).
- **Desktop full-view** (`ChecklistModal.tsx`): opened via `checklistModalId` in context. Manages its own item state; writes to localStorage + Firestore via `updateChecklistItems` on every toggle/add/delete/reorder. Items support drag-to-reorder and inline text editing (pen icon). Uses `overlay--scroll` class so the overlay scrolls when the list is tall.
- **`checklistModalId`** in context: `number | null` — set to an idea's `id` to open `ChecklistModal`, `null` to close it. `IdeaNode.tsx` sets it on header click; `ChecklistModal` clears it on close.

### Drag and Drop (Desktop)

Drag is disabled on mobile (`window.matchMedia('(max-width: 768px)')`). Drop targets: `trash` (delete), `last-idea` (reparent to grandparent), `idea-{id}` (reparent). Link nodes and **checklist nodes** cannot receive drops (`useDroppable` `disabled: isMobile || isChecklist`). `PointerSensor` requires 10px movement before a drag starts (prevents accidental drags on clicks).

### SCSS Colors (`variables.scss`)

```scss
$background-color: #E9F9E5;  // page background
$neutral:          #D3DED1;  // input/textarea background
$roots:            #A3703E;  // root/parent nodes, depth indicators
$sky:              #00A9D8;  // parent nodes
$leaf:             #41BC28;  // leaf nodes, confirm buttons
$back:             #C84600;  // back button
$danger:           #C80000;  // delete button
$link:             #E8E879;  // link nodes, cancel buttons
$neo-pink:         #DB44A4;
$neo-green:        #2B701D;
$purple:           #7322C3;
$indigo:           #2049C5;
$teal:             #1EB899;
$orange:           #EC8A13;
```

### Breakpoints

```scss
$mobile:              576px;
$tablet:              768px;
$desktop:             1024px;
$macbook-air-15:      1439px;
$macbook-air-13:      1999px;
$large-desktop:       1921px;
$very-large-desktop:  3840px;
```

Drag and drop UI is hidden on mobile. Depth indicators are hidden on mobile (`display: none`). The desktop layout and `MobileMindMap` swap at `$mobile` (576px).
