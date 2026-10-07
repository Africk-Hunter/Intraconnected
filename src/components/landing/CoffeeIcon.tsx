// Coffee cup for the pricing hero sticker. Same construction as the other
// landing SVGs: a solid offset shadow behind a filled, outlined shape.

const stroke = { stroke: '#111', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const CoffeeIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M 6 14 L 17 14 L 17 17 Q 17 20 14 20 L 9 20 Q 6 20 6 17 Z" fill="#111" />
    <path d="M 4 8 L 15 8 L 15 14 Q 15 18 11.5 18 L 7.5 18 Q 4 18 4 14 Z" fill="var(--mm-leaf)" {...stroke} />
    <path d="M 15 10 L 17 10 Q 19.5 10 19.5 12.5 Q 19.5 15 17 15 L 15 15" {...stroke} />
    <path d="M 7.5 5.5 Q 6.5 4 7.5 2.5 M 11.5 5.5 Q 10.5 4 11.5 2.5" {...stroke} />
  </svg>
);

export default CoffeeIcon;
