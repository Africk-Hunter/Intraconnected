import React, { useState, useEffect } from 'react';
import { useDroppable, useDndMonitor } from '@dnd-kit/core';

interface LastIdeaProps {
    lastRootName: string;
}

const LastIdea: React.FC<LastIdeaProps> = ({ lastRootName }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: 'last-idea',
    });

    const [isDragging, setIsDragging] = useState(false);

    useDndMonitor({
        onDragStart: () => setIsDragging(true),
        onDragEnd: () => setIsDragging(false),
        onDragCancel: () => setIsDragging(false),
    });

    const style = {
        scale: isOver ? '1.10' : '',
        visibility: isDragging ? 'visible' : 'hidden',
        transition: 'scale 0.2s ease, opacity 0.2s ease',
        opacity: isOver ? .75 : 0.5,
    };

    return (
        <div ref={setNodeRef} className="moveBack roots" style={style}>
            {lastRootName}
        </div>
    );
};

export default LastIdea;
