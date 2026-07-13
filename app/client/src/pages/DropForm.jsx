import React, { useEffect, useState } from 'react';
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  Text,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail
} from '@shopify/polaris';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';

/**
 * Single form that handles both create and update — the create/update
 * workflow required by the brief. Product selection pulls from the local
 * catalog cache (synced from Shopify via the "Sync Catalog" button), which
 * keeps drop creation fast even for stores with large catalogs.
 */
export default function DropForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  const [catalog, setCatalog] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/products').then(setCatalog).catch((err) => setError(err.message));

    if (isEdit) {
      api
        .get(`/api/drops/${id}`)
        .then((drop) => {
          setName(drop.name);
          setDescription(drop.description || '');
          setStartsAt(drop.startsAt?.slice(0, 16) || '');
          setEndsAt(drop.endsAt?.slice(0, 16) || '');
          setWaitlistEnabled(drop.waitlistEnabled);
          setLowStockThreshold(String(drop.lowStockThreshold));
          setSelectedProductIds(drop.products.map((p) => p.productId));
        })
        .catch((err) => setError(err.message));
    }
  }, [id]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await api.post('/api/products/sync', {});
      const fresh = await api.get('/api/products');
      setCatalog(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function toggleProduct(productId) {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id2) => id2 !== productId) : [...prev, productId]
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const payload = {
      name,
      description,
      startsAt,
      endsAt: endsAt || null,
      waitlistEnabled,
      lowStockThreshold: Number(lowStockThreshold),
      productIds: selectedProductIds
    };

    try {
      if (isEdit) {
        await api.patch(`/api/drops/${id}`, payload);
        navigate(`/drops/${id}`);
      } else {
        const created = await api.post('/api/drops', payload);
        navigate(`/drops/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={isEdit ? 'Edit Drop' : 'New Drop'} backAction={{ content: 'Drops', onAction: () => navigate('/drops') }}>
      {error && <Banner tone="critical" title="Something went wrong">{error}</Banner>}

      <BlockStack gap="400">
        <Card>
          <FormLayout>
            <TextField label="Drop name" value={name} onChange={setName} autoComplete="off" placeholder="Drop 004 — Grayscale" />
            <TextField label="Description" value={description} onChange={setDescription} multiline={3} autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Starts at" type="datetime-local" value={startsAt} onChange={setStartsAt} autoComplete="off" />
              <TextField label="Ends at (optional)" type="datetime-local" value={endsAt} onChange={setEndsAt} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <Checkbox label="Enable storefront waitlist for sold-out sizes" checked={waitlistEnabled} onChange={setWaitlistEnabled} />
              <TextField label="Low stock alert threshold (units)" type="number" value={lowStockThreshold} onChange={setLowStockThreshold} autoComplete="off" />
            </FormLayout.Group>
          </FormLayout>
        </Card>

        <Card>
          <BlockStack gap="300">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text as="h2" variant="headingMd">Products in this drop</Text>
              <Button onClick={handleSync} loading={syncing}>Sync Catalog from Shopify</Button>
            </div>
            {catalog.length === 0 && (
              <Text as="p" tone="subdued">No products synced yet. Click "Sync Catalog from Shopify" to pull your products in.</Text>
            )}
            <ResourceList
              resourceName={{ singular: 'product', plural: 'products' }}
              items={catalog}
              renderItem={(product) => (
                <ResourceItem
                  id={String(product.id)}
                  media={<Thumbnail source={product.imageUrl || ''} alt={product.title} size="small" />}
                  onClick={() => toggleProduct(product.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text as="span">{product.title}</Text>
                    <Checkbox checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} label="" labelHidden />
                  </div>
                </ResourceItem>
              )}
            />
          </BlockStack>
        </Card>

        <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!name || !startsAt}>
          {isEdit ? 'Save Changes' : 'Create Drop'}
        </Button>
      </BlockStack>
    </Page>
  );
}
