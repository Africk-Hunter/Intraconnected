import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/index.scss';
import Idea from './pages/Idea';
import Login from './pages/Login';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Idea />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
);