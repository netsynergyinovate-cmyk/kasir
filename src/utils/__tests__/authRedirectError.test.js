import { describe, it, expect } from 'vitest';
import { readAuthRedirectError } from '../authRedirectError';

describe('readAuthRedirectError', () => {
  it('returns null when the url has no auth error', () => {
    expect(readAuthRedirectError('http://localhost:5173/')).toBeNull();
  });

  it('reads error_description from the query string', () => {
    const url = 'http://localhost:5173/?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance';
    expect(readAuthRedirectError(url)).toBe('Email Google ini belum terdaftar di sistem. Minta superadmin mendaftarkannya.');
  });

  it('keeps the raw description for other error codes', () => {
    const url = 'http://localhost:5173/?error=server_error&error_code=unexpected_failure&error_description=Something+broke';
    expect(readAuthRedirectError(url)).toBe('Something broke (unexpected_failure)');
  });

  it('reads error_description from the hash fragment', () => {
    const url = 'http://localhost:5173/#error=server_error&error_description=Unable+to+exchange+external+code';
    expect(readAuthRedirectError(url)).toBe('Unable to exchange external code');
  });

  it('falls back to the error code when there is no description', () => {
    expect(readAuthRedirectError('http://localhost:5173/?error=access_denied')).toBe('access_denied');
  });
});
