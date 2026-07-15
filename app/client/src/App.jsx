import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { NavMenu } from '@shopify/app-bridge-react';
import { Frame } from '@shopify/polaris';
import Nav from './components/Nav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Drops from './pages/Drops.jsx';
import DropForm from './pages/DropForm.jsx';
import DropDetail from './pages/DropDetail.jsx';
import Waitlist from './pages/Waitlist.jsx';
import ActivityLog from './pages/ActivityLog.jsx';

/**
 * NavMenu renders Shopify's built-in embedded-app navigation (the menu
 * inside the Admin's app frame, not a component we draw ourselves). Nav.jsx
 * below is our own in-page nav for anyone previewing outside the iframe.
 */
export default function App() {
  // Embedded apps only work inside the Shopify Admin iframe, which supplies
  // the ?host= param App Bridge needs to mint session tokens. Opened directly
  // (localhost:5173 or the bare tunnel URL) there is no shop context and
  // every API call would 401 — so show a clear signpost instead of a
  // half-broken dashboard.
  const isEmbedded = new URLSearchParams(window.location.search).has('host');
  if (!isEmbedded) {
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Drop &amp; Restock Manager</h1>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          This is an embedded Shopify app — it runs inside the Shopify Admin,
          which provides the store context and authentication it needs.
          Opening it directly at this URL is expected to show nothing.
        </p>
        <p style={{ marginTop: 16 }}>
          <a href="https://admin.shopify.com/store/bones-clothing-zb5sysar/apps/drop-restock-manager" style={{ color: '#2c6ecb', fontWeight: 600 }}>
            Open it in Shopify Admin &rarr;
          </a>
        </p>
      </div>
    );
  }

  return (
    <Frame>
      <NavMenu>
        <a href="/" rel="home">Dashboard</a>
        <a href="/drops">Drops</a>
        <a href="/waitlist">Waitlist</a>
        <a href="/activity">Activity</a>
      </NavMenu>
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/drops" element={<Drops />} />
        <Route path="/drops/new" element={<DropForm />} />
        <Route path="/drops/:id" element={<DropDetail />} />
        <Route path="/drops/:id/edit" element={<DropForm />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/activity" element={<ActivityLog />} />
      </Routes>
    </Frame>
  );
}
