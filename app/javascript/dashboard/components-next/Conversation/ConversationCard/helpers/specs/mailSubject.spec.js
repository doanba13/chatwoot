import { mailSubjectFor } from '../mailSubject';

describe('mailSubjectFor', () => {
  it('reads the camelCased shape the history sidebars hand over', () => {
    expect(
      mailSubjectFor({
        additionalAttributes: { mailSubject: 'Aw: Bestellung #PL-5563' },
      })
    ).toBe('Aw: Bestellung #PL-5563');
  });

  it('reads the server casing the main conversations store keeps', () => {
    // The inbox list is this case, and it is the one the work was for.
    expect(
      mailSubjectFor({
        additional_attributes: { mail_subject: 'Fehlende Bestellung PL5713' },
      })
    ).toBe('Fehlende Bestellung PL5713');
  });

  it.each([
    [
      'a camelCased container with the server key',
      { mail_subject: 'Rép: CU-1095' },
    ],
    [
      'a server container with the camelCased key',
      { mailSubject: 'Rép: CU-1095' },
    ],
  ])('reads a mixed shape: %s', (_label, attributes) => {
    expect(mailSubjectFor({ additionalAttributes: attributes })).toBe(
      'Rép: CU-1095'
    );
    expect(mailSubjectFor({ additional_attributes: attributes })).toBe(
      'Rép: CU-1095'
    );
  });

  it.each([
    ['no attributes at all', {}],
    ['an empty camelCased container', { additionalAttributes: {} }],
    ['an empty server container', { additional_attributes: {} }],
    ['an empty subject', { additionalAttributes: { mailSubject: '' } }],
    ['a null subject', { additional_attributes: { mail_subject: null } }],
  ])('returns an empty string for %s', (_label, conversation) => {
    expect(mailSubjectFor(conversation)).toBe('');
  });

  it.each([[undefined], [null]])(
    'returns an empty string rather than throwing on %s',
    conversation => {
      expect(mailSubjectFor(conversation)).toBe('');
    }
  );
});
