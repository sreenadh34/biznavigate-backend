import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SignupDto } from "../dto/signup.dto";
import { LoginDto } from "../dto/login.dto";
import { AuthResponseDto } from "../dto/auth-response.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Register a new user
   */
  async signup(signupDto: SignupDto): Promise<AuthResponseDto> {
    const { email, password, tenant_name, phone_number } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const tenant = await this.prisma.tenants.create({
      data: {
        email: email,
        tenant_name: tenant_name,
        phone_number: phone_number,
      },
    });

    if (!tenant) {
      throw new BadRequestException("Failed to create tenant");
    }

    const business = await this.prisma.businesses.create({
      data: {
        business_name: tenant_name,
        tenant_id: tenant.tenant_id,
      },
    });

    const role = await this.prisma.roles.findMany();
    const adminRole = role.find((r) => r.role_name === "admin");

    if (!adminRole) {
      throw new BadRequestException("Admin role not found in system");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with proper business relation
    const user = await this.prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        name: tenant_name,
        phone_number: phone_number,
        business_id: business.business_id,
        role_id: adminRole.role_id,
        is_active: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      business_id: business.business_id,
      tenant_id: business.tenant_id,
      role_id: user.role_id,
    });

    // Store refresh token
    await this.updateRefreshToken(user.user_id, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        business_id: business.business_id,
        role_id: user.role_id,
        profile_completed: user.profile_completed || false,
      },
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.users.findUnique({
      where: { email },
      include: {
        businesses: {
          include: {
            tenants: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException("Account is inactive");
    }

    // Check if password exists
    if (!user.password) {
      throw new UnauthorizedException("Please set a password for your account");
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);

    console.log("Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      business_id: user.business_id,
      tenant_id: user.businesses.tenant_id,
      role_id: user.role_id,
    });

    // Store refresh token
    await this.updateRefreshToken(user.user_id, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        business_id: user.business_id,
        role_id: user.role_id,
        profile_completed: user.profile_completed || false,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });

      // Find user
      const user = await this.prisma.users.findUnique({
        where: { user_id: payload.user_id },
        include: {
          businesses: {
            include: {
              tenants: true,
            },
          },
        },
      });

      if (!user || !user.is_active) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Verify stored refresh token matches
      if (!user.refresh_token) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refresh_token
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = await this.generateTokens({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        business_id: user.business_id,
        tenant_id: user.businesses.tenant_id,
        role_id: user.role_id,
      });

      // Update refresh token
      await this.updateRefreshToken(user.user_id, tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          business_id: user.business_id,
          role_id: user.role_id,
          profile_completed: user.profile_completed || false,
        },
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { refresh_token: null },
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(payload: {
    user_id: string;
    email: string;
    name: string;
    business_id: string;
    tenant_id: string;
    role_id: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const accessExpiration =
      this.configService.get<string>("JWT_ACCESS_EXPIRATION") || "15m";
    const refreshExpiration =
      this.configService.get<string>("JWT_REFRESH_EXPIRATION") || "7d";

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessExpiration as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshExpiration as any,
      }),
    ]);

    return { access_token, refresh_token };
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   */
  private async comparePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Update refresh token in database
   */
  private async updateRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { refresh_token: hashedRefreshToken },
    });
  }
}
