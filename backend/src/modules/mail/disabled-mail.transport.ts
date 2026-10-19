import { ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/http/api-error';
import type { MailTransport } from './mail-transport';

export const emailUnavailable = () =>
  new ServiceUnavailableException(
    apiError('EMAIL_UNAVAILABLE', 'Email is temporarily unavailable. Please try again later.'),
  );

export class DisabledMailTransport implements MailTransport {
  readonly available = false;

  send(): Promise<void> {
    return Promise.reject(emailUnavailable());
  }
}
