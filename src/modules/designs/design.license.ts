import type {
  DesignLicense,
  Store,
} from '../../integrations/database/database.schema';

export interface DesignLicenseInfo {
  license: DesignLicense;
  name: string;
  url: string;
  attributionRequired: boolean;
  /** Our changes to the file must be shared under the same license. */
  shareAlike: boolean;
  /** `false`: the model may be scaled but not remixed. */
  derivativesAllowed: boolean;
}

export const DESIGN_LICENSE_INFO: Record<DesignLicense, DesignLicenseInfo> = {
  cc0: {
    license: 'cc0',
    name: 'CC0 1.0 Public Domain Dedication',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    shareAlike: false,
    derivativesAllowed: true,
  },
  cc_by: {
    license: 'cc_by',
    name: 'Creative Commons Attribution 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
    shareAlike: false,
    derivativesAllowed: true,
  },
  cc_by_sa: {
    license: 'cc_by_sa',
    name: 'Creative Commons Attribution-ShareAlike 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionRequired: true,
    shareAlike: true,
    derivativesAllowed: true,
  },
  cc_by_nd: {
    license: 'cc_by_nd',
    name: 'Creative Commons Attribution-NoDerivatives 4.0',
    url: 'https://creativecommons.org/licenses/by-nd/4.0/',
    attributionRequired: true,
    shareAlike: false,
    derivativesAllowed: false,
  },
};

/**
 * Licenses each store accepts. Jewelry is always adapted (sizes, metals), so
 * Gripr takes only licenses without share-alike or no-derivatives terms.
 */
export const STORE_LICENSES: Record<Store, DesignLicense[]> = {
  gripr: ['cc0', 'cc_by'],
  lab: ['cc0', 'cc_by', 'cc_by_sa', 'cc_by_nd'],
};

export type LicenseRejection =
  'license' | 'not_downloadable' | 'age_restricted';

export interface LicenseSubject {
  licenseLabel: string | null;
  isDownloadable: boolean;
  isAgeRestricted: boolean;
}

const NON_COMMERCIAL = /non-?commercial|\bnc\b/i;
const SHARE_ALIKE = /share-?\s?alike|\bsa\b/i;
const NO_DERIVATIVES = /no-?\s?deriv|\bnd\b/i;

/**
 * Maps a source license label (Sketchfab `CC Attribution-ShareAlike`,
 * Thingiverse `Creative Commons - Attribution - No Derivatives`) to a stored
 * license; non-commercial and unknown licenses give `null`.
 */
export function licenseFromLabel(
  label: string | null | undefined,
): DesignLicense | null {
  const value = label?.trim() ?? '';

  if (!value || NON_COMMERCIAL.test(value)) return null;
  if (/\bcc0\b/i.test(value) || /public domain/i.test(value)) return 'cc0';
  if (!/attribution|\bcc[- ]by\b/i.test(value)) return null;
  if (SHARE_ALIKE.test(value) && NO_DERIVATIVES.test(value)) return null;
  if (SHARE_ALIKE.test(value)) return 'cc_by_sa';
  if (NO_DERIVATIVES.test(value)) return 'cc_by_nd';

  return 'cc_by';
}

/**
 * The license of a downloadable, unrestricted model when the store accepts
 * it; anything else (NC, editorial, store licenses) is rejected.
 */
export function classifyLicense(
  subject: LicenseSubject,
  allowed: DesignLicense[] = STORE_LICENSES.gripr,
): DesignLicenseInfo | LicenseRejection {
  if (!subject.isDownloadable) return 'not_downloadable';
  if (subject.isAgeRestricted) return 'age_restricted';

  const license = licenseFromLabel(subject.licenseLabel);

  return license && allowed.includes(license)
    ? DESIGN_LICENSE_INFO[license]
    : 'license';
}
