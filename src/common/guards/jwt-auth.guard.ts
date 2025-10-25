import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 *
 * This guard uses Passport JWT strategy for authentication.
 * It validates the JWT token from the Authorization header
 * and attaches the decoded user payload to request.user
 *
 * @example Usage:
 * ```typescript
 * @Controller('leads')
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * export class LeadController { ... }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * JWT Payload Interface
 * Define the structure of the decoded JWT token
 */
export interface JwtPayload {
  user_id: string;
  tenant_id: string;
  business_id: string;
  role_id: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}
