import React, { useRef, useState } from 'react';

interface TooltipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    tooltip: string;
    tooltipSide?: 'left' | 'right';
}

const TooltipButton: React.FC<TooltipButtonProps> = ({
    tooltip,
    tooltipSide = 'right',
    className,
    children,
    onMouseEnter,
    onMouseLeave,
    ...props
}) => {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        timerRef.current = setTimeout(() => setVisible(true), 1000);
        onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
        onMouseLeave?.(e);
    };

    return (
        <div className="tooltip-wrapper">
            <button
                {...props}
                className={`${className ?? ''}${visible ? ' tooltip-highlighted' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </button>
            {visible && (
                <span className={`tooltip-text tooltip-${tooltipSide}`}>{tooltip}</span>
            )}
        </div>
    );
};

export default TooltipButton;
