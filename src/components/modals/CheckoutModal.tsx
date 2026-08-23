import { useEffect, useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { useIdeaContext } from "../../context/IdeaContext";
import AnimatedOverlay from "../AnimatedOverlay";
import { fetchCheckoutIntent, type CheckoutIntent } from "../../utilities/billing/billing";
import { getStripe } from "../../utilities/billing/stripeClient";
import { checkoutFonts } from "../../utilities/billing/stripeAppearance";
import { SUPPORT_EMAIL } from "../../utilities/support";
import { useModalFocusTrap } from "../../utilities/useModalFocusTrap";
import CheckoutForm from "./CheckoutForm";

// How long to wait for the stripe-webhook Netlify Function to land the
// Firestore plan flip before giving up on the "confirming" UI and just
// telling the user their payment went through — the charge already
// succeeded at this point either way, this only affects whether the
// celebration modal gets to fire before they navigate away.
const CONFIRM_TIMEOUT_MS = 20_000;

// If it's still not landed several minutes later, "just wait" stops being
// honest — either the webhook is stuck or it failed outright (see
// programmer-docs/launch-readiness-audit.md). There's a live Firestore
// listener already running (useBillingPlanSync, subscribed in Idea.tsx) that
// will flip this modal to the celebration screen automatically the moment
// the write actually lands, however late — this second timeout only changes
// the message while that's still pending, giving the person a real next
// step instead of an indefinite "still finalizing."
const CONFIRM_STUCK_TIMEOUT_MS = 2 * 60_000;

function CheckoutModal() {
    const { checkoutPlan, setCheckoutPlan, billingPlan, setCelebrationPlan } = useIdeaContext();
    const [intent, setIntent] = useState<CheckoutIntent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [confirmSlow, setConfirmSlow] = useState(false);
    const [confirmStuck, setConfirmStuck] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    function handleClose() {
        setCheckoutPlan(null);
    }

    useModalFocusTrap(checkoutPlan !== null, containerRef, handleClose);

    useEffect(() => {
        if (!checkoutPlan) {
            setIntent(null);
            setError(null);
            setConfirming(false);
            setConfirmSlow(false);
            setConfirmStuck(false);
            return;
        }

        let cancelled = false;
        setIntent(null);
        setError(null);

        fetchCheckoutIntent(checkoutPlan)
            .then(result => {
                if (!cancelled) setIntent(result);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error && err.message ? err.message : "Couldn't start checkout. Please try again.";
                setError(message);
            });

        return () => {
            cancelled = true;
        };
    }, [checkoutPlan]);

    // Stripe confirming the card charge client-side isn't the same as the
    // plan actually updating — that only happens once stripe-webhook
    // receives the event and writes Firestore, which has its own latency
    // (network hop + Netlify cold start). Wait for the real flip, via the
    // billing listener already running in Idea.tsx, before declaring
    // success — a flat timer previously closed this modal regardless of
    // whether the write had landed yet.
    useEffect(() => {
        if (!confirming || !checkoutPlan) return;

        if (billingPlan === checkoutPlan) {
            const confirmedPlan = checkoutPlan;
            setCheckoutPlan(null);
            setCelebrationPlan(confirmedPlan);
            return;
        }

        const slowTimeout = setTimeout(() => setConfirmSlow(true), CONFIRM_TIMEOUT_MS);
        const stuckTimeout = setTimeout(() => setConfirmStuck(true), CONFIRM_STUCK_TIMEOUT_MS);
        return () => {
            clearTimeout(slowTimeout);
            clearTimeout(stuckTimeout);
        };
    }, [confirming, billingPlan, checkoutPlan, setCheckoutPlan, setCelebrationPlan]);

    function handleDone() {
        setConfirmSlow(false);
        setConfirmStuck(false);
        setConfirming(true);
    }

    return (
        <AnimatedOverlay open={checkoutPlan !== null} scrollable onClick={handleClose}>
            <div
                className="modal neobrutal confirmModal checkoutModal"
                onClick={(e) => e.stopPropagation()}
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Checkout"
                tabIndex={-1}
            >
                <button className="checkoutModal-close neobrutal-button" onClick={handleClose} aria-label="Close">✕</button>
                {confirming ? (
                    <p className="checkoutModalLoading">
                        {confirmStuck ? (
                            <>
                                Your payment went through, but your plan is taking unusually long to update — sorry about that.
                                You won't be charged again. If it hasn't updated in a few minutes, email{' '}
                                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll sort it out. Safe to close this.
                            </>
                        ) : confirmSlow ? (
                            "Still finalizing — your payment went through, this is just taking longer than usual. Safe to close; it'll catch up shortly."
                        ) : (
                            'Payment received — finalizing your upgrade…'
                        )}
                    </p>
                ) : error ? (
                    <p className="checkoutModalError">{error}</p>
                ) : !checkoutPlan || !intent ? (
                    <p className="checkoutModalLoading">Loading checkout…</p>
                ) : (
                    <Elements key={checkoutPlan} stripe={getStripe()} options={{ fonts: checkoutFonts }}>
                        <CheckoutForm plan={checkoutPlan} intent={intent} onDone={handleDone} />
                    </Elements>
                )}
            </div>
        </AnimatedOverlay>
    );
}

export default CheckoutModal;
