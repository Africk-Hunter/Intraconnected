import React, { useEffect, useRef, useState } from 'react';

// Hover delay before the label appears. Long enough not to flash while the
// pointer crosses the sidebar, short enough that an icon-only button explains
// itself without a pause.
const HOVER_DELAY_MS = 400;

interface TooltipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    tooltip: string;
    // Keyboard shortcut shown after the label, e.g. "C" -> "Create new idea (C)".
    shortcut?: string;
    tooltipSide?: 'left' | 'right';
    alwaysVisible?: boolean;
    wrapperClassName?: string;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({
    tooltip,
    shortcut,
    tooltipSide = 'right',
    alwaysVisible = false,
    wrapperClassName,
    className,
    children,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...props
}) => {
    const [hoverVisible, setHoverVisible] = useState(false);
    const [focusVisible, setFocusVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const visible = alwaysVisible || hoverVisible || focusVisible;
    const label = shortcut ? `${tooltip} (${shortcut})` : tooltip;

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        timerRef.current = setTimeout(() => setHoverVisible(true), HOVER_DELAY_MS);
        onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setHoverVisible(false);
        onMouseLeave?.(e);
    };

    // Only keyboard focus shows the label at once; a mouse click also focuses
    // the button, and the tooltip would then stick until the user clicks away.
    const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
        if (e.currentTarget.matches(':focus-visible')) setFocusVisible(true);
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
        setFocusVisible(false);
        onBlur?.(e);
    };

    return (
        <div className={`tooltip-wrapper${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
            <button
                {...props}
                className={`${className ?? ''}${visible ? ' tooltip-highlighted' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
            >
                {children}
            </button>
            {visible && (
                <span className={`tooltip-text tooltip-${tooltipSide}${alwaysVisible ? ' tooltip-text--bump' : ''}`}>{label}</span>
            )}
        </div>
    );
};

export default TooltipButton;
