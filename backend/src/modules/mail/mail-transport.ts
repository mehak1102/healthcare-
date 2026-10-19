import { Inject } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Port for outbound email. Provider adapters (decision D5) implement this interface; feature code
 * depends only on it.
 */
export interface MailTransport {
  /** False when delivery is switched off; callers must fail closed instead of pretending to send. */
  readonly available: boolean;
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
export const InjectMailTransport = () => Inject(MAIL_TRANSPORT);
