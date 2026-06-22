# Dev Log — Private Changelog

Personal record of every update. Not displayed to users. See `src/CHANGELOG.md` for the public-facing feature announcements.

---

## V 1.04 — Firebase Optimization — 2026-06-22
- Timestamp-based sync guard: on page load, read one `meta/sync` doc instead of the full ideas collection; full fetch only runs when the remote timestamp differs from the locally cached one (cross-device sync, first login, cleared storage)
- Every Firebase idea write now also updates `meta/sync.lastModified` and mirrors the value to `localStorage`, keeping both sides in lockstep
- Checklist item writes decoupled from localStorage writes; Firebase write debounced 1.5s per checklist ID so rapid toggling/editing collapses to a single write
- Subtree deletion replaced with a single `writeBatch` commit across all deleted node IDs instead of one `deleteDoc` call per node
- Patch notes Firebase read skipped when `localStorage` already has a cached value for the current user; only fetched on first visit per device
- `clearLocalStorage()` changed from `localStorage.clear()` to `localStorage.removeItem('ideas')` to preserve patch notes and sync timestamp keys across full re-fetches

## V 1.03.11 — Mobile Fixes — 2026-06-22
- All mobile FAB buttons (help, patch notes, navigate, create, edit) animate their icon on active state (scale up + lift); patch notes and navigate buttons also change background color
- Mind map sheet entry animation now radial-pops from click origin (same as help/patch notes sheets)
- Mind map sheet and help sheet bottom edge repositioned to clear the FAB bar instead of overlapping it
- Sass `lighten()` → `color.adjust()` deprecation fix in `idea.scss` and `mobileMindMap.scss`; overlay uses `100dvh` fallback

## V 1.03.10 — EVEN MORE POLISH (I guess?) — 2026-06-22
- Checklist items can now have individual links (optional `link` field on `ChecklistItem`); link button in hover controls on desktop card, desktop modal, and mobile sheet; linked items render as `<a>` tags; Firebase encryption/decryption updated to handle item links
- Delete confirm modal pop animation now originates from the trash can position instead of cursor; idea name clamped to 4 lines to prevent oversized names from breaking the modal
- Mind map tree resets collapse state on close (remounted via `treeKey`); node button max-width increased 160→240px with overflow clipping
- Mobile sheet container uses `max-height: 80dvh` + `overflow: hidden` to fix content bleed on dynamic viewport heights
- `IdeaNode` `isHidden` simplified from `useState` to a derived value

## V 1.03.9 — POLISHING DIS SHII — 2026-06-21
- All desktop modals (Rename, Delete, Link, Checklist, Creation) now use `AnimatedOverlay` for pop-in/out animations keyed from click origin
- Mind map always rendered in DOM (opacity/pointer-events toggle); auto-centers on current idea node on open; zoom now pivots around cursor position
- Checklist nodes display inline as read-only cards in the desktop mind map
- Desktop mid-section fades out (opacity transition) instead of unmounting when mind map opens; navbar create button and depth holder fade similarly
- Mobile header title converted to editable textarea (inline rename, saves on blur)
- Mobile sheet and help/patch notes pop animations changed from slide-up to radial-pop from click origin
- Mobile rename sheet input upgraded from `<input>` to auto-growing `<textarea>`
- Mobile checklist sheet edit input upgraded from `<input>` to auto-growing `<textarea>`
- Mobile navigate button animation: icon scales up and inverts on active state
- Help badge colors corrected: nav badge → teal, edit badge → yellow
- Help sheet back button styled consistently (orange, reduced padding)
- `TooltipButton` accepts `wrapperClassName` prop for hiding the wrapper div

## V 1.03.8 — Mind Map Line Fix — 2026-06-21
- Fixed collapse toggle line extending past '+' circle when children are hidden
- Consistent vertical line centering across all mind map connectors

## V 1.03.7 — SEO & Polish — 2026-06-20
- SEO Optimization
- Mobile create sheet: optional link input added to new-idea sheet.
- Bottom bar and sheets use env(safe-area-inset-bottom) to clear iPhone home indicator

## V 1.03.6 — Mobile Mind Map — 2026-06-20
- Replaced Navigate bottom sheet with full-screen Mind Map overlay (`MobileMindMapSheet`) with entry animation and styled vertical tree

## V 1.03.5 — Checklist Item Drag & Edit — 2026-06-20
- Drag-to-reorder checklist items in desktop card, desktop modal, and mobile sheet
- Inline checklist item text editing via pen icon (click to edit, Enter/blur to commit) in all three views

