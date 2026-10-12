import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/index.scss';

// iOS Safari requires at least one touchstart listener on the document for
// :active CSS pseudo-class to fire on touch elements.
document.addEventListener('touchstart', () => {}, { passive: true });
import { lazy, Suspense } from 'react';
import { IdeaProvider } from './context/IdeaContext';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import ReportModal from './components/modals/ReportModal';
import { isNative } from './utilities/platform';

// One chunk per route, so the marketing pages (the first thing a new
// visitor loads) don't download the app, Firebase or Stripe up front.
const Idea = lazy(() => import('./pages/Idea'));
const Login = lazy(() => import('./pages/Login'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Support = lazy(() => import('./pages/Support'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const NativeEntry = lazy(() => import('./components/NativeEntry'));

// Inside the app there is no marketing site: "/" decides between the map and
// sign-in, and the pricing/landing pages (which sell) are not reachable.
const native = isNative();
const MarketingTransition = lazy(() => import('./components/landing/MarketingTransition'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <>
  <ErrorBoundary>
    <IdeaProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={native ? <NativeEntry /> : <MarketingTransition />} />
            <Route path="/login" element={<Login />} />
            <Route path="/main" element={<Idea />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />
            <Route path="/auth/action" element={<AuthAction />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/pricing" element={native ? <Navigate to="/" replace /> : <MarketingTransition />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </IdeaProvider>
  </ErrorBoundary>
  <ReportModal />
  </>
);