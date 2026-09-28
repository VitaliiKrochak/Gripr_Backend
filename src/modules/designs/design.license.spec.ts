import { classifyLicense, DESIGN_LICENSE_INFO } from './design.license';

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

  it('requires attribution only for CC BY', () => {
    expect(DESIGN_LICENSE_INFO.cc0.attributionRequired).toBe(false);
    expect(DESIGN_LICENSE_INFO.cc_by.attributionRequired).toBe(true);
  });
});
