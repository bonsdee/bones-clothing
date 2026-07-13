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
