import { useEffect, useId, useRef, useState } from 'react';
import {
    BG_TYPES, BG_TYPE_BY_KEY, KIND_OPTIONS, MAX_BG_LAYERS, newLayer,
    type BgGroup, type BgLayer, type BgParam, type BgType,
} from '../../utilities/theme';
import {
    capitalize as cap, layerColorFields, layerPalette, layerSummary, layerThumb, moveLayer, retypeLayer, type LayerColorParam,
} from '../../utilities/themeLayers';
import ColorPicker from './ColorPicker';

interface Props {
    layers: BgLayer[];
    onChange: (layers: BgLayer[]) => void;
    /** Passed to each color picker (see ColorPicker). */
    clear?: boolean;
}

type SliderParam = 'angle' | 'size' | 'density' | 'speed';

const SLIDERS: Record<SliderParam, { label: string; min: number; max: number }> = {
    angle: { label: 'Angle', min: 0, max: 360 },
    size: { label: 'Scale', min: 1, max: 10 },
    density: { label: 'Detail', min: 1, max: 10 },
    speed: { label: 'Speed', min: 0, max: 10 },
};

const GROUPS: BgGroup[] = ['Basic', 'Math', 'Scenes'];

/** Angle only means something for straight gradients and lined patterns. */
const hasAngle = (l: BgLayer) =>
    l.type === 'gradient' ? l.kind !== 'radial' : l.type === 'pattern' ? ['stripes', 'hatch'].includes(l.kind) : true;

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
    return (
        <label className="cust-slider">
            <span>{label}</span>
            <input type="range" className="cust-range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
            <output>{value}</output>
        </label>
    );
}

export interface LayerControlsProps {
    layer: BgLayer;
    onUpdate: (patch: Partial<BgLayer>) => void;
    onChangeType: (type: BgType) => void;
    onRaise?: () => void;
    onLower?: () => void;
    onRemove: () => void;
    palette: string[];
    clear?: boolean;
    /** Touch UI: open the sheet's own picker page for this color instead of the picker modal. */
    onPickColor?: (param: LayerColorParam, label: string) => void;
}

