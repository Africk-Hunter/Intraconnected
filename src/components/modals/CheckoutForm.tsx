import { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { CheckoutIntent, CheckoutPlan } from "../../utilities/billing/billing";
import { formatMoney } from "../../utilities/billing/billing";
import { getCardElementStyle } from "../../utilities/billing/stripeAppearance";

const PLAN_LABEL: Record<CheckoutPlan, { label: string; suffix: string }> = {
    annual: { label: "Annual Plan", suffix: "/year" },
    lifetime: { label: "Lifetime Access", suffix: " one-time" },
};

interface Props {
    plan: CheckoutPlan;
    intent: CheckoutIntent;
    onDone: () => void;
}

function CheckoutForm({ plan, intent, onDone }: Props) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const card = elements?.getElement(CardElement);
        if (!stripe || !card || submitting) return;

        setSubmitting(true);
        setError(null);

        const { error: confirmError } = await stripe.confirmCardPayment(intent.clientSecret, {
            payment_method: { card },
        });

        if (confirmError) {
            setError(confirmError.message ?? "Payment failed. Please try again.");
            setSubmitting(false);
            return;
        }

        onDone();
    }

    const { label, suffix } = PLAN_LABEL[plan];

    return (
        <form className="checkoutForm" onSubmit={handleSubmit}>
            <div className="checkoutFormSummary">
                <span>{label}</span>
                <span>{formatMoney(intent.amount, intent.currency)}{suffix}</span>
            </div>
            <div>
                <p className="checkoutFormLabel"><img src="/images/Card.svg" alt="" className="checkoutFormLabelIcon" /> Card information</p>
                <div className="checkoutFormCardBox">
                    <CardElement options={{ style: getCardElementStyle() }} />
                </div>
            </div>
            {error && <p className="checkoutModalError">{error}</p>}
            <button
                type="submit"
                className="modalButton continue neobrutal-button checkoutFormSubmit"
                disabled={!stripe || submitting}
            >
                {submitting ? "Processing…" : "Pay now"}
            </button>
            <p className="checkoutFormTrust">🔒 Payments secured by Stripe</p>
        </form>
    );
}

export default CheckoutForm;
