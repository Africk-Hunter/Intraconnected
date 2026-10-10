import { useRef } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import AnimatedOverlay from "../AnimatedOverlay";
import { WarningIcon } from "../Icons";
import PriceCard from "../landing/PriceCard";
import { startCheckout, formatMoney } from "../../utilities/billing/billing";
import { useLifetimePrice } from "../../utilities/billing/useLifetimePrice";
import { FREE_NODE_LIMIT } from "../../utilities/billing/limits";
import { ANNUAL_PRICE_DISPLAY, ANNUAL_PRICE_PER_MONTH_DISPLAY, LIFETIME_PRICE_DISPLAY } from "../../utilities/billing/pricingDisplay";
import { useModalFocusTrap } from "../../utilities/useModalFocusTrap";

function UpgradeModal() {
    const { upgradeModalOpen, setUpgradeModalOpen, billingPlan, upgradeModalReason, setCheckoutPlan } = useIdeaContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const { preview: lifetimePreview, loading: lifetimeLoading } = useLifetimePrice(upgradeModalOpen, billingPlan === 'annual');

    function handleClose() {
        setUpgradeModalOpen(false);
    }

    useModalFocusTrap(upgradeModalOpen, containerRef, handleClose);

    function handleUpgrade(plan: 'annual' | 'lifetime') {
        setUpgradeModalOpen(false);
        startCheckout(plan, setCheckoutPlan);
    }

    // Annual subscribers already have the Annual plan — only offer the
    // Lifetime upsell instead of showing a redundant "Start Annual Plan" card.
    const showAnnual = billingPlan !== 'annual';
    // 'limit' only ever fires for free-plan users (canCreateIdea only blocks
    // them) — forced opens get an explanation of what just happened instead
    // of the generic "browse plans" copy a voluntary open gets.
    const forced = upgradeModalReason === 'limit' && billingPlan === 'free';
    const title = billingPlan === 'annual'
        ? 'Go Lifetime, never renew again'
        : forced
            ? `You've hit the free plan's ${FREE_NODE_LIMIT}-node limit`
            : 'Upgrade your plan';
    const subtitle = billingPlan === 'annual'
        ? 'Pay once and keep unlimited nodes forever.'
        : `Free plans are limited to ${FREE_NODE_LIMIT} nodes. Upgrade for unlimited nodes and full feature access.`;

    return (
        <AnimatedOverlay open={upgradeModalOpen} scrollable onClick={handleClose}>
            <div
                className={`modal neobrutal confirmModal upgradeModal${showAnnual ? '' : ' upgradeModal--single'}`}
                onClick={(e) => e.stopPropagation()}
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="upgradeModalTitle"
                tabIndex={-1}
            >
                <button className="upgradeModal-close neobrutal-button" onClick={handleClose} aria-label="Close">✕</button>
                <h3 className="upgradeModalTitle" id="upgradeModalTitle">{title}</h3>
                {forced ? (
                    <p className="upgradeModalNotice">
                        <span className="upgradeModalNotice-icon" aria-hidden="true"><WarningIcon /></span>
                        Your idea tree has reached {FREE_NODE_LIMIT} nodes, the max the Free plan allows. New ideas are paused until you upgrade.
                    </p>
                ) : (
                    <p className="upgradeModalSubtitle">{subtitle}</p>
                )}
                <section className={`upgradeModalPlans${showAnnual ? '' : ' upgradeModalPlans--single'}`}>
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
                                { label: 'Suggest new features' },
                            ]}
                            ctaLabel="Start Annual Plan"
                            onCtaClick={() => handleUpgrade('annual')}
                            footNote={`Renews at ${ANNUAL_PRICE_DISPLAY}/yr · Cancel anytime`}
                        />
                    )}
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
                            { label: 'Suggest new features' },
                        ]}
                        ctaLabel="Unlock Lifetime Access"
                        onCtaClick={() => handleUpgrade('lifetime')}
                        footNote="Access Forever"
                    />
                </section>
                <button className="upgradeModalDismiss" onClick={handleClose}>Not now</button>
            </div>
        </AnimatedOverlay>
    );
}

export default UpgradeModal;
