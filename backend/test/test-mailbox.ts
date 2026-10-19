import type { MailMessage, MailTransport } from '../src/modules/mail/mail-transport';

/** Captures outgoing email in memory so tests can follow emailed links. */
export class TestMailbox implements MailTransport {
  readonly available = true;
  readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  /** Waits for background sends; returns the newest message to `to` matching `subject`. */
  async waitFor(to: string, subject: RegExp, timeoutMs = 3_000): Promise<MailMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const match = [...this.messages]
        .reverse()
        .find((message) => message.to === to && subject.test(message.subject));
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`No email to ${to} matching ${subject} within ${timeoutMs} ms`);
  }

  count(to: string, subject = /./): number {
    return this.messages.filter((message) => message.to === to && subject.test(message.subject))
      .length;
  }
}

export function tokenFromLink(message: MailMessage, path: string): string {
  const match = new RegExp(`${path}#token=([A-Za-z0-9_-]+)`).exec(message.text);
  if (!match?.[1]) throw new Error(`No ${path} link in email`);
  return match[1];
}
