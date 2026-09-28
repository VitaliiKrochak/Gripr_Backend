import type { DesignLicense } from '../../integrations/database/database.schema';

export interface DesignLicenseInfo {
  license: DesignLicense;
  name: string;
  url: string;
  attributionRequired: boolean;
}

export const DESIGN_LICENSE_INFO: Record<DesignLicense, DesignLicenseInfo> = {
  cc0: {
    license: 'cc0',
    name: 'CC0 1.0 Public Domain Dedication',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
  },
  cc_by: {
    license: 'cc_by',
    name: 'Creative Commons Attribution 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
};

export type LicenseRejection =
  'license' | 'not_downloadable' | 'age_restricted';

export interface LicenseSubject {
  licenseLabel: string | null;
  isDownloadable: boolean;
  isAgeRestricted: boolean;
}

const RESTRICTED_TERMS =
  /non-?commercial|share-?alike|no-?deriv|\bnc\b|\bsa\b|\bnd\b/i;

/**
 * Maps a source license label to a license that allows commercial
 * manufacturing; anything else (NC, SA, ND, editorial, store) is rejected.
 */
export function classifyLicense(
  subject: LicenseSubject,
): DesignLicenseInfo | LicenseRejection {
  if (!subject.isDownloadable) return 'not_downloadable';
  if (subject.isAgeRestricted) return 'age_restricted';

  const label = subject.licenseLabel?.trim() ?? '';

  if (RESTRICTED_TERMS.test(label)) return 'license';
  if (/^cc0\b/i.test(label) || /public domain/i.test(label)) {
    return DESIGN_LICENSE_INFO.cc0;
  }
  if (/^cc attribution\b/i.test(label) || /^cc[- ]by\b/i.test(label)) {
    return DESIGN_LICENSE_INFO.cc_by;
  }

  return 'license';
}
