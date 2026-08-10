import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';

interface DepthIndicatorProps {
    index: number;
    rootId: number;
    rootName: string;
}

const DepthIndicator: React.FC<DepthIndicatorProps> = ({ index, rootId, rootName }) => {
    const { navigateToId } = useIdeaContext();

    const handleClick = () => {
        navigateToId(rootId);
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
