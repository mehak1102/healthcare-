import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { validateEnv } from '../../config/env.schema';
import { SmtpMailTransport } from './smtp-mail.transport';

interface Received {
  from: string;
  to: string[];
  user: string | undefined;
  raw: string;
}

/** A throwaway SMTP server on localhost; nothing leaves the machine. */
async function startServer(): Promise<{ server: SMTPServer; port: number; received: Received[] }> {
  const received: Received[] = [];
  const server = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    authOptional: false,
    logger: false,
    onAuth(auth, _session, callback) {
      if (auth.username === 'mailer' && auth.password === 'synthetic-smtp-password') {
        callback(null, { user: auth.username });
      } else {
        callback(new Error('Invalid username or password'));
      }
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          to: session.envelope.rcptTo.map((rcpt) => rcpt.address),
          user: session.user as string | undefined,
          raw: Buffer.concat(chunks).toString('utf8'),
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.server.address() as AddressInfo).port, received };
}

const envFor = (port: number, overrides: Record<string, string> = {}) =>
  validateEnv({
    MONGODB_URI: 'mongodb://localhost/',
    SESSION_SECRET: 'x'.repeat(40),
    MAIL_TRANSPORT: 'smtp',
    MAIL_FROM: 'Sukoon Health <no-reply@sukoon.test>',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_SECURE: 'false',
    SMTP_REQUIRE_TLS: 'false',
    SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'synthetic-smtp-password',
    ...overrides,
  });

describe('SmtpMailTransport', () => {
  let server: SMTPServer;
  let port: number;
  let received: Received[];

  beforeAll(async () => {
    ({ server, port, received } = await startServer());
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('logs in and delivers the message with the configured sender', async () => {
    const transport = new SmtpMailTransport(envFor(port));
    try {
      await transport.send({
        to: 'asha@example.test',
        subject: 'Reset your Sukoon Health password',
        text: 'Open this link: http://localhost:5173/reset-password#token=abc',
      });
    } finally {
      transport.close();
    }

    const message = received.at(-1)!;
    expect(message.user).toBe('mailer');
    expect(message.from).toBe('no-reply@sukoon.test');
    expect(message.to).toEqual(['asha@example.test']);
    expect(message.raw).toContain('Subject: Reset your Sukoon Health password');
    expect(message.raw).toContain('reset-password#token=abc');
  });

  it('fails when the login is wrong', async () => {
    const transport = new SmtpMailTransport(envFor(port, { SMTP_PASSWORD: 'wrong-password' }));
    try {
      await expect(
        transport.send({ to: 'asha@example.test', subject: 'Hi', text: 'Hello' }),
      ).rejects.toThrow(/Invalid login|Invalid username/);
    } finally {
      transport.close();
    }
  });

  it('refuses to send over an unencrypted connection unless explicitly allowed', async () => {
    const transport = new SmtpMailTransport(envFor(port, { SMTP_REQUIRE_TLS: 'true' }));
    const before = received.length;
    try {
      await expect(
        transport.send({ to: 'asha@example.test', subject: 'Hi', text: 'Hello' }),
      ).rejects.toThrow(/STARTTLS/);
    } finally {
      transport.close();
    }
    expect(received).toHaveLength(before);
  });
});

describe('SMTP configuration', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/', SESSION_SECRET: 'x'.repeat(40) };

  it('requires a host and sender, and both login fields together', () => {
    const run = () => validateEnv({ ...base, MAIL_TRANSPORT: 'smtp', SMTP_USER: 'mailer' });
    expect(run).toThrow(/SMTP_HOST/);
    expect(run).toThrow(/MAIL_FROM/);
    expect(run).toThrow(/SMTP_PASSWORD/);
  });

  it('never allows unencrypted SMTP in production', () => {
    const run = () =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        MAIL_TRANSPORT: 'smtp',
        MAIL_FROM: 'no-reply@sukoon.in',
        SMTP_HOST: 'smtp.example.in',
        SMTP_REQUIRE_TLS: 'false',
      });
    expect(run).toThrow(/SMTP_REQUIRE_TLS/);
  });
});
