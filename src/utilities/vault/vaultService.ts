import { db, auth } from "../../firebaseConfig";
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, updateDoc, type FieldValue } from "firebase/firestore";
import type { IdeaType, StandardIdea } from "../types";
import { cleanLink, fetchFullIdeaList, isVaultIdea, resolveIdeaLabel, buildAncestorPath } from "../idea/helpers";
import { deleteIdeasById, updateVaultFields } from "../idea/ideaStore";
import { clearUndo } from "../idea/undoStack";
import {
    VaultError,
    decryptVaultField,
    encryptVaultField,
    generateRawVaultKey,
    generateRecoveryCode,
    generateVaultKeyId,
    importVaultKey,
    unwrapWithPassphrase,
    unwrapWithRecoveryCode,
    vaultKeyIdOf,
    wrapWithPassphrase,
    wrapWithRecoveryCode,
} from "./vaultCrypto";
import { cacheVaultLabel, cacheVaultLabels, getCachedVaultLabel, getVaultSnapshot, lockVault, requireVaultKey, setVaultUnlocked, touchVault } from "./vaultSession";

// The vault's Firestore side (meta/vault) and every multi-step vault action.
// meta/vault is an ordinary per-user meta doc, so it is written directly; the
// vault notes themselves are ideas and still go through ideaStore/the outbox.

export interface VaultMeta {
    v: 1;
    keyId: string;
    passphraseWrap: string;
    recoveryWrap: string;
}

export interface VaultNoteText {
    label: string;
    secret: string;
    link: string;
}

// A wrapped key that has not been saved yet: shown to the user (the recovery
// code) before anything is written. Its raw key bytes are zeroed on commit or discard.
export interface PendingVault {
    kind: "setup";
    uid: string;
    meta: VaultMeta;
    raw: Uint8Array;
    recoveryCode: string;
}

export interface PendingRewrap {
    kind: "rewrap";
    uid: string;
    keyId: string;
    raw: Uint8Array;
    passphraseWrap?: string;
    recoveryWrap?: string;
    recoveryCode?: string;
}

export interface VerifiedRecovery {
    kind: "verified";
    uid: string;
    keyId: string;
    raw: Uint8Array;
}

const WRITE_TIMEOUT_MS = 15_000;
const metaCacheKey = (uid: string) => `vault_meta_${uid}`;

function currentUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new VaultError("locked", "Not signed in.");
    return uid;
}

function vaultDoc(uid: string) {
    return doc(db, "users", uid, "meta", "vault");
}

function isVaultMeta(value: unknown): value is VaultMeta {
    const v = value as VaultMeta | null;
    return !!v && v.v === 1 && typeof v.keyId === "string" && /^[0-9a-f]{8}$/.test(v.keyId)
        && typeof v.passphraseWrap === "string" && typeof v.recoveryWrap === "string";
}

// "No vault" is stored as this marker, so the Vault tab can say so at once
// instead of waiting on the network. It is only a first guess: the status hook
// still checks the server and corrects it (a vault made on another device).
const NO_VAULT_MARKER = "none";

function cacheMeta(uid: string, meta: VaultMeta | null): void {
    try {
        localStorage.setItem(metaCacheKey(uid), meta ? JSON.stringify(meta) : NO_VAULT_MARKER);
    } catch {
        // storage unavailable: unlocking offline just won't work on this device
    }
}

// A brand-new account cannot have a vault yet.
export function markNoVault(uid: string): void {
    cacheMeta(uid, null);
}

// What this device already knows, without a network read: "none", "ready"
// (a vault exists) or null (unknown).
export function peekVaultStatus(): "none" | "ready" | null {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    if (cachedMeta(uid)) return "ready";
    try {
        return localStorage.getItem(metaCacheKey(uid)) === NO_VAULT_MARKER ? "none" : null;
    } catch {
        return null;
    }
}

// Starts the vault read early (after sign-in) so the Vault tab finds it settled.
export function warmVaultMeta(): void {
    loadVaultMeta().catch(() => { /* the Vault tab reports it when opened */ });
}

