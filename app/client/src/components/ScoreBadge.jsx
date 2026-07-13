import React from 'react';
import { Badge } from '@shopify/polaris';

/**
 * Renders a Restock Priority Score (0-100) with a tone that scans quickly:
 * red/critical means "restock now", green means "no urgency yet".
 */
export default function ScoreBadge({ score }) {
  let tone = 'success';
  let label = 'Low';

  if (score >= 70) {
    tone = 'critical';
    label = 'Urgent';
  } else if (score >= 40) {
    tone = 'warning';
    label = 'Medium';
  }

  return <Badge tone={tone}>{`${label} · ${score}`}</Badge>;
}
