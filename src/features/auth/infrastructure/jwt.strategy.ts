import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Validate user still exists and is active
    const user = await this.prisma.users.findUnique({
      where: { user_id: payload.user_id },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
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
