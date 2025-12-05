import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RespondReviewDto {
  @IsNotEmpty()
  @IsString()
  response_text: string;

  @IsNotEmpty()
  @IsUUID()
  responded_by: string;
}
