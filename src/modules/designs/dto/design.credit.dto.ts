import { ApiProperty } from '@nestjs/swagger';
import { DESIGN_LICENSES } from '../../../integrations/database/database.schema';
import type { DesignLicense } from '../../../integrations/database/database.schema';

/** Public attribution for a product manufactured from an open-license model. */
export class DesignCreditDto {
  /** Title of the original 3D model. */
  title: string;
  author: string;
  authorUrl: string | null;
  /** Where the model was published, e.g. "Sketchfab". */
  sourceName: string;
  sourceUrl: string;
  @ApiProperty({ enum: DESIGN_LICENSES })
  license: DesignLicense;
  licenseName: string;
  licenseUrl: string;
  /** Whether the license requires crediting the author. */
  attributionRequired: boolean;
}