/** Everything a layer can change: style, shape, colors, sliders, order and removal. */
export function LayerControls({ layer: l, onUpdate, onChangeType, onRaise, onLower, onRemove, palette, clear, onPickColor }: LayerControlsProps) {
    const meta = BG_TYPE_BY_KEY[l.type];
    const kinds = KIND_OPTIONS[l.type];
    const fieldId = useId();
    const name = (p: BgParam, fallback: string) => meta.names?.[p] ?? fallback;
    const colors = layerColorFields(l);
    const sliders = (Object.keys(SLIDERS) as SliderParam[]).filter((p) => meta.params.includes(p) && (p !== 'angle' || hasAngle(l)));

    // Remove takes a second press within a few seconds, so a stray press can't lose a tuned layer.
    const [confirming, setConfirming] = useState(false);
    const timer = useRef(0);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const remove = () => {
        window.clearTimeout(timer.current);
        if (confirming) { onRemove(); return; }
        setConfirming(true);
        timer.current = window.setTimeout(() => setConfirming(false), 3000);
    };

    return (
        <>
            <div className="cust-field">
                <label className="cust-field-label" htmlFor={`${fieldId}-style`}>Style</label>
                <select
                    id={`${fieldId}-style`}
                    className="cust-select neobrutal-input"
                    value={l.type}
                    onChange={(e) => onChangeType(e.target.value as BgType)}
                >
                    {GROUPS.map((g) => (
                        <optgroup key={g} label={g}>
                            {BG_TYPES.filter((t) => t.group === g).map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                        </optgroup>
                    ))}
                </select>
            </div>
            <p className="cust-layer-hint">{meta.hint}</p>

            {kinds && (
                <div className="cust-field">
                    <span className="cust-field-label">Shape</span>
                    <div className="cust-seg cust-seg--wrap" role="group" aria-label="Shape">
                        {kinds.map((k) => (
                            <button
                                key={k}
                                type="button"
                                className={`cust-seg-btn${l.kind === k ? ' cust-seg-btn--on' : ''}`}
                                aria-pressed={l.kind === k}
                                onClick={() => onUpdate({ kind: k })}
                            >
                                {cap(k)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="cust-field">
                <span className="cust-field-label">{colors.length > 1 ? 'Colors' : 'Color'}</span>
                <div className="cust-swatches">
                    {colors.map(({ param, label }) => (
                        <ColorPicker
                            key={param}
                            variant="swatch"
                            label={label}
                            value={l[param]}
                            swatches={palette}
                            clear={clear}
                            onChange={(hex) => onUpdate({ [param]: hex })}
                            onOpen={onPickColor && (() => onPickColor(param, label))}
                        />
                    ))}
                </div>
            </div>

            <div className="cust-sliders">
                {sliders.map((p) => (
                    <Slider key={p} label={name(p, SLIDERS[p].label)} min={SLIDERS[p].min} max={SLIDERS[p].max} value={l[p]} onChange={(n) => onUpdate({ [p]: n })} />
                ))}
                <Slider label="Strength" min={0} max={100} value={l.opacity} onChange={(n) => onUpdate({ opacity: n })} />
            </div>

            <div className="cust-layer-foot">
                {onRaise && <button type="button" className="cust-link" onClick={onRaise}>Move up</button>}
                {onLower && <button type="button" className="cust-link" onClick={onLower}>Move down</button>}
                <button type="button" className={`cust-link cust-link--danger${confirming ? ' cust-link--confirm' : ''}`} onClick={remove}>
                    {confirming ? 'Press again to remove' : 'Remove layer'}
                </button>
            </div>
        </>
    );
}

interface LayerCardProps extends LayerControlsProps {
    open: boolean;
    onToggle: () => void;
}

function LayerCard({ open, onToggle, ...controls }: LayerCardProps) {
    const l = controls.layer;
    const bodyId = useId();
    return (
        <li className={`cust-layer${open ? ' cust-layer--open' : ''}`}>
            <button type="button" className="cust-layer-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
                <span className="cust-layer-thumb" style={{ background: layerThumb(l) }} aria-hidden="true" />
                <span className="cust-layer-text">
                    <span className="cust-layer-name">{BG_TYPE_BY_KEY[l.type].label}</span>
                    <span className="cust-layer-sub">{layerSummary(l)}</span>
                </span>
                <svg className="cust-dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                </svg>
            </button>

            <div className="cust-layer-body" id={bodyId} inert={!open}>
                <div className="cust-layer-inner"><div className="cust-layer-content">
                    <LayerControls {...controls} />
                </div></div>
            </div>
        </li>
    );
}

export default function BackgroundEditor({ layers, onChange, clear }: Props) {
    const [openId, setOpenId] = useState<string | null>(null);

    const update = (id: string, patch: Partial<BgLayer>) =>
        onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const add = () => {
        const l = newLayer('gradient');
        onChange([...layers, l]);
        setOpenId(l.id);
    };

    const palette = layerPalette(layers);

    return (
        <div className="cust-bg">
            <div className="cust-bg-head">
                <span className="cust-bg-title">
                    Layers <span className="cust-bg-count">{layers.length} of {MAX_BG_LAYERS}</span>
                </span>
                <button type="button" className="cust-mini neobrutal-button" disabled={layers.length >= MAX_BG_LAYERS} onClick={add}>
                    + Add layer
                </button>
            </div>

            {layers.length === 0 ? (
                <p className="cust-bg-empty">Add a gradient, pattern or moving math effect over the base color.</p>
            ) : (
                // Listed top first, the way they stack on screen.
                <ol className="cust-layers">
                    {layers.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
                        <LayerCard
                            key={l.id}
                            layer={l}
                            open={openId === l.id}
                            onToggle={() => setOpenId((o) => (o === l.id ? null : l.id))}
                            onUpdate={(patch) => update(l.id, patch)}
                            onChangeType={(type) => onChange(retypeLayer(layers, l.id, type))}
                            onRaise={i < layers.length - 1 ? () => onChange(moveLayer(layers, i, 1)) : undefined}
                            onLower={i > 0 ? () => onChange(moveLayer(layers, i, -1)) : undefined}
                            onRemove={() => onChange(layers.filter((x) => x.id !== l.id))}
                            palette={palette}
                            clear={clear}
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}
