import { Badge } from '@/components/ui/badge';
import type { AvailabilityStatus, ProfileCompletion, VerificationStatus } from './api';

const VERIFICATION: Record<
  VerificationStatus,
  { label: string; tone: 'success' | 'warning' | 'accent' | 'neutral' }
> = {
  pending: { label: 'Verification pending', tone: 'accent' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Verification rejected', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'warning' },
};

const AVAILABILITY: Record<
  AvailabilityStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
  busy: { label: 'Busy', tone: 'warning' },
  on_leave: { label: 'On leave', tone: 'warning' },
};

const COMPLETION: Record<ProfileCompletion, { label: string; tone: 'success' | 'warning' }> = {
  complete: { label: 'Profile complete', tone: 'success' },
  incomplete: { label: 'Profile incomplete', tone: 'warning' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const item = VERIFICATION[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus | null }) {
  if (!status) return <Badge tone="neutral">Availability not set</Badge>;
  const item = AVAILABILITY[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function CompletionBadge({ status }: { status: ProfileCompletion }) {
  const item = COMPLETION[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
