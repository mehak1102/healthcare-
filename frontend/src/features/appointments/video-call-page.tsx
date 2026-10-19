import '@livekit/components-styles';
import {
  ControlBar,
  ConnectionStateToast,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useConnectionState,
  useTracks,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { useMutation } from '@tanstack/react-query';
import { Track } from 'livekit-client';
import { ChevronLeft, Video } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { appointmentsApi } from './api';

function ConnectionStatus() {
  const state = useConnectionState();
  const label =
    state === ConnectionState.Connected
      ? 'Connected'
      : state === ConnectionState.Reconnecting
        ? 'Reconnecting…'
        : state === ConnectionState.Connecting
          ? 'Connecting…'
          : 'Disconnected';
  const tone =
    state === ConnectionState.Connected
      ? 'text-emerald-700'
      : state === ConnectionState.Disconnected
        ? 'text-ink-muted'
        : 'text-amber-800';
  return (
    <p className={`px-3 py-2 text-sm font-medium ${tone}`} role="status" aria-live="polite">
      {label}
    </p>
  );
}

function CallStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <>
      <ConnectionStatus />
      <GridLayout tracks={tracks} style={{ height: 'calc(100% - var(--lk-control-bar-height))' }}>
        <ParticipantTile />
      </GridLayout>
      <ControlBar controls={{ chat: false, settings: false }} />
      <ConnectionStateToast />
      <RoomAudioRenderer />
    </>
  );
}

export function VideoCallPage({ as }: { as: 'patient' | 'doctor' }) {
  usePageTitle('Video consultation');
  const { id = '' } = useParams();
  const back = as === 'doctor' ? '/doctor/appointments' : `/appointments/${id}`;
  const join = useMutation({ mutationFn: () => appointmentsApi.joinVideo(id, as) });
  const [inCall, setInCall] = useState(false);
  const [left, setLeft] = useState(false);
  const [deviceProblem, setDeviceProblem] = useState(false);

  const start = () => {
    setLeft(false);
    setDeviceProblem(false);
    join.mutate(undefined, { onSuccess: () => setInCall(true) });
  };

  if (inCall && join.data) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
        {deviceProblem && (
          <Alert tone="warning">
            We could not use your camera or microphone. Check that your browser is allowed to use
            them, then use the buttons below to turn them on.
          </Alert>
        )}
        <LiveKitRoom
          serverUrl={join.data.url}
          token={join.data.token}
          connect
          video
          audio
          data-lk-theme="default"
          className="h-[75vh] overflow-hidden rounded-[var(--radius-card)]"
          onMediaDeviceFailure={() => setDeviceProblem(true)}
          onDisconnected={() => {
            setInCall(false);
            setLeft(true);
          }}
        >
          <CallStage />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        to={back}
        className="inline-flex items-center gap-1 text-sm font-semibold text-coral-ink hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {as === 'doctor' ? 'Your patients’ appointments' : 'Back to the appointment'}
      </Link>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Video consultation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {left && <Alert tone="info">You have left the call. You can rejoin until it ends.</Alert>}
          <p className="text-sm">
            Your browser will ask to use your camera and microphone. Use a quiet, private place and
            a stable internet connection.
          </p>
          <p className="text-sm text-ink-muted">
            The call is encrypted in transit and relayed through our video provider, LiveKit. It is
            not end-to-end encrypted. Sukoon Health does not record calls.
          </p>
          {join.isError && (
            <Alert tone="error">
              {join.error instanceof ApiError
                ? join.error.message
                : 'We could not start the call. Please try again.'}
            </Alert>
          )}
          <Button className="self-start" loading={join.isPending} onClick={start}>
            <Video className="size-4" aria-hidden="true" />
            {left ? 'Rejoin call' : 'Join call'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
