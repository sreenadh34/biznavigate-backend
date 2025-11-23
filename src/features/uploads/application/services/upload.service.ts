// import {
//   Injectable,
//   BadRequestException,
//   NotFoundException,
//   InternalServerErrorException,
// } from '@nestjs/common';
// import { ConfigService} from '@nestjs/config';
// import * as fs from 'fs/promises';
// import * as path from 'path';
// import * as sharp from 'sharp';
// import { ProductImageRepositoryPrisma } from '../../domain/repositories/product-image.repository.prisma';
// import { ImageResponseDto, UploadImageDto, UpdateImageDto } from '../dto/upload-image.dto';

// @Injectable()
// export class UploadService {
//   private readonly uploadDir: string;
//   private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
//   private readonly allowedMimeTypes = [
//     'image/jpeg',
//     'image/jpg',
//     'image/png',
//     'image/webp',
//     'image/gif',
//   ];

//   constructor(
//     private readonly imageRepository: ProductImageRepositoryPrisma,
//     private readonly configService: ConfigService,
//   ) {
//     this.uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
//     this.ensureUploadDir();
//   }

//   private async ensureUploadDir() {
//     try {
//       await fs.access(this.uploadDir);
//     } catch {
//       await fs.mkdir(this.uploadDir, { recursive: true });
//     }
//   }

//   async uploadProductImage(
//     file: Express.Multer.File,
//     uploadData: UploadImageDto,
//   ): Promise<ImageResponseDto> {
//     // Validate file
//     this.validateFile(file);

//     // Generate unique filename
//     const timestamp = Date.now();
//     const randomString = Math.random().toString(36).substring(7);
//     const ext = path.extname(file.originalname);
//     const filename = `${uploadData.product_id}_${timestamp}_${randomString}${ext}`;
//     const filepath = path.join(this.uploadDir, filename);

//     try {
//       // Process and save image
//       const metadata = await this.processAndSaveImage(file.buffer, filepath);

//       // Save to database
//       const image = await this.imageRepository.create({
//         product_id: uploadData.product_id,
//         business_id: uploadData.business_id,
//         file_name: filename,
//         file_path: `uploads/products/${filename}`,
//         file_size: file.size,
//         mime_type: file.mimetype,
//         storage_type: 'local',
//         width: metadata.width,
//         height: metadata.height,
//         alt_text: uploadData.alt_text,
//         display_order: uploadData.display_order || 0,
//         is_primary: uploadData.is_primary || false,
//       });

//       return this.toResponseDto(image);
//     } catch (error) {
//       // Clean up file if database save fails
//       try {
//         await fs.unlink(filepath);
//       } catch {}

//       throw new InternalServerErrorException(
//         `Failed to upload image: ${error.message}`,
//       );
//     }
//   }

//   async uploadMultipleProductImages(
//     files: Express.Multer.File[],
//     uploadData: UploadImageDto,
//   ): Promise<ImageResponseDto[]> {
//     const uploadedImages: ImageResponseDto[] = [];

//     for (let i = 0; i < files.length; i++) {
//       const file = files[i];
//       const imageData = {
//         ...uploadData,
//         display_order: (uploadData.display_order || 0) + i,
//         is_primary: i === 0 && (uploadData.is_primary || false),
//       };

//       try {
//         const image = await this.uploadProductImage(file, imageData);
//         uploadedImages.push(image);
//       } catch (error) {
//         // Continue with other uploads even if one fails
//         console.error(`Failed to upload file ${file.originalname}:`, error);
//       }
//     }

//     return uploadedImages;
//   }

//   async getProductImages(productId: string): Promise<ImageResponseDto[]> {
//     const images = await this.imageRepository.findByProductId(productId);
//     return images.map((img) => this.toResponseDto(img));
//   }

//   async getImageById(imageId: string): Promise<ImageResponseDto> {
//     const image = await this.imageRepository.findById(imageId);
//     if (!image) {
//       throw new NotFoundException('Image not found');
//     }
//     return this.toResponseDto(image);
//   }

//   async updateImage(
//     imageId: string,
//     updateData: UpdateImageDto,
//   ): Promise<ImageResponseDto> {
//     const image = await this.imageRepository.update(imageId, updateData);
//     return this.toResponseDto(image);
//   }

//   async deleteImage(imageId: string): Promise<void> {
//     const image = await this.imageRepository.findById(imageId);
//     if (!image) {
//       throw new NotFoundException('Image not found');
//     }

//     // Delete file from filesystem
//     const filepath = path.join(process.cwd(), 'public', image.file_path);
//     try {
//       await fs.unlink(filepath);
//     } catch (error) {
//       console.error(`Failed to delete file: ${filepath}`, error);
//     }

//     // Delete from database
//     await this.imageRepository.delete(imageId);
//   }

//   async reorderImages(
//     productId: string,
//     imageOrders: { imageId: string; order: number }[],
//   ): Promise<void> {
//     await this.imageRepository.reorder(productId, imageOrders);
//   }

//   private validateFile(file: Express.Multer.File): void {
//     if (!file) {
//       throw new BadRequestException('No file provided');
//     }

//     if (file.size > this.maxFileSize) {
//       throw new BadRequestException(
//         `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
//       );
//     }

//     if (!this.allowedMimeTypes.includes(file.mimetype)) {
//       throw new BadRequestException(
//         `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
//       );
//     }
//   }

//   private async processAndSaveImage(
//     buffer: Buffer,
//     filepath: string,
//   ): Promise<{ width: number; height: number }> {
//     try {
//       // Process image with sharp (resize, optimize, convert to WebP)
//       const image = sharp(buffer);
//       const metadata = await image.metadata();

//       // Resize if too large (max 2000px width)
//       let processedImage = image;
//       if (metadata.width && metadata.width > 2000) {
//         processedImage = image.resize(2000, null, {
//           fit: 'inside',
//           withoutEnlargement: true,
//         });
//       }

//       // Save as WebP for better compression (or keep original format)
//       await processedImage
//         .webp({ quality: 85 })
//         .toFile(filepath.replace(/\.[^.]+$/, '.webp'));

//       const finalMetadata = await sharp(filepath.replace(/\.[^.]+$/, '.webp')).metadata();

//       return {
//         width: finalMetadata.width || 0,
//         height: finalMetadata.height || 0,
//       };
//     } catch (error) {
//       // If webp conversion fails, save original
//       await fs.writeFile(filepath, buffer);
//       const metadata = await sharp(buffer).metadata();
//       return {
//         width: metadata.width || 0,
//         height: metadata.height || 0,
//       };
//     }
//   }

//   private toResponseDto(image: any): ImageResponseDto {
//     const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3006';
//     return {
//       image_id: image.image_id,
//       product_id: image.product_id,
//       file_name: image.file_name,
//       file_path: image.file_path,
//       file_url: `${baseUrl}/${image.file_path}`,
//       file_size: image.file_size,
//       mime_type: image.mime_type,
//       width: image.width,
//       height: image.height,
//       alt_text: image.alt_text,
//       display_order: image.display_order,
//       is_primary: image.is_primary,
//       storage_type: image.storage_type,
//       created_at: image.created_at,
//       updated_at: image.updated_at,
//     };
//   }
// }
