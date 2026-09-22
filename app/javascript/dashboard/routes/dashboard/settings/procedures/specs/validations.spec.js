import {
  SLUG_PATTERN,
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_PHRASES,
  slugError,
  titleError,
  bodyError,
  phrasesError,
  isProcedureFormValid,
} from '../validations';

describe('#slugError', () => {
  it('requires a slug', () => {
    expect(slugError('')).toEqual('PROCEDURES_MGMT.FORM.SLUG.REQUIRED_ERROR');
    expect(slugError('   ')).toEqual(
      'PROCEDURES_MGMT.FORM.SLUG.REQUIRED_ERROR'
    );
    expect(slugError(undefined)).toEqual(
      'PROCEDURES_MGMT.FORM.SLUG.REQUIRED_ERROR'
    );
  });

  it('matches the server pattern exactly', () => {
    expect(SLUG_PATTERN.source).toEqual('^[a-z0-9_]{3,40}$');
  });

  it('refuses characters the server refuses', () => {
    expect(slugError('Return-Window')).toEqual(
      'PROCEDURES_MGMT.FORM.SLUG.PATTERN_ERROR'
    );
    expect(slugError('has space')).toEqual(
      'PROCEDURES_MGMT.FORM.SLUG.PATTERN_ERROR'
    );
    expect(slugError('ab')).toEqual('PROCEDURES_MGMT.FORM.SLUG.PATTERN_ERROR');
    expect(slugError('a'.repeat(41))).toEqual(
      'PROCEDURES_MGMT.FORM.SLUG.PATTERN_ERROR'
    );
  });

  it('accepts a slug the server accepts', () => {
    expect(slugError('return_window')).toEqual('');
    expect(slugError('return-window'.replace('-', '_'))).toEqual('');
    expect(slugError('a1_')).toEqual('');
  });
});

describe('#titleError', () => {
  it('requires a title', () => {
    expect(titleError('')).toEqual('PROCEDURES_MGMT.FORM.TITLE.REQUIRED_ERROR');
    expect(titleError('   ')).toEqual(
      'PROCEDURES_MGMT.FORM.TITLE.REQUIRED_ERROR'
    );
  });

  it('caps the title at the server limit', () => {
    expect(titleError('a'.repeat(MAX_TITLE_LENGTH))).toEqual('');
    expect(titleError('a'.repeat(MAX_TITLE_LENGTH + 1))).toEqual(
      'PROCEDURES_MGMT.FORM.TITLE.LENGTH_ERROR'
    );
  });

  it('accepts an ordinary title', () => {
    expect(titleError('Return window')).toEqual('');
  });
});

describe('#bodyError', () => {
  it('requires a body', () => {
    expect(bodyError('')).toEqual('PROCEDURES_MGMT.FORM.BODY.REQUIRED_ERROR');
  });

  it('caps the body at the server limit', () => {
    expect(bodyError('a'.repeat(MAX_BODY_LENGTH))).toEqual('');
    expect(bodyError('a'.repeat(MAX_BODY_LENGTH + 1))).toEqual(
      'PROCEDURES_MGMT.FORM.BODY.LENGTH_ERROR'
    );
  });
});

describe('#phrasesError', () => {
  it('requires at least one phrase', () => {
    expect(phrasesError([])).toEqual('PROCEDURES_MGMT.FORM.PHRASES.MIN_ERROR');
    expect(phrasesError(undefined)).toEqual(
      'PROCEDURES_MGMT.FORM.PHRASES.MIN_ERROR'
    );
  });

  it('caps at the server maximum', () => {
    expect(phrasesError(Array(MAX_PHRASES).fill('x'))).toEqual('');
    expect(phrasesError(Array(MAX_PHRASES + 1).fill('x'))).toEqual(
      'PROCEDURES_MGMT.FORM.PHRASES.MAX_ERROR'
    );
  });

  it('accepts a normal phrase list', () => {
    expect(phrasesError(['I want to return this'])).toEqual('');
  });
});

describe('#isProcedureFormValid', () => {
  const validInput = {
    slug: 'return_window',
    title: 'Return window',
    body: 'Offer a 30 day return window.',
    phrases: ['I want to return this'],
  };

  it('is valid when every field passes', () => {
    expect(isProcedureFormValid(validInput)).toEqual(true);
  });

  it('is invalid when the slug is malformed', () => {
    expect(isProcedureFormValid({ ...validInput, slug: 'Bad Slug' })).toEqual(
      false
    );
  });

  it('is invalid when the title is empty', () => {
    expect(isProcedureFormValid({ ...validInput, title: '' })).toEqual(false);
  });

  it('is invalid when there are too many phrases', () => {
    expect(
      isProcedureFormValid({
        ...validInput,
        phrases: Array(MAX_PHRASES + 1).fill('x'),
      })
    ).toEqual(false);
  });

  it('is invalid when there are no phrases at all', () => {
    expect(isProcedureFormValid({ ...validInput, phrases: [] })).toEqual(false);
  });

  it('skips the slug check entirely when no slug is passed, for an edit', () => {
    const { slug, ...editInput } = validInput;
    expect(slug).toBeDefined();
    expect(isProcedureFormValid(editInput)).toEqual(true);
  });
});
