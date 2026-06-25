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

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <IdeaProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/main" element={<Idea />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </BrowserRouter>
  </IdeaProvider>
);