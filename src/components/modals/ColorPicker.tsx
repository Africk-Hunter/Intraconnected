import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnimatedOverlay from '../AnimatedOverlay';

interface Props {
    label: string;
    value: string;
    onChange: (hex: string) => void;
    /** Quick-pick colors (e.g. the rest of the theme). */
    swatches?: string[];
    /** row: swatch, label and hex in one button. chip: a little idea card painted in the color. swatch: a square with a small caption. */
    variant?: 'row' | 'chip' | 'swatch';
    /** One line under the label saying what the color paints. */
    hint?: string;
    /** No dimmed backdrop, and the picker sits clear of the theme panel, so the app stays visible while picking. */
    clear?: boolean;
    /** When set, pressing the button calls this instead of opening the picker modal (the touch UI's sheet shows its own). */
    onOpen?: () => void;
}

type Hsv = [number, number, number]; // h 0-360, s 0-1, v 0-1
type Rgb = [number, number, number]; // 0-255
type Mode = 'rgb' | 'hsv' | 'hsl';

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Normalizes "abc", "#abc" or "#aabbcc" to "#aabbcc"; null when invalid. */
function normalizeHex(input: string): string | null {
    const m = HEX_RE.exec(input.trim());
    if (!m) return null;
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `#${h}`;
}

function hexToRgb(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
    return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsv([r, g, b]: Rgb): Hsv {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return [h, max ? d / max : 0, max];
}

function hsvToRgb([h, s, v]: Hsv): Rgb {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return [f(5), f(3), f(1)];
}

function rgbToHsl(rgb: Rgb, hueHint: number): [number, number, number] {
    const [h, sv, v] = rgbToHsv(rgb);
    const l = v * (1 - sv / 2);
    const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
    return [sv === 0 ? hueHint : h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
    const v = l + s * Math.min(l, 1 - l);
    return hsvToRgb([h, v === 0 ? 0 : 2 * (1 - l / v), v]);
}

const css = (rgb: Rgb) => `rgb(${Math.round(rgb[0])} ${Math.round(rgb[1])} ${Math.round(rgb[2])})`;
const ramp = (fn: (t: number) => Rgb, steps = 6) =>
    `linear-gradient(to right, ${Array.from({ length: steps + 1 }, (_, i) => css(fn(i / steps))).join(', ')})`;

interface Channel {
    key: string;
    label: string;
    max: number;
    value: number;
    gradient: string;
    /** Returns the new color (as HSV) after this channel is set to `v` (0..max). */
    set: (v: number) => Hsv;
}

/** Calls onMove with the pointer position for the whole drag. */
function startDrag(e: React.PointerEvent, el: HTMLElement, onMove: (x: number, y: number, rect: DOMRect) => void) {
    const run = (ev: { clientX: number; clientY: number }) => onMove(ev.clientX, ev.clientY, el.getBoundingClientRect());
    el.setPointerCapture(e.pointerId);
    run(e);
    const up = () => {
        el.removeEventListener('pointermove', run);
        el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', run);
    el.addEventListener('pointerup', up);
}

/** One channel as a slider bar plus its number. `bare` drops the number (the compact picker's hue bar). */
function Bar({ channel, onChange, bare }: { channel: Channel; onChange: (hsv: Hsv) => void; bare?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const { max, value } = channel;
    return (
        <div className={`cust-channel${bare ? ' cust-channel--bare' : ''}`}>
            <span className="cust-channel-label">{channel.label}</span>
            <div
                ref={ref}
                className="cust-bar"
                style={{ background: channel.gradient }}
                role="slider"
                tabIndex={0}
                aria-label={channel.key}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.round(value)}
                onPointerDown={(e) => ref.current && startDrag(e, ref.current, (x, _y, r) =>
                    onChange(channel.set(clamp((x - r.left) / r.width, 0, 1) * max)))}
                onKeyDown={(e) => {
                    const step = e.shiftKey ? 10 : 1;
                    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
                    if (!dir) return;
                    e.preventDefault();
                    onChange(channel.set(clamp(value + dir * step, 0, max)));
                }}
            >
                <span className="cust-bar-thumb" style={{ left: `${(value / max) * 100}%` }} />
            </div>
            {!bare && <input
                className="cust-num neobrutal-input"
                type="number"
                min={0}
                max={max}
                value={Math.round(value)}
                aria-label={channel.key}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    if (e.target.value !== '' && !Number.isNaN(n)) onChange(channel.set(clamp(n, 0, max)));
                }}
            />}
        </div>
    );
}

/** Black or white, whichever reads better on `hex`. */
function inkFor(hex: string): string {
    const [r, g, b] = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

interface BodyProps {
    label: string;
    /** The color when the picker opened: becomes "Original", and the starting point. */
    value: string;
    onChange: (hex: string) => void;
    swatches?: string[];
    /** wheel: the modal's hue ring around the square. compact: the touch sheet's wide square, a hue bar, and values on request. */
    layout?: 'wheel' | 'compact';
    /** Rendered at the end (the modal's Done button). */
    children?: React.ReactNode;
}

/**
 * The picker itself. Its state starts from `value` when it mounts, so mount it
 * fresh (or change its key) for each color being picked.
 */
export function ColorPickerBody({ label, value, onChange, swatches, layout = 'wheel', children }: BodyProps) {
    const [startHex] = useState(value);
    const [mode, setMode] = useState<Mode>('hsv');
    const [showValues, setShowValues] = useState(false);
    const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
    const [text, setText] = useState(value);
    const hsvRef = useRef(hsv);
    const wheelRef = useRef<HTMLDivElement>(null);
    const squareRef = useRef<HTMLDivElement>(null);
    const compact = layout === 'compact';

    const apply = (next: Hsv) => {
        hsvRef.current = next;
        setHsv(next);
        const hex = rgbToHex(hsvToRgb(next));
        setText(hex);
        onChange(hex);
    };

    const commitText = (raw: string) => {
        setText(raw);
        const hex = normalizeHex(raw);
        if (!hex) return;
        const next = rgbToHsv(hexToRgb(hex));
        // Greys have no hue of their own: keep the one the user was on.
        if (next[1] === 0 || next[2] === 0) next[0] = hsvRef.current[0];
        hsvRef.current = next;
        setHsv(next);
        setText(hex);
        onChange(hex);
    };

    const useEyedropper = async () => {
        if (!EyeDropper) return;
        try {
            const res = await new EyeDropper().open();
            commitText(res.sRGBHex);
        } catch { /* cancelled */ }
    };

    const rgb = hsvToRgb(hsv);
    const hsl = rgbToHsl(rgb, hsv[0]);
    // Rebuilds HSV from RGB / HSL edits, keeping the hue when the result is grey.
    const fromRgb = (next: Rgb): Hsv => {
        const out = rgbToHsv(next);
        if (out[1] === 0 || out[2] === 0) out[0] = hsv[0];
        return out;
    };
    const fromHsl = (next: [number, number, number]): Hsv => {
        const out = rgbToHsv(hslToRgb(next));
        out[0] = next[0];
        return out;
    };

    const rainbow = ramp((t) => hsvToRgb([t * 360, 1, 1]));
    const hueChannel: Channel = { key: 'H', label: 'H', max: 360, value: hsv[0], gradient: rainbow, set: (v: number) => [v, hsv[1], hsv[2]] as Hsv };
    const channels: Channel[] = mode === 'rgb'
        ? (['R', 'G', 'B'] as const).map((l, i) => ({
            key: l, label: l, max: 255, value: rgb[i],
            gradient: ramp((t) => { const c = [...rgb] as Rgb; c[i] = t * 255; return c; }, 2),
            set: (v: number) => { const c = [...rgb] as Rgb; c[i] = v; return fromRgb(c); },
        }))
        : mode === 'hsv'
            ? [
                hueChannel,
                { key: 'S', label: 'S', max: 100, value: hsv[1] * 100, gradient: ramp((t) => hsvToRgb([hsv[0], t, hsv[2]]), 2), set: (v: number) => [hsv[0], v / 100, hsv[2]] as Hsv },
                { key: 'V', label: 'V', max: 100, value: hsv[2] * 100, gradient: ramp((t) => hsvToRgb([hsv[0], hsv[1], t]), 2), set: (v: number) => [hsv[0], hsv[1], v / 100] as Hsv },
            ]
            : [
                { key: 'H', label: 'H', max: 360, value: hsl[0], gradient: rainbow, set: (v: number) => fromHsl([v, hsl[1], hsl[2]]) },
                { key: 'S', label: 'S', max: 100, value: hsl[1] * 100, gradient: ramp((t) => hslToRgb([hsl[0], t, hsl[2]]), 2), set: (v: number) => fromHsl([hsl[0], v / 100, hsl[2]]) },
                { key: 'L', label: 'L', max: 100, value: hsl[2] * 100, gradient: ramp((t) => hslToRgb([hsl[0], hsl[1], t])), set: (v: number) => fromHsl([hsl[0], hsl[1], v / 100]) },
            ];

    const hex = rgbToHex(rgb);
    const ringAngle = (hsv[0] * Math.PI) / 180;
    const ringR = 41; // % of wheel size: middle of the ring

    const square = (
        <div
            ref={squareRef}
            className={`cust-square${compact ? ' cust-square--flat' : ''}`}
            style={{ background: css(hsvToRgb([hsv[0], 1, 1])) }}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`Saturation ${Math.round(hsv[1] * 100)}, brightness ${Math.round(hsv[2] * 100)}`}
            aria-valuenow={Math.round(hsv[1] * 100)}
            onKeyDown={(e) => {
                e.stopPropagation();
                const step = e.shiftKey ? 0.1 : 0.01;
                const ds = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                const dv = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
                if (!ds && !dv) return;
                e.preventDefault();
                apply([hsv[0], clamp(hsv[1] + ds, 0, 1), clamp(hsv[2] + dv, 0, 1)]);
            }}
            onPointerDown={(e) => {
                e.stopPropagation();
                if (!squareRef.current) return;
                startDrag(e, squareRef.current, (x, y, r) => apply([
                    hsvRef.current[0],
                    clamp((x - r.left) / r.width, 0, 1),
                    1 - clamp((y - r.top) / r.height, 0, 1),
                ]));
            }}
        >
            <span className="cust-square-white" />
            <span className="cust-square-black" />
            <span
                className="cust-square-thumb"
                style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: hex }}
            />
        </div>
    );

    const hexField = (
        <input
            className="cust-hex cust-hex--wide neobrutal-input"
            value={text}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={7}
            aria-label="Hex"
            onChange={(e) => commitText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
    );

    const modes = (
        <div className="cust-modes" role="tablist">
            {(['rgb', 'hsv', 'hsl'] as Mode[]).map((m) => (
                <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    className={`cust-tab neobrutal-button${mode === m ? ' cust-tab--active' : ''}`}
                    onClick={() => setMode(m)}
                >
                    {m.toUpperCase()}
                </button>
            ))}
        </div>
    );

    const swatchRow = swatches && swatches.length > 0 && (
        <div className="cust-swatch-row" aria-label="Theme colors">
            {swatches.map((c, i) => (
                <button
                    key={`${c}-${i}`}
                    type="button"
                    className="cust-swatch-chip neobrutal-button"
                    style={{ background: c }}
                    aria-label={`Use ${c}`}
                    onClick={() => commitText(c)}
                />
            ))}
        </div>
    );

    const original = (
        <button
            type="button"
            className="cust-compare-old neobrutal-button"
            style={{ background: startHex, color: inkFor(startHex) }}
            onClick={() => commitText(startHex)}
            title="Revert to the color you opened with"
        >
            Original
        </button>
    );

    if (compact) {
        return (
            <div className="cust-picker-body cust-picker-body--compact" role="group" aria-label={`${label} color`}>
                {square}
                <Bar channel={hueChannel} onChange={apply} bare />
                <div className="cust-compare">
                    {original}
                    <span className="cust-compare-new" style={{ background: hex, color: inkFor(hex) }}>New</span>
                </div>
                <div className="cust-channel">
                    <span className="cust-channel-label">#</span>
                    {hexField}
                </div>
                {swatchRow}
                <button type="button" className="cust-link cust-values-toggle" aria-expanded={showValues} onClick={() => setShowValues((o) => !o)}>
                    {showValues ? 'Hide exact values' : 'Exact values (RGB, HSV, HSL)'}
                </button>
                {showValues && (
                    <>
                        {modes}
                        <div className="cust-channels">
                            {channels.map((c) => <Bar key={`${mode}-${c.key}`} channel={c} onChange={apply} />)}
                        </div>
                    </>
                )}
                {children}
            </div>
        );
    }

    return (
        <>
            <header className="cust-picker-header" style={{ background: hex, color: inkFor(hex) }}>
                <h3 className="cust-picker-title">{label}</h3>
                <span className="cust-picker-hexlabel">{hex.toUpperCase()}</span>
            </header>

            <div className="cust-picker-body">
                <div
                    ref={wheelRef}
                    className="cust-wheel"
                    role="slider"
                    tabIndex={0}
                    aria-label="Hue"
                    aria-valuemin={0}
                    aria-valuemax={360}
                    aria-valuenow={Math.round(hsv[0])}
                    onKeyDown={(e) => {
                        const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
                        if (!dir) return;
                        e.preventDefault();
                        apply([(hsv[0] + dir * (e.shiftKey ? 10 : 1) + 360) % 360, hsv[1], hsv[2]]);
                    }}
                    onPointerDown={(e) => wheelRef.current && startDrag(e, wheelRef.current, (x, y, r) => {
                        const dx = x - (r.left + r.width / 2);
                        const dy = y - (r.top + r.height / 2);
                        const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
                        apply([h, hsvRef.current[1], hsvRef.current[2]]);
                    })}
                >
                    <span
                        className="cust-wheel-thumb"
                        style={{
                            left: `${50 + ringR * Math.sin(ringAngle)}%`,
                            top: `${50 - ringR * Math.cos(ringAngle)}%`,
                            background: css(hsvToRgb([hsv[0], 1, 1])),
                        }}
                    />
                    <div className="cust-wheel-hole" />
                    {square}
                </div>

                <div className="cust-compare">
                    {original}
                    <span className="cust-compare-new" style={{ background: hex, color: inkFor(hex) }}>New</span>
                    {EyeDropper && (
                        <button type="button" className="cust-eyedropper neobrutal-button" onClick={useEyedropper} aria-label="Pick a color from the screen" title="Pick from screen">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M14 4l6 6" />
                                <path d="M17 7l-9.5 9.5L5 19l-1 1 1 1 1-1 2.5-2.5L18 8" />
                            </svg>
                        </button>
                    )}
                </div>

                {modes}

                <div className="cust-channels">
                    {channels.map((c) => <Bar key={`${mode}-${c.key}`} channel={c} onChange={apply} />)}
                    <div className="cust-channel">
                        <span className="cust-channel-label">#</span>
                        {hexField}
                    </div>
                </div>

                {swatchRow}
                {children}
            </div>
        </>
    );
}

