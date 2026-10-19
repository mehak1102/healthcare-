import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { AuditEvent, type AuditMetadata, type AuditOutcome } from './audit-event.schema';

export interface AuditEntry {
  action: string;
  outcome: AuditOutcome;
  actorUserId?: string | null;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  ipAddress?: string;
  metadata?: AuditMetadata;
}

/**
 * Append-only by design: there are intentionally no update or delete methods. Callers await
 * `record`, so a privileged action fails if its audit event cannot be written.
 */
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditEvent.name) private readonly events: Model<AuditEvent>) {}

  /** Pass `session` to commit the event in the same transaction as the change it describes. */
  async record(entry: AuditEntry, session?: ClientSession): Promise<void> {
    await this.events.create(
      [
        {
          action: entry.action,
          outcome: entry.outcome,
          actorUserId: entry.actorUserId ? new Types.ObjectId(entry.actorUserId) : null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          requestId: entry.requestId ?? '',
          ipAddress: entry.ipAddress ?? '',
          metadata: entry.metadata ?? {},
        },
      ],
      { session },
    );
  }
}
