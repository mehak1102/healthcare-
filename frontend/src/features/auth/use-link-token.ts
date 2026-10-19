import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * Reads the one-time token from an emailed link (`/path#token=…`) and then removes it from the
 * address bar so it does not linger in history, bookmarks or screenshots. Fragments are never
 * sent to servers, so the token does not reach access logs or Referer headers.
 */
export function useLinkToken(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'));

  useEffect(() => {
    if (location.hash) {
      void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return token;
}
