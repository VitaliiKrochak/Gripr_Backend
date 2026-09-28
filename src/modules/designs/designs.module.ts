import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminDesignCandidatesController } from './admin/design.candidates.controller';
import { DesignCandidatesService } from './design.candidates.service';
import { DesignImportService } from './design.import.service';

@Module({
  imports: [CatalogModule],
  controllers: [AdminDesignCandidatesController],
  providers: [DesignCandidatesService, DesignImportService],
})
export class DesignsModule {}