## V 1.03.4 — Icon Refresh & Help Polish — 2026-06-20
- New skinny icon variants across mobile FAB area (MindMap, Open, PatchNotes, Plus); navigate and patch notes buttons colored teal and yellow
- Help screens polished: checklist badge uses real CSS checkbox, patch notes shown as real button, node type order fixed
- Bug fix: `rootIdStack` no longer double-pushes root on re-render

## V 1.03.3 — Expanded Help & Streamlined Onboarding — 2026-06-19
- Help carousel expanded from 3 to 5 screens (desktop + mobile)
- Desktop screens 4–5: Mind Map overview, depth dots + patch notes
- Mobile screens 3–5: checklist node type, Navigate button, edit mode + patch notes
- Recovery code screen removed from signup/migration/restore flows — users go straight to `/main`
- New users auto-shown help on first load via `sessionStorage` flag

## V 1.03.2 — Polish & UX Improvements — 2026-06-19
- Added Privacy Policy page (`/privacy` route, link on auth screen)
- Leaf nodes truncate long text with a fade overlay + animated expand/collapse toggle
- Node fade-out when pending delete; fades back in if cancelled
- Custom CSS checkboxes replace emoji checkboxes in mobile checklist (inline + sheet)
- MindMap collapse toggle redesigned: vertical line + circle button
- Leaf nodes in MindMap and mobile node headers get line-clamping
- Patch notes "new" state synced to/from Firestore
- Help and patch notes panels are now mutually exclusive (opening one closes the other)
- `scrollbar-gutter: stable` added to prevent layout shift on scroll

## V 1.03.1 — 2026-06-19
- Fixed checklist bug (item state / toggle behavior)

## V 1.03 — Checklist Ideas
- Added checklist idea type: titled checklist with check/uncheck, add, and delete per item
- Desktop: inline card with checkboxes + full-view `ChecklistModal`
- Mobile: inline accordion toggle + full-view checklist sheet
- End-to-end encryption for checklist item text in Firestore
- Code cleanup pass

## V 1.02.1 — Minor Fixes
- Minor changes / small fixes (unspecified)

## V 1.02 — End-to-End Encryption
- AES-256-GCM encryption for all idea `content` and `link` fields
- Two-layer key scheme: DEK wrapped by password-derived KEK + recovery KEK + email KEK
- Recovery code flow: generated on first login, shown once, acknowledged flag stored in Firestore
- Email recovery: unwrap DEK using email-derived KEK (no email sent; Firebase Auth ownership = proof)
- DEK persisted in `sessionStorage` across page reloads; cleared on sign-out
- `enc:` prefix on ciphertext for backward-compatible migration of legacy plaintext

## V 1.01.1 — Recommend Features Button
- Added "Recommend Features" button

## V 1.01 — Patch Notes & Tooltips
- Added in-app patch notes panel (desktop right sidebar, patch notes button)
- Added mobile patch notes bottom sheet (patch notes button in FAB area)
- `parseChangelog` utility reads `src/CHANGELOG.md` at build time
- Replaced raw `<button>` nav buttons with `TooltipButton` (1000ms hover delay)

## V 1.0.x — Mobile, Navigation & QOL Patches
- Mobile quick-navigate sheet (◎ button; jump to any node)
- Mobile grid background styling
- Mobile view overhaul + cleanup pass
- Delete confirmation modal added; delete modal tweaks
- Multiple bug fixes (general)
- Mobile styling fixes (multiple passes)
- Styling tweaks (general)
- Rename bug fix
- More robust idea renaming (handles edge cases)
- Fixed dropping ideas into link nodes (link nodes no longer accept drops)
- Link change tweaks + link change functionality added
- `RenameModal` updates
- Depth indicator fix
- Styling changes (multiple passes)
- Reworked help screen
- Depth indicator added
- Mobile styling fixes
- Copy-text button added
- Link idea functionality added
- Mobile responsiveness changes
- Favicon updated
- Rename functionality added
- Various QOL changes
- `_redirects` file added (Netlify SPA routing)
- Backwards navigation (back button / parent traversal)
- Helper functions file restructured (`utilities/idea/`)
- Parent-change (reparent) functionality added

## V 1.0 — Mind Map
- Full-tree overlay with pan, zoom, expand/collapse, click-to-navigate
- `rootIdStack` for desktop navigation history
- Ancestor nodes start expanded; others start collapsed

## Pre-1.0 — Foundation
- Drag and drop (dnd-kit) with delete-to-trash and reparent-on-drop
- Delete logic implemented
- Help screen (3-screen carousel)
- Logout functionality
- Context refactor (`IdeaContext`)
- Full descent + idea creation flow
- Idea creation modal
- Firebase Firestore connection + user auth
- Core styling, flexbox layout, large-desktop responsiveness
- Initial commit