export default function ColorPicker({ label, value, onChange, swatches, variant = 'row', hint, clear, onOpen }: Props) {
    const [open, setOpen] = useState(false);
    // Each opening mounts a fresh body, so it starts from the color as it is now.
    const [opened, setOpened] = useState(0);

    const openPicker = () => {
        if (onOpen) { onOpen(); return; }
        setOpened((n) => n + 1);
        setOpen(true);
    };

    return (
        <>
            {variant === 'swatch' ? (
                <button type="button" className="cust-swatch-btn" onClick={openPicker} aria-label={`${label} color, ${value.toUpperCase()}`} title={value.toUpperCase()}>
                    <span className="cust-swatch" style={{ background: value }} />
                    <span className="cust-swatch-cap">{label}</span>
                </button>
            ) : variant === 'chip' ? (
                <button
                    type="button"
                    className="cust-chip"
                    style={{ background: value, color: inkFor(value) }}
                    aria-label={`${label} color, ${value.toUpperCase()}`}
                    onClick={openPicker}
                >
                    {label}
                </button>
            ) : (
                <button type="button" className="cust-color-row" onClick={openPicker} aria-label={`${label} color, ${value.toUpperCase()}`}>
                    <span className="cust-swatch" style={{ background: value }} />
                    <span className="cust-color-text">
                        <span className="cust-color-label">{label}</span>
                        {hint && <span className="cust-color-hint">{hint}</span>}
                    </span>
                    <span className="cust-color-hex">{value.toUpperCase()}</span>
                </button>
            )}

            {!onOpen && createPortal(
                <AnimatedOverlay open={open} onEscape={() => setOpen(false)} onClick={() => setOpen(false)} className={clear ? 'cust-picker-overlay' : undefined}>
                    <div className="modal neobrutal confirmModal cust-picker" onClick={(e) => e.stopPropagation()}>
                        <ColorPickerBody key={opened} label={label} value={value} onChange={onChange} swatches={swatches}>
                            <section className="modalButtons">
                                <button className="modalButton continue neobrutal-button" onClick={() => setOpen(false)}>Done</button>
                            </section>
                        </ColorPickerBody>
                    </div>
                </AnimatedOverlay>,
                document.body,
            )}
        </>
    );
}
