import { useEffect, useRef, useState } from 'react';
import {
    DEFAULT_COLORS, NET_HEADS, PRESETS, applyTheme, effectiveColor, loadSavedTheme, sameValues, saveTheme,
    type Theme, type ThemeColors, type TokenKey,
} from './theme';
import {
    MAX_USER_THEMES, PRESET_PREFIX, deleteUserTheme, updateUserTheme, fetchUserThemes, loadCachedUserThemes, saveUserTheme, setUserThemeStarred, sortUserThemes,
    type UserTheme,
} from './firebase/userThemes';
import { pushThemeSoon } from './firebase/themeSync';

export type ListTab = 'builtin' | 'mine';

/** A refused write (rules, plan) is not a connection problem, so don't send the user off to check their network. */
const saveErrorMessage = (err: unknown) => {
    console.error('Theme save failed', err);
    return (err as { code?: string })?.code === 'permission-denied'
        ? "Couldn't save the theme: the server refused it. Saving themes needs a paid plan."
        : "Couldn't save the theme. Check your connection and try again.";
};

const sameColors = (a: ThemeColors, b: ThemeColors) =>
    sameValues(a, b) && JSON.stringify(a.layers ?? []) === JSON.stringify(b.layers ?? []);

const withValue = (colors: ThemeColors, key: TokenKey, hex: string): ThemeColors =>
    ({ ...colors, values: { ...colors.values, [key]: hex } });

const withoutValue = (colors: ThemeColors, key: TokenKey): ThemeColors => {
    const values = { ...colors.values };
    delete values[key];
    return { ...colors, values };
};

/** Built-in themes, with any copy the user saved over them taking their place. */
const withOverrides = (themes: UserTheme[]): Theme[] =>
    PRESETS.map((p) => {
        const o = themes.find((t) => t.id === PRESET_PREFIX + p.id);
        return o ? { ...p, colors: o.colors } : p;
    });

/**
 * Everything the theme editor knows and does, shared by the desktop panel
 * (CustomizationSettings) and the touch UI's sheet (MobileThemeSheet). Every
 * change is applied to the page and saved locally at once; "saving" a theme
 * only stores it by name.
 */
