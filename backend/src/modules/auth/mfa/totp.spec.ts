import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpStep,
  verifyTotp,
} from './totp';

/** The shared secret used by the RFC 4226 and RFC 6238 SHA-1 test vectors. */
const RFC_KEY = Buffer.from('12345678901234567890', 'ascii');

describe('HOTP (RFC 4226 appendix D)', () => {
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [5, '254676'],
    [6, '287922'],
    [7, '162583'],
    [8, '399871'],
    [9, '520489'],
  ])('counter %i gives %s', (counter, expected) => {
    expect(hotp(RFC_KEY, counter)).toBe(expected);
  });
});

describe('TOTP (RFC 6238 appendix B, SHA-1, 8 digits)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('time %i gives %s', (seconds, expected) => {
    expect(hotp(RFC_KEY, totpStep(seconds * 1000), 8)).toBe(expected);
  });
});

describe('base32', () => {
  it('round-trips and matches the RFC 4648 vectors', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb-oi======').toString()).toBe('foobar');
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });
});

describe('verifyTotp', () => {
  const secret = base32Encode(RFC_KEY);
  const now = 1234567890 * 1000;
  const step = totpStep(now);
  const codeAt = (offset: number) => hotp(RFC_KEY, step + offset);

  it('accepts the current code and one step of drift either way', () => {
    expect(verifyTotp(secret, codeAt(0), now)).toBe(step);
    expect(verifyTotp(secret, codeAt(-1), now)).toBe(step - 1);
    expect(verifyTotp(secret, codeAt(1), now)).toBe(step + 1);
  });

  it('rejects older codes, wrong codes and malformed input', () => {
    expect(verifyTotp(secret, codeAt(-2), now)).toBeNull();
    expect(verifyTotp(secret, codeAt(2), now)).toBeNull();
    expect(verifyTotp(secret, '000000', now)).toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
    expect(verifyTotp(secret, '12345a', now)).toBeNull();
  });
});

describe('otpauthUri', () => {
  it('builds a URI authenticator apps understand', () => {
    const raw = otpauthUri('Sukoon Health', 'asha@example.test', 'JBSWY3DPEHPK3PXP');
    expect(raw).toContain('issuer=Sukoon%20Health');
    expect(raw).not.toContain('+');
    const uri = new URL(raw);
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe('/Sukoon Health:asha@example.test');
    expect(uri.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(uri.searchParams.get('issuer')).toBe('Sukoon Health');
    expect(uri.searchParams.get('digits')).toBe('6');
  });
});
