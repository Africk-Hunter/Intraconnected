interface BrandMarkProps {
  className?: string;
}

// The node-tree symbol: a root idea (roots) with a parent (sky) and a leaf
// (leaf) below it, colored like real nodes. Each node is a shadow + face pair
// so it can pop in as one piece when the logo animates.
export const BrandMark: React.FC<BrandMarkProps> = ({ className = '' }) => (
  <svg className={`brandMark ${className}`} viewBox="0 0 52 44" aria-hidden="true" focusable="false">
    {/* One path per child so both connectors draw out from the root at once. */}
    <path className="brandMark-link" pathLength={1} d="M26 15.5V21H12.5V27" />
    <path className="brandMark-link" pathLength={1} d="M26 15.5V21H39.5V27" />
    <g className="brandMark-node brandMark-node--root">
      <rect className="brandMark-shadow" x="17.5" y="4" width="21" height="13" rx="4.5" />
      <rect className="brandMark-face" x="15.5" y="2" width="21" height="13" rx="4.5" />
    </g>
    <g className="brandMark-node brandMark-node--parent">
      <rect className="brandMark-shadow" x="4" y="29" width="19" height="13" rx="4.5" />
      <rect className="brandMark-face" x="2" y="27" width="19" height="13" rx="4.5" />
    </g>
    <g className="brandMark-node brandMark-node--leaf">
      <rect className="brandMark-shadow" x="33" y="29" width="19" height="13" rx="4.5" />
      <rect className="brandMark-face" x="31" y="27" width="19" height="13" rx="4.5" />
    </g>
  </svg>
);

interface BrandLogoProps {
  className?: string;
  // Plays the one-time "connect" entrance (auth pages). Off where the logo
  // remounts often, like the mobile top bar.
  animated?: boolean;
}

// Mark + wordmark. Sized by font-size, so callers scale it with one property.
const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', animated = false }) => (
  <div className={`brandLogo${animated ? ' brandLogo--animated' : ''} ${className}`} role="img" aria-label="Intraconnected">
    <BrandMark />
    <span className="brandLogo-word" aria-hidden="true">Intraconnected</span>
  </div>
);

export default BrandLogo;
