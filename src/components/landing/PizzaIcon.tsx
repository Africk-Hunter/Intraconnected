// Pizza slice for the pricing hero sticker. Same construction as the other
// landing SVGs: a solid offset shadow behind filled, outlined shapes. The
// cheese is orange (not the sticker's yellow) so the slice reads against it.

const stroke = { stroke: '#111', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const PizzaIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {/* offset shadow */}
    <path d="M 3.5 5.5 Q 12.5 1.5 21.5 5.5 L 12.5 22 Z" fill="#111" />
    {/* cheese */}
    <path d="M 2 4 Q 11 0 20 4 L 11 20.5 Z" fill="#EC8A13" {...stroke} />
    {/* crust */}
    <path d="M 2 4 Q 11 0 20 4 L 18.4 7.2 Q 11 4 3.6 7.2 Z" fill="var(--mm-roots)" {...stroke} />
    {/* pepperoni */}
    <circle cx="8.8" cy="10.8" r="1.9" fill="#C80000" {...stroke} strokeWidth="1.2" />
    <circle cx="13.8" cy="9.8" r="1.7" fill="#C80000" {...stroke} strokeWidth="1.2" />
    <circle cx="11" cy="15.2" r="1.5" fill="#C80000" {...stroke} strokeWidth="1.2" />
  </svg>
);

export default PizzaIcon;
