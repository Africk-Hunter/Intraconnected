import React, { useRef, useState } from 'react';

interface TooltipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    tooltip: string;
    tooltipSide?: 'left' | 'right';
    alwaysVisible?: boolean;
    wrapperClassName?: string;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({
    tooltip,
    tooltipSide = 'right',
    alwaysVisible = false,
    wrapperClassName,
    className,
    children,
    onMouseEnter,
    onMouseLeave,
    ...props
}) => {
    const [hoverVisible, setHoverVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const visible = alwaysVisible || hoverVisible;

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        timerRef.current = setTimeout(() => setHoverVisible(true), 1000);
        onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setHoverVisible(false);
        onMouseLeave?.(e);
    };

    return (
        <div className={`tooltip-wrapper${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
            <button
                {...props}
                className={`${className ?? ''}${visible ? ' tooltip-highlighted' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </button>
            {visible && (
                <span className={`tooltip-text tooltip-${tooltipSide}${alwaysVisible ? ' tooltip-text--bump' : ''}`}>{tooltip}</span>
            )}
        </div>
    );
};

export default TooltipButton;
