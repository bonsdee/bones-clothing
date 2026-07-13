import React, { useEffect, useState } from 'react';
import { Page, Card, ResourceList, ResourceItem, Text, Badge, Banner } from '@shopify/polaris';
import { api } from '../api/client.js';

const ACTOR_TONE = {
  system: 'info',
  user: 'success',
  webhook: 'attention',
  storefront: 'magic'
};

export default function ActivityLog() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/activity').then(setEvents).catch((err) => setError(err.message));
  }, []);

  return (
    <Page title="Activity" subtitle="Full audit trail — drop changes, waitlist signups, and system events">
      {error && <Banner tone="critical" title="Could not load activity">{error}</Banner>}
      <Card>
        <ResourceList
          resourceName={{ singular: 'event', plural: 'events' }}
          items={events || []}
          loading={!events}
          renderItem={(event) => (
            <ResourceItem id={String(event.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text as="span">{event.message || event.action}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{new Date(event.createdAt).toLocaleString()}</Text>
                </div>
                <Badge tone={ACTOR_TONE[event.actor]}>{event.actor}</Badge>
              </div>
            </ResourceItem>
          )}
        />
      </Card>
    </Page>
  );
}
