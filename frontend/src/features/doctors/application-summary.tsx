import type { DoctorApplication } from './api';

export function ApplicationSummary({ application }: { application: DoctorApplication }) {
  const rows = [
    ['Registration number', application.registrationNumber],
    ['Medical council', application.registrationCouncil],
    ['Year of registration', String(application.registrationYear)],
    ['Qualifications', application.qualification],
    ['Speciality', application.specialty],
  ];
  return (
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-ink-muted">{label}</dt>
          <dd className="mt-0.5 font-semibold break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
