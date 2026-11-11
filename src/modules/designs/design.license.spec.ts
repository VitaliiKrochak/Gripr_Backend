import {
  classifyLicense,
  DESIGN_LICENSE_INFO,
  licenseFromLabel,
  STORE_LICENSES,
} from './design.license';

describe('classifyLicense', () => {
  const subject = (licenseLabel: string | null) => ({
    licenseLabel,
    isDownloadable: true,
    isAgeRestricted: false,
  });

  it.each([
    ['CC0 Public Domain', 'cc0'],
    ['CC Attribution', 'cc_by'],
    ['CC-BY 4.0', 'cc_by'],
  ] as const)('accepts %s', (label, license) => {
    expect(classifyLicense(subject(label))).toBe(DESIGN_LICENSE_INFO[license]);
  });

  it.each([
    'CC Attribution-NonCommercial',
    'CC Attribution-ShareAlike',
    'CC Attribution-NoDerivs',
    'CC Attribution-NonCommercial-ShareAlike',
    'Editorial',
    'Standard',
    null,
  ])('rejects %s', (label) => {
    expect(classifyLicense(subject(label))).toBe('license');
  });

  it('rejects models that cannot be downloaded or are age restricted', () => {
    expect(
      classifyLicense({
        ...subject('CC0 Public Domain'),
        isDownloadable: false,
      }),
    ).toBe('not_downloadable');
    expect(
      classifyLicense({
        ...subject('CC0 Public Domain'),
        isAgeRestricted: true,
      }),
    ).toBe('age_restricted');
  });

  it('requires attribution for every license but CC0', () => {
    expect(DESIGN_LICENSE_INFO.cc0.attributionRequired).toBe(false);
    expect(DESIGN_LICENSE_INFO.cc_by.attributionRequired).toBe(true);
    expect(DESIGN_LICENSE_INFO.cc_by_nd.derivativesAllowed).toBe(false);
    expect(DESIGN_LICENSE_INFO.cc_by_sa.shareAlike).toBe(true);
  });

  it('accepts share-alike and no-derivatives licenses for Gripr Lab', () => {
    const lab = STORE_LICENSES.lab;

    expect(classifyLicense(subject('CC Attribution-ShareAlike'), lab)).toBe(
      DESIGN_LICENSE_INFO.cc_by_sa,
    );
    expect(classifyLicense(subject('CC Attribution-NoDerivs'), lab)).toBe(
      DESIGN_LICENSE_INFO.cc_by_nd,
    );
    expect(classifyLicense(subject('CC Attribution-NonCommercial'), lab)).toBe(
      'license',
    );
  });
});

describe('licenseFromLabel', () => {
  it.each([
    ['Creative Commons - Attribution', 'cc_by'],
    ['Creative Commons - Attribution - Share Alike', 'cc_by_sa'],
    ['Creative Commons - Attribution - No Derivatives', 'cc_by_nd'],
    ['Creative Commons - Public Domain Dedication', 'cc0'],
    ['Public Domain', 'cc0'],
    ['Creative Commons - Attribution - Non-Commercial', null],
    ['Creative Commons - Attribution - Non-Commercial - Share Alike', null],
    ['GNU - GPL', null],
    ['BSD License', null],
  ] as const)('maps %s', (label, license) => {
    expect(licenseFromLabel(label)).toBe(license);
  });
});