function cachedMeta(uid: string): VaultMeta | null {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(metaCacheKey(uid)) ?? "null");
        return isVaultMeta(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function requireOnline(): void {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new VaultError("offline");
}

// A write that never reaches the server (offline) would otherwise wait forever.
async function withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new VaultError("offline")), WRITE_TIMEOUT_MS); }),
        ]);
    } catch (error) {
        if (error instanceof VaultError) throw error;
        throw new VaultError("offline", (error as Error)?.message);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function unlockWithRaw(raw: Uint8Array, keyId: string, uid: string): Promise<void> {
    const key = await importVaultKey(raw);
    raw.fill(0);
    setVaultUnlocked(key, keyId, uid);
}

// The vault's wrapped key, or null if this account has no vault. Offline, the
// copy saved on this device is used, which is what lets the vault unlock offline.
export async function loadVaultMeta(): Promise<VaultMeta | null> {
    const uid = currentUid();
    let snapshot;
    try {
        snapshot = await getDoc(vaultDoc(uid));
    } catch {
        const cached = cachedMeta(uid);
        if (cached) return cached;
        throw new VaultError("offline");
    }
    if (!snapshot.exists()) {
        cacheMeta(uid, null);
        return null;
    }
    const data = snapshot.data();
    const meta: VaultMeta = { v: 1, keyId: data.keyId, passphraseWrap: data.passphraseWrap, recoveryWrap: data.recoveryWrap };
    if (!isVaultMeta(meta)) throw new VaultError("damaged");
    cacheMeta(uid, meta);
    return meta;
}

// ── Setup ──────────────────────────────────────────────────────────────────

export async function prepareVaultSetup(passphrase: string): Promise<PendingVault> {
    const uid = currentUid();
    const keyId = generateVaultKeyId();
    const raw = generateRawVaultKey();
    const recoveryCode = generateRecoveryCode();
    const [passphraseWrap, recoveryWrap] = await Promise.all([
        wrapWithPassphrase(raw, passphrase, uid, keyId),
        wrapWithRecoveryCode(raw, recoveryCode, uid, keyId),
    ]);
    return { kind: "setup", uid, meta: { v: 1, keyId, passphraseWrap, recoveryWrap }, raw, recoveryCode };
}

// Saved only after the user has shown they kept the recovery code.
export async function commitVaultSetup(pending: PendingVault): Promise<void> {
    requireOnline();
    const ref = vaultDoc(pending.uid);
    await withTimeout(runTransaction(db, async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists()) throw new VaultError("already-set-up");
        tx.set(ref, { ...pending.meta, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }));
    cacheMeta(pending.uid, pending.meta);
    await unlockWithRaw(pending.raw, pending.meta.keyId, pending.uid);
}

// ── Unlocking and changing secrets ─────────────────────────────────────────

export async function unlockVault(passphrase: string): Promise<void> {
    const meta = await loadVaultMeta();
    if (!meta) throw new VaultError("not-set-up");
    const uid = currentUid();
    const raw = await unwrapWithPassphrase(meta.passphraseWrap, passphrase, uid, meta.keyId);
    await unlockWithRaw(raw, meta.keyId, uid);
}

// Proves the code before asking for a new passphrase. Writes nothing.
export async function verifyRecoveryCode(code: string): Promise<VerifiedRecovery> {
    const meta = await loadVaultMeta();
    if (!meta) throw new VaultError("not-set-up");
    const uid = currentUid();
    const raw = await unwrapWithRecoveryCode(meta.recoveryWrap, code, uid, meta.keyId);
    return { kind: "verified", uid, keyId: meta.keyId, raw };
}

// A used recovery code is replaced: the new passphrase and a brand-new code.
export async function prepareRecoveredVault(verified: VerifiedRecovery, newPassphrase: string): Promise<PendingRewrap> {
    const recoveryCode = generateRecoveryCode();
    const [passphraseWrap, recoveryWrap] = await Promise.all([
        wrapWithPassphrase(verified.raw, newPassphrase, verified.uid, verified.keyId),
        wrapWithRecoveryCode(verified.raw, recoveryCode, verified.uid, verified.keyId),
    ]);
    return { kind: "rewrap", uid: verified.uid, keyId: verified.keyId, raw: verified.raw, passphraseWrap, recoveryWrap, recoveryCode };
}

export async function prepareNewRecoveryCode(passphrase: string): Promise<PendingRewrap> {
    const meta = await loadVaultMeta();
    if (!meta) throw new VaultError("not-set-up");
    const uid = currentUid();
    const raw = await unwrapWithPassphrase(meta.passphraseWrap, passphrase, uid, meta.keyId);
    const recoveryCode = generateRecoveryCode();
    const recoveryWrap = await wrapWithRecoveryCode(raw, recoveryCode, uid, meta.keyId);
    return { kind: "rewrap", uid, keyId: meta.keyId, raw, recoveryWrap, recoveryCode };
}

// The vault key itself never changes here, so a write that half-fails still
// leaves a passphrase and code that open the same notes.
export async function commitRewrap(pending: PendingRewrap): Promise<void> {
    requireOnline();
    const fields: { [field: string]: FieldValue | string } = { updatedAt: serverTimestamp() };
    if (pending.passphraseWrap) fields.passphraseWrap = pending.passphraseWrap;
    if (pending.recoveryWrap) fields.recoveryWrap = pending.recoveryWrap;
    await withTimeout(updateDoc(vaultDoc(pending.uid), fields));
    const cached = cachedMeta(pending.uid);
    if (cached) {
        cacheMeta(pending.uid, {
            ...cached,
            passphraseWrap: pending.passphraseWrap ?? cached.passphraseWrap,
            recoveryWrap: pending.recoveryWrap ?? cached.recoveryWrap,
        });
    }
    await unlockWithRaw(pending.raw, pending.keyId, pending.uid);
}

export async function changeVaultPassphrase(current: string, next: string): Promise<void> {
    const meta = await loadVaultMeta();
    if (!meta) throw new VaultError("not-set-up");
    const uid = currentUid();
    const raw = await unwrapWithPassphrase(meta.passphraseWrap, current, uid, meta.keyId);
    try {
        const passphraseWrap = await wrapWithPassphrase(raw, next, uid, meta.keyId);
        await commitRewrap({ kind: "rewrap", uid, keyId: meta.keyId, raw, passphraseWrap });
    } finally {
        raw.fill(0);
    }
}

export function discardPending(pending: PendingVault | PendingRewrap | VerifiedRecovery | null | undefined): void {
    pending?.raw.fill(0);
}

// ── Reset ──────────────────────────────────────────────────────────────────

// For a lost passphrase and code: the vault doc goes first (so a failure
// changes nothing), then every vault note, and Undo can't bring one back.
export async function resetVault(): Promise<number> {
    requireOnline();
    const uid = currentUid();
    await withTimeout(deleteDoc(vaultDoc(uid)));
    cacheMeta(uid, null);
    lockVault("reset");
    const removed = deleteIdeasById(fetchFullIdeaList().filter(isVaultIdea).map((idea) => idea.id));
    clearUndo();
    return removed.length;
}

// ── Notes ──────────────────────────────────────────────────────────────────

export function vaultNoteKeyId(idea: StandardIdea): string | null {
    return vaultKeyIdOf(idea.noteTitle);
}

export async function decryptVaultNote(idea: StandardIdea): Promise<VaultNoteText> {
    const { key, keyId, uid } = requireVaultKey();
    const [label, secret, link] = await Promise.all([
        decryptVaultField(idea.noteTitle ?? "", key, keyId, uid, idea.id, "noteTitle"),
        decryptVaultField(idea.content, key, keyId, uid, idea.id, "content"),
        decryptVaultField(idea.link ?? "", key, keyId, uid, idea.id, "link"),
    ]);
    cacheVaultLabel(idea.noteTitle ?? "", label);
    touchVault();
    return { label, secret, link };
}

// After an unlock or a sync: decrypts just the labels not yet in memory.
export async function decryptMissingLabels(ideas: IdeaType[]): Promise<boolean> {
    let session;
    try {
        session = requireVaultKey();
    } catch {
        return false;
    }
    const { key, keyId, uid } = session;
    const before = getVaultSnapshot().version;
    const entries = await Promise.all(
        ideas.filter(isVaultIdea)
            .filter((idea) => vaultKeyIdOf(idea.noteTitle) === keyId && getCachedVaultLabel(idea.noteTitle!) === undefined)
            .map(async (idea): Promise<[string, string] | null> => {
                try {
                    return [idea.noteTitle!, await decryptVaultField(idea.noteTitle!, key, keyId, uid, idea.id, "noteTitle")];
                } catch {
                    return null;
                }
            })
    );
    cacheVaultLabels(entries.filter((entry): entry is [string, string] => entry !== null));
    return getVaultSnapshot().version !== before;
}

export async function encryptVaultNote(id: number, text: VaultNoteText): Promise<{ noteTitle: string; content: string; link: string }> {
    const { key, keyId, uid } = requireVaultKey();
    const [noteTitle, content, link] = await Promise.all([
        encryptVaultField(text.label, key, keyId, uid, id, "noteTitle"),
        encryptVaultField(text.secret, key, keyId, uid, id, "content"),
        encryptVaultField(cleanLink(text.link), key, keyId, uid, id, "link"),
    ]);
    return { noteTitle, content, link };
}

// Only the fields that changed are re-encrypted and sent, as one write.
export async function saveVaultNote(id: number, next: VaultNoteText, previous: VaultNoteText): Promise<void> {
    const { key, keyId, uid } = requireVaultKey();
    const patch: { noteTitle?: string; content?: string; link?: string } = {};
    if (next.label !== previous.label) patch.noteTitle = await encryptVaultField(next.label, key, keyId, uid, id, "noteTitle");
    if (next.secret !== previous.secret) patch.content = await encryptVaultField(next.secret, key, keyId, uid, id, "content");
    const link = cleanLink(next.link);
    if (link !== previous.link) patch.link = await encryptVaultField(link, key, keyId, uid, id, "link");
    updateVaultFields(id, patch);
    if (patch.noteTitle) cacheVaultLabel(patch.noteTitle, next.label);
    touchVault();
}

// Decrypted, on purpose: the user asked for a readable copy.
export async function buildVaultExport(now = new Date()): Promise<string> {
    requireVaultKey();
    const all = fetchFullIdeaList();
    const notes = [];
    for (const idea of all.filter(isVaultIdea)) {
        try {
            const text = await decryptVaultNote(idea);
            const path = buildAncestorPath(idea.parentID, all)
                .filter((id) => id !== 1)
                .map((id) => resolveIdeaLabel(all.find((i) => i.id === id)));
            notes.push({ label: text.label, secret: text.secret, link: text.link, priority: idea.priority ?? null, path });
        } catch {
            // a note from an old vault can't be opened; nothing to export
        }
    }
    return JSON.stringify({
        exportedAt: now.toISOString(),
        warning: "This file is NOT encrypted. Anyone who opens it can read these secrets.",
        vaultNotes: notes,
    }, null, 2);
}
