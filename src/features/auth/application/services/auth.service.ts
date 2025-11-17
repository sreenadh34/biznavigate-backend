import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
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
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  /**
   * Register a new user
   */
  async signup(signupDto: SignupDto): Promise<AuthResponseDto> {
    const { email, password, tenant_name, phone_number } = signupDto;

    console.log('[SIGNUP] Starting signup process for:', email);

    // Check if user already exists (outside transaction for performance)
    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }
    console.log('[SIGNUP] User check passed');

    // Find admin role outside transaction (read-only, no need to lock)
    const roles = await this.prisma.roles.findMany();
    console.log('[SIGNUP] Found roles:', roles.map(r => r.role_name));
    const adminRole = roles.find((r) => r.role_name.toUpperCase() === "ADMIN");

    if (!adminRole) {
      throw new BadRequestException("Admin role not found in system");
    }
    console.log('[SIGNUP] Admin role found:', adminRole.role_id);

    // Hash password before transaction (CPU-intensive, no DB access)
    const hashedPassword = await this.hashPassword(password);
    console.log('[SIGNUP] Password hashed');

    try {
      // Execute all database writes in a single atomic transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create tenant
        const tenant = await tx.tenants.create({
          data: {
            email: email,
            tenant_name: tenant_name,
            phone_number: phone_number,
          },
        });
        console.log('[SIGNUP] Tenant created:', tenant.tenant_id);

        // 2. Create business linked to tenant
        const business = await tx.businesses.create({
          data: {
            business_name: tenant_name,
            tenant_id: tenant.tenant_id,
          },
        });
        console.log('[SIGNUP] Business created:', business.business_id);

        // 3. Create user linked to business
        const user = await tx.users.create({
          data: {
            email,
            password: hashedPassword,
            name: tenant_name,
            phone_number: phone_number,
            business_id: business.business_id,
            role_id: adminRole.role_id,
            is_active: true,
            last_password_change: new Date(),
            email_verified: false, // TODO: Implement email verification
            failed_login_attempts: 0,
          },
        });
        console.log('[SIGNUP] User created:', user.user_id);

        return { tenant, business, user };
      });

      // Generate tokens (outside transaction - no DB write risk)
      const tokens = await this.generateTokens({
        user_id: result.user.user_id,
        email: result.user.email,
        name: result.user.name,
        business_id: result.business.business_id,
        tenant_id: result.business.tenant_id,
        role_id: result.user.role_id,
      });
      console.log('[SIGNUP] Tokens generated');

      // Store refresh token (separate operation, can retry if fails)
      await this.updateRefreshToken(result.user.user_id, tokens.refresh_token);
      console.log('[SIGNUP] Refresh token stored');

      // Pre-populate cache with is_active = true to prevent race conditions
      const cacheKey = `user:${result.user.user_id}:active`;
      await this.cacheManager.set(cacheKey, true, 300000); // 5 minutes TTL
      console.log('[SIGNUP] Cache initialized with is_active = true');

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          user_id: result.user.user_id,
          email: result.user.email,
          name: result.user.name,
          business_id: result.business.business_id,
          role_id: result.user.role_id,
          profile_completed: result.user.profile_completed || false,
        },
      };
    } catch (error) {
      console.error('[SIGNUP] Error occurred:', error.message);
      console.error('[SIGNUP] Error stack:', error.stack);

      // If error is already a NestJS exception, rethrow it
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      // Otherwise wrap in BadRequestException
      throw new BadRequestException(
        `Signup failed: ${error.message || "Unknown error"}`
      );
    }
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

    console.log("User found during login:", user);

    if (!user) {
      throw new UnauthorizedException("User not found");
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
      // Increment failed login attempts
      await this.prisma.users.update({
        where: { user_id: user.user_id },
        data: {
          failed_login_attempts: (user.failed_login_attempts || 0) + 1,
          // Lock account after 5 failed attempts for 15 minutes
          account_locked_until:
            (user.failed_login_attempts || 0) + 1 >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : undefined,
        },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      const minutesLeft = Math.ceil(
        (user.account_locked_until.getTime() - Date.now()) / 60000
      );
      throw new UnauthorizedException(
        `Account is locked due to multiple failed login attempts. Please try again in ${minutesLeft} minutes.`
      );
    }

    // Validate business and tenant relationship
    if (!user.businesses || !user.businesses.tenant_id) {
      throw new UnauthorizedException("User business configuration is invalid");
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

    // Store refresh token and update security fields
    await this.updateRefreshToken(user.user_id, tokens.refresh_token);

    // Update last login and reset failed attempts
    await this.prisma.users.update({
      where: { user_id: user.user_id },
      data: {
        last_login_at: new Date(),
        failed_login_attempts: 0,
        account_locked_until: null,
      },
    });

    // Pre-populate cache with is_active = true to prevent race conditions
    const cacheKey = `user:${user.user_id}:active`;
    await this.cacheManager.set(cacheKey, true, 300000); // 5 minutes TTL
    console.log('[LOGIN] Cache initialized with is_active = true');

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

      // Pre-populate cache with is_active = true to prevent race conditions
      const cacheKey = `user:${user.user_id}:active`;
      await this.cacheManager.set(cacheKey, true, 300000); // 5 minutes TTL
      console.log('[REFRESH] Cache initialized with is_active = true');

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
   * Logout user (invalidate refresh token and clear cache)
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { refresh_token: null },
    });

    // Clear user cache to force revalidation on next request
    await this.clearUserCache(userId);
  }

  /**
   * Clear user cache (call this when user status changes)
   */
  private async clearUserCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:active`;
    await this.cacheManager.del(cacheKey);
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
