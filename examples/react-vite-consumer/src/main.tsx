import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'designqr/style.css';
import { ConsumerFixture } from './ConsumerFixture';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('The consumer fixture root was not found.');
createRoot(root).render(
  <StrictMode>
    <ConsumerFixture />
  </StrictMode>
);
