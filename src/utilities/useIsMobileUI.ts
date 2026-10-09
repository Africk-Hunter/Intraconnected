import { useEffect, useState } from 'react';

// When the touch UI (MobileMindMap) replaces the desktop layout. Must match
// $mobile-ui in src/styles/variables.scss, which hides one layout and shows
// the other in CSS; this lets code that only belongs to one of them (the
// mobile back-button history, for one) not run at all under the other.
export const MOBILE_UI_QUERY = '(max-width: 1023px) and (pointer: coarse), (max-width: 576px)';

function matches(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(MOBILE_UI_QUERY).matches;
}

export function useIsMobileUI(): boolean {
    const [isMobileUI, setIsMobileUI] = useState(matches);

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_UI_QUERY);
        const update = () => setIsMobileUI(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    return isMobileUI;
}
