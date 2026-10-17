import { useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { BG_SECTION, IDEA_SECTION, MORE_SECTIONS, TOKEN_BY_KEY, effectiveColor } from '../../utilities/theme';
import { useThemeEditor, type ListTab } from '../../utilities/useThemeEditor';
import ColorPicker from './ColorPicker';
import BackgroundEditor from './BackgroundEditor';
import { BackgroundPreview, Dropdown, LockedPitch, StarIcon, ThemeArt, TokenRow } from './customizationParts';
import { downloadFile } from '../../utilities/download';
import '../../styles/customization.scss';

interface Props {
    /** panel: the docked theme panel (pinned save bar, picker leaves the app visible). inline: inside Profile. */
    variant?: 'panel' | 'inline';
}

export default function CustomizationSettings({ variant = 'inline' }: Props) {
    const { billingPlan } = useIdeaContext();
    const premium = billingPlan === 'annual' || billingPlan === 'lifetime';
    const clear = variant === 'panel';
    const ed = useThemeEditor(premium);
    const { activeId, colors, listTab, setListTab, presets, mine, base, canUpdate, dirty, swatches, listError, saving, naming, themeName, confirmDeleteId } = ed;

    const [exporting, setExporting] = useState(false);
    const [exportPicked, setExportPicked] = useState<Set<string>>(() => new Set());

    if (!premium) return <LockedPitch variant={variant} />;

    const rowProps = { colors, swatches, clear, onSet: ed.setToken, onReset: ed.resetToken };

    // Dumps the working colors, your edits to built-in themes (id without the prefix = the built-in's id) and your own themes,
    // in the shape PRESETS use, so they can be pasted back in as new defaults.
    const exportable = [
        { key: 'current', id: 'current', name: `Current colors${base ? ` (from ${base.name})` : ''}`, colors },
        ...presets.filter((t) => t.id !== 'default').map((t) => ({ key: 'b:' + t.id, id: t.id, name: `${t.name} (built-in)`, colors: t.colors })),
        ...mine.map((t) => ({ key: 'u:' + t.id, id: t.id, name: t.name, colors: t.colors })),
    ];
    const exportThemes = () => {
        const out = exportable.filter((e) => exportPicked.has(e.key)).map((e) => ({
            id: e.id, name: e.name, values: e.colors.values, ...(e.colors.layers?.length ? { layers: e.colors.layers } : {}),
        }));
        downloadFile(JSON.stringify(out, null, 2), 'application/json', 'intraconnected-themes.json');
    };

    return (
        <div className={`cust cust--${variant}`}>
            <div className="cust-scroll">
                <section className="cust-section" aria-labelledby="cust-themes-title">
                    <div className="cust-section-head">
                        <h3 className="cust-section-title" id="cust-themes-title">Themes</h3>
                        <div className="cust-seg" role="group" aria-label="Which themes">
                            {([['builtin', 'Built-in'], ['mine', `Yours${mine.length ? ` (${mine.length})` : ''}`]] as [ListTab, string][]).map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    className={`cust-seg-btn${listTab === k ? ' cust-seg-btn--on' : ''}`}
                                    aria-pressed={listTab === k}
                                    onClick={() => setListTab(k)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {listTab === 'builtin' ? (
                        <div className="cust-tiles" key="builtin">
                            {presets.map((t) => (
                                <div key={t.id} className="cust-tile-wrap">
                                    <button
                                        type="button"
                                        className={`cust-tile${activeId === t.id ? ' cust-tile--on' : ''}`}
                                        aria-pressed={activeId === t.id}
                                        onClick={() => ed.commit(t.colors, t.id)}
                                    >
                                        <ThemeArt colors={t.colors} />
                                        <span className="cust-tile-name">{t.name}</span>
                                    </button>
                                    {ed.isEdited(t) && (
                                        <button
                                            type="button"
                                            className="cust-tile-reset"
                                            onClick={() => ed.resetPreset(t)}
                                            aria-label={`Reset ${t.name} to the original`}
                                            title="You saved changes to this theme. Reset to the original."
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M4 12a8 8 0 1 0 2.5-5.8" />
                                                <path d="M4 4v4.5h4.5" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : mine.length === 0 ? (
                        <p className="cust-empty" key="empty">
                            Nothing saved yet. Change any color below, then press <strong>Save as new</strong>.
                        </p>
                    ) : (
                        <ul className="cust-mine" key="mine">
                            {mine.map((t) => {
                                const on = activeId === 'u:' + t.id;
                                const confirming = confirmDeleteId === t.id;
                                return (
                                    <li key={t.id} className={`cust-mine-row${on ? ' cust-mine-row--on' : ''}`}>
                                        <button type="button" className="cust-mine-pick" aria-pressed={on} onClick={() => ed.commit(t.colors, 'u:' + t.id)}>
                                            <ThemeArt colors={t.colors} />
                                            <span className="cust-mine-name">{t.name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`cust-icon-btn${t.starred ? ' cust-icon-btn--star' : ''}`}
                                            onClick={() => ed.toggleStar(t)}
                                            aria-label={t.starred ? `Unstar ${t.name}` : `Star ${t.name}`}
                                            aria-pressed={t.starred}
                                            title={t.starred ? 'Unstar' : 'Star (keeps it at the top)'}
                                        >
                                            <StarIcon filled={t.starred} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`cust-icon-btn cust-icon-btn--delete${confirming ? ' cust-icon-btn--confirm' : ''}`}
                                            onClick={() => ed.removeTheme(t)}
                                            aria-label={confirming ? `Press again to delete ${t.name}` : `Delete ${t.name}`}
                                            title={confirming ? 'Press again to delete' : 'Delete'}
                                        >
                                            {confirming ? 'Delete?' : <span aria-hidden="true">&times;</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section className="cust-section" aria-labelledby="cust-ideas-title">
                    <div className="cust-section-head">
                        <h3 className="cust-section-title" id="cust-ideas-title">{IDEA_SECTION.title}</h3>
                    </div>
                    <div className="cust-chips">
                        {IDEA_SECTION.rows.map((r) => (
                            <ColorPicker
                                key={r.key}
                                variant="chip"
                                label={r.label ?? TOKEN_BY_KEY[r.key].label}
                                swatches={swatches}
                                value={effectiveColor(colors, r.key)}
                                onChange={(hex) => ed.setToken(r.key, hex)}
                                clear={clear}
                            />
                        ))}
                    </div>
                </section>

                <section className="cust-section" aria-labelledby="cust-bg-section-title">
                    <div className="cust-section-head">
                        <h3 className="cust-section-title" id="cust-bg-section-title">{BG_SECTION.title}</h3>
                    </div>
                    <div className="cust-stage">
                        <BackgroundPreview layers={colors.layers ?? []} />
                        <div className="cust-stage-body">
                            {BG_SECTION.rows.map((r) => <TokenRow key={r.key} row={{ ...r, label: 'Base color', hint: 'Under the layers, and on its own when there are none' }} {...rowProps} />)}
                            <BackgroundEditor layers={colors.layers ?? []} onChange={ed.setLayers} clear={clear} />
                        </div>
                    </div>
                </section>

                <section className="cust-section" aria-labelledby="cust-more-title">
                    <div className="cust-section-head">
                        <h3 className="cust-section-title" id="cust-more-title">More colors</h3>
                    </div>
                    <div className="cust-dds">
                        {MORE_SECTIONS.map((s) => (
                            <Dropdown key={s.id} title={s.title} colors={colors} keys={s.rows.map((r) => r.key)}>
                                {s.rows.map((r) => <TokenRow key={r.key} row={r} {...rowProps} />)}
                            </Dropdown>
                        ))}
                    </div>
                </section>

                <button type="button" className="cust-link" aria-expanded={exporting} onClick={() => setExporting((o) => !o)}>Export themes (JSON)</button>
                {exporting && (
                    <div className="cust-export">
                        <ul className="cust-export-list">
                            {exportable.map((e) => (
                                <li key={e.key}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={exportPicked.has(e.key)}
                                            onChange={() => setExportPicked((prev) => { const n = new Set(prev); if (!n.delete(e.key)) n.add(e.key); return n; })}
                                        />
                                        {' '}{e.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                        <button type="button" className="cust-secondary neobrutal-button" disabled={exportPicked.size === 0} onClick={exportThemes}>
                            Download {exportPicked.size || ''} selected
                        </button>
                    </div>
                )}
                <p className="cust-footnote">Community themes are coming soon.</p>
            </div>

            <div className={`cust-savebar${dirty || listError ? ' cust-savebar--open' : ''}`} inert={!dirty && !listError}>
                <div className="cust-savebar-inner"><div className="cust-savebar-body">
                    {dirty && (
                        <div className="cust-savebar-status">
                            <span>{base ? <>Changed from <strong>{base.name}</strong></> : 'Unsaved colors'}</span>
                            {base && <button type="button" className="cust-link" onClick={ed.revert}>Undo all</button>}
                        </div>
                    )}
                    {dirty && (naming ? (
                        <form className="cust-savebar-actions" onSubmit={(e) => { e.preventDefault(); void ed.saveCurrent(); }}>
                            <input
                                className="cust-name neobrutal-input"
                                value={themeName}
                                onChange={(e) => ed.setThemeName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ed.setNaming(false); } }}
                                maxLength={40}
                                placeholder="My theme"
                                aria-label="Theme name"
                                autoFocus
                            />
                            <button type="submit" className="cust-primary neobrutal-button" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                            <button type="button" className="cust-secondary neobrutal-button" onClick={() => ed.setNaming(false)}>Cancel</button>
                        </form>
                    ) : (
                        <div className="cust-savebar-actions">
                            {canUpdate && (
                                <button type="button" className="cust-secondary neobrutal-button" disabled={saving} onClick={() => void ed.updateBase()}>
                                    {saving ? 'Saving...' : `Update ${base!.name}`}
                                </button>
                            )}
                            <button type="button" className="cust-primary neobrutal-button" disabled={saving} onClick={() => ed.setNaming(true)}>
                                Save as new
                            </button>
                        </div>
                    ))}
                    {listError && <p className="cust-error" role="alert">{listError}</p>}
                </div></div>
            </div>
        </div>
    );
}
