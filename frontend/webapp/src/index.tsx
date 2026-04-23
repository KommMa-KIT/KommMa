/**
 * index.tsx
 *
 * Application entry point. Mounts the React component tree into the root DOM
 * node, wrapping it in React.StrictMode for development-time checks and in the
 * Redux Provider so the store is accessible to all components via useSelector
 * and useDispatch.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './store/store';

// --- Entry point ---

/**
 * The cast to HTMLElement is safe here because the root element is guaranteed
 * to exist in index.html — if it were missing, the application could not run
 * regardless.
 */
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);