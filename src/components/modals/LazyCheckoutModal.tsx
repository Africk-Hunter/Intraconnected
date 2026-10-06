import { lazy, Suspense, useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";

const CheckoutModal = lazy(() => import("./CheckoutModal"));

// Keeps Stripe (and CheckoutModal's Firebase-backed billing calls) out of
// the initial bundle: nothing is fetched until checkout is first opened.
// Stays mounted afterwards so AnimatedOverlay's close animation still runs.
const LazyCheckoutModal: React.FC = () => {
    const { checkoutPlan } = useIdeaContext();
    const [opened, setOpened] = useState(false);
    if (checkoutPlan !== null && !opened) setOpened(true);

    if (!opened) return null;
    return (
        <Suspense fallback={null}>
            <CheckoutModal />
        </Suspense>
    );
};

export default LazyCheckoutModal;
