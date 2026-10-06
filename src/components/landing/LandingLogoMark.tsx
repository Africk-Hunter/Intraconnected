interface LandingLogoMarkProps {
  width?: number;
  height?: number;
}

const LandingLogoMark: React.FC<LandingLogoMarkProps> = ({ width = 38, height = 32 }) => (
  <svg width={width} height={height} viewBox="0 0 38 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="1" width="14" height="10" rx="3" fill="var(--mm-roots)" stroke="#111" strokeWidth="1.5" />
    <line x1="19" y1="11" x2="9" y2="18" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="19" y1="11" x2="29" y2="18" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="3" y="18" width="12" height="10" rx="3" fill="var(--mm-sky)" stroke="#111" strokeWidth="1.5" />
    <rect x="23" y="18" width="12" height="10" rx="3" fill="var(--mm-leaf)" stroke="#111" strokeWidth="1.5" />
  </svg>
);

export default LandingLogoMark;
