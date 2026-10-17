import React, { useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import {
    BG_SECTION, BG_TYPE_BY_KEY, IDEA_SECTION, MAX_BG_LAYERS, MORE_SECTIONS, TOKEN_BY_KEY, effectiveColor, newLayer,
    type BgLayer, type TokenKey,
} from '../../utilities/theme';
import {
    layerPalette, layerSummary, layerThumb, moveLayer, retypeLayer, type LayerColorParam,
} from '../../utilities/themeLayers';
import { useThemeEditor, type ListTab } from '../../utilities/useThemeEditor';
import { useBackHandler } from '../../utilities/backStack';
import ColorPicker, { ColorPickerBody } from '../modals/ColorPicker';
import { LayerControls } from '../modals/BackgroundEditor';
import { BackgroundPreview, ColorStrip, LockedPitch, StarIcon, ThemeArt, TokenRow } from '../modals/customizationParts';
import { useSheetSwipeDown } from './useSheetSwipeDown';
import '../../styles/customization.scss';
import '../../styles/mobileThemeSheet.scss';

interface Props {
    onClose: () => void;
    style?: React.CSSProperties;
}

type PickTarget = { type: 'token'; key: TokenKey } | { type: 'layer'; id: string; param: LayerColorParam };

// One page of the sheet. The stack starts at home; each drill-in pushes one, and ‹ Back / the phone's Back pops it.
type Page =
    | { kind: 'home' }
    | { kind: 'ideas' }
    | { kind: 'background' }
    | { kind: 'layer'; id: string }
    | { kind: 'group'; id: string }
    | { kind: 'pick'; target: PickTarget; label: string };

const pageKey = (p: Page) => (p.kind === 'pick'
    ? `pick:${p.target.type === 'token' ? p.target.key : `${p.target.id}.${p.target.param}`}`
    : p.kind === 'layer' || p.kind === 'group' ? `${p.kind}:${p.id}` : p.kind);

const sectionTitle = (id: string) => {
    const s = MORE_SECTIONS.find((x) => x.id === id);
    return s ? s.touchTitle ?? s.title : '';
};

function Chevron() {
    return (
        <svg className="mtheme-nav-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
        </svg>
    );
}

function CloseIcon() {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg>;
}

/**
 * The theme editor on the touch UI: a bottom sheet over the live app, so every
 * change shows on the real screen above it (the desktop panel works the same
 * way). Same editor as desktop (useThemeEditor), split into pages, with the
 * color picker as a page of its own rather than a modal on top.
 */
export default function MobileThemeSheet({ onClose, style }: Props) {
    const { billingPlan } = useIdeaContext();
    const premium = billingPlan === 'annual' || billingPlan === 'lifetime';
    const ed = useThemeEditor(premium);
    const { activeId, colors, listTab, setListTab, presets, mine, base, canUpdate, dirty, swatches, listError, saving, naming, themeName, confirmDeleteId } = ed;
    const layers = colors.layers ?? [];

    const [stack, setStack] = useState<Page[]>([{ kind: 'home' }]);
    const page = stack[stack.length - 1];
    const push = (p: Page) => setStack((s) => [...s, p]);
    const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    useBackHandler(stack.length > 1, pop, 2);

    const swipe = useSheetSwipeDown(onClose);

    const pickToken = (key: TokenKey, label: string) => push({ kind: 'pick', target: { type: 'token', key }, label });
    const updateLayer = (id: string, patch: Partial<BgLayer>) => ed.setLayers(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const addLayer = () => {
        const l = newLayer('gradient');
        ed.setLayers([...layers, l]);
        push({ kind: 'layer', id: l.id });
    };

    const title = page.kind === 'home' ? 'Theme'
        : page.kind === 'ideas' ? IDEA_SECTION.title
        : page.kind === 'background' ? BG_SECTION.title
        : page.kind === 'layer' ? BG_TYPE_BY_KEY[layers.find((l) => l.id === page.id)?.type ?? 'gradient'].label
        : page.kind === 'group' ? sectionTitle(page.id)
        : page.label;

    const rowProps = { colors, swatches, clear: true, onSet: ed.setToken, onReset: ed.resetToken, onPick: pickToken, touch: true };

    function renderHome() {
        return (
            <>
                <section className="mtheme-section" aria-label="Themes">
                    {listTab === 'builtin' ? (
                        <div className="mtheme-tiles" key="builtin">
                            {presets.map((t) => (
                                <div key={t.id} className="cust-tile-wrap mtheme-tile">
                                    <button
                                        type="button"
                                        className={`cust-tile${activeId === t.id ? ' cust-tile--on' : ''}`}
                                        aria-pressed={activeId === t.id}
                                        onClick={() => ed.commit(t.colors, t.id)}
                                    >
                                        <ThemeArt colors={t.colors} variant="rows" />
                                        <span className="cust-tile-name">{t.name}</span>
                                    </button>
                                    {ed.isEdited(t) && (
                                        <button
                                            type="button"
                                            className="cust-tile-reset"
                                            onClick={() => ed.resetPreset(t)}
                                            aria-label={`Reset ${t.name} to the original`}
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
                        <ul className="cust-mine mtheme-mine" key="mine">
                            {mine.map((t) => {
                                const on = activeId === 'u:' + t.id;
                                const confirming = confirmDeleteId === t.id;
                                return (
                                    <li key={t.id} className={`cust-mine-row${on ? ' cust-mine-row--on' : ''}`}>
                                        <button type="button" className="cust-mine-pick" aria-pressed={on} onClick={() => ed.commit(t.colors, 'u:' + t.id)}>
                                            <ThemeArt colors={t.colors} variant="rows" />
                                            <span className="cust-mine-name">{t.name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`cust-icon-btn${t.starred ? ' cust-icon-btn--star' : ''}`}
                                            onClick={() => ed.toggleStar(t)}
                                            aria-label={t.starred ? `Unstar ${t.name}` : `Star ${t.name}`}
                                            aria-pressed={t.starred}
                                        >
                                            <StarIcon filled={t.starred} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`cust-icon-btn cust-icon-btn--delete${confirming ? ' cust-icon-btn--confirm' : ''}`}
                                            onClick={() => ed.removeTheme(t)}
                                            aria-label={confirming ? `Tap again to delete ${t.name}` : `Delete ${t.name}`}
                                        >
                                            {confirming ? 'Delete?' : <span aria-hidden="true">&times;</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section className="mtheme-section" aria-label="Edit colors">
                    <h3 className="mtheme-section-title">Edit colors</h3>
                    <ul className="mtheme-nav">
                        <li>
                            <button type="button" className="mtheme-nav-row" onClick={() => push({ kind: 'ideas' })}>
                                <span className="mtheme-nav-label">{IDEA_SECTION.title}</span>
                                <ColorStrip colors={colors} keys={IDEA_SECTION.rows.map((r) => r.key)} />
                                <Chevron />
                            </button>
                        </li>
                        <li>
                            <button type="button" className="mtheme-nav-row" onClick={() => push({ kind: 'background' })}>
                                <span className="mtheme-nav-label">
                                    {BG_SECTION.title}
                                    <span className="mtheme-nav-sub">{layers.length ? `${layers.length} ${layers.length === 1 ? 'layer' : 'layers'}` : 'Plain color'}</span>
                                </span>
                                <span className="mtheme-nav-scene" aria-hidden="true">
                                    <BackgroundPreview layers={layers} />
                                </span>
                                <Chevron />
                            </button>
                        </li>
                        {MORE_SECTIONS.map((s) => (
                            <li key={s.id}>
                                <button type="button" className="mtheme-nav-row" onClick={() => push({ kind: 'group', id: s.id })}>
                                    <span className="mtheme-nav-label">{s.touchTitle ?? s.title}</span>
                                    <ColorStrip colors={colors} keys={s.rows.map((r) => r.key)} />
                                    <Chevron />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </>
        );
    }

    function renderBackground() {
        return (
            <>
                <div className="cust-stage">
                    <BackgroundPreview layers={layers} />
                    <div className="cust-stage-body">
                        {BG_SECTION.rows.map((r) => (
                            <TokenRow key={r.key} row={{ ...r, label: 'Base color', hint: 'Under the layers, and on its own when there are none' }} {...rowProps} />
                        ))}
                    </div>
                </div>
                <div className="cust-bg-head mtheme-bg-head">
                    <span className="cust-bg-title">
                        Layers <span className="cust-bg-count">{layers.length} of {MAX_BG_LAYERS}</span>
                    </span>
                    <button type="button" className="cust-mini neobrutal-button" disabled={layers.length >= MAX_BG_LAYERS} onClick={addLayer}>
                        + Add layer
                    </button>
                </div>
                {layers.length === 0 ? (
                    <p className="cust-bg-empty">Add a gradient, pattern or moving math effect over the base color.</p>
                ) : (
                    // Listed top first, the way they stack on screen.
                    <ol className="mtheme-nav">
                        {[...layers].reverse().map((l) => (
                            <li key={l.id}>
                                <button type="button" className="mtheme-nav-row" onClick={() => push({ kind: 'layer', id: l.id })}>
                                    <span className="cust-layer-thumb" style={{ background: layerThumb(l) }} aria-hidden="true" />
                                    <span className="mtheme-nav-label">
                                        {BG_TYPE_BY_KEY[l.type].label}
                                        <span className="mtheme-nav-sub">{layerSummary(l)}</span>
                                    </span>
                                    <Chevron />
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </>
        );
    }

    function renderLayer(id: string) {
        const i = layers.findIndex((l) => l.id === id);
        const l = layers[i];
        if (!l) return <p className="cust-empty">This layer was removed.</p>;
        return (
            <div className="mtheme-layer">
                <LayerControls
                    layer={l}
                    onUpdate={(patch) => updateLayer(l.id, patch)}
                    onChangeType={(type) => ed.setLayers(retypeLayer(layers, l.id, type))}
                    onRaise={i < layers.length - 1 ? () => ed.setLayers(moveLayer(layers, i, 1)) : undefined}
                    onLower={i > 0 ? () => ed.setLayers(moveLayer(layers, i, -1)) : undefined}
                    onRemove={() => { ed.setLayers(layers.filter((x) => x.id !== l.id)); pop(); }}
                    palette={layerPalette(layers)}
                    clear
                    onPickColor={(param, label) => push({ kind: 'pick', target: { type: 'layer', id: l.id, param }, label })}
                />
            </div>
        );
    }

    function renderPick(target: PickTarget, label: string) {
        if (target.type === 'token') {
            return (
                <ColorPickerBody
                    label={label}
                    layout="compact"
                    value={effectiveColor(colors, target.key)}
                    swatches={swatches}
                    onChange={(hex) => ed.setToken(target.key, hex)}
                />
            );
        }
        const l = layers.find((x) => x.id === target.id);
        if (!l) return <p className="cust-empty">This layer was removed.</p>;
        return (
            <ColorPickerBody
                label={label}
                layout="compact"
                value={l[target.param]}
                swatches={layerPalette(layers)}
                onChange={(hex) => updateLayer(l.id, { [target.param]: hex })}
            />
        );
    }

    function renderPage(page: Page) {
        switch (page.kind) {
            case 'home': return renderHome();
            case 'ideas': return (
                <div className="cust-chips">
                    {IDEA_SECTION.rows.map((r) => {
                        const label = r.label ?? TOKEN_BY_KEY[r.key].label;
                        return (
                            <ColorPicker
                                key={r.key}
                                variant="chip"
                                label={label}
                                value={effectiveColor(colors, r.key)}
                                onChange={(hex) => ed.setToken(r.key, hex)}
                                onOpen={() => pickToken(r.key, `${label} ideas`)}
                            />
                        );
                    })}
                </div>
            );
            case 'background': return renderBackground();
            case 'layer': return renderLayer(page.id);
            case 'group': {
                const s = MORE_SECTIONS.find((x) => x.id === page.id);
                return <div className="mtheme-rows">{s?.rows.map((r) => <TokenRow key={r.key} row={r} {...rowProps} />)}</div>;
            }
            case 'pick': return renderPick(page.target, page.label);
        }
    }

    return (
        <>
            <div className="mmobile-scrim mtheme-scrim" onClick={onClose} />
            <div ref={swipe.sheetRef} className="mtheme-sheet" style={style} role="dialog" aria-modal="true" aria-label="Theme">
                <div className={`mtheme-header${page.kind === 'home' ? ' mtheme-header--home' : ''}`} {...swipe.dragProps}>
                    <div className="mmobile-sheet-grab mmobile-sheet-grab--panel" aria-hidden="true" />
                    {page.kind === 'home' ? (
                        <div className="cust-seg mtheme-seg" role="group" aria-label="Which themes">
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
                    ) : (
                        <>
                            <button type="button" className="mtheme-back" onClick={pop}>
                                <span aria-hidden="true">‹</span> Back
                            </button>
                            <h2 className="mtheme-title" id="mtheme-title">{title}</h2>
                        </>
                    )}
                    <button type="button" className="mmobile-search-close mtheme-close" onClick={onClose} aria-label="Close theme"><CloseIcon /></button>
                </div>

                {premium ? (
                    <>
                        {/* Pages under the top one stay mounted (hidden), so going back keeps their scroll and open groups. */}
                        {stack.map((p, i) => (
                            <div key={`${i}:${pageKey(p)}`} className={`mtheme-body cust${i === stack.length - 1 && i > 0 ? ' mtheme-body--in' : ''}`} hidden={i !== stack.length - 1}>
                                {renderPage(p)}
                            </div>
                        ))}

                        {(dirty || listError) && (
                            <div className="mtheme-footer">
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
                                            maxLength={40}
                                            placeholder="My theme"
                                            aria-label="Theme name"
                                            enterKeyHint="done"
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
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mtheme-body">
                        <LockedPitch variant="sheet" />
                    </div>
                )}
            </div>
        </>
    );
}
