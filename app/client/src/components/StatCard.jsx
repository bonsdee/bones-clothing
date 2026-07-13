import React from 'react';
import { Card, Text, BlockStack } from '@shopify/polaris';

export default function StatCard({ label, value, tone }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="p" variant="heading2xl" tone={tone}>{value}</Text>
      </BlockStack>
    </Card>
  );
}
