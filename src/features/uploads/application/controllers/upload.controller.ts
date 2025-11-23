// import {
//   Controller,
//   Post,
//   Get,
//   Put,
//   Delete,
//   Body,
//   Param,
//   UseInterceptors,
//   UploadedFile,
//   UploadedFiles,
//   UseGuards,
//   Query,
//   BadRequestException,
// } from '@nestjs/common';
// import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
// import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
// import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
// import { UploadService } from '../services/upload.service';
// import {
//   UploadImageDto,
//   UpdateImageDto,
//   ImageResponseDto,
// } from '../dto/upload-image.dto';

// @ApiTags('uploads')
// @Controller('uploads')
// @UseGuards(JwtAuthGuard)
// export class UploadController {
//   constructor(private readonly uploadService: UploadService) {}

//   @Post('product-image')
//   @ApiOperation({ summary: 'Upload a single product image' })
//   @ApiConsumes('multipart/form-data')
//   @ApiBody({
//     schema: {
//       type: 'object',
//       required: ['file', 'business_id', 'product_id'],
//       properties: {
//         file: {
//           type: 'string',
//           format: 'binary',
//         },
//         business_id: { type: 'string' },
//         product_id: { type: 'string' },
//         alt_text: { type: 'string' },
//         display_order: { type: 'number' },
//         is_primary: { type: 'boolean' },
//       },
//     },
//   })
//   @UseInterceptors(FileInterceptor('file'))
//   async uploadSingleImage(
//     @UploadedFile() file: Express.Multer.File,
//     @Body() uploadData: UploadImageDto,
//   ): Promise<{ statusCode: number; message: string; data: ImageResponseDto }> {
//     if (!file) {
//       throw new BadRequestException('No file uploaded');
//     }

//     const image = await this.uploadService.uploadProductImage(file, uploadData);

//     return {
//       statusCode: 201,
//       message: 'Image uploaded successfully',
//       data: image,
//     };
//   }

//   @Post('product-images/multiple')
//   @ApiOperation({ summary: 'Upload multiple product images' })
//   @ApiConsumes('multipart/form-data')
//   @ApiBody({
//     schema: {
//       type: 'object',
//       required: ['files', 'business_id', 'product_id'],
//       properties: {
//         files: {
//           type: 'array',
//           items: {
//             type: 'string',
//             format: 'binary',
//           },
//         },
//         business_id: { type: 'string' },
//         product_id: { type: 'string' },
//         alt_text: { type: 'string' },
//         display_order: { type: 'number' },
//         is_primary: { type: 'boolean' },
//       },
//     },
//   })
//   @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
//   async uploadMultipleImages(
//     @UploadedFiles() files: Express.Multer.File[],
//     @Body() uploadData: UploadImageDto,
//   ): Promise<{
//     statusCode: number;
//     message: string;
//     data: ImageResponseDto[];
//   }> {
//     if (!files || files.length === 0) {
//       throw new BadRequestException('No files uploaded');
//     }

//     const images = await this.uploadService.uploadMultipleProductImages(
//       files,
//       uploadData,
//     );

//     return {
//       statusCode: 201,
//       message: `${images.length} image(s) uploaded successfully`,
//       data: images,
//     };
//   }

//   @Get('product/:productId/images')
//   @ApiOperation({ summary: 'Get all images for a product' })
//   async getProductImages(
//     @Param('productId') productId: string,
//   ): Promise<{
//     statusCode: number;
//     message: string;
//     data: ImageResponseDto[];
//   }> {
//     const images = await this.uploadService.getProductImages(productId);

//     return {
//       statusCode: 200,
//       message: 'Product images retrieved successfully',
//       data: images,
//     };
//   }

//   @Get('image/:imageId')
//   @ApiOperation({ summary: 'Get a single image by ID' })
//   async getImage(
//     @Param('imageId') imageId: string,
//   ): Promise<{ statusCode: number; message: string; data: ImageResponseDto }> {
//     const image = await this.uploadService.getImageById(imageId);

//     return {
//       statusCode: 200,
//       message: 'Image retrieved successfully',
//       data: image,
//     };
//   }

//   @Put('image/:imageId')
//   @ApiOperation({ summary: 'Update image metadata (alt text, order, primary)' })
//   async updateImage(
//     @Param('imageId') imageId: string,
//     @Body() updateData: UpdateImageDto,
//   ): Promise<{ statusCode: number; message: string; data: ImageResponseDto }> {
//     const image = await this.uploadService.updateImage(imageId, updateData);

//     return {
//       statusCode: 200,
//       message: 'Image updated successfully',
//       data: image,
//     };
//   }

//   @Delete('image/:imageId')
//   @ApiOperation({ summary: 'Delete an image' })
//   async deleteImage(
//     @Param('imageId') imageId: string,
//   ): Promise<{ statusCode: number; message: string }> {
//     await this.uploadService.deleteImage(imageId);

//     return {
//       statusCode: 200,
//       message: 'Image deleted successfully',
//     };
//   }

//   @Post('product/:productId/images/reorder')
//   @ApiOperation({ summary: 'Reorder product images' })
//   @ApiBody({
//     schema: {
//       type: 'object',
//       properties: {
//         imageOrders: {
//           type: 'array',
//           items: {
//             type: 'object',
//             properties: {
//               imageId: { type: 'string' },
//               order: { type: 'number' },
//             },
//           },
//         },
//       },
//     },
//   })
//   async reorderImages(
//     @Param('productId') productId: string,
//     @Body('imageOrders') imageOrders: { imageId: string; order: number }[],
//   ): Promise<{ statusCode: number; message: string }> {
//     await this.uploadService.reorderImages(productId, imageOrders);

//     return {
//       statusCode: 200,
//       message: 'Images reordered successfully',
//     };
//   }
// }
