import { getErrorMessage, ERROR_MESSAGES } from './errorMessages';

describe('getErrorMessage', () => {
  it('returns the mapped message for a known backend error code', () => {
    expect(getErrorMessage('SEAT_COUNT_EXCEEDED')).toBe(ERROR_MESSAGES.SEAT_COUNT_EXCEEDED);
  });

  it('prefers the caller-supplied fallback over the generic default for an unknown code', () => {
    expect(getErrorMessage('SOME_UNMAPPED_CODE', 'Custom fallback')).toBe('Custom fallback');
  });

  it('returns the generic default when the code is unknown and no fallback is given', () => {
    expect(getErrorMessage('SOME_UNMAPPED_CODE')).toBe('Something went wrong, please try again');
  });

  it('returns the generic default when no code is given at all', () => {
    expect(getErrorMessage(undefined)).toBe('Something went wrong, please try again');
  });

  it('ignores an empty-string fallback and returns the generic default', () => {
    expect(getErrorMessage('SOME_UNMAPPED_CODE', '')).toBe('Something went wrong, please try again');
  });
});
