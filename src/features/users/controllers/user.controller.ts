import { Controller, Post, Body, Param, Patch, Get, UseGuards, Request } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { UsersService } from "../applications/user.service";
import { CreateUserDto } from "../applications/dto/create-user.dto";
import { UpdateUserDto } from "../applications/dto/update-user.dto";
import { AssignRoleDto } from "../applications/dto/assign-role.dto";
import { UpdateProfileDto } from "../application/dto/update-profile.dto";

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post("create")
  createUser(@Body() dto: CreateUserDto) {
    return this.service.createUser(dto);
  }

  @Patch("update/:user_id")
  updateUser(@Param("user_id") user_id: string, @Body() dto: UpdateUserDto) {
    return this.service.updateUser(user_id, dto);
  }

  @Patch("assign-role")
  assignRole(@Body() dto: AssignRoleDto) {
    return this.service.assignRole(dto);
  }

  @Get(":user_id")
  getUser(@Param("user_id") user_id: string) {
    return this.service.getUserById(user_id);
  }

  @Get()
  getAllUsers() {
    return this.service.getAllUsers();
  }

  @Patch("profile")
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(req.user.user_id, dto);
  }
}
