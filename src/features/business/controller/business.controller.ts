import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";

import { CreateBusinessDto } from "../application/dto/create-business.dto";
import { UpdateBusinessDto } from "../application/dto/update-business.dto";
import { BusinessesService } from "../application/business.service";

@ApiTags("Businesses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Get("tenant/:tenant_id")
  findByTenant(@Param("tenant_id") tenant_id: string) {
    return this.service.findByTenant(tenant_id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBusinessDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
