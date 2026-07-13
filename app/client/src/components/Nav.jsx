import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/drops', label: 'Drops' },
  { to: '/waitlist', label: 'Waitlist' },
  { to: '/activity', label: 'Activity' }
];

/**
 * A lightweight in-page tab strip. Shopify's NavMenu (rendered in App.jsx)
 * drives the real Admin sidebar; this exists so the app is also usable
 * when previewed outside the iframe during development.
 */
export default function Nav() {
  const location = useLocation();

  return (
    <nav style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid #e1e3e5' }}>
      {links.map((link) => {
        const active = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={{ pathname: link.to, search: location.search }}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              background: active ? '#f1f2f4' : 'transparent',
              color: '#202223',
              textDecoration: 'none'
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
