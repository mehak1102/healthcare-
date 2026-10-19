import { DynamicModule, Global, Inject, Module } from '@nestjs/common';
import type { Env } from './env.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Injects the validated, read-only environment configuration. */
export const InjectConfig = () => Inject(APP_CONFIG);

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: Object.freeze({ ...env }) }],
      exports: [APP_CONFIG],
    };
  }
}
