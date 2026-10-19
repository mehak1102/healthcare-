import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('allows same-site relative paths', () => {
    expect(safeRedirectPath('/admin/users?page=2')).toBe('/admin/users?page=2');
  });

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['/account\n/evil'],
    [''],
    [null],
  ])('falls back for unsafe destination %j', (candidate) => {
    expect(safeRedirectPath(candidate)).toBe('/account');
  });
});
