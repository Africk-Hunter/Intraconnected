import React, { useEffect } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { checkIfIdeaIsLeaf } from '../utilities';

interface IdeaNodeProps {
    id: number;
    title: string;
    parentID: number;
    link: string;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, link}) => {
    const { setRootId, setRootName, rootIdStack } = useIdeaContext();

    const [nodeType, setNodeType] = React.useState('leaf');
    const [isLink, setIsLink] = React.useState(false);

    function makeRoot() {
        setRootId(id);
        setRootName(title);
        console.log('makeRoot called with id:', id);
        rootIdStack.current?.push(id);
    }

    useEffect(() => {
        determineNodeType();
    }, [id, link]);

    function determineNodeType() {
        if (link && link != '') {
            setNodeType('link');
            setIsLink(true);
            return;
        } else if (checkIfIdeaIsLeaf(id)) {
            setNodeType('leaf');
        }
        else {
            setNodeType('parent');
        }
    }

    // Drag and Drop ---------
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
    // -----

    return (
        isLink ? (
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`}
                {...attributes}
                {...listeners}>
                {title}
            </a >

        ) : (

            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`}
                {...attributes}
                {...listeners}>
                {title}
            </div >

        )
    );
};

export default IdeaNode;