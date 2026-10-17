import { db } from "../../firebaseConfig";
import { collection, deleteDoc, doc, getDocsFromServer, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { authCheck } from "./currentUser";
import { BG_TYPES, TOKEN_BY_KEY, type ThemeColors, type TokenKey } from "../theme";

// A user's saved themes live at users/{uid}/themes/{themeId}, one self-contained
// doc each ({ v, name, colors, starred }) so a theme can later be shared by
// copying the doc (or its JSON) into another account. Themes are not secret and
// are stored as plain data. A copy is cached in localStorage per account so the
// list shows instantly and offline.

export interface UserTheme {
    id: string;
    name: string;
    colors: ThemeColors;
    starred: boolean;
    createdAt: number;
}

export const MAX_USER_THEMES = 50;
const SCHEMA_VERSION = 1;
const cacheKey = (uid: string) => `user_themes_${uid}`;

/** Starred first, then newest first. */
export const sortUserThemes = (themes: UserTheme[]) =>
    [...themes].sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt - a.createdAt);

function sanitizeColors(raw: Partial<ThemeColors> | undefined): ThemeColors {
    const values: ThemeColors["values"] = {};
    for (const [k, v] of Object.entries(raw?.values ?? {})) {
        if (k in TOKEN_BY_KEY && typeof v === "string") values[k as TokenKey] = v;
    }
    const layers = Array.isArray(raw?.layers) ? raw.layers.filter((l) => BG_TYPES.some((t) => t.type === l?.type)) : null;
    return { values, ...(layers ? { layers } : {}) };
}

export function loadCachedUserThemes(): UserTheme[] {
    const user = authCheck();
    if (!user) return [];
    try {
        const raw = localStorage.getItem(cacheKey(user.uid));
        return raw ? sortUserThemes(JSON.parse(raw) as UserTheme[]) : [];
    } catch {
        return [];
    }
}

function cacheUserThemes(uid: string, themes: UserTheme[]): void {
    try { localStorage.setItem(cacheKey(uid), JSON.stringify(themes)); } catch { /* storage unavailable */ }
}

export async function fetchUserThemes(): Promise<UserTheme[]> {
    const user = authCheck();
    if (!user) return [];
    const snap = await getDocsFromServer(collection(db, "users", user.uid, "themes"));
    const themes = snap.docs.map((d): UserTheme => {
        const data = d.data();
        return {
            id: d.id,
            name: typeof data.name === "string" ? data.name : "Untitled",
            colors: sanitizeColors(data.colors),
            starred: data.starred === true,
            createdAt: (data.createdAt?.toMillis?.() as number | undefined) ?? 0,
        };
    });
    const sorted = sortUserThemes(themes);
    cacheUserThemes(user.uid, sorted);
    return sorted;
}

/** Saves a new theme; returns it for immediate display. */
export async function saveUserTheme(name: string, colors: ThemeColors): Promise<UserTheme> {
    const user = authCheck();
    if (!user) throw new Error("Not signed in");
    const ref = doc(collection(db, "users", user.uid, "themes"));
    const clean = name.trim().slice(0, 40) || "Untitled";
    const theme: UserTheme = { id: ref.id, name: clean, colors, starred: false, createdAt: Date.now() };
    await setDoc(ref, { v: SCHEMA_VERSION, name: clean, colors: JSON.parse(JSON.stringify(colors)), starred: false, createdAt: serverTimestamp() });
    cacheUserThemes(user.uid, sortUserThemes([...loadCachedUserThemes(), theme]));
    return theme;
}

export async function setUserThemeStarred(id: string, starred: boolean): Promise<void> {
    const user = authCheck();
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "themes", id), { starred });
    cacheUserThemes(user.uid, sortUserThemes(loadCachedUserThemes().map((t) => (t.id === id ? { ...t, starred } : t))));
}

export async function deleteUserTheme(id: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "themes", id));
    cacheUserThemes(user.uid, loadCachedUserThemes().filter((t) => t.id !== id));
}

/** Ids starting with this are a user's edited copy of a built-in theme (the rest of the id is the preset id). */
export const PRESET_PREFIX = "preset_";

function replaceCached(uid: string, theme: UserTheme): void {
    const rest = loadCachedUserThemes().filter((t) => t.id !== theme.id);
    cacheUserThemes(uid, sortUserThemes([...rest, theme]));
}

/** Overwrites the colors of a saved theme, or creates/updates the user's copy of a built-in one (`id` = PRESET_PREFIX + preset id). */
export async function updateUserTheme(id: string, name: string, colors: ThemeColors): Promise<UserTheme> {
    const user = authCheck();
    if (!user) throw new Error("Not signed in");
    const clean = name.trim().slice(0, 40) || "Untitled";
    const old = loadCachedUserThemes().find((t) => t.id === id);
    await setDoc(
        doc(db, "users", user.uid, "themes", id),
        { v: SCHEMA_VERSION, name: clean, colors: JSON.parse(JSON.stringify(colors)), starred: old?.starred ?? false, ...(old ? {} : { createdAt: serverTimestamp() }) },
        { merge: true },
    );
    const theme: UserTheme = { id, name: clean, colors, starred: old?.starred ?? false, createdAt: old?.createdAt ?? Date.now() };
    replaceCached(user.uid, theme);
    return theme;
}
