import { procedureErrorKey, PROCEDURE_ERROR_KEYS } from '../errors';

const errorWithReason = reason => ({ response: { data: { reason } } });

describe('#procedureErrorKey', () => {
  it('maps every reason code the controller can answer with, to its own message', () => {
    expect(procedureErrorKey(errorWithReason('unconfigured'))).toEqual(
      PROCEDURE_ERROR_KEYS.unconfigured
    );
    expect(procedureErrorKey(errorWithReason('unavailable'))).toEqual(
      PROCEDURE_ERROR_KEYS.unavailable
    );
    expect(procedureErrorKey(errorWithReason('invalid'))).toEqual(
      PROCEDURE_ERROR_KEYS.invalid
    );
    expect(procedureErrorKey(errorWithReason('duplicate_slug'))).toEqual(
      PROCEDURE_ERROR_KEYS.duplicate_slug
    );
    expect(procedureErrorKey(errorWithReason('not_found'))).toEqual(
      PROCEDURE_ERROR_KEYS.not_found
    );
  });

  it('never collapses distinct reasons onto the same message', () => {
    const keys = Object.values(PROCEDURE_ERROR_KEYS);
    expect(new Set(keys).size).toEqual(keys.length);
  });

  it('falls back to unavailable on an unrecognised reason', () => {
    expect(procedureErrorKey(errorWithReason('something_new'))).toEqual(
      PROCEDURE_ERROR_KEYS.unavailable
    );
  });

  it('falls back to unavailable when there is no response at all', () => {
    expect(procedureErrorKey(new Error('network down'))).toEqual(
      PROCEDURE_ERROR_KEYS.unavailable
    );
    expect(procedureErrorKey(undefined)).toEqual(
      PROCEDURE_ERROR_KEYS.unavailable
    );
  });

  it('falls back to unavailable when the response carries no reason', () => {
    expect(procedureErrorKey({ response: { data: {} } })).toEqual(
      PROCEDURE_ERROR_KEYS.unavailable
    );
  });
});
