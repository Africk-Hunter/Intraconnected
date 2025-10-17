import React, { useEffect, useState } from 'react';
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
    const { setRootId, setRootName, rootIdStack, setRenameModalOpen, setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink, setCurrentNameChangeId, setSelectedIdeaName, selectedIdeaName } = useIdeaContext();

    const [nodeType, setNodeType] = React.useState('leaf');
    const [isLink, setIsLink] = React.useState(false);
    const [copyPath, setCopyPath] = React.useState('images/CopyIcon.svg');
    const [penPath, setPenPath] = React.useState('images/Pen.svg');
    const [linkPath, setLinkPath] = React.useState('images/LinkBlack.svg');
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });


    function makeRoot() {
        setRootId(id);
        setRootName(title);
        rootIdStack.current?.push(id);
    }

    useEffect(() => {
        determineNodeType();
    }, [id, link, isLeaf]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);

        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', handler as any);
        } else {
            mq.addListener(handler);
        }

        return () => {
            if (typeof mq.removeEventListener === 'function') {
                mq.removeEventListener('change', handler as any);
            } else {
                mq.removeListener(handler);
            }
        };
    }, []);

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
        disabled: isMobile, 
    });
    const { isOver, setNodeRef: setDroppableRef, active } = useDroppable({
        id: `idea-${id}`,
        disabled: isMobile, 
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
        e.preventDefault();

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

    function changeLink(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        setCurrentLinkID(id)
        setCurrentLink(link)
        setLinkChangeModalOpen(true)
    }

    function changeName(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();

        setCurrentNameChangeId(id)
        setSelectedIdeaName(title)
        console.log(selectedIdeaName)
        setRenameModalOpen(true)
    }

    return (
        link && link !== "" ? (
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                {isLeaf ? <button className="editLink copy" onClick={changeLink}><img src={linkPath} alt="Change Link" className="copyImg" /></button> : <></>}
                <button className="renameButtonNode copy" onClick={changeName}><img src={penPath} alt="Change Link" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </a>
        ) : (
            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                {isLeaf ? <button className="editLink copy" onClick={changeLink}><img src={linkPath} alt="Change Link" className="copyImg" /></button> : <></>}
                <button className="renameButtonNode copy" onClick={changeName}><img src={penPath} alt="Change Link" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </div>
        )
    );
};

export default IdeaNode;