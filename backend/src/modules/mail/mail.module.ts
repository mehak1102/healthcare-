import { Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { ConsoleMailTransport } from './console-mail.transport';
import { DisabledMailTransport } from './disabled-mail.transport';
import { InjectMailTransport, MAIL_TRANSPORT, type MailTransport } from './mail-transport';
import { SmtpMailTransport } from './smtp-mail.transport';

function createMailTransport(env: Env): MailTransport {
  switch (env.MAIL_TRANSPORT) {
    case 'console':
      return new ConsoleMailTransport();
    case 'smtp':
      return new SmtpMailTransport(env);
    case 'disabled':
      return new DisabledMailTransport();
  }
}

@Module({
  providers: [{ provide: MAIL_TRANSPORT, inject: [APP_CONFIG], useFactory: createMailTransport }],
  exports: [MAIL_TRANSPORT],
})
export class MailModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@InjectMailTransport() private readonly transport: MailTransport) {}

  onApplicationBootstrap(): void {
    if (this.transport instanceof SmtpMailTransport) void this.transport.verify();
  }

  onApplicationShutdown(): void {
    if (this.transport instanceof SmtpMailTransport) this.transport.close();
  }
}
