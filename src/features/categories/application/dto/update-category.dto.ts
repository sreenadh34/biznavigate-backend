import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/**
 * DTO for updating a category
 * All fields are optional
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
