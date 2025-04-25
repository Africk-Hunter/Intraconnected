import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.scss';
import Idea from './pages/Idea';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <section className='main'>
      <Idea />
    </section>
  </React.StrictMode>
);