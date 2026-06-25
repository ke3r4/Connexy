import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { globalStyles } from './theme/global-styles';

const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);