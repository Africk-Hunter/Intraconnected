import React from 'react';

// Welcome-screen loop: a root idea grows a tree downward, level by level.
// Timing lives in help.scss.
const HelpTreeAnim: React.FC = () => (
    <svg
        className="help-tree"
        viewBox="0 0 120 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <g className="help-tree-scene">
            <g stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path className="help-tree-link help-tree-link--1" pathLength={1} d="M 60 20 L 34 38" />
                <path className="help-tree-link help-tree-link--1" pathLength={1} d="M 60 20 L 86 38" />
                <path className="help-tree-link help-tree-link--2" pathLength={1} d="M 34 54 L 14 72" />
                <path className="help-tree-link help-tree-link--2" pathLength={1} d="M 34 54 L 44 72" />
                <path className="help-tree-link help-tree-link--2" pathLength={1} d="M 86 54 L 76 72" />
                <path className="help-tree-link help-tree-link--2" pathLength={1} d="M 86 54 L 106 72" />
            </g>

            <g stroke="#111" strokeWidth="2">
                <rect className="help-tree-node help-tree-node--root" x="46" y="4" width="28" height="16" rx="4" fill="#A3703E" />
                <rect className="help-tree-node help-tree-node--2" x="20" y="38" width="28" height="16" rx="4" fill="#00A9D8" />
                <rect className="help-tree-node help-tree-node--2" x="72" y="38" width="28" height="16" rx="4" fill="#00A9D8" />
                <rect className="help-tree-node help-tree-node--3" x="3" y="72" width="22" height="16" rx="4" fill="#41BC28" />
                <rect className="help-tree-node help-tree-node--3" x="33" y="72" width="22" height="16" rx="4" fill="#41BC28" />
                <rect className="help-tree-node help-tree-node--3" x="65" y="72" width="22" height="16" rx="4" fill="#E8E879" />
                <rect className="help-tree-node help-tree-node--3" x="95" y="72" width="22" height="16" rx="4" fill="#41BC28" />
            </g>
        </g>
    </svg>
);

export default HelpTreeAnim;
