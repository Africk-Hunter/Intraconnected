import { useEffect } from 'react';
import PriceCard from '../components/landing/PriceCard';
import { startCheckout } from '../utilities/billing/billing';
import { useIdeaContext } from '../context/IdeaContext';

const Pricing: React.FC = () => {
  const { setCheckoutPlan } = useIdeaContext();

  useEffect(() => {
    document.title = 'Intraconnected — Pricing';
  }, []);

  return (
    <div className="pricingPage">
      <section className="pricingHero">
        <h1 className="pricingHeroTitle">Big ideas,<br />tiny price.</h1>
        <p className="pricingHeroSubline">
          50 nodes free, no card needed. Go annual for $1.99/yr, or grab lifetime access
          for the price of a sandwich.
        </p>
      </section>

      <section className="pricingCards">
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
        <PriceCard
          variant="annual"
          tier="Annual"
          price="$1.99"
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
          footNote="Renews at $1.99/yr · Cancel anytime"
        />
        <PriceCard
          variant="lifetime"
          badge="LIFETIME"
          tier="Lifetime"
          price="$4.99"
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
      </section>

      <div className="pricingTaglineWrap">
        <div className="pricingTagline">Less than a cup of coffee. Your ideas last forever.</div>
      </div>
    </div>
  );
};

export default Pricing;
