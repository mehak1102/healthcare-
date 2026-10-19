import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail-transport';

/**
 * Development only: prints emails to the backend terminal instead of sending them. The environment
 * schema rejects this transport in production because messages contain single-use secrets.
 */
export class ConsoleMailTransport implements MailTransport {
  readonly available = true;
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    const divider = '─'.repeat(64);
    this.logger.log(
      `Email not sent (development console transport)\n${divider}\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n${divider}`,
    );
    return Promise.resolve();
  }
}
