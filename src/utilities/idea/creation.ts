import { createIdea } from "./ideaStore";
import { ChecklistItem } from "../types";
import { canCreateIdea } from "../billing/limits";
import { encryptVaultNote } from "../vault/vaultService";
import { cacheVaultLabel, touchVault } from "../vault/vaultSession";

// Redundant free-tier gate — the primary check happens where the "create"
// UI is triggered (Navbar/MobileMindMap), before this ever runs. Kept here
// too as defense-in-depth against any future call site that skips that
// check. This one's still just a UX nicety (a client that skips it entirely
// would just have its Firestore write rejected instead) — the actual
// enforcement lives server-side in firestore.rules (meta/nodeCount), not
// here. See sendOp in sync/outbox.ts for where that counter gets maintained.
export function handleIdeaCreation(content: string, parentID: number, link: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), content, parentID, link, ...(priority ? { priority } : {}) });
}

export function handleChecklistCreation(title: string, parentID: number, items: ChecklistItem[], priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), type: 'checklist' as const, content: title, parentID, items, ...(priority ? { priority } : {}) });
}

// Encrypted with the vault key before it reaches ideaStore, so the plaintext
// is never stored anywhere. Needs the vault unlocked (throws VaultError otherwise).
export async function handleVaultCreation(label: string, parentID: number, secret: string, link: string, priority?: 1 | 2 | 3): Promise<boolean> {
    if (!secret.trim() || !canCreateIdea()) return false;
    const id = Date.now();
    const fields = await encryptVaultNote(id, { label, secret, link });
    createIdea({ id, parentID, isNote: true, isVault: true, ...fields, ...(priority ? { priority } : {}) });
    cacheVaultLabel(fields.noteTitle, label);
    touchVault();
    return true;
}

export function handleNoteCreation(title: string, parentID: number, body: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), content: body, parentID, link: '', isNote: true, noteTitle: title, ...(priority ? { priority } : {}) });
}
