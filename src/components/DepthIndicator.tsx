import React from 'react';
import { returnToRootOfID } from '../utilities/index';
import { useIdeaContext } from '../context/IdeaContext';

interface DepthIndicatorProps {
    index: number;
    rootId: number;
    rootName: string;
}

const DepthIndicator: React.FC<DepthIndicatorProps> = ({ index, rootId, rootName }) => {
    const { setRootId, setRootName, rootIdStack } = useIdeaContext();

    const handleClick = () => {
        returnToRootOfID({
            setRootId,
            setRootName,
            rootIdStack,
            rootToGoTo: rootId,
            newRootName: rootName,
        });
    };

    const col = index % 3; // 0 = left, 1 = middle, 2 = right
    const labelRight = `calc(13rem - ${2 - col} * 3.5rem)`;

    return (
        <div key={index} className="depthIndicator" style={{ '--label-right': labelRight } as React.CSSProperties} onClick={handleClick}>
            <div className="depthText">{rootName}</div>
        </div>
    );
};

export default DepthIndicator;