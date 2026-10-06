// Spot icons for the support page. Same construction as the landing/pricing
// SVGs: a solid offset shadow behind a filled, outlined shape.

export type SupportIconName = 'account' | 'billing' | 'sync' | 'export' | 'mail';

const Shadowed: React.FC<{ fill: string; children: React.ReactNode }> = ({ fill, children }) => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <rect x="7" y="7" width="44" height="44" rx="9" fill="#111" />
    <rect x="4" y="4" width="44" height="44" rx="9" fill={fill} stroke="#111" strokeWidth="2.5" />
    {children}
  </svg>
);

const stroke = { stroke: '#111', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const SupportIcon: React.FC<{ name: SupportIconName }> = ({ name }) => {
  switch (name) {
    case 'account':
      return (
        <Shadowed fill="var(--mm-sky)">
          <circle cx="26" cy="19" r="6.5" fill="#fff" {...stroke} />
          <path d="M 13 38 C 13 30 39 30 39 38 Z" fill="#fff" {...stroke} />
        </Shadowed>
      );
    case 'billing':
      return (
        <Shadowed fill="var(--mm-link)">
          <rect x="11" y="16" width="30" height="21" rx="3.5" fill="#fff" {...stroke} />
          <path d="M 11 23 L 41 23" {...stroke} />
          <path d="M 16 31 L 23 31" {...stroke} />
        </Shadowed>
      );
    case 'sync':
      return (
        <Shadowed fill="var(--mm-leaf)">
          <path d="M 14 22 C 16 14 28 12 35 19" fill="none" {...stroke} />
          <path d="M 36 12 L 36 20 L 28 20" fill="none" {...stroke} />
          <path d="M 38 30 C 36 38 24 40 17 33" fill="none" {...stroke} />
          <path d="M 16 40 L 16 32 L 24 32" fill="none" {...stroke} />
        </Shadowed>
      );
    case 'export':
      return (
        <Shadowed fill="var(--mm-indigo)">
          <path d="M 26 13 L 26 29" {...stroke} stroke="#fff" />
          <path d="M 19 22 L 26 29 L 33 22" fill="none" {...stroke} stroke="#fff" />
          <path d="M 14 33 L 14 38 L 38 38 L 38 33" fill="none" {...stroke} stroke="#fff" />
        </Shadowed>
      );
    case 'mail':
      return (
        <Shadowed fill="var(--mm-link)">
          <rect x="10" y="16" width="32" height="22" rx="3.5" fill="#fff" {...stroke} />
          <path d="M 11 18 L 26 29 L 41 18" fill="none" {...stroke} />
        </Shadowed>
      );
  }
};

export default SupportIcon;
