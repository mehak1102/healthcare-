import { Link } from 'react-router';
import { Logo } from './logo';

const CURRENT_YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-sand/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-sm leading-relaxed text-ink-muted">
            Calm, verified care for patients in India. We are building carefully — features appear
            here only when they genuinely work.
          </p>
        </div>
        <nav aria-label="Care">
          <h2 className="font-sans text-sm font-bold tracking-wide text-ink uppercase">Care</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/doctors">
                Find a doctor
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/care">
                Healthcare categories
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/doctor-at-home">
                Doctor at home
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/online-consultation">
                Online consultation
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/diagnostics">
                Diagnostics
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="font-sans text-sm font-bold tracking-wide text-ink uppercase">Company</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/about">
                About us
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/contact">
                Contact
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/doctors/join">
                For doctors
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="font-sans text-sm font-bold tracking-wide text-ink uppercase">Policies</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/privacy">
                Privacy Notice (draft)
              </Link>
            </li>
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/terms">
                Terms of Use (draft)
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-sm font-bold tracking-wide text-ink uppercase">Safety</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-ink-muted hover:text-ink" to="/emergency">
                Emergency guidance
              </Link>
            </li>
            <li className="text-ink-muted">
              National emergency number:{' '}
              <a
                className="font-semibold text-ink underline-offset-2 hover:underline"
                href="tel:112"
              >
                112
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-muted sm:px-6 lg:px-8">
          © {CURRENT_YEAR} Sukoon Health (working name). Development build — not for real patient
          use.
        </p>
      </div>
    </footer>
  );
}
