import { useQuery } from '@tanstack/react-query';
import { Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { doctorsApi, MY_APPLICATION_KEY } from './api';

/** Account-page entry point for doctors who have not been approved yet. */
export function DoctorAccessCard() {
  const mine = useQuery({ queryKey: MY_APPLICATION_KEY, queryFn: doctorsApi.myApplication });
  if (!mine.data) return null;
  const application = mine.data.application;

  const status =
    application?.status === 'pending' ? (
      <Badge tone="warning">Under review</Badge>
    ) : application?.status === 'rejected' ? (
      <Badge tone="warning">Needs changes</Badge>
    ) : null;

  const text =
    application?.status === 'pending'
      ? 'We are checking your medical registration. We will email you when it is done.'
      : application?.status === 'rejected'
        ? 'We could not approve your last application. See why and apply again.'
        : 'Offer consultations on Sukoon. We verify your medical registration first.';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="size-5 text-coral-ink" aria-hidden="true" />
          Are you a doctor?
        </CardTitle>
        {status}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">{text}</p>
        <Link to="/doctors/join" className={cn(buttonVariants({ variant: 'secondary' }), 'mt-4')}>
          {application ? 'View application' : 'Apply to join as a doctor'}
        </Link>
      </CardContent>
    </Card>
  );
}
