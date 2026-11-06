import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { parseViewOptions } from './app/view/viewParams';
import { useViewStore } from './app/view/viewStore';

// Name tags crowd a phone screen: start without them there (tap an aircraft to see its tag).
// A link can also open a particular view (camera, heights, selected aircraft): viewParams.ts.
useViewStore.setState({
  showLabels: window.matchMedia('(min-width: 40rem)').matches,
  ...parseViewOptions(window.location.search).state,
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
