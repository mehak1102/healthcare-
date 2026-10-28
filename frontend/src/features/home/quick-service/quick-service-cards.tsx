import { Link } from 'react-router';
import './quick-service-cards.css';

function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function GoArrow() {
  return (
    <span
      className="qc-go"
      aria-hidden="true"
      style={{
        flex: '0 0 auto',
        width: 32,
        height: 32,
        borderRadius: 999,
        background: '#F2F3F8',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0E1222"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke .25s' }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

function CardBody({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        padding: '14px 16px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 8,
        flex: 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: '16.5px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.4, color: '#6B7186' }}>{subtitle}</p>
      </div>
      <GoArrow />
    </div>
  );
}

const img = (file: string) => `/images/quick-service/${file}`;

export function QuickServiceCards() {
  return (
    <div data-sukoon-quick-cards>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(#E9EBF2 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '8%',
          top: 160,
          width: '84%',
          height: 320,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '45%',
            height: '100%',
            borderRadius: 999,
            background: '#DCD8FF',
            filter: 'blur(110px)',
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '45%',
            height: '100%',
            borderRadius: 999,
            background: '#CDEBFF',
            filter: 'blur(110px)',
            opacity: 0.55,
          }}
        />
      </div>

      <section
        aria-labelledby="qc3-h"
        style={{
          position: 'relative',
          maxWidth: 1240,
          margin: '0 auto',
          padding: '80px 24px 80px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          className="qc-rv qc-d1"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#3D3FC4',
              }}
            >
              Care, your way
            </div>
            <h2
              id="qc3-h"
              style={{
                margin: '8px 0 0',
                fontSize: 'clamp(30px, 3.2vw, 42px)',
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
              }}
            >
              How can we help{' '}
              <span
                style={{
                  fontFamily: "'Instrument Serif', 'Noto Serif Devanagari', Georgia, serif",
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: '#4C4FE0',
                }}
              >
                today?
              </span>
            </h2>
          </div>
          <Link
            className="qc-see"
            to="/#services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              fontSize: 15,
              fontWeight: 600,
              color: '#3D3FC4',
              textDecoration: 'none',
            }}
          >
            See all services <ArrowIcon />
          </Link>
        </div>

        <div className="qc-row6" role="list">
          <Link
            className="qc-card qc-rv qc-d2"
            role="listitem"
            to="/online-consultation"
            aria-label="Video consultation — talk to a verified doctor from anywhere"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#D8E6FF' }}>
              <img
                className="qc-ph"
                src={img('2c1b0daecd4d29f6fad142fa3c96603d.jpg')}
                alt="A woman on a video call with a doctor on her laptop"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(14,18,34,0.25) 0%, rgba(14,18,34,0) 40%)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.94)',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                <span
                  className="qc-blink"
                  style={{ width: 6, height: 6, borderRadius: 999, background: '#E5484D' }}
                />
                Video · Audio
              </span>
            </div>
            <CardBody title="Video consultation" subtitle="Talk from anywhere" />
          </Link>

          <Link
            className="qc-card qc-rv qc-d3"
            role="listitem"
            to="/doctor-at-home"
            aria-label="Doctor at home — at your door in as little as 30 minutes"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#FFE6D8' }}>
              <img
                className="qc-ph"
                src={img('500fa8cfaaeafd9d35cae9c58b1cfe9c.jpg')}
                alt="An Indian doctor checking a patient with a stethoscope"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(14,18,34,0.25) 0%, rgba(14,18,34,0) 40%)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  background: '#0E1222',
                  padding: '4px 9px',
                  borderRadius: 999,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFB38A" strokeWidth="2.6" strokeLinecap="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2 2M9 2h6" />
                </svg>
                30 min
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#FFFFFF',
                  background: '#4C4FE0',
                  padding: '3px 7px',
                  borderRadius: 999,
                }}
              >
                NEW
              </span>
            </div>
            <CardBody title="Doctor at home" subtitle="In as little as 30 min" />
          </Link>

          <Link
            className="qc-card qc-rv qc-d4"
            role="listitem"
            to="/care"
            aria-label="Physiotherapy — sessions at home or at the clinic"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#DCF4E6' }}>
              <img
                className="qc-ph"
                src={img('2fdfa91f594fa3fb458bdc4de48d09be.jpg')}
                alt="A physiotherapist treating a patient's knee"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(14,18,34,0.2) 0%, rgba(14,18,34,0) 40%)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.94)',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1C8A5A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11 12 4l9 7" />
                  <path d="M5 10v10h14V10" />
                </svg>
                Home or clinic
              </span>
            </div>
            <CardBody title="Physiotherapy" subtitle="Recovery sessions" />
          </Link>

          <Link
            className="qc-card qc-rv qc-d5"
            role="listitem"
            to="/doctors"
            aria-label="Doctors at night — verified doctors after hours"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#171C4E' }}>
              <img
                className="qc-ph"
                src={img('feadaa2d8d0e1440863b6237e33eb3c9.jpg')}
                alt="A doctor at her desk, shown in night-time blue tones"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(11,15,46,0.55) 0%, rgba(11,15,46,0.05) 55%, rgba(11,15,46,0.35) 100%)',
                }}
              />
              <span
                aria-hidden="true"
                className="qc-tw"
                style={{
                  position: 'absolute',
                  left: '20%',
                  top: '22%',
                  width: 3,
                  height: 3,
                  borderRadius: 999,
                  background: '#FFFFFF',
                }}
              />
              <span
                aria-hidden="true"
                className="qc-tw"
                style={{
                  position: 'absolute',
                  left: '46%',
                  top: '12%',
                  width: 2,
                  height: 2,
                  borderRadius: 999,
                  background: '#FFFFFF',
                  animationDelay: '0.8s',
                }}
              />
              <span
                aria-hidden="true"
                className="qc-tw"
                style={{
                  position: 'absolute',
                  left: '62%',
                  top: '26%',
                  width: 2,
                  height: 2,
                  borderRadius: 999,
                  background: '#FFFFFF',
                  animationDelay: '1.6s',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 14,
                  top: 12,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: 'radial-gradient(circle at 35% 35%, #FFFFFF, #E3E6FF 60%, #B8BEF0)',
                  boxShadow: '0 0 22px 6px rgba(201,204,248,0.45)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '4px 8px',
                  borderRadius: 999,
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}
              >
                <span
                  className="qc-blink"
                  style={{ width: 6, height: 6, borderRadius: 999, background: '#34D399' }}
                />
                Open now
              </span>
            </div>
            <CardBody title="Doctors at night" subtitle="Verified, after hours" />
          </Link>

          <Link
            className="qc-card qc-rv qc-d6"
            role="listitem"
            to="/diagnostics"
            aria-label="Lab tests — sample collected at home"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#E4E2FF' }}>
              <img
                className="qc-ph"
                src={img('402eff8fc31150d50c581559ca449688.jpg')}
                alt="Blood sample tubes in a rack at a laboratory"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(14,18,34,0.2) 0%, rgba(14,18,34,0) 40%)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.94)',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11 12 4l9 7" />
                  <path d="M5 10v10h14V10" />
                </svg>
                Home collection
              </span>
            </div>
            <CardBody title="Lab tests" subtitle="Reports in your records" />
          </Link>

          <Link
            className="qc-card qc-rv qc-d7"
            role="listitem"
            to="/doctors"
            aria-label="Specialist doctors — registration checked"
          >
            <div style={{ position: 'relative', height: 178, overflow: 'hidden', background: '#DCEBFA' }}>
              <img
                className="qc-ph"
                src={img('cb9b6ce485821de19ebe0130b26e3f61.jpg')}
                alt="A doctor with a stethoscope, arms crossed"
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(14,18,34,0.2) 0%, rgba(14,18,34,0) 40%)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: '#0E1222',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Reg. checked
              </span>
            </div>
            <CardBody title="Specialist doctors" subtitle="Cardio, skin, neuro & more" />
          </Link>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#8A90A3' }}>
          Photos: Pexels & Unsplash (free licence) — illustrative, not Sukoon doctors.
        </p>
      </section>
    </div>
  );
}
