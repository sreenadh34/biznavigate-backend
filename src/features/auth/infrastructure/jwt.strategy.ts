import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  user_id: string;
  email: string;
  name: string;
  business_id: string;
  tenant_id: string;
  role_id: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const cacheKey = `user:${payload.user_id}:active`;

    // Try to get user status from cache first
    let isUserActive: boolean | undefined = await this.cacheManager.get(cacheKey);

    if (isUserActive === undefined) {
      // Cache miss - query database
      const user = await this.prisma.users.findUnique({
        where: { user_id: payload.user_id },
        select: { is_active: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      isUserActive = user.is_active ?? false;

      // Cache the result for 5 minutes (300 seconds)
      // This significantly reduces DB load for concurrent requests
      await this.cacheManager.set(cacheKey, isUserActive, 300000);
    }

    if (!isUserActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Return the payload which will be attached to request.user
    return {
      user_id: payload.user_id,
      email: payload.email,
      name: payload.name,
      business_id: payload.business_id,
      tenant_id: payload.tenant_id,
      role_id: payload.role_id,
    };
  }
}
