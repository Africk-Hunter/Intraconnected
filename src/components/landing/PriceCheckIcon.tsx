interface PriceCheckIconProps {
  style: 'green' | 'white' | 'locked';
}

const PriceCheckIcon: React.FC<PriceCheckIconProps> = ({ style }) => {
  if (style === 'locked') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="3" fill="#e0e0e0" stroke="#bbb" strokeWidth="1.5" />
        <path d="M 5 5 L 9.5 9.5 M 9.5 5 L 5 9.5" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  const fill = style === 'green' ? 'var(--mm-leaf)' : '#fff';
  const check = style === 'green' ? '#fff' : '#111';

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="3" width="13" height="13" rx="3" fill="#111" />
      <rect x="1" y="1" width="13" height="13" rx="3" fill={fill} stroke="#111" strokeWidth="1.5" />
      <path d="M 4.5 7.5 L 6.5 9.5 L 10.5 5" stroke={check} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default PriceCheckIcon;
