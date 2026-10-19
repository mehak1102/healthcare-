import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { apiError } from '../http/api-error';

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) =>
      message.startsWith(error.property) ? message.replace(error.property, path) : message,
    );
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

/**
 * Strict validation: unknown properties are rejected (prevents mass assignment such as a client
 * sending `roles`), and validated values never echo back into error messages.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new BadRequestException(
        apiError('VALIDATION_FAILED', 'Request validation failed', flatten(errors)),
      ),
  });
}
