import { useId, useMemo, useState, type ReactNode } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import {
    PRESETS, TOKEN_BY_KEY, editorRowText, effectiveColor, isHead, nestedMembers,
    type BgLayer, type EditorRow, type ThemeColors, type TokenKey,
} from '../../utilities/theme';
import { PRICING_URL, usePurchaseMode } from '../../utilities/billing/purchaseMode';
import { openExternal } from '../../utilities/platform';
import ColorPicker from './ColorPicker';
import { BackgroundLayers } from '../ThemeBackground';

// Pieces of the theme editor shared by the desktop panel (CustomizationSettings)
// and the touch UI's sheet (MobileThemeSheet).

/** A still frame of the layers on the base color, so the section reads as a scene, not a swatch. */
export function BackgroundPreview({ layers }: { layers: BgLayer[] }) {
    const still = useMemo(() => layers.map((l) => ({ ...l, speed: 0 })), [layers]);
    return (
        <div className="cust-stage-preview" aria-hidden="true">
            <BackgroundLayers layers={still} contained />
        </div>
    );
}

export function StarIcon({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        </svg>
    );
}

/** The page behind the thumbnail: a gradient layer if the theme starts with one, else the page color. */
function artBackground(colors: ThemeColors): string {
    const first = colors.layers?.[0];
    const bg = effectiveColor(colors, 'pageBg');
    if (first?.type !== 'gradient') return bg;
    const stops = `${first.color}, ${first.color2}, ${first.color3}`;
    if (first.kind === 'radial') return `radial-gradient(circle, ${stops})`;
    if (first.kind === 'conic') return `conic-gradient(from ${first.angle}deg, ${stops}, ${first.color})`;
    return `linear-gradient(${first.angle}deg, ${stops})`;
}

const ART_NODES: TokenKey[] = ['nodeParent', 'nodeLeaf', 'nodeLink', 'nodeChecklist'];

/**
 * A thumbnail of the app in this theme. grid: the desktop's root bar over four
 * idea cards. rows: the phone's title card over a list of rows.
 */
export function ThemeArt({ colors, variant = 'grid' }: { colors: ThemeColors; variant?: 'grid' | 'rows' }) {
    const c = (k: TokenKey) => effectiveColor(colors, k);
    return (
        <span className={`cust-art${variant === 'rows' ? ' cust-art--rows' : ''}`} style={{ background: artBackground(colors) }} aria-hidden="true">
            <i className="cust-art-root" style={{ background: c('nodeRoot') }} />
            <span className="cust-art-nodes">
                {(variant === 'rows' ? ART_NODES.slice(0, 3) : ART_NODES).map((k) => (
                    <i key={k} style={{ background: c(k) }} />
                ))}
            </span>
        </span>
    );
}

/** The chip strip a closed group shows: the group's current colors, so it reads at a glance. */
export function ColorStrip({ colors, keys }: { colors: ThemeColors; keys: TokenKey[] }) {
    return (
        <span className="cust-dd-strip" aria-hidden="true">
            {keys.map((k) => <i key={k} style={{ background: effectiveColor(colors, k) }} />)}
        </span>
    );
}

/** A collapsible group. The closed header shows the group's current colors. */
export function Dropdown({ title, colors, keys, children }: { title: string; colors: ThemeColors; keys: TokenKey[]; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const bodyId = useId();
    return (
        <div className={`cust-dd${open ? ' cust-dd--open' : ''}`}>
            <button type="button" className="cust-dd-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
                <svg className="cust-dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                </svg>
                <span className="cust-dd-title">{title}</span>
                <ColorStrip colors={colors} keys={keys} />
            </button>
            <div className="cust-dd-body" id={bodyId} inert={!open}>
                <div className="cust-dd-inner"><div className="cust-dd-content">{children}</div></div>
            </div>
        </div>
    );
}

export interface TokenRowProps {
    row: EditorRow;
    colors: ThemeColors;
    swatches: string[];
    clear: boolean;
    onSet: (key: TokenKey, hex: string) => void;
    onReset: (key: TokenKey) => void;
    /** Touch UI: open the sheet's own picker page instead of the picker modal. */
    onPick?: (key: TokenKey, label: string) => void;
    touch?: boolean;
}

/**
 * One color. A head recolors its whole net; members tucked under it open with
 * "Fine-tune". A member shown as its own row says which color it follows.
 */
export function TokenRow({ row, colors, swatches, clear, onSet, onReset, onPick, touch }: TokenRowProps) {
    const { key } = row;
    const def = TOKEN_BY_KEY[key];
    const { label, hint } = editorRowText(row, touch);
    const own = !!colors.values[key];
    const follows = !isHead(key) && def.net ? TOKEN_BY_KEY[def.net as TokenKey].label : null;
    const members = nestedMembers(key);
    const detached = members.filter((m) => colors.values[m.key as TokenKey]).length;
    const [fineOpen, setFineOpen] = useState(false);
    const nestedId = useId();
    const hasMeta = (follows && !own) || own || members.length > 0;
    return (
        <div className="cust-row">
            <ColorPicker
                label={label}
                hint={hint}
                swatches={swatches}
                value={effectiveColor(colors, key)}
                onChange={(hex) => onSet(key, hex)}
                onOpen={onPick && (() => onPick(key, label))}
                clear={clear}
            />
            {hasMeta && (
                <div className="cust-row-meta">
                    {follows && !own && <span className="cust-row-note">Matches {follows}</span>}
                    {own && (
                        <button type="button" className="cust-link" onClick={() => onReset(key)}>
                            {follows ? `Match ${follows}` : 'Reset'}
                        </button>
                    )}
                    {members.length > 0 && (
                        <button type="button" className="cust-link" aria-expanded={fineOpen} aria-controls={nestedId} onClick={() => setFineOpen((o) => !o)}>
                            {fineOpen ? 'Hide fine-tuning' : `Fine-tune ${members.length}`}
                        </button>
                    )}
                    {detached > 0 && !fineOpen && <span className="cust-row-note">{detached} set separately</span>}
                </div>
            )}
            {members.length > 0 && fineOpen && (
                <div className="cust-row-nested" id={nestedId}>
                    {members.map((m) => (
                        <TokenRow
                            key={m.key}
                            row={{ key: m.key as TokenKey }}
                            colors={colors}
                            swatches={swatches}
                            clear={clear}
                            onSet={onSet}
                            onReset={onReset}
                            onPick={onPick}
                            touch={touch}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** What a free account sees instead of the editor. */
export function LockedPitch({ variant }: { variant: string }) {
    const { setUpgradeModalOpen } = useIdeaContext();
    const purchaseMode = usePurchaseMode();
    return (
        <div className={`cust cust--${variant} cust--locked`}>
            <div className="cust-scroll">
                <div className="cust-pitch-art">
                    {PRESETS.slice(1, 7).map((t) => <ThemeArt key={t.id} colors={t.colors} />)}
                </div>
                <h3 className="cust-pitch-title">Make it yours</h3>
                <p className="cust-pitch-desc">
                    Pick from {PRESETS.length} themes or paint your own: idea colors, buttons, and moving backgrounds.
                    {' '}Themes come with the Annual and Lifetime plans.
                </p>
                {purchaseMode === 'checkout' && (
                    <button className="cust-primary neobrutal-button" onClick={() => setUpgradeModalOpen(true)}>See plans</button>
                )}
                {purchaseMode === 'link-out' && (
                    <button className="cust-primary neobrutal-button" onClick={() => openExternal(PRICING_URL)}>See plans on the website</button>
                )}
            </div>
        </div>
    );
}
