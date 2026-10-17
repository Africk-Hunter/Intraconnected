import { useNavigate } from 'react-router-dom';
import PriceCard from '../components/landing/PriceCard';
import PizzaIcon from '../components/landing/PizzaIcon';
import PriceCheckIcon from '../components/landing/PriceCheckIcon';
import type { CheckoutPlan } from '../utilities/billing/billing';
import { ANNUAL_PRICE_DISPLAY, ANNUAL_PRICE_PER_MONTH_DISPLAY, LIFETIME_PRICE_DISPLAY } from '../utilities/billing/pricingDisplay';
import { useIdeaContext } from '../context/IdeaContext';
import { SUPPORT_EMAIL } from '../utilities/support';
import { useSignedIn } from '../utilities/firebase/useSignedIn';

const Pricing: React.FC = () => {
  const { setCheckoutPlan, billingPlan } = useIdeaContext();
  const navigate = useNavigate();
  const signedIn = useSignedIn();

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
  const isLifetime = billingPlan === 'lifetime';
  const visibleCount = 1 + Number(showAnnual) + Number(showLifetime);

  // billing.tsx imports Firebase Auth — loaded on click rather than with the
  // page so it stays out of the marketing bundle.
  const beginCheckout = (plan: CheckoutPlan) => {
    void import('../utilities/billing/billing').then(({ startCheckout }) => startCheckout(plan, setCheckoutPlan));
  };

  return (
    <div className="pricingPage">
      {/* Same node types as the app (and the landing page's floaters). */}
      <span className="pricingHeroNode pricingHeroNode--leaf" aria-hidden="true">Big idea</span>
      <span className="pricingHeroNode pricingHeroNode--sky" aria-hidden="true">Side projects <small>4 ›</small></span>
      <span className="pricingHeroNode pricingHeroNode--link" aria-hidden="true">Inspo <small>↗</small></span>
      <span className="pricingHeroNode pricingHeroNode--indigo" aria-hidden="true">Budget <small>2/4</small></span>
      <span className="pricingHeroNode pricingHeroNode--leaf2" aria-hidden="true">Skip one pizza</span>
      <span className="pricingHeroNode pricingHeroNode--link2" aria-hidden="true">Read later <small>↗</small></span>
      <span className="pricingHeroNode pricingHeroNode--sky2" aria-hidden="true">Someday <small>6 ›</small></span>
      <span className="pricingHeroNode pricingHeroNode--indigo2" aria-hidden="true">Goals <small>1/3</small></span>
      <section className="pricingHero">
        <div className="pricingHeroSticker">Cheaper Than A Pizza <PizzaIcon /></div>
        <h1 className="pricingHeroTitle">Big ideas,<br /><span className="pricingHeroTitleHighlight">tiny</span> price.</h1>
        <p className="pricingHeroSubline">
          50 nodes free, no card needed. Go annual for {ANNUAL_PRICE_DISPLAY}/yr, or pay once
          for lifetime access.
        </p>
      </section>

      {billingPlan === 'lifetime' && (
        <section className="pricingThanks" aria-label="Thank you">
          <span className="pricingThanksBadge">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            LIFETIME MEMBER
          </span>
          <h2 className="pricingThanksTitle">You're in <span>for good.</span></h2>
          <p className="pricingThanksText">
            Thank you for backing Intraconnected. You paid once, so there's nothing to renew and
            no node limit to watch. It genuinely means a lot.
          </p>
          <div className="pricingThanksChips" aria-hidden="true">
            <span className="pricingThanksChip pricingThanksChip--sky">
              Unlimited nodes
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 12c-1.8-2.6-3.4-4-5.2-4a4 4 0 0 0 0 8c1.8 0 3.4-1.4 5.2-4zm0 0c1.8 2.6 3.4 4 5.2 4a4 4 0 0 0 0-8c-1.8 0-3.4 1.4-5.2 4z" />
              </svg>
            </span>
            <span className="pricingThanksChip pricingThanksChip--link">
              No renewals
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 1 1-2.5-5.8" />
                <path d="M5.5 5.5l12 12" />
              </svg>
            </span>
            <span className="pricingThanksChip pricingThanksChip--indigo">
              Paid once
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                <path d="M7.5 12.5l3 3 6-7" />
              </svg>
            </span>
          </div>
          <p className="pricingThanksSign">Got an idea for what to build next? Send it from the app's feature request form.</p>
        </section>
      )}

      {!isLifetime && (
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
          ctaLabel={signedIn ? 'Open Your Map' : 'Get Started Free'}
          onCtaClick={() => navigate(signedIn ? '/main' : '/login')}
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
            price={LIFETIME_PRICE_DISPLAY}
            priceSuffix="one time"
            subtitle="Pay once, yours forever"
            note="No renewals. No surprises."
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
      )}

      <section className="pricingIncludes" aria-label="Included in every plan">
        <h2 className="pricingIncludesTitle">Every plan includes</h2>
        <ul className="pricingIncludesList">
          <li><PriceCheckIcon style="green" />Full feature access</li>
          <li><PriceCheckIcon style="green" />Export anytime (Markdown, OPML, JSON)</li>
        </ul>
      </section>

      {!isLifetime && (
      <div className="pricingTaglineWrap">
        <div className="pricingTagline">Under $1.25 a month. Your idea won't outgrow it.</div>
        <p className="pricingNoLockIn">
          Your data is never locked in. Export to Markdown, OPML or JSON anytime, on any plan.
        </p>
      </div>
      )}

      <p className="pricingSupport">
        Billing question? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </div>
  );
};

export default Pricing;
