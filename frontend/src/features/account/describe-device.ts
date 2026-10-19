/** A friendly, approximate label such as "Chrome on macOS". User agents can be spoofed; display only. */
export function describeDevice(userAgent: string): { label: string; mobile: boolean } {
  const ua = userAgent || '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);

  if (browser && os) return { label: `${browser} on ${os}`, mobile };
  if (browser || os) return { label: (browser ?? os) as string, mobile };
  return { label: 'Unknown device', mobile };
}
