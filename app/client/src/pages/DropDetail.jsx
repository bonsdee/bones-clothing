import React, { useEffect, useState } from 'react';
import {
  Page,
  Card,
  BlockStack,
  Text,
  Badge,
  ResourceList,
  ResourceItem,
  Banner,
  Select,
  InlineGrid,
  Thumbnail
} from '@shopify/polaris';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ScoreBadge from '../components/ScoreBadge.jsx';

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Active', value: 'active' },
  { label: 'Ended', value: 'ended' }
];

export default function DropDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drop, setDrop] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    api.get(`/api/drops/${id}`).then(setDrop).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  async function handleStatusChange(status) {
    await api.patch(`/api/drops/${id}`, { status });
    load();
  }

  if (error) return <Banner tone="critical" title="Could not load drop">{error}</Banner>;
  if (!drop) return null;

  return (
    <Page
      title={drop.name}
      backAction={{ content: 'Drops', onAction: () => navigate('/drops') }}
      secondaryActions={[{ content: 'Edit', onAction: () => navigate(`/drops/${id}/edit`) }]}
    >
      <BlockStack gap="400">
        {drop.lowStockAlerts.length > 0 && (
          <Banner tone="warning" title={`${drop.lowStockAlerts.length} product(s) running low`}>
            {drop.lowStockAlerts.map((a) => a.productTitle).join(', ')} — below the low-stock threshold for this drop.
          </Banner>
        )}

        <Card>
          <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
            <Text as="p" tone="subdued">{drop.description}</Text>
            <Select label="Status" labelHidden options={STATUS_OPTIONS} value={drop.status} onChange={handleStatusChange} />
          </InlineGrid>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Restock Priority for this Drop</Text>
            <ResourceList
              resourceName={{ singular: 'product', plural: 'products' }}
              items={drop.restockPriority}
              renderItem={(item) => (
                <ResourceItem id={String(item.id)}>
                  <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
                    <Text as="span" fontWeight="semibold">{item.title}</Text>
                    <ScoreBadge score={item.score} />
                  </InlineGrid>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {item.waitlistCount} waitlisted &middot; {item.sellThroughRate}% sold through
                    {item.daysSinceSoldOut !== null ? ` · sold out ${item.daysSinceSoldOut}d ago` : ''}
                  </Text>
                </ResourceItem>
              )}
            />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Products</Text>
            <ResourceList
              resourceName={{ singular: 'product', plural: 'products' }}
              items={drop.products}
              renderItem={(product) => (
                <ResourceItem
                  id={String(product.productId)}
                  media={<Thumbnail source={product.imageUrl || ''} alt={product.title} size="small" />}
                >
                  <Text as="span">{product.title}</Text>
                  <Text as="span" variant="bodySm" tone="subdued"> — baseline inventory {product.baselineInventory}</Text>
                </ResourceItem>
              )}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
