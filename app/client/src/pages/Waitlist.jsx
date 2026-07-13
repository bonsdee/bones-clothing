import React, { useEffect, useState } from 'react';
import { Page, Card, ResourceList, ResourceItem, Text, Button, Badge, Banner } from '@shopify/polaris';
import { api } from '../api/client.js';

export default function Waitlist() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    api.get('/api/waitlist').then(setEntries).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function markNotified(id) {
    await api.post(`/api/waitlist/${id}/notify`, {});
    load();
  }

  return (
    <Page title="Waitlist" subtitle="Shoppers waiting on sold-out sizes, newest first">
      {error && <Banner tone="critical" title="Could not load waitlist">{error}</Banner>}
      <Card>
        <ResourceList
          resourceName={{ singular: 'signup', plural: 'signups' }}
          items={entries || []}
          loading={!entries}
          renderItem={(entry) => (
            <ResourceItem id={String(entry.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text as="span" fontWeight="semibold">{entry.email}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {entry.productTitle} &middot; joined {new Date(entry.createdAt).toLocaleString()}
                  </Text>
                </div>
                {entry.notifiedAt ? (
                  <Badge tone="success">Notified</Badge>
                ) : (
                  <Button onClick={() => markNotified(entry.id)}>Mark Notified</Button>
                )}
              </div>
            </ResourceItem>
          )}
        />
      </Card>
    </Page>
  );
}
