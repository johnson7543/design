import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import Fixture from './App';
import './fixture.css';

const root = document.getElementById('root')!;
const app = <StrictMode><Fixture /></StrictMode>;
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
