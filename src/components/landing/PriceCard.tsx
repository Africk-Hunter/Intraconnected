import PriceCheckIcon from './PriceCheckIcon';

interface PriceFeature {
  label: string;
  locked?: boolean;
  bold?: boolean;
}

interface PriceCardProps {
  variant: 'free' | 'annual' | 'lifetime';
  badge?: string;
  tier: string;
  price: string;
  priceSuffix?: string;
  subtitle: string;
  note: string;
  features: PriceFeature[];
  ctaLabel: string;
  ctaHref: string;
  onCtaClick?: () => void;
  footNote: string;
}

const PriceCard: React.FC<PriceCardProps> = ({
  variant,
  badge,
  tier,
  price,
  priceSuffix,
  subtitle,
  note,
  features,
  ctaLabel,
  ctaHref,
  onCtaClick,
  footNote,
}) => {
  const checkStyle = variant === 'free' ? 'green' : 'white';

  return (
    <div className={`priceCard priceCard--${variant} neobrutal`}>
      {badge && <div className="priceCardBadge">{badge}</div>}

      <div className="priceCardTier">{tier}</div>
      <div className="priceCardPriceRow">
        <span className="priceCardPrice">{price}</span>
        {priceSuffix && <span className="priceCardPriceSuffix">{priceSuffix}</span>}
      </div>
      <div className="priceCardSubtitle">{subtitle}</div>
      <div className="priceCardNote">{note}</div>

      <div className="priceCardFeatures">
        {features.map((feature) => (
          <div
            key={feature.label}
            className={`priceCardFeature${feature.locked ? ' priceCardFeature--locked' : ''}`}
          >
            <PriceCheckIcon style={feature.locked ? 'locked' : checkStyle} />
            <span className={feature.bold ? 'priceCardFeatureLabel priceCardFeatureLabel--bold' : 'priceCardFeatureLabel'}>
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      {onCtaClick ? (
        <button type="button" className="priceCardCta neobrutal-button" onClick={onCtaClick}>
          {ctaLabel}
        </button>
      ) : (
        <a
          href={ctaHref}
          className="priceCardCta neobrutal-button"
          onClick={ctaHref === '#' ? (e) => e.preventDefault() : undefined}
        >
          {ctaLabel}
        </a>
      )}
      <div className="priceCardFootNote">{footNote}</div>
    </div>
  );
};

export default PriceCard;
