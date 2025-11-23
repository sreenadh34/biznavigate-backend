import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Tenant Decorator
 * Extracts tenant_id from the authenticated user's JWT token
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Tenant() tenantId: string) {
 *   return this.service.findAll(tenantId);
 * }
 * ```
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenant_id || request.tenantId;
  },
);
