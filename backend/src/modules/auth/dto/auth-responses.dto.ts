import { ApiProperty } from '@nestjs/swagger';
import { ALL_PERMISSIONS, type Permission } from '../../access-control/permissions';
import { ROLES, type Role } from '../../access-control/roles';
import type { SessionAccess } from '../../access-control/session-access';
import type { UserDocument } from '../../users/user.schema';
import type { SessionDocument } from '../session.schema';

export class CurrentUserDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ROLES, isArray: true }) roles: Role[];
  @ApiProperty({
    enum: ALL_PERMISSIONS,
    isArray: true,
    description: 'Derived on the server; for UI hints only',
  })
  permissions: Permission[];
  @ApiProperty() emailVerified: boolean;
  @ApiProperty() mfaEnabled: boolean;
  @ApiProperty({
    description: 'Staff permissions are locked until this session passes two-step verification',
  })
  staffMfaRequired: boolean;
  @ApiProperty() createdAt: string;

  static from(user: UserDocument, access: SessionAccess): CurrentUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: [...user.roles],
      permissions: access.permissions,
      emailVerified: user.emailVerifiedAt !== null,
      mfaEnabled: user.mfaEnrolledAt !== null,
      staffMfaRequired: access.staffMfaRequired,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export class AuthResponseDto {
  @ApiProperty({ type: CurrentUserDto }) user: CurrentUserDto;
  @ApiProperty({ description: 'Send as the X-CSRF-Token header on POST/PUT/PATCH/DELETE' })
  csrfToken: string;
}

export class MfaRequiredDto {
  @ApiProperty({
    description: 'Password accepted; send a code to POST /auth/mfa/challenge within 5 minutes',
  })
  mfaRequired: true;
}

export class MfaStatusDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty({ type: String, nullable: true }) enrolledAt: string | null;
  @ApiProperty() recoveryCodesRemaining: number;
  @ApiProperty() canDisable: boolean;
}

export class MfaSetupDto {
  @ApiProperty({ description: 'Base32 secret for manual entry' }) secret: string;
  @ApiProperty({ description: 'otpauth:// URI to show as a QR code' }) otpauthUri: string;
}

export class RecoveryCodesDto {
  @ApiProperty({ type: String, isArray: true, description: 'Shown once; store them safely' })
  recoveryCodes: string[];
}

export class SessionSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() lastSeenAt: string;
  @ApiProperty() userAgent: string;
  @ApiProperty() ipAddress: string;
  @ApiProperty() current: boolean;

  static from(session: SessionDocument, currentSessionId: string): SessionSummaryDto {
    return {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      current: session.id === currentSessionId,
    };
  }
}

export class SessionListDto {
  @ApiProperty({ type: SessionSummaryDto, isArray: true }) items: SessionSummaryDto[];
}

export class RevokedCountDto {
  @ApiProperty() revoked: number;
}
