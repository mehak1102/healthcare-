import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  CONSULTATION_MODES,
  doctorName,
  doctorsApi,
  LANGUAGES,
  MODE_LABELS,
  MY_PROFILE_KEY,
  type MyDoctorProfile,
} from './api';
import { doctorProfileSchema, type DoctorProfileValues } from './schemas';

const toValues = (profile: MyDoctorProfile): DoctorProfileValues => ({
  bio: profile.bio,
  languages: profile.languages,
  consultationModes: profile.consultationModes,
  consultationFeeInr: profile.consultationFeeInr === null ? '' : String(profile.consultationFeeInr),
  clinicName: profile.clinicName ?? '',
  city: profile.city ?? '',
  locality: profile.locality ?? '',
  requiresBookingApproval: profile.requiresBookingApproval,
  published: profile.published,
});

export function DoctorProfileEditorPage() {
  usePageTitle('Your doctor profile');
  const profile = useQuery({ queryKey: MY_PROFILE_KEY, queryFn: doctorsApi.myProfile });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="For doctors"
        title="Your doctor profile"
        description="This is what patients see in Find a doctor. Nothing is shown until you choose to publish."
      />
      <div className="mt-8">
        {profile.isPending && <PageLoading />}
        {profile.isError && (
          <Alert tone="error">
            {profile.error instanceof ApiError && profile.error.code === 'PROFILE_NOT_FOUND'
              ? profile.error.message
              : 'We could not load your profile. Please refresh the page.'}
          </Alert>
        )}
        {profile.data && <ProfileEditor profile={profile.data} />}
      </div>
    </div>
  );
}

function ProfileEditor({ profile }: { profile: MyDoctorProfile }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: doctorsApi.saveProfile,
    onSuccess: (saved) => {
      queryClient.setQueryData(MY_PROFILE_KEY, saved);
      reset(toValues(saved));
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<DoctorProfileValues>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: toValues(profile),
  });
  const offersClinic = useWatch({ control, name: 'consultationModes' }).includes('clinic');
  const bioLength = useWatch({ control, name: 'bio' }).trim().length;

  const onSubmit = handleSubmit((values) => {
    const clinic = values.consultationModes.includes('clinic');
    save.mutate({
      ...values,
      consultationFeeInr:
        values.consultationFeeInr === '' ? null : Number(values.consultationFeeInr),
      clinicName: (clinic && values.clinicName) || null,
      city: (clinic && values.city) || null,
      locality: (clinic && values.locality) || null,
    });
  });

  const incomplete =
    save.error instanceof ApiError && save.error.code === 'PROFILE_INCOMPLETE' ? save.error : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{doctorName(profile.displayName)}</CardTitle>
          {profile.published ? (
            <Badge tone="success">Visible to patients</Badge>
          ) : (
            <Badge tone="warning">Not published</Badge>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Speciality</dt>
              <dd className="mt-0.5 font-semibold">{profile.specialty}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Qualifications</dt>
              <dd className="mt-0.5 font-semibold">{profile.qualification}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Registration</dt>
              <dd className="mt-0.5 font-semibold">
                {profile.registrationNumber}, {profile.registrationCouncil} (
                {profile.registrationYear})
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-muted">
            These details were checked when your application was approved. To change them, contact
            support.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {profile.published && (
              <Link
                to={`/doctors/${profile.slug}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-coral-ink hover:underline"
              >
                View your public profile <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            <Link
              to="/doctor/schedule"
              className="text-sm font-semibold text-coral-ink hover:underline"
            >
              Set your timetable
            </Link>
            <Link
              to="/doctor/appointments"
              className="text-sm font-semibold text-coral-ink hover:underline"
            >
              Patient appointments
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details for patients</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {save.isSuccess && !isDirty && (
              <Alert tone="success">Your profile has been saved.</Alert>
            )}
            {incomplete && (
              <Alert tone="error" title="Add these before publishing">
                <ul className="list-disc pl-5">
                  {incomplete.details.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {save.isError && !incomplete && (
              <Alert tone="error">
                {save.error instanceof ApiError && save.error.details.length > 0
                  ? save.error.details.join('. ')
                  : 'We could not save your profile. Please try again.'}
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="text-sm font-semibold">
                About you
              </label>
              <textarea
                id="bio"
                rows={5}
                maxLength={1500}
                aria-invalid={errors.bio ? true : undefined}
                aria-describedby="bio-hint"
                className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2.5 text-[0.95rem] hover:border-rose focus-visible:border-coral-ink"
                {...register('bio')}
              />
              <p id="bio-hint" className="text-xs text-ink-muted">
                Your experience and the conditions you treat. {bioLength}/1500 characters, at least
                50 to publish. Do not include phone numbers or patient details.
              </p>
              {errors.bio && (
                <p className="text-sm font-medium text-danger-ink">{errors.bio.message}</p>
              )}
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">How patients can consult you</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {CONSULTATION_MODES.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={mode}
                      className="size-4 accent-coral-ink"
                      {...register('consultationModes')}
                    />
                    {MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </fieldset>

            <FormField
              label="Consultation fee (₹)"
              inputMode="numeric"
              maxLength={5}
              hint="Whole rupees. Enter 0 for free consultations."
              error={errors.consultationFeeInr?.message}
              className="sm:max-w-xs"
              {...register('consultationFeeInr')}
            />

            {offersClinic && (
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  label="Clinic name"
                  error={errors.clinicName?.message}
                  {...register('clinicName')}
                />
                <FormField label="City" error={errors.city?.message} {...register('city')} />
                <FormField
                  label="Area or locality"
                  error={errors.locality?.message}
                  {...register('locality')}
                />
              </div>
            )}

            <fieldset>
              <legend className="text-sm font-semibold">Languages you consult in</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LANGUAGES.map((language) => (
                  <label key={language} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={language}
                      className="size-4 accent-coral-ink"
                      {...register('languages')}
                    />
                    {language}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-coral-ink"
                {...register('requiresBookingApproval')}
              />
              <span>
                <span className="font-semibold">Approve each booking before it is confirmed</span>
                <span className="block text-ink-muted">
                  When on, patients wait for you to accept on Patient appointments. Turn off for
                  instant confirmation after payment (easier for testing video calls).
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-coral-ink"
                {...register('published')}
              />
              <span>
                <span className="font-semibold">Show my profile to patients</span>
                <span className="block text-ink-muted">
                  Your profile appears in Find a doctor. You can hide it again at any time.
                </span>
              </span>
            </label>

            {!profile.published && profile.missing.length > 0 && (
              <p className="text-sm text-ink-muted">
                Still needed to publish: {profile.missing.join(', ')}.
              </p>
            )}

            <Button type="submit" size="lg" loading={save.isPending} className="sm:self-start">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
