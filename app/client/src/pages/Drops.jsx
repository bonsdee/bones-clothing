import React, { useEffect, useState } from 'react';
import { Page, Card, ResourceList, ResourceItem, Badge, InlineGrid, Text, Banner } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const STATUS_TONE = {
  draft: 'info',
  scheduled: 'attention',
  active: 'success',
  ended: undefined
};

export default function Drops() {
  const [drops, setDrops] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/drops').then(setDrops).catch((err) => setError(err.message));
  }, []);

  return (
    <Page
      title="Drops"
      subtitle="Every limited release, past and upcoming"
      primaryAction={{ content: 'New Drop', onAction: () => navigate('/drops/new') }}
    >
      {error && <Banner tone="critical" title="Could not load drops">{error}</Banner>}
      <Card>
        <ResourceList
          resourceName={{ singular: 'drop', plural: 'drops' }}
          items={drops || []}
          loading={!drops}
          renderItem={(drop) => (
            <ResourceItem id={String(drop.id)} url={`/drops/${drop.id}`}>
              <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
                <div>
                  <Text as="span" fontWeight="semibold">{drop.name}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Starts {new Date(drop.startsAt).toLocaleDateString()}
                  </Text>
                </div>
                <Badge tone={STATUS_TONE[drop.status]}>{drop.status}</Badge>
              </InlineGrid>
            </ResourceItem>
          )}
        />
      </Card>
    </Page>
  );
}
