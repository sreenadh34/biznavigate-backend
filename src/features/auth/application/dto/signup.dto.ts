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
import { IsStrongPassword } from "../../../../common/validators/password.validator";

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
    description: "User password (minimum 12 characters, must contain uppercase, lowercase, number, and special character)",
    example: "SecureP@ssw0rd123",
    minLength: 12,
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
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
