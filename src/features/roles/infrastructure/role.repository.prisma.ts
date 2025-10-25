import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

export interface RolePermissions {
  [key: string]: boolean | undefined;
  view?: boolean;
  edit?: boolean;
  create?: boolean;
  delete?: boolean;
}

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRole(role_name: string, permissions?: RolePermissions) {
    try {
      const existingRole = await this.prisma.roles.findUnique({
        where: { role_name },
      });

      if (existingRole) {
        throw new BadRequestException("Role with this name already exists");
      }

      return await this.prisma.roles.create({
        data: {
          role_name,
          permissions: permissions || {
            view: true,
            create: true,
            edit: true,
            delete: false,
          },
        },
      });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async updateRole(
    role_id: string,
    role_name?: string,
    permissions?: RolePermissions
  ) {
    try {
      return await this.prisma.roles.update({
        where: { role_id },
        data: { role_name, permissions },
      });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async assignIntent(role_id: string, intent_id: string) {
    try {
      return await this.prisma.role_intents.create({
        data: { role_id, intent_id },
      });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async getRoleById(role_id: string) {
    try {
      return await this.prisma.roles.findUnique({ where: { role_id } });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async getRoleByName(role_name: string) {
    try {
      return await this.prisma.roles.findUnique({ where: { role_name } });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async getAllRoles() {
    try {
      return await this.prisma.roles.findMany();
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async getRolePermissions(role_id: string): Promise<RolePermissions> {
    try {
      const role = await this.prisma.roles.findUnique({ where: { role_id } });
      if (!role) return {};
      const perms = role.permissions;
      if (typeof perms === "string") {
        try {
          const parsed = JSON.parse(perms);
          return typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? parsed
            : {};
        } catch {
          return {};
        }
      }
      return typeof perms === "object" && perms !== null
        ? (perms as RolePermissions)
        : {};
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async getRolesByIntentId(intent_id: string) {
    try {
      return await this.prisma.role_intents.findMany({ where: { intent_id } });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async createNotification(
    user_id: string,
    intent_id: string,
    message: string
  ) {
    try {
      return await this.prisma.notifications.create({
        data: { user_id, intent_id, message, read_status: false },
      });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async findIntentByName(intent_name: string) {
    try {
      return await this.prisma.intents.findFirst({ where: { intent_name } });
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }
}
