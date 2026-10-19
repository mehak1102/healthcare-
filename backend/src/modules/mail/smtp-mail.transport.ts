import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.schema';
import type { MailMessage, MailTransport } from './mail-transport';

const TIMEOUT_MS = 15_000;

/** Sends through any SMTP provider. Message bodies (which contain one-time links) are never logged. */
export class SmtpMailTransport implements MailTransport {
  readonly available = true;
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(env: Env) {
    if (!env.SMTP_HOST || !env.MAIL_FROM) {
      throw new Error('SMTP_HOST and MAIL_FROM are required for the SMTP mail transport');
    }
    this.from = env.MAIL_FROM;
    this.transporter = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      requireTLS: env.SMTP_REQUIRE_TLS,
      ignoreTLS: !env.SMTP_REQUIRE_TLS,
      tls: { minVersion: 'TLSv1.2' },
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    this.logger.log(`Email sent: "${message.subject}" (message id ${String(info.messageId)})`);
  }

  /** Checks the connection and login at startup so configuration mistakes show up immediately. */
  async verify(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified; emails will be sent');
    } catch (error) {
      this.logger.error(
        `SMTP check failed: ${error instanceof Error ? error.message : 'unknown error'}. ` +
          'Emails will fail until SMTP settings in backend/.env are fixed.',
      );
    }
  }

  close(): void {
    this.transporter.close();
  }
}
