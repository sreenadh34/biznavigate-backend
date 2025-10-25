import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ Create a user
  async createUser(data: CreateUserDto) {
    return await this.prisma.users.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        phone_number: data.phone_number,
        businesses: { connect: { business_id: data.business_id } },
        roles: { connect: { role_id: data.role_id } },
        is_active: data.is_active ?? true,
      },
      include: { businesses: true },
    });
  }

  // ✅ Update user details
  async updateUser(user_id: string, data: UpdateUserDto) {
    const updateData: any = {
      name: data.name,
      email: data.email,
      is_active: data.is_active,
    };

    if (data.role_id) {
      updateData.role_id = data.role_id; // <-- use scalar field
    }

    return await this.prisma.users.update({
      where: { user_id },
      data: updateData,
      include: { businesses: true },
    });
  }

  // ✅ Assign a new role to a user
  async assignRole(user_id: string, role_id: string) {
    return await this.prisma.users.update({
      where: { user_id },
      data: { role_id }, // <-- use scalar field
      include: { businesses: true },
    });
  }

  // ✅ Get user by ID
  async getUserById(user_id: string) {
    return await this.prisma.users.findUnique({
      where: { user_id },
      include: { businesses: true },
    });
  }

  // ✅ Get all users (optionally by business)
  async getAllUsers(business_id?: string) {
    return await this.prisma.users.findMany({
      where: business_id ? { business_id } : undefined,
      include: { businesses: true },
    });
  }

  // ✅ Get users by Role (for notify intents etc.)
  async getUsersByRole(role_id: string, business_id?: string) {
    return await this.prisma.users.findMany({
      where: {
        role_id,
        ...(business_id && { business_id }),
      },
      include: { businesses: true },
    });
  }
}
