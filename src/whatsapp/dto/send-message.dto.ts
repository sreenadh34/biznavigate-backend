import { IsNotEmpty, IsString, IsOptional } from "class-validator";
import { from } from "rxjs";

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  from: string;

  @IsNotEmpty()
  @IsString()
  to: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  businessId?: string;
}
