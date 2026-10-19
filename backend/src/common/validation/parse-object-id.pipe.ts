import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { apiError } from '../http/api-error';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Malformed IDs are reported as "not found" so callers learn nothing about ID formats. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
      throw new NotFoundException(apiError('NOT_FOUND', 'Resource not found'));
    }
    return value.toLowerCase();
  }
}
