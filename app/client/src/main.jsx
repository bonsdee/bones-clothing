import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PolarisProvider i18n={{}}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PolarisProvider>
  </React.StrictMode>
);
