import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CUSTOM_REQUEST_SOURCES,
  CUSTOM_REQUEST_STATUSES,
  MODEL_DELIVERABLES,
  PRODUCT_TYPES,
  PROPOSAL_STATUSES,
  STORES,
} from '../../integrations/database/database.schema';
import type {
  CustomRequestSource,
  CustomRequestStatus,
  ModelDeliverable,
  ProductType,
  ProposalStatus,
  Store,
} from '../../integrations/database/database.schema';
import { StorePageQueryDto } from '../../shared/store/store.query.dto';
import { ImageAssetDto } from '../../shared/media/image.asset.dto';
import { JewelrySpecificationDto } from '../../shared/specification/jewelry.specification.dto';
import { SpecificationChoiceDto } from '../../shared/specification/jewelry.specification.dto';
import { ImageDto } from '../catalog/dto/collection.dto';
import { RevisionTermsDto } from '../orders/dto/order.dto';
import { PRINT_FINISHES } from '../prints/print.settings';
import type { PrintFinish } from '../prints/print.settings';
import { OrderContactDto } from '../orders/dto/checkout.dto';
import { SelectedOptionDto } from '../storefront/storefront.dto';

/** A Gripr Lab model to design; ids are resolved to name snapshots. */
export class LabSpecificationInputDto {
  @ApiProperty({ enum: MODEL_DELIVERABLES })
  @IsIn(MODEL_DELIVERABLES)
  deliverable: ModelDeliverable;

  /** Printed height in mm; also the scale the file is modeled for. */
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1000)
  heightMm?: number;

  /** Resin to print in; omit to let the workshop recommend one. */
  @IsOptional()
  @IsUUID()
  resinId?: string;

  @IsOptional()
  @ApiProperty({ enum: PRINT_FINISHES, required: false })
  @IsIn(PRINT_FINISHES)
  finish?: PrintFinish;

  @IsOptional()
  @IsBoolean()
  painted?: boolean;

  /** A base code from `GET /storefront/print-options`. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  baseCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  /** The customer's own model file to start from or fix. */
  @IsOptional()
  @IsUUID()
  sourceFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comments?: string;
}

export class LabSpecificationBaseDto {
  code: string;
  name: string;
}

export class LabSpecificationFileDto {
  id: string;
  name: string;
}

/** Print fields are empty when only the file is delivered. */
export class LabSpecificationDto {
  @ApiProperty({ enum: MODEL_DELIVERABLES })
  deliverable: ModelDeliverable;
  heightMm: number | null;
  @ApiProperty({ type: SpecificationChoiceDto, nullable: true })
  resin: SpecificationChoiceDto | null;
  @ApiProperty({ enum: PRINT_FINISHES, nullable: true })
  finish: PrintFinish | null;
  painted: boolean;
  @ApiProperty({ type: LabSpecificationBaseDto, nullable: true })
  base: LabSpecificationBaseDto | null;
  quantity: number;
  @ApiProperty({ type: LabSpecificationFileDto, nullable: true })
  sourceFile: LabSpecificationFileDto | null;
  comments: string | null;
}

export class CreateCustomRequestDto {
  /** Store the request is for; defaults to `gripr`. */
  @IsOptional()
  @ApiProperty({ enum: STORES, required: false })
  @IsIn(STORES)
  store?: Store;

  /**
   * A jewelry type for Gripr, a print type for Gripr Lab. Ignored for
   * customizations, which take the type of the product.
   */
  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  productType: ProductType;

  /** What the customer wants: idea, style, occasion, or changes to make. */
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  /** Images uploaded with `POST /customers/me/uploads/signature`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ImageAssetDto)
  referenceImages?: ImageAssetDto[];

  /** In kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  /** In kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  /** Free-text metal wish from the legacy form. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  desiredMetal?: string;

  /** Legacy ring size field; use `specification.size` instead. */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(30)
  ringSize?: number;

  /** Structured wishes: metal, stones, size, engraving, coating, timeline. */
  @IsOptional()
  @ValidateNested()
  @Type(() => JewelrySpecificationDto)
  specification?: JewelrySpecificationDto;

  /** Required for Gripr Lab; not accepted for Gripr. */
  @IsOptional()
  @ValidateNested()
  @Type(() => LabSpecificationInputDto)
  labSpecification?: LabSpecificationInputDto;

  /** Published Gripr catalog product to customize. */
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Configurator selection the customization starts from. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionValueIds?: string[];
}

/** Legacy quote fields; mirrors the latest proposal for older clients. */
export class CustomRequestQuoteDto {
  title: string | null;
  /** In kopiykas. */
  price: number | null;
  /** In kopiykas; paid first, the remainder later. */
  depositAmount: number | null;
  productionDaysMin: number | null;
  productionDaysMax: number | null;
  note: string | null;
}

