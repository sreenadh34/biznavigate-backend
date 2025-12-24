import { IsBoolean, IsArray, IsUUID, IsOptional } from 'class-validator';

export class ToggleProductInCatalogDto {
  @IsUUID()
  productId: string;

  @IsBoolean()
  inCatalog: boolean;
}

export class BulkToggleCatalogDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds: string[];

  @IsBoolean()
  inCatalog: boolean;
}

export class SyncCatalogDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}
