import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CitySearchQueryDto {
  /** At least two letters of the city name. */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}

export class WarehouseSearchQueryDto {
  /** `ref` of a city from the city search. */
  @IsString()
  @MaxLength(100)
  cityRef: string;

  /** Branch number or part of the address. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CityDto {
  /** Nova Poshta city `Ref`, stored as `delivery.cityRef` at checkout. */
  ref: string;
  name: string;
  settlementType: string;
  area: string;
}

export class WarehouseDto {
  /** Stored as `delivery.warehouseRef` at checkout. */
  ref: string;
  number: string;
  name: string;
  shortAddress: string;
  /** `Branch`, `Postomat` (parcel locker), or `Store`. */
  category: string;
}
