import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// BrowserRouter keeps the window's scroll position across route changes, so
// leaving a scrolled-down marketing page (e.g. /landing → /) would open the
// next page partway down. Reset on every pathname change.
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
