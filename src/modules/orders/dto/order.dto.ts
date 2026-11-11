import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  MODEL_DELIVERABLES,
  ORDER_ITEM_KINDS,
  ORDER_KINDS,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PRODUCTION_STEP_STATES,
  STORES,
} from '../../../integrations/database/database.schema';
import type {
  ModelDeliverable,
  OrderItemKind,
  OrderKind,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  ProductionStepState,
  Store,
} from '../../../integrations/database/database.schema';
import { ImageDto } from '../../catalog/dto/collection.dto';
import { SelectedOptionDto } from '../../storefront/storefront.dto';
import { JewelrySpecificationDto } from '../../../shared/specification/jewelry.specification.dto';
import type { NextPayment } from '../order.balance';
import { REVISION_KINDS } from '../order.modeling';
import type { RevisionKind } from '../order.modeling';

export class ProductionStageSummaryDto {
  id: string;
  code: string;
  name: string;
  /** Customer-facing explanation of the stage. */
  description: string | null;
}

export class ProductionStepDto {
  id: string;
  stage: ProductionStageSummaryDto;
  @ApiProperty({ enum: PRODUCTION_STEP_STATES })
  state: ProductionStepState;
  note: string | null;
  images: ImageDto[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export class AdminProductionStepDto extends ProductionStepDto {
  visibleToCustomer: boolean;
  sortOrder: number;
}

export class OrderItemDto {
  id: string;
  /** `print` lines are the customer's Lab models (`printRequestId`). */
  @ApiProperty({ enum: ORDER_ITEM_KINDS })
  itemKind: OrderItemKind;
  printRequestId: string | null;
  productId: string | null;
  productSlug: string | null;
  productName: string;
  imageUrl: string | null;
  selectedOptions: SelectedOptionDto[];
  engravingText: string | null;
  /** Approved specification of a custom piece. */
  @ApiProperty({ type: JewelrySpecificationDto, nullable: true })
  specification: JewelrySpecificationDto | null;
  fromStock: boolean;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  productionDaysMin: number;
  productionDaysMax: number;
  /** Production timeline; only steps visible to the customer. */
  productionSteps: ProductionStepDto[];
}

export class AdminOrderItemDto extends OrderItemDto {
  declare productionSteps: AdminProductionStepDto[];
}

export class OrderStatusChangeDto {
  @ApiProperty({ enum: ORDER_STATUSES, nullable: true })
  fromStatus: OrderStatus | null;
  @ApiProperty({ enum: ORDER_STATUSES })
  toStatus: OrderStatus;
  note: string | null;
  createdAt: Date;
}

export class OrderPaymentDto {
  id: string;
  @ApiProperty({ enum: PAYMENT_TYPES })
  type: PaymentType;
  @ApiProperty({ enum: PAYMENT_STATUSES })
  status: PaymentStatus;
  amount: number;
  createdAt: Date;
  paidAt: Date | null;
}

export class AdminOrderPaymentDto extends OrderPaymentDto {
  /** The store account that receives the money. */
  @ApiProperty({ enum: STORES })
  merchant: Store;
  /** 
ull for manual payments. */
  @ApiProperty({ enum: PAYMENT_PROVIDERS, nullable: true })
  provider: PaymentProvider | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  note: string | null;
}

export class NextPaymentDto {
  @ApiProperty({
    enum: [
      'full',
      'deposit',
      'model_prepayment',
      'production_prepayment',
      'remainder',
    ],
  })
  type: NextPayment['type'];
  amount: number;
}

export class OrderSummaryDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  number: number;
  /** Number with the store prefix, e.g. `LAB-1043`. */
  reference: string;
  @ApiProperty({ enum: ORDER_KINDS })
  kind: OrderKind;
  @ApiProperty({ enum: ORDER_STATUSES })
  status: OrderStatus;
  total: number;
  paidAmount: number;
  itemCount: number;
  productionDaysMax: number;
  createdAt: Date;
}

export class OrderSummaryPageDto {
  items: OrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class RevisionTermsDto {
  /** Revisions included in the model price. */
  freeBig: number;
  freeSmall: number;
  /** Kopiykas per revision beyond the free ones. */
  bigPrice: number;
  smallPrice: number;
}

/** Gripr Lab modeling order: what is delivered and the model revisions. */
export class OrderModelingDto {
  @ApiProperty({ enum: MODEL_DELIVERABLES })
  deliverable: ModelDeliverable;
  terms: RevisionTermsDto;
  bigRevisions: number;
  smallRevisions: number;
  freeBigRevisionsLeft: number;
  freeSmallRevisionsLeft: number;
  /** Requested changes waiting for staff to classify them. */
  pendingRevision: boolean;
  /** Personal-use license of the delivered file; `null` without a file. */
  license: string | null;
}

export class OrderDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  number: number;
  /** Number with the store prefix, e.g. `LAB-1043`. */
  reference: string;
  @ApiProperty({ enum: ORDER_KINDS })
  kind: OrderKind;
  @ApiProperty({ enum: ORDER_STATUSES })
  status: OrderStatus;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  deliveryCityRef: string;
  deliveryCityName: string;
  deliveryWarehouseRef: string;
  deliveryWarehouseName: string;
  /** Nova Poshta tracking number (TTN), once shipped. */
  trackingNumber: string | null;
  subtotal: number;
  discount: number;
  total: number;
  /** Legacy custom orders: first payment. */
  depositAmount: number | null;
  /** Staged custom orders: 3D model prepayment. */
  modelPaymentAmount: number | null;
  /** Staged custom orders: prepayment due before manufacturing. */
  productionPaymentAmount: number | null;
  paidAmount: number;
  /** Custom request the order was created from. */
  customRequestId: string | null;
  /** What the customer should pay next, or null. */
  nextPayment: NextPaymentDto | null;
  @ApiProperty({ type: OrderModelingDto, nullable: true })
  modeling: OrderModelingDto | null;
  productionDaysMin: number;
  productionDaysMax: number;
  customerComment: string | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemDto[];
  history: OrderStatusChangeDto[];
  payments: OrderPaymentDto[];
}

export class AdminOrderCustomerDto {
  id: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export class AdminOrderDto extends OrderDto {
  customerId: string;
  customer: AdminOrderCustomerDto;
  adminNote: string | null;
  declare items: AdminOrderItemDto[];
  declare payments: AdminOrderPaymentDto[];
  /** Statuses the order can move to next. */
  @ApiProperty({ enum: ORDER_STATUSES, isArray: true })
  allowedTransitions: OrderStatus[];
}

export class ModelRevisionDto {
  /**
   * `big`: shape, pose, or proportions; `small`: a detail or a size
   * correction.
   */
  @ApiProperty({ enum: REVISION_KINDS })
  @IsIn(REVISION_KINDS)
  kind: RevisionKind;
}

export class ModelChangesDto {
  /** What should change in the 3D model. */
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  comment: string;
}

export class AdminOrderListItemDto extends OrderSummaryDto {
  contactName: string;
  contactPhone: string;
}

export class AdminOrderPageDto {
  items: AdminOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}
