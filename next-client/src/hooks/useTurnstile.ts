'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// The public site key of the Cloudflare Turnstile widget (safe in the browser). Set NEXT_PUBLIC_TURNSTILE_SITE_KEY to change it
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAE1v1PaZCL-bktYH';
const TURNSTILE_SCRIPT_ID = 'turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// The widget is drawn as soon as the script and the container exist: the check repeats this often, and gives up after
// MAX_ATTEMPTS (about 20 seconds), for example when an ad blocker stops the script
const POLL_INTERVAL_MS = 100;
const MAX_ATTEMPTS = 200;

/**
 * Cloudflare Turnstile for one dialog or form. Put `containerRef` on an empty div; `token` is filled once the visitor
 * passes the check. `enabled` is false while the widget is not on screen (a closed dialog, a step without CAPTCHA).
 * `reset()` asks for a fresh token after a request has used the old one.
 */
export function useTurnstile(action: string, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let isCancelled = false;
    setLoadFailed(false);

    if (!document.getElementById(TURNSTILE_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const renderWidget = () => {
      if (isCancelled || widgetIdRef.current) return;
      const turnstile = (window as any).turnstile;
      // The script or the dialog's container (drawn by a portal) is not ready yet
      if (!turnstile || !containerRef.current) {
        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setLoadFailed(true);
          return;
        }
        timerId = setTimeout(renderWidget, POLL_INTERVAL_MS);
        return;
      }
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        theme: 'dark',
        callback: (newToken: string) => setToken(newToken),
        'error-callback': () => setToken(''),
        'expired-callback': () => setToken('')
      });
    };
    renderWidget();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      const turnstile = (window as any).turnstile;
      if (widgetIdRef.current && turnstile?.remove) {
        turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      setToken('');
    };
  }, [enabled, action]);

  const reset = useCallback(() => {
    const turnstile = (window as any).turnstile;
    if (widgetIdRef.current && turnstile?.reset) {
      turnstile.reset(widgetIdRef.current);
    }
    setToken('');
  }, []);

  return { containerRef, token, loadFailed, reset };
}