export function useThemeEditor(premium: boolean) {
    const [activeId, setActiveId] = useState<string | null>(() => {
        const saved = loadSavedTheme();
        if (!saved) return 'default';
        const cached = loadCachedUserThemes();
        const preset = withOverrides(cached).find((p) => sameColors(p.colors, saved));
        if (preset) return preset.id;
        const mine = cached.find((t) => !t.id.startsWith(PRESET_PREFIX) && sameColors(t.colors, saved));
        return mine ? 'u:' + mine.id : null;
    });
    // The theme being edited: the last one picked or saved, kept while its colors are changed.
    const [baseId, setBaseId] = useState<string | null>(activeId);
    const [colors, setColors] = useState<ThemeColors>(() => loadSavedTheme() ?? DEFAULT_COLORS);

    const [listTab, setListTab] = useState<ListTab>(() => (activeId?.startsWith('u:') ? 'mine' : 'builtin'));
    const [userThemes, setUserThemes] = useState<UserTheme[]>(loadCachedUserThemes);
    const [naming, setNaming] = useState(false);
    const [themeName, setThemeName] = useState('');
    const [saving, setSaving] = useState(false);
    const [listError, setListError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const confirmTimer = useRef(0);

    useEffect(() => {
        if (!premium) return;
        fetchUserThemes().then(setUserThemes).catch(() => { /* offline: keep the cached list */ });
    }, [premium]);

    useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

    const commit = (next: ThemeColors, id: string | null) => {
        setColors(next);
        setActiveId(id);
        if (id) {
            setBaseId(id);
            setNaming(false);
        }
        const isDefault = id === 'default';
        saveTheme(isDefault ? null : next);
        applyTheme(isDefault ? null : next);
        pushThemeSoon(isDefault ? null : next);
    };

    const presets = withOverrides(userThemes);
    const mine = userThemes.filter((t) => !t.id.startsWith(PRESET_PREFIX));
    const baseMine = baseId?.startsWith('u:') ? mine.find((t) => 'u:' + t.id === baseId) : undefined;
    const basePreset = baseId ? presets.find((t) => t.id === baseId) : undefined;
    const base = baseMine ?? basePreset;
    // Classic is the stock look: it can be returned to, not saved over.
    const canUpdate = !!baseMine || (!!basePreset && basePreset.id !== 'default');
    const dirty = activeId === null;
    const swatches = [...new Set(NET_HEADS.map((h) => effectiveColor(colors, h.key as TokenKey)))];

    const setToken = (key: TokenKey, hex: string) => commit(withValue(colors, key, hex), null);
    const resetToken = (key: TokenKey) => commit(withoutValue(colors, key), null);
    const setLayers = (layers: NonNullable<ThemeColors['layers']>) => commit({ ...colors, layers }, null);
    const revert = () => base && commit(base.colors, baseMine ? 'u:' + baseMine.id : base.id);
    const isEdited = (t: Theme) => userThemes.some((x) => x.id === PRESET_PREFIX + t.id);

    // Save over the theme being edited: a saved theme is updated, a built-in one gets the user's own copy.
    const updateBase = async () => {
        const target = baseMine ? { id: baseMine.id, name: baseMine.name, activeKey: 'u:' + baseMine.id }
            : basePreset && canUpdate ? { id: PRESET_PREFIX + basePreset.id, name: basePreset.name, activeKey: basePreset.id }
            : null;
        if (!target || saving) return;
        setSaving(true);
        setListError('');
        try {
            const t = await updateUserTheme(target.id, target.name, colors);
            setUserThemes((prev) => sortUserThemes([...prev.filter((x) => x.id !== t.id), t]));
            setActiveId(target.activeKey);
        } catch (err) {
            setListError(saveErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const resetPreset = async (t: Theme) => {
        const id = PRESET_PREFIX + t.id;
        const original = PRESETS.find((p) => p.id === t.id);
        setUserThemes((prev) => prev.filter((x) => x.id !== id));
        if (original && activeId === t.id) commit(original.colors, t.id);
        try { await deleteUserTheme(id); } catch { setUserThemes(await fetchUserThemes().catch(() => userThemes)); }
    };

    const saveCurrent = async () => {
        if (saving) return;
        if (mine.length >= MAX_USER_THEMES) { setListError(`You can keep up to ${MAX_USER_THEMES} saved themes. Delete one to save another.`); return; }
        setSaving(true);
        setListError('');
        try {
            const t = await saveUserTheme(themeName.trim() || 'My theme', colors);
            setUserThemes((prev) => sortUserThemes([...prev, t]));
            setActiveId('u:' + t.id);
            setBaseId('u:' + t.id);
            setThemeName('');
            setNaming(false);
            setListTab('mine');
        } catch (err) {
            setListError(saveErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const toggleStar = async (t: UserTheme) => {
        setUserThemes((prev) => sortUserThemes(prev.map((x) => (x.id === t.id ? { ...x, starred: !t.starred } : x))));
        try { await setUserThemeStarred(t.id, !t.starred); } catch { setUserThemes(await fetchUserThemes().catch(() => userThemes)); }
    };

    // Delete takes a second press within a few seconds, so a stray press can't lose a theme.
    const removeTheme = async (t: UserTheme) => {
        window.clearTimeout(confirmTimer.current);
        if (confirmDeleteId !== t.id) {
            setConfirmDeleteId(t.id);
            confirmTimer.current = window.setTimeout(() => setConfirmDeleteId(null), 3000);
            return;
        }
        setConfirmDeleteId(null);
        setUserThemes((prev) => prev.filter((x) => x.id !== t.id));
        if (activeId === 'u:' + t.id) setActiveId(null);
        if (baseId === 'u:' + t.id) setBaseId(null);
        try { await deleteUserTheme(t.id); } catch { setUserThemes(await fetchUserThemes().catch(() => userThemes)); }
    };

    return {
        activeId, colors, listTab, setListTab, naming, setNaming, themeName, setThemeName, saving, listError, confirmDeleteId,
        presets, mine, base, canUpdate, dirty, swatches, isEdited,
        commit, setToken, resetToken, setLayers, revert, updateBase, resetPreset, saveCurrent, toggleStar, removeTheme,
    };
}

export type ThemeEditor = ReturnType<typeof useThemeEditor>;
