import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LandingNavbar from './LandingNavbar';
import Landing from '../../pages/Landing';
import Pricing from '../../pages/Pricing';
import CheckoutModal from '../modals/CheckoutModal';
import { useIdeaContext } from '../../context/IdeaContext';
import { useBillingPlanSync } from '../../utilities/billing/useBillingPlanSync';

type PageKey = 'landing' | 'pricing';

interface Transition {
  from: PageKey;
  to: PageKey;
  direction: 'left' | 'right';
}

const SLIDE_DURATION_MS = 420;

// Left-to-right reading order: navigating to a page further right in this
// list slides right, navigating to one further left slides left.
const PAGE_ORDER: PageKey[] = ['landing', 'pricing'];

const keyForPath = (pathname: string): PageKey => (pathname === '/pricing' ? 'pricing' : 'landing');

const renderPage = (key: PageKey) => (key === 'pricing' ? <Pricing /> : <Landing />);

// Landing and Pricing are routed through here (instead of directly) so that
// navigating between them slides the incoming page in while the outgoing
// page slides out, rather than an instant swap. The navbar lives here too,
// outside the sliding track, so it stays put while the content underneath
// slides.
const MarketingTransition: React.FC = () => {
  const location = useLocation();
  const targetKey = keyForPath(location.pathname);
  const { setBillingPlan } = useIdeaContext();

  // These pages sit outside the authenticated app (Idea.tsx never mounts
  // here), so without this an already-Annual user landing on /pricing
  // directly would see billingPlan stuck at its default 'free' and be
  // shown "Start Annual Plan" again — see Pricing.tsx's use of billingPlan.
  useBillingPlanSync(setBillingPlan);

  const [currentKey, setCurrentKey] = useState<PageKey>(targetKey);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [animate, setAnimate] = useState(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => {
    if (targetKey === currentKey) return;

    const direction = PAGE_ORDER.indexOf(targetKey) > PAGE_ORDER.indexOf(currentKey) ? 'left' : 'right';

    // Reset scroll before the slide starts (not after) so there's no later
    // jump when the outgoing pane unmounts and the page shrinks back down
    // to a single (possibly shorter) page's height.
    window.scrollTo(0, 0);

    setTransition({ from: currentKey, to: targetKey, direction });
    setCurrentKey(targetKey);
    setAnimate(false);

    // Double rAF: let the browser paint the pre-transition position first,
    // then flip the class that triggers the CSS transition on the next frame.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setAnimate(true));
    });

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setTransition(null);
      setAnimate(false);
    }, SLIDE_DURATION_MS + 30);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return (
    <div className="marketingPage">
      <LandingNavbar page={targetKey} />
      <CheckoutModal />

      {!transition ? (
        renderPage(currentKey)
      ) : (
        <div
          className={`marketingSlideTrack${animate ? ' marketingSlideTrack--active' : ''}`}
          style={
            transition.direction === 'right'
              ? ({ '--slide-start': '-50%', '--slide-end': '0%' } as React.CSSProperties)
              : ({ '--slide-start': '0%', '--slide-end': '-50%' } as React.CSSProperties)
          }
        >
          {transition.direction === 'right' ? (
            <>
              <div className="marketingSlidePane">{renderPage(transition.to)}</div>
              <div className="marketingSlidePane">{renderPage(transition.from)}</div>
            </>
          ) : (
            <>
              <div className="marketingSlidePane">{renderPage(transition.from)}</div>
              <div className="marketingSlidePane">{renderPage(transition.to)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketingTransition;
