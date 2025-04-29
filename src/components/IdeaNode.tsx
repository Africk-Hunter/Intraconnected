import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface IdeaNodeProps {
    id: number;
    title: string;
    parentID: number;
    isLeaf: boolean;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, isLeaf }) => {
    const { setRootId, setRootName, rootIdStack } = useIdeaContext();

    function makeRoot() {
        setRootId(id);
        setRootName(title);
        console.log('makeRoot called with id:', id);
        rootIdStack.current?.push(id);
    }

    const { attributes, listeners, setNodeRef: setDraggableRef, transform } = useDraggable({
        id: `idea-${id}`,
    });

    const { isOver, setNodeRef: setDroppableRef, active } = useDroppable({
        id: `idea-${id}`,
    });

    const setNodeRef = (node: HTMLElement | null) => {
        setDraggableRef(node);
        setDroppableRef(node);
    };

    const isBeingDraggedOver = isOver && active?.id !== `idea-${id}`;

    const draggableStyle = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: 'none',
        cursor: 'grabbing',
    };

    const dropStyle = {
        border: isBeingDraggedOver ? '3px dashed #000' : undefined,
        transition: isBeingDraggedOver ? 'scale 0.2s ease-in-out, border 0.2s ease-in-out' : undefined,
        scale: isBeingDraggedOver ? '1.15' : undefined,
    };

    const combinedStyle = {
        ...draggableStyle,
        ...dropStyle,
    };

    return (
        <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${isLeaf ? 'leaf' : 'parent'}`}
            {...attributes}
            {...listeners}>
            {title}
        </div>
    );
};

export default IdeaNode;