/**
 * Robust cookie and Datadog domain extractor.
 * Handles:
 * - Windows CMD cURL (-H ^"cookie: ...^" ^)
 * - Bash / Unix cURL (-H "cookie: ..." or -H 'cookie: ...')
 * - PowerShell cURL (curl.exe or Invoke-WebRequest)
 * - Fetch request snippets ("headers": { "cookie": "..." })
 * - Raw HTTP header ("Cookie: ...")
 * - Direct cookie strings ("datadog_login=...; dd-session=...")
 * - JSON cookie export extensions ([{"name": "datadog_login", "value": "..."}])
 * - Plain session token ("abcd1234...")
 */

export interface ParsedSessionInput {
  cookie: string;
  domain: string | null;
  hasCurl: boolean;
  error?: string;
}

/**
 * Sanitizes any string to ensure it is 100% safe as an HTTP header value
 * in Node.js / undici fetch without throwing TypeError: Headers.append
 */
export function sanitizeHeaderValue(val: string): string {
  if (!val) return '';
  return val
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x09\x20-\x7E\x80-\xFF]/g, '')
    .trim();
}

export function extractCookieAndDomain(input: string): ParsedSessionInput {
  if (!input) {
    return { cookie: '', domain: null, hasCurl: false };
  }

  let raw = input.trim();
  const hasCurl =
    raw.toLowerCase().includes('curl') ||
    raw.includes('--url') ||
    raw.includes('-H ') ||
    raw.includes('-b ') ||
    raw.includes('--header');

  // 1. Detect Datadog domain if present in URL
  let detectedDomain: string | null = null;
  const domainMatch = raw.match(/https?:\/\/([a-z0-9\.-]*datadoghq\.(?:com|eu)|[a-z0-9\.-]*ddog-gov\.com)/i);
  if (domainMatch && domainMatch[1]) {
    detectedDomain = domainMatch[1].toLowerCase();
  }

  let cookie = '';

  // 2. Windows CMD cURL: e.g. -H ^"cookie: dd-session=...^" ^
  // or -H ^"Cookie: ...^"
  const winCmdMatch =
    raw.match(/(?:-H|--header)\s+\^"cookie:\s*([^"\r\n]+?)(?:\^"|$)/i) ||
    raw.match(/(?:-b|--cookie)\s+\^"([^"\r\n]+?)(?:\^"|$)/i);
  if (winCmdMatch && winCmdMatch[1]) {
    cookie = winCmdMatch[1];
  }

  // 3. Standard Bash / Unix cURL: -H 'cookie: ...' or -H "cookie: ..."
  if (!cookie) {
    const stdCurlMatch =
      raw.match(/(?:-H|--header)\s+['"]cookie:\s*([^'"\r\n]+)['"]/i) ||
      raw.match(/(?:-b|--cookie)\s+['"]([^'"\r\n]+)['"]/i);
    if (stdCurlMatch && stdCurlMatch[1]) {
      cookie = stdCurlMatch[1];
    }
  }

  // 4. Fetch snippet or JSON headers: "cookie": "..."
  if (!cookie) {
    const fetchMatch = raw.match(/['"]?cookie['"]?\s*:\s*['"]([^'"\r\n]+)['"]/i);
    if (fetchMatch && fetchMatch[1]) {
      cookie = fetchMatch[1];
    }
  }

  // 5. Raw "Cookie: foo=bar"
  if (!cookie && /^cookie:\s*/i.test(raw)) {
    cookie = raw.replace(/^cookie:\s*/i, '');
  }

  // 6. JSON array from cookie extension
  if (!cookie && (raw.startsWith('[') || raw.startsWith('{'))) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const parts = parsed
          .filter((item: any) => item && item.name && item.value)
          .map((item: any) => `${item.name}=${item.value}`);
        if (parts.length > 0) {
          cookie = parts.join('; ');
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const parts = Object.entries(parsed).map(([k, v]) => `${k}=${v}`);
        if (parts.length > 0) {
          cookie = parts.join('; ');
        }
      }
    } catch {
      // not valid json, ignore
    }
  }

  // 7. Direct cookie key-value string (not a curl command)
  if (!cookie && !hasCurl) {
    cookie = raw;
  }

  // 8. Clean caret escapes and invalid characters from cookie
  if (cookie) {
    cookie = cookie
      .replace(/\^/g, '')
      .replace(/^["'\s]+|["'\s]+$/g, '');
    cookie = sanitizeHeaderValue(cookie);

    // If result still accidentally looks like a curl command line, invalidate it
    if (cookie.toLowerCase().startsWith('curl') || cookie.includes('--url')) {
      cookie = '';
    }
  }

  // 9. Plain token fallback: if user just pasted an alphanumeric session token without '='
  if (!cookie && !hasCurl && raw.length >= 10 && !raw.includes(' ') && !raw.includes('=')) {
    cookie = `datadog_login=${raw.trim()}`;
  }

  // Error handling if user pasted a cURL command that lacked cookie header
  let error: string | undefined;
  if (hasCurl && !cookie) {
    error =
      'O comando cURL colado não contém o cabeçalho "Cookie". No Datadog, clique com botão direito em uma requisição autenticada (ex: /api/... ou recarregue com F5) e selecione "Copy as cURL".';
  }

  return {
    cookie,
    domain: detectedDomain,
    hasCurl,
    error,
  };
}

export function parseAnyCookieInput(input: string): string {
  const result = extractCookieAndDomain(input);
  return result.cookie;
}
