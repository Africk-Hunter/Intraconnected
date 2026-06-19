# Intraconnected — CLAUDE.md

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

### Idea Data Shape

```ts
interface IdeaType {
  id: number;        // Date.now() for new ideas, 1 for the root
  content: string;
  parentID: number;
  link: string;      // external URL or empty string
}
```

### Navigation Model

- `rootId` — the currently displayed idea (its children fill the grid)
- `rootIdStack` — a `useRef<number[]>` acting as a history stack; push on zoom-in, pop on back
- Root idea always has `id: 1` and is never deletable

### Node Types

Determined at render time in `IdeaNode.tsx`:
- **leaf** — no children, no link → green
- **parent** — has children → blue (`$sky`)
- **link** — has a URL → yellow (`$link`)

## Directory Structure

```
src/
├── pages/
│   ├── Idea.tsx              # main page — DnD context, navigation state, drag handler
│   └── Login.tsx             # login page wrapper
├── components/
│   ├── IdeaNode.tsx          # draggable/droppable idea card
│   ├── MobileMindMap.tsx     # mobile-only UI orchestrator (shown ≤576px, hidden on desktop)
│   ├── MobileHelpSheet.tsx   # mobile help carousel (3 screens); owns helpScreen state
│   ├── MobileMoveSheet.tsx   # mobile move-tree sheet; owns expandedMoveNodes state + auto-scroll
│   ├── Navbar.tsx            # left + right sidebars
│   ├── DepthIndicator.tsx    # breadcrumb dot in right sidebar
│   ├── Trash.tsx             # drop zone for deletion
│   ├── Help.tsx              # 3-screen help carousel
│   ├── LastIdea.tsx          # drop zone to move idea to parent
│   ├── MessageBox.tsx        # toast notifications
│   ├── Auth.tsx              # login/signup form
│   └── modals/
│       ├── CreationModal.tsx       # create new idea
│       ├── RenameModal.tsx         # rename idea or current root
│       ├── LinkChangeModal.tsx     # add/change external link
│       └── DeleteConfirmModal.tsx  # confirm before deleting
├── context/
│   └── IdeaContext.tsx       # all global state
├── utilities/
│   ├── index.ts              # barrel export
│   ├── types.ts              # IdeaType interface
│   ├── firebase/
│   │   ├── firebaseHelpers.tsx   # Firestore CRUD
│   │   └── authFirebase.tsx      # sign out
│   └── idea/
│       ├── helpers.tsx       # navigation helpers, name/link lookups, cleanLink()
│       ├── storage.tsx       # localStorage CRUD
│       ├── parsing.tsx       # getIdeasByParentID, recursive delete
│       ├── creation.tsx      # handleIdeaCreation
│       └── organizers.tsx    # fetchFromFirebaseAndOrganizeIdeas
├── styles/
│   ├── variables.scss        # colors, breakpoints
│   ├── index.scss            # global styles + imports
│   ├── idea.scss             # main page + node styles
│   ├── mobileMindMap.scss    # mobile UI styles
│   ├── navbar.scss           # sidebar styles
│   ├── depth.scss            # breadcrumb indicators
│   ├── ideaCreationModal.scss # all modal styles (shared)
│   ├── auth.scss
│   └── help.scss
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

### `geLinkFromID` typo
The function is named `geLinkFromID` (missing the `t` in `get`) in `helpers.tsx`. This is the real name — don't rename without updating all call sites in `Idea.tsx` and anywhere else it's imported.

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
- **Interaction**: tap navigates into a node; long-press (360ms) opens an actions bottom sheet; edit mode (pencil button) makes a single tap open the actions sheet instead
- **Sheets**: uses a local `sheet` state (`SheetState` discriminated union) for bottom sheets — does **not** use context modal flags (`renameModalOpen`, etc.)
- **Sheet types**: `actions` | `rename` | `move` | `link` | `confirmDelete`
- **Move tree**: rendered by `MobileMoveSheet`; owns `expandedMoveNodes` state and auto-scroll logic; scrollable tree with expand/collapse; auto-scrolls to current parent on open; descendants and current parent are disabled as move targets
- **Help carousel**: rendered by `MobileHelpSheet`; owns its own `helpScreen` state (1–3); receives only an `onClose` prop
- **Link cleaning**: `cleanLink()` in `utilities/idea/helpers.tsx` auto-prepends `https://` and appends `.com` if the URL contains neither
- **No DnD**: doesn't use `@dnd-kit` at all; touch events handle long-press detection with `touchMoved` guard to cancel on scroll

### Drag and Drop (Desktop)

Drag is disabled on mobile (`window.matchMedia('(max-width: 768px)')`). Drop targets: `trash` (delete), `last-idea` (reparent to grandparent), `idea-{id}` (reparent). Link nodes (`link !== ""`) cannot receive drops. `PointerSensor` requires 10px movement before a drag starts (prevents accidental drags on clicks).

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
