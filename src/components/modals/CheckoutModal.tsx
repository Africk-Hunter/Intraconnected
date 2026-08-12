import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { useIdeaContext } from "../../context/IdeaContext";
import AnimatedOverlay from "../AnimatedOverlay";
import { fetchCheckoutIntent, type CheckoutIntent } from "../../utilities/billing/billing";
import { getStripe } from "../../utilities/billing/stripeClient";
import { checkoutFonts } from "../../utilities/billing/stripeAppearance";
import CheckoutForm from "./CheckoutForm";

function CheckoutModal() {
    const { checkoutPlan, setCheckoutPlan } = useIdeaContext();
    const [intent, setIntent] = useState<CheckoutIntent | null>(null);
    const [error, setError] = useState<string | null>(null);

    function handleClose() {
        setCheckoutPlan(null);
    }

    useEffect(() => {
        if (!checkoutPlan) {
            setIntent(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setIntent(null);
        setError(null);

        fetchCheckoutIntent(checkoutPlan)
            .then(result => {
                if (!cancelled) setIntent(result);
            })
            .catch(() => {
                if (!cancelled) setError("Couldn't start checkout. Please try again.");
            });

        return () => {
            cancelled = true;
        };
    }, [checkoutPlan]);

    // Give the user a beat to see the "Processing…" state resolve before the
    // modal disappears — the Firestore billing listener (subscribeBillingStatus,
    // see Idea.tsx) picks up the plan flip once the webhook lands, no polling
    // needed here.
    function handleDone() {
        setTimeout(() => setCheckoutPlan(null), 1500);
    }

    return (
        <AnimatedOverlay open={checkoutPlan !== null} scrollable onClick={handleClose}>
            <div className="modal neobrutal confirmModal checkoutModal" onClick={(e) => e.stopPropagation()}>
                <button className="checkoutModal-close neobrutal-button" onClick={handleClose} aria-label="Close">✕</button>
                {error ? (
                    <p className="checkoutModalError">{error}</p>
                ) : !intent ? (
                    <p className="checkoutModalLoading">Loading checkout…</p>
                ) : (
                    <Elements key={checkoutPlan} stripe={getStripe()} options={{ fonts: checkoutFonts }}>
                        <CheckoutForm plan={checkoutPlan!} intent={intent} onDone={handleDone} />
                    </Elements>
                )}
            </div>
        </AnimatedOverlay>
    );
}

export default CheckoutModal;