export class CustomProposalDto {
  id: string;
  version: number;
  @ApiProperty({ enum: PROPOSAL_STATUSES })
  status: ProposalStatus;
  title: string;
  /** Gripr proposals. */
  @ApiProperty({ type: JewelrySpecificationDto, nullable: true })
  specification: JewelrySpecificationDto | null;
  /** Gripr Lab proposals. */
  @ApiProperty({ type: LabSpecificationDto, nullable: true })
  labSpecification: LabSpecificationDto | null;
  /** Gripr Lab: modeling hours `modelPrice` was calculated from. */
  modelingHours: number | null;
  /** Gripr Lab: revisions included in the price and the price of more. */
  @ApiProperty({ type: RevisionTermsDto, nullable: true })
  revisionTerms: RevisionTermsDto | null;
  requiresModel: boolean;
  /** 3D modeling price, paid first. */
  modelPrice: number;
  /** Price of the finished piece. */
  productPrice: number;
  /** Part of `productPrice` due before manufacturing starts. */
  productionPrepayment: number;
  /** `modelPrice + productPrice`. */
  totalPrice: number;
  productionDaysMin: number;
  productionDaysMax: number;
  note: string | null;
  /** Customer's change request for this version. */
  customerResponse: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

export class CustomRequestProductDto {
  id: string | null;
  slug: string | null;
  name: string;
}

export class CustomRequestDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  @ApiProperty({ enum: CUSTOM_REQUEST_STATUSES })
  status: CustomRequestStatus;
  /** `customization` requests modify a catalog product. */
  @ApiProperty({ enum: CUSTOM_REQUEST_SOURCES })
  source: CustomRequestSource;
  /** Catalog product of a customization request. */
  product: CustomRequestProductDto | null;
  /** Configuration of the product the customization starts from. */
  baseOptions: SelectedOptionDto[];
  @ApiProperty({ enum: PRODUCT_TYPES })
  productType: ProductType;
  description: string;
  referenceImages: ImageDto[];
  budgetMin: number | null;
  budgetMax: number | null;
  desiredMetal: string | null;
  ringSize: number | null;
  /** Original customer request; never changed by the workshop. */
  @ApiProperty({ type: JewelrySpecificationDto, nullable: true })
  specification: JewelrySpecificationDto | null;
  /** Gripr Lab: the original model request; never changed by the workshop. */
  @ApiProperty({ type: LabSpecificationDto, nullable: true })
  labSpecification: LabSpecificationDto | null;
  /** Present once the request is quoted. */
  quote: CustomRequestQuoteDto | null;
  /** Latest proposal, if any. */
  @ApiProperty({ type: CustomProposalDto, nullable: true })
  proposal: CustomProposalDto | null;
  /** All proposal versions, newest first. */
  proposals: CustomProposalDto[];
  /** The order created when the proposal was approved. */
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomRequestPageDto {
  @ApiProperty({ type: [CustomRequestDto] })
  items: CustomRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CustomRequestCustomerDto {
  id: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export class AdminCustomRequestDto extends CustomRequestDto {
  adminNote: string | null;
  customer: CustomRequestCustomerDto;
}

export class AdminCustomRequestPageDto {
  @ApiProperty({ type: [AdminCustomRequestDto] })
  items: AdminCustomRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminCustomRequestListQueryDto extends StorePageQueryDto {
  @IsOptional()
  @ApiProperty({ enum: CUSTOM_REQUEST_STATUSES, required: false })
  @IsIn(CUSTOM_REQUEST_STATUSES)
  status?: CustomRequestStatus;

  @IsOptional()
  @ApiProperty({ enum: CUSTOM_REQUEST_SOURCES, required: false })
  @IsIn(CUSTOM_REQUEST_SOURCES)
  source?: CustomRequestSource;
}

export class UpdateCustomRequestDto {
  @IsOptional()
  @ApiProperty({ enum: ['in_review', 'rejected'], required: false })
  @IsIn(['in_review', 'rejected'])
  status?: 'in_review' | 'rejected';

  /** Internal note, never shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNote?: string;
}

export class CreateProposalDto {
  /** Order item name, e.g. `Каблучка з сапфіром на замовлення`. */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  /** Final proposed specification; required for Gripr. */
  @IsOptional()
  @ValidateNested()
  @Type(() => JewelrySpecificationDto)
  specification?: JewelrySpecificationDto;

  /** Final proposed model; required for Gripr Lab. */
  @IsOptional()
  @ValidateNested()
  @Type(() => LabSpecificationInputDto)
  labSpecification?: LabSpecificationInputDto;

  /**
   * `false` skips the 3D model stage, e.g. for small customizations. Gripr
   * Lab proposals always include a model.
   */
  @IsBoolean()
  requiresModel: boolean;

  /**
   * Estimated modeling hours; `modelPrice` is then calculated from the
   * hourly rate in the print settings.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(1000)
  modelingHours?: number;

  /**
   * 3D modeling price in kopiykas; ignored without a model or with
   * `modelingHours`, otherwise required with a model.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  modelPrice?: number;

  /**
   * Price of the finished piece in kopiykas: at least 1, or 0 when a Gripr
   * Lab model is delivered only as a file.
   */
  @IsInt()
  @Min(0)
  productPrice: number;

  /** Part of the product price due before manufacturing, in kopiykas. */
  @IsInt()
  @Min(0)
  productionPrepayment: number;

  @IsInt()
  @Min(1)
  productionDaysMin: number;

  @IsInt()
  @Min(1)
  productionDaysMax: number;

  /** Explanation shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class RequestProposalChangesDto {
  /** What should change in the proposal or model. */
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  comment: string;
}

export class AcceptCustomRequestDto extends OrderContactDto {}
