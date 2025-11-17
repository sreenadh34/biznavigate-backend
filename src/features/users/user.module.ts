import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { UsersService } from "./applications/user.service";
import { UsersRepository } from "./applications/infrastructure/users.repository.prisma";
import { UsersController } from "./controllers/user.controller";


@Module({
  imports: [CacheModule.register()],
  providers: [UsersService, UsersRepository],
  controllers: [UsersController],
})
export class UsersModule {}
