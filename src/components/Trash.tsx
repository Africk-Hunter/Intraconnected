import React from 'react';
import { useDroppable } from '@dnd-kit/core';

const Trash: React.FC = () => {
    const { isOver, setNodeRef } = useDroppable({
        id: 'trash',
    });

    const style = {
        backgroundColor: isOver ? 'red' : '',
        scale: isOver ? '1.25' : '',
        transform: isOver ? 'translateY(-10px)' : '',
    };

    return (
        <div ref={setNodeRef} style={style} className="largeSideButton neobrutal-button danger trashCan">
            <img src="/images/Trash.svg" alt="Trash Can" className="buttonImg" />
        </div>
    );
};

export default Trash;