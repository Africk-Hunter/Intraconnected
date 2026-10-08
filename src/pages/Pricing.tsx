import { useNavigate } from 'react-router-dom';
import PriceCard from '../components/landing/PriceCard';
import PizzaIcon from '../components/landing/PizzaIcon';
import PriceCheckIcon from '../components/landing/PriceCheckIcon';
import type { CheckoutPlan } from '../utilities/billing/billing';
import { useLifetimePrice } from '../utilities/billing/useLifetimePrice';
import { ANNUAL_PRICE_DISPLAY, ANNUAL_PRICE_PER_MONTH_DISPLAY, LIFETIME_PRICE_DISPLAY, formatMoney } from '../utilities/billing/pricingDisplay';
import { useIdeaContext } from '../context/IdeaContext';
import { SUPPORT_EMAIL } from '../utilities/support';

const Pricing: React.FC = () => {
  const { setCheckoutPlan, billingPlan } = useIdeaContext();
  const navigate = useNavigate();

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
  const { preview: lifetimePreview, loading: lifetimeLoading } = useLifetimePrice(true, billingPlan === 'annual');

  // billing.tsx imports Firebase Auth — loaded on click rather than with the
  // page so it stays out of the marketing bundle.
  const beginCheckout = (plan: CheckoutPlan) => {
    void import('../utilities/billing/billing').then(({ startCheckout }) => startCheckout(plan, setCheckoutPlan));
  };

  return (
    <div className="pricingPage">
      <section className="pricingHero">
        <span className="pricingHeroNode pricingHeroNode--leaf" aria-hidden="true">idea!</span>
        <span className="pricingHeroNode pricingHeroNode--sky" aria-hidden="true">sub-idea</span>
        <span className="pricingHeroNode pricingHeroNode--link" aria-hidden="true">tangent</span>
        <div className="pricingHeroSticker">Cheaper than pizza <PizzaIcon /></div>
        <h1 className="pricingHeroTitle">Big ideas,<br /><span className="pricingHeroTitleHighlight">tiny</span> price.</h1>
        <p className="pricingHeroSubline">
          50 nodes free, no card needed. Go annual for {ANNUAL_PRICE_DISPLAY}/yr, or pay once
          for lifetime access.
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
            { label: 'Export anytime (Markdown, OPML, JSON)' },
          ]}
          highlights={['Up to 50 nodes']}
          ctaLabel="Get Started Free"
          onCtaClick={() => navigate('/login')}
          footNote="No card required"
        />
        {showAnnual && (
          <PriceCard
            variant="annual"
            tier="Annual"
            price={ANNUAL_PRICE_DISPLAY}
            priceSuffix="/ year"
            subtitle={`That's ${ANNUAL_PRICE_PER_MONTH_DISPLAY} a month, billed once a year`}
            note="Cancel anytime."
            features={[
              { label: 'Unlimited nodes', bold: true },
              { label: 'Full feature access' },
              { label: 'Cancel anytime' },
              { label: 'Export anytime (Markdown, OPML, JSON)' },
              { label: 'Suggest new features' },
            ]}
            highlights={['Unlimited nodes', 'Suggest new features']}
            ctaLabel="Start Annual Plan"
            onCtaClick={() => beginCheckout('annual')}
            footNote={`Renews at ${ANNUAL_PRICE_DISPLAY}/yr · Cancel anytime`}
          />
        )}
        {showLifetime && (
          <PriceCard
            variant="lifetime"
            badge="LIFETIME"
            tier="Lifetime"
            price={lifetimeLoading
              ? '…'
              : lifetimePreview && lifetimePreview.discountCents > 0
                ? formatMoney(lifetimePreview.amount, lifetimePreview.currency)
                : LIFETIME_PRICE_DISPLAY}
            ctaDisabled={lifetimeLoading}
            priceSuffix="one time"
            subtitle="Pay once, yours forever"
            note={billingPlan === 'annual'
              ? lifetimeLoading
                ? 'Applying your Annual credit…'
                : lifetimePreview && lifetimePreview.discountCents > 0
                  ? `Your Annual payment is credited, ${formatMoney(lifetimePreview.discountCents, lifetimePreview.currency)} off, already applied above.`
                  : "You've already paid for this year, that's credited at checkout."
              : 'No renewals. No surprises.'}
            features={[
              { label: 'Unlimited nodes', bold: true },
              { label: 'Full feature access' },
              { label: 'Pay once, yours forever' },
              { label: 'Export anytime (Markdown, OPML, JSON)' },
              { label: 'Suggest new features' },
            ]}
            highlights={['Unlimited nodes', 'Suggest new features']}
            ctaLabel="Unlock Lifetime Access"
            onCtaClick={() => beginCheckout('lifetime')}
            footNote="Access Forever"
          />
        )}
      </section>

      <section className="pricingIncludes" aria-label="Included in every plan">
        <h2 className="pricingIncludesTitle">Every plan includes</h2>
        <ul className="pricingIncludesList">
          <li><PriceCheckIcon style="green" />Full feature access</li>
          <li><PriceCheckIcon style="green" />Export anytime (Markdown, OPML, JSON)</li>
        </ul>
      </section>

      <div className="pricingTaglineWrap">
        <div className="pricingTagline">Under $1.25 a month. Your ideas last forever.</div>
        <p className="pricingNoLockIn">
          Your data is never locked in. Export to Markdown, OPML or JSON anytime, on any plan.
        </p>
      </div>

      <p className="pricingSupport">
        Billing question? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </div>
  );
};

export default Pricing;
