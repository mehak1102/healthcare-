import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AppRequest } from '../http/app-request';
import { isApiErrorBody, type ApiErrorBody } from '../http/api-error';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Converts every error into a stable JSON shape and never leaks stack traces or internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const res = http.getResponse<Response>();
    const requestId = typeof req.id === 'string' ? req.id : undefined;

    const { status, body } = this.toResponse(exception);
    if (status >= 500) {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
    }
    if (status === 429) {
      res.setHeader('Retry-After', '60');
    }
    res.status(status).json({ error: body, requestId });
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    const bodyParserStatus = this.bodyParserStatus(exception);
    if (bodyParserStatus) {
      return {
        status: bodyParserStatus,
        body: {
          code: DEFAULT_CODES[bodyParserStatus] ?? 'BAD_REQUEST',
          message:
            bodyParserStatus === 413
              ? 'Request body is too large'
              : 'Request body is not valid JSON',
        },
      };
    }

    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      };
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (isApiErrorBody(payload)) {
      return { status, body: payload };
    }
    if (status >= 500) {
      return { status, body: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } };
    }
    const message =
      status === 429 ? 'Too many requests. Please wait a minute and try again.' : exception.message;
    return { status, body: { code: DEFAULT_CODES[status] ?? 'ERROR', message } };
  }

  /** body-parser errors are plain Errors carrying `type` and `status`. */
  private bodyParserStatus(exception: unknown): number | undefined {
    if (typeof exception !== 'object' || exception === null) return undefined;
    const { type, status } = exception as { type?: unknown; status?: unknown };
    if (typeof type !== 'string' || typeof status !== 'number') return undefined;
    if (type === 'entity.parse.failed') return 400;
    if (type === 'entity.too.large') return 413;
    return status >= 400 && status < 500 ? status : undefined;
  }
}
