import { useEffect } from 'react';
import PriceCard from '../components/landing/PriceCard';
import { startCheckout } from '../utilities/billing/billing';
import { ANNUAL_PRICE_DISPLAY, LIFETIME_PRICE_DISPLAY } from '../utilities/billing/pricingDisplay';
import { useIdeaContext } from '../context/IdeaContext';
import { SUPPORT_EMAIL } from '../utilities/support';

const Pricing: React.FC = () => {
  const { setCheckoutPlan, billingPlan } = useIdeaContext();

  useEffect(() => {
    document.title = 'Intraconnected — Pricing';
  }, []);

  // An already-Annual user re-subscribing would silently create a second,
  // independent Stripe subscription (Stripe allows multiple per customer) —
  // double billing. An already-Lifetime user "buying" it again would just
  // waste a one-time charge for nothing. Mirrors UpgradeModal's showAnnual
  // gate, which already did this correctly in-app; this page previously had
  // no such check at all. The server rejects both cases too either way (see
  // create-payment-intent.ts) — this just stops it from being offered in
  // the first place.
  const showAnnual = billingPlan !== 'annual' && billingPlan !== 'lifetime';
  const showLifetime = billingPlan !== 'lifetime';
  const visibleCount = 1 + Number(showAnnual) + Number(showLifetime);

  return (
    <div className="pricingPage">
      <section className="pricingHero">
        <h1 className="pricingHeroTitle">Big ideas,<br />tiny price.</h1>
        <p className="pricingHeroSubline">
          50 nodes free, no card needed. Go annual for {ANNUAL_PRICE_DISPLAY}/yr, or grab lifetime access
          for the price of a sandwich.
        </p>
      </section>

      <section className={`pricingCards${visibleCount < 3 ? ' pricingCards--compact' : ''}`}>
        <PriceCard
          variant="free"
          tier="Free"
          price="$0"
          subtitle="Forever free"
          note="No credit card needed."
          features={[
            { label: 'Unlimited nodes', locked: true },
            { label: 'Up to 50 nodes' },
            { label: 'Full feature access' },
          ]}
          ctaLabel="Get Started Free"
          ctaHref="/"
          footNote="No card required"
        />
        {showAnnual && (
          <PriceCard
            variant="annual"
            tier="Annual"
            price={ANNUAL_PRICE_DISPLAY}
            priceSuffix="/ year"
            subtitle="Billed once a year"
            note="Cancel anytime."
            features={[
              { label: 'Unlimited nodes', bold: true },
              { label: 'Full feature access' },
              { label: 'Cancel anytime' },
              { label: 'Suggest new features' },
            ]}
            ctaLabel="Start Annual Plan"
            ctaHref="#"
            onCtaClick={() => startCheckout('annual', setCheckoutPlan)}
            footNote={`Renews at ${ANNUAL_PRICE_DISPLAY}/yr · Cancel anytime`}
          />
        )}
        {showLifetime && (
          <PriceCard
            variant="lifetime"
            badge="LIFETIME"
            tier="Lifetime"
            price={LIFETIME_PRICE_DISPLAY}
            priceSuffix="one time"
            subtitle="Pay once, yours forever"
            note="No renewals. No surprises."
            features={[
              { label: 'Unlimited nodes', bold: true },
              { label: 'Full feature access' },
              { label: 'Pay once, yours forever' },
              { label: 'Suggest new features' },
            ]}
            ctaLabel="Unlock Lifetime Access"
            ctaHref="#"
            onCtaClick={() => startCheckout('lifetime', setCheckoutPlan)}
            footNote="Access Forever"
          />
        )}
      </section>

      <div className="pricingTaglineWrap">
        <div className="pricingTagline">Less than a cup of coffee. Your ideas last forever.</div>
      </div>

      <p className="pricingSupport">
        Billing question? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </div>
  );
};

export default Pricing;
