import React, { useEffect, useState } from 'react';
import { Page, Layout, Card, BlockStack, InlineGrid, Text, TextField, ResourceList, ResourceItem, Badge, Banner, SkeletonBodyText } from '@shopify/polaris';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import ScoreBadge from '../components/ScoreBadge.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [restockQuery, setRestockQuery] = useState('');

  // Pulled out so both the initial load and the manual "Refresh" action
  // (below) share one code path — merchants land here right after a drop
  // sells out and want an easy way to pull the latest numbers without
  // reloading the whole embedded app.
  function loadDashboard() {
    setRefreshing(true);
    return api
      .get('/api/dashboard')
      .then((result) => {
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // Client-side only — the list is already small (top picks), so filtering
  // in-memory as the merchant types avoids a round trip for every keystroke.
  const filteredTopRestock = data
    ? data.topRestockPriority.filter((item) =>
        item.title.toLowerCase().includes(restockQuery.trim().toLowerCase())
      )
    : [];

  return (
    <Page
      title="Dashboard"
      subtitle="Bones Clothing — drop performance at a glance"
      primaryAction={{ content: 'Refresh', onAction: loadDashboard, loading: refreshing }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Could not load dashboard">{error}</Banner>
          </Layout.Section>
        )}

        {lastUpdated && (
          <Layout.Section>
            <Text as="p" tone="subdued" variant="bodySm" alignment="end">
              Last updated {lastUpdated.toLocaleTimeString()}
            </Text>
          </Layout.Section>
        )}

        <Layout.Section>
          {!data ? (
            <Card><SkeletonBodyText lines={3} /></Card>
          ) : (
            <InlineGrid columns={3} gap="400">
              <StatCard label="Active Drops" value={data.stats.activeDrops} />
              <StatCard label="Total Waitlist Signups" value={data.stats.totalWaitlistSignups} />
              <StatCard label="Products in Catalog" value={data.stats.catalogSize} />
            </InlineGrid>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Restock Priority — Top Picks</Text>
              <Text as="p" tone="subdued" variant="bodySm">
                Ranked by waitlist demand, sell-through rate, and how recently each item sold out.
                Score is 0-100; higher means restock sooner.
              </Text>
              {data ? (
                <>
                  <TextField
                    label="Search products"
                    labelHidden
                    placeholder="Search by product name…"
                    value={restockQuery}
                    onChange={setRestockQuery}
                    clearButton
                    onClearButtonClick={() => setRestockQuery('')}
                    autoComplete="off"
                  />
                  {filteredTopRestock.length === 0 ? (
                    <Text as="p" tone="subdued">No products match “{restockQuery}”.</Text>
                  ) : (
                    <ResourceList
                      resourceName={{ singular: 'product', plural: 'products' }}
                      items={filteredTopRestock}
                      renderItem={(item) => (
                        <ResourceItem id={String(item.id)}>
                          <BlockStack gap="100">
                            <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
                              <Text as="span" fontWeight="semibold">{item.title}</Text>
                              <ScoreBadge score={item.score} />
                            </InlineGrid>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {item.waitlistCount} waitlisted &middot; {item.sellThroughRate}% sold through
                            </Text>
                          </BlockStack>
                        </ResourceItem>
                      )}
                    />
                  )}
                </>
              ) : (
                <SkeletonBodyText lines={4} />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
                <Text as="h2" variant="headingMd">Active Drops</Text>
                <Link to="/drops/new">+ New Drop</Link>
              </InlineGrid>
              {data && data.activeDrops.length === 0 && (
                <Text as="p" tone="subdued">No drops are live right now.</Text>
              )}
              {data && data.activeDrops.length > 0 && (
                <ResourceList
                  resourceName={{ singular: 'drop', plural: 'drops' }}
                  items={data.activeDrops}
                  renderItem={(drop) => (
                    <ResourceItem id={String(drop.id)} url={`/drops/${drop.id}`}>
                      <InlineGrid columns={['twoThirds', 'oneThird']} alignItems="center">
                        <Text as="span" fontWeight="semibold">{drop.name}</Text>
                        <Badge tone="success">Active</Badge>
                      </InlineGrid>
                    </ResourceItem>
                  )}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Recent Activity</Text>
              {data && (
                <ResourceList
                  resourceName={{ singular: 'event', plural: 'events' }}
                  items={data.recentActivity}
                  renderItem={(event) => (
                    <ResourceItem id={String(event.id)}>
                      <Text as="span">{event.message}</Text>
                      <Text as="span" tone="subdued" variant="bodySm"> — {new Date(event.createdAt).toLocaleString()}</Text>
                    </ResourceItem>
                  )}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
