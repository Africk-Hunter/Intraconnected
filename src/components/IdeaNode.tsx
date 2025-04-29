import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useDraggable } from '@dnd-kit/core';

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

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `idea-${id}`,
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            transition: 'none',
            cursor: 'grabbing',
        }
        : undefined;

    return (
            <div
                onClick={makeRoot}
                ref={setNodeRef}
                style={style}
                className={`neobrutal-button ideaNode ${isLeaf ? 'leaf' : 'parent'}`}
                {...attributes}
                {...listeners}
            >
                {title}
            </div>
    );
};

export default IdeaNode;