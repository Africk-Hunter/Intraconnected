# Dev Log — Private Changelog

Personal record of every update. Not displayed to users. See `src/CHANGELOG.md` for the public-facing feature announcements.

---

## V 1.03.2 — 2026-06-19
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

## V 1.02.1
- Minor changes / small fixes (unspecified)

## V 1.02 — End-to-End Encryption
- AES-256-GCM encryption for all idea `content` and `link` fields
- Two-layer key scheme: DEK wrapped by password-derived KEK + recovery KEK + email KEK
- Recovery code flow: generated on first login, shown once, acknowledged flag stored in Firestore
- Email recovery: unwrap DEK using email-derived KEK (no email sent; Firebase Auth ownership = proof)
- DEK persisted in `sessionStorage` across page reloads; cleared on sign-out
- `enc:` prefix on ciphertext for backward-compatible migration of legacy plaintext

## V 1.01.1
- Added "Recommend Features" button

## V 1.01 — Patch Notes & Tooltips
- Added in-app patch notes panel (desktop right sidebar, ★ button)
- Added mobile patch notes bottom sheet (★ button in FAB area)
- `parseChangelog` utility reads `src/CHANGELOG.md` at build time
- Replaced raw `<button>` nav buttons with `TooltipButton` (1000ms hover delay)

## V 1.0.x — Post-Mind-Map Patches
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
