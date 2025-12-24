import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { UsersRepository } from "./infrastructure/users.repository.prisma";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { PrismaService } from "../../../prisma/prisma.service";
import { UpdateProfileDto } from "../application/dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  async createUser(dto: CreateUserDto) {
    try {
      return await this.repo.createUser(dto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateUser(user_id: string, dto: UpdateUserDto) {
    try {
      const user = await this.repo.getUserById(user_id);
      if (!user) throw new NotFoundException("User not found");

      const updatedUser = await this.repo.updateUser(user_id, dto);

      // Clear the user cache after update to refresh is_active status
      // This is critical if is_active field was changed
      const cacheKey = `user:${user_id}:active`;
      await this.cacheManager.del(cacheKey);

      return updatedUser;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async assignRole(dto: AssignRoleDto) {
    try {
      const user = await this.repo.getUserById(dto.user_id);
      if (!user) throw new NotFoundException("User not found");
      return await this.repo.assignRole(dto.user_id, dto.role_id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getUserById(user_id: string) {
    try {
      return await this.repo.getUserById(user_id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getAllUsers() {
    try {
      return await this.repo.getAllUsers();
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateProfile(user_id: string, dto: UpdateProfileDto) {
    try {
      // Get user to find their business_id and verify is_active status
      const user = await this.prisma.users.findUnique({
        where: { user_id },
        select: { business_id: true, is_active: true },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Update business profile fields if provided
      if (
        dto.whatsapp_number ||
        dto.business_type ||
        dto.logo_url ||
        dto.working_hours
      ) {
        await this.prisma.businesses.update({
          where: { business_id: user.business_id },
          data: {
            whatsapp_number: dto.whatsapp_number,
            business_type: dto.business_type,
            logo_url: dto.logo_url,
            working_hours: dto.working_hours,
            updated_at: new Date(),
          },
        });
      }

      // Update user profile_completed status and ensure is_active is true
      const updatedUser = await this.prisma.users.update({
        where: { user_id },
        data: {
          profile_completed: dto.profile_completed,
          is_active: true, // Ensure user is active
        },
      });

      // Clear the user cache after profile update to refresh is_active status
      const cacheKey = `user:${user_id}:active`;
      await this.cacheManager.del(cacheKey);

      return {
        message: "Profile updated successfully",
        profile_completed: updatedUser.profile_completed,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
