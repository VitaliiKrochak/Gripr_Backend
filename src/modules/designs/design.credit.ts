import type {
  DesignCandidate,
  DesignSource,
} from '../../integrations/database/database.schema';
import { DESIGN_LICENSE_INFO } from './design.license';
import type { DesignCreditDto } from './dto/design.credit.dto';

const SOURCE_NAMES: Record<DesignSource, string> = {
  sketchfab: 'Sketchfab',
};

export type DesignCreditSource = Pick<
  DesignCandidate,
  'title' | 'authorName' | 'authorUrl' | 'source' | 'sourceUrl' | 'license'
>;

export function toDesignCredit(
  candidate: DesignCreditSource | null | undefined,
): DesignCreditDto | null {
  if (!candidate) return null;

  const license = DESIGN_LICENSE_INFO[candidate.license];

  return {
    title: candidate.title,
    author: candidate.authorName,
    authorUrl: candidate.authorUrl,
    sourceName: SOURCE_NAMES[candidate.source],
    sourceUrl: candidate.sourceUrl,
    license: candidate.license,
    licenseName: license.name,
    licenseUrl: license.url,
    attributionRequired: license.attributionRequired,
  };
}
