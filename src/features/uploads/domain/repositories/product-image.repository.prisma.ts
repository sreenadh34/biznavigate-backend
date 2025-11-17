import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { product_images } from '@prisma/client';

export interface CreateProductImageData {
  product_id: string;
  business_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  storage_type?: string;
  width?: number;
  height?: number;
  alt_text?: string;
  display_order?: number;
  is_primary?: boolean;
}

export interface UpdateProductImageData {
  alt_text?: string;
  display_order?: number;
  is_primary?: boolean;
}

@Injectable()
export class ProductImageRepositoryPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductImageData): Promise<product_images> {
    // If setting as primary, unset other primary images for this product
    if (data.is_primary) {
      await this.prisma.product_images.updateMany({
        where: {
          product_id: data.product_id,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    }

    return this.prisma.product_images.create({
      data: {
        ...data,
        storage_type: data.storage_type || 'local',
        display_order: data.display_order || 0,
        is_primary: data.is_primary || false,
      },
    });
  }

  async findById(imageId: string): Promise<product_images | null> {
    return this.prisma.product_images.findUnique({
      where: { image_id: imageId },
    });
  }

  async findByProductId(productId: string): Promise<product_images[]> {
    return this.prisma.product_images.findMany({
      where: { product_id: productId },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async findPrimaryImage(productId: string): Promise<product_images | null> {
    return this.prisma.product_images.findFirst({
      where: {
        product_id: productId,
        is_primary: true,
      },
    });
  }

  async update(
    imageId: string,
    data: UpdateProductImageData,
  ): Promise<product_images> {
    const image = await this.findById(imageId);

    if (!image) {
      throw new Error('Image not found');
    }

    // If setting as primary, unset other primary images for this product
    if (data.is_primary) {
      await this.prisma.product_images.updateMany({
        where: {
          product_id: image.product_id,
          is_primary: true,
          image_id: { not: imageId },
        },
        data: {
          is_primary: false,
        },
      });
    }

    return this.prisma.product_images.update({
      where: { image_id: imageId },
      data,
    });
  }

  async delete(imageId: string): Promise<product_images> {
    return this.prisma.product_images.delete({
      where: { image_id: imageId },
    });
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.prisma.product_images.deleteMany({
      where: { product_id: productId },
    });
  }

  async reorder(productId: string, imageOrders: { imageId: string; order: number }[]): Promise<void> {
    await this.prisma.$transaction(
      imageOrders.map(({ imageId, order }) =>
        this.prisma.product_images.update({
          where: { image_id: imageId },
          data: { display_order: order },
        }),
      ),
    );
  }
}
