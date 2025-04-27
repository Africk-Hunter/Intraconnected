import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/index.scss';
import { IdeaProvider } from './context/IdeaContext';
import Idea from './pages/Idea';
import Login from './pages/Login';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <IdeaProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/main" element={<Idea />} />
      </Routes>
    </BrowserRouter>
  </IdeaProvider>
);