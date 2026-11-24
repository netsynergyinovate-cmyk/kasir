import { describe, it, expect } from 'vitest';
import { buildMultipartBody } from '../../api/_lib/runsnetClient.js';

describe('buildMultipartBody', () => {
  it('merakit field biasa + bagian file kosong dengan filename="" seperti browser', () => {
    const { body, contentType } = buildMultipartBody({ pac_nama: 'Budi', _csrf: 'tok' }, ['pac_lampiran[]']);
    const boundary = contentType.split('boundary=')[1];
    expect(body).toContain(`--${boundary}\r\nContent-Disposition: form-data; name="pac_nama"\r\n\r\nBudi\r\n`);
    expect(body).toContain(`--${boundary}\r\nContent-Disposition: form-data; name="_csrf"\r\n\r\ntok\r\n`);
    expect(body).toContain('name="pac_lampiran[]"; filename=""\r\nContent-Type: application/octet-stream');
    expect(body.endsWith(`--${boundary}--\r\n`)).toBe(true);
  });
});
