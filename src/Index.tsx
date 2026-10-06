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

// One chunk per route, so the marketing pages (the first thing a new
// visitor loads) don't download the app, Firebase or Stripe up front.
const Idea = lazy(() => import('./pages/Idea'));
const Login = lazy(() => import('./pages/Login'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Support = lazy(() => import('./pages/Support'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const MarketingTransition = lazy(() => import('./components/landing/MarketingTransition'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <ErrorBoundary>
    <IdeaProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<MarketingTransition />} />
            <Route path="/login" element={<Login />} />
            <Route path="/main" element={<Idea />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />
            <Route path="/auth/action" element={<AuthAction />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/pricing" element={<MarketingTransition />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </IdeaProvider>
  </ErrorBoundary>
);