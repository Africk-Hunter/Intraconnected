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
  // The few lines that differ between plans. Only shown on phones, where the
  // full per-card feature list is replaced by one shared "Every plan includes".
  highlights?: string[];
  ctaLabel: string;
  onCtaClick: () => void;
  footNote: string;
  ctaDisabled?: boolean;
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
  highlights = [],
  ctaLabel,
  onCtaClick,
  footNote,
  ctaDisabled,
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
      <ul className="priceCardHighlights">
        {highlights.map((text) => (
          <li key={text} className="priceCardHighlight">
            <PriceCheckIcon style={checkStyle} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
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

      <button type="button" className="priceCardCta neobrutal-button" onClick={onCtaClick} disabled={ctaDisabled}>
        {ctaLabel}
      </button>
      <div className="priceCardFootNote">{footNote}</div>
    </div>
  );
};

export default PriceCard;
