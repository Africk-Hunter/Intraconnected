import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/index.scss';

// iOS Safari requires at least one touchstart listener on the document for
// :active CSS pseudo-class to fire on touch elements.
document.addEventListener('touchstart', () => {}, { passive: true });
import { IdeaProvider } from './context/IdeaContext';
import Idea from './pages/Idea';
import Login from './pages/Login';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AuthAction from './pages/AuthAction';
import MarketingTransition from './components/landing/MarketingTransition';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <ErrorBoundary>
    <IdeaProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/main" element={<Idea />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/auth/action" element={<AuthAction />} />
          <Route path="/landing" element={<MarketingTransition />} />
          <Route path="/pricing" element={<MarketingTransition />} />
        </Routes>
      </BrowserRouter>
    </IdeaProvider>
  </ErrorBoundary>
);