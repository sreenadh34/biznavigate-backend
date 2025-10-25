import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsUUID,
  IsPhoneNumber,
  IsOptional,
} from "class-validator";

export class SignupDto {
  @ApiProperty({
    description: "Tenant name",
    example: "Acme Corporation",
  })
  @IsString()
  @IsNotEmpty()
  tenant_name: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "User password (minimum 6 characters)",
    example: "SecurePassword123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: "User full name",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({
    description: "User phone number",
    example: "+1234567890",
  })
  // @IsPhoneNumber()
  @IsNotEmpty()
  phone_number: string;
}
