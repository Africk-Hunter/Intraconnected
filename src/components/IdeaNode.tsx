import React, { useEffect } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface IdeaNodeProps {
    id: number;
    title: string;
    parentID: number;
    link: string;
    isLeaf: boolean;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ id, title, link, isLeaf }) => {
    const { setRootId, setRootName, rootIdStack, setRenameModalOpen, setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink } = useIdeaContext();

    const [nodeType, setNodeType] = React.useState('leaf');
    const [isLink, setIsLink] = React.useState(false);
    const [copyPath, setCopyPath] = React.useState('images/CopyIcon.svg');
    const [penPath, setPenPath] = React.useState('images/Pen.svg');


    function makeRoot() {
        setRootId(id);
        setRootName(title);
        rootIdStack.current?.push(id);
    }

    useEffect(() => {
        determineNodeType();
    }, [id, link, isLeaf]);

    function determineNodeType() {
        if (link && link != '') {
            setNodeType('link');
            setIsLink(true);
            return;
        } else if (isLeaf) {
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

    function copyToClipboard(e: React.MouseEvent) {
        e.stopPropagation();

        navigator.clipboard.writeText(title).then(() => {
            console.log('Copied to clipboard:', title);
            setTimeout(() => {
                setCopyPath('images/CopyIcon.svg');
            }, 1000);
            setCopyPath('images/Checkmark.svg');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    /* function renameIdea(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        setRenameModalOpen(true)
        navigator.clipboard.writeText(title).then(() => {
            console.log('Copied to clipboard:', title);
            setTimeout(() => {
                setCopyPath('images/CopyIcon.svg');
            }, 1000);
            setCopyPath('images/Checkmark.svg');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    } */

    function changeLink(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        setCurrentLinkID(id)
        setCurrentLink(link)
        setLinkChangeModalOpen(true)
    }

    return (
        isLink ? (
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                <button className="copy" onClick={changeLink}><img src={penPath} alt="Copy Idea Content" className="copyImg" /></button>
            </a >

        ) : (

            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </div >

        )
    );
};

export default IdeaNode;