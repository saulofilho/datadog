import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { extractCookieAndDomain, sanitizeHeaderValue } from './src/utils/cookie';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to normalize domain
function normalizeDomain(domainInput?: string): string {
  if (!domainInput) return 'app.datadoghq.com';
  let d = domainInput.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return d || 'app.datadoghq.com';
}

// Helper to extract cookies from fetch response
function extractCookies(response: Response, existingCookies: Record<string, string> = {}): Record<string, string> {
  const cookies = { ...existingCookies };
  
  // Node's native fetch provides getSetCookie if available, or 'set-cookie' headers
  let setCookieHeaders: string[] = [];
  if (typeof (response.headers as any).getSetCookie === 'function') {
    setCookieHeaders = (response.headers as any).getSetCookie();
  } else {
    const raw = response.headers.get('set-cookie');
    if (raw) {
      setCookieHeaders = [raw];
    }
  }

  for (const header of setCookieHeaders) {
    // Each header might be comma-separated or multiple cookies
    const parts = header.split(';');
    if (parts[0]) {
      const [key, ...val] = parts[0].split('=');
      if (key && val) {
        cookies[key.trim()] = val.join('=').trim();
      }
    }
  }

  return cookies;
}

function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// Helper to safely parse JSON from upstream fetch without crashing on HTML responses
async function safeJsonFetch(res: Response, fallbackContext: string = 'Datadog'): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
  const location = res.headers.get('location') || '';

  if (isRedirect || location.includes('/account/login') || res.url.includes('/account/login')) {
    throw new Error(
      'Sessão não autenticada ou redirecionada para a tela de login do Datadog. Verifique suas credenciais ou informe o cookie de sessão.'
    );
  }

  if (!contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    if (rawText.trim().startsWith('<') || rawText.includes('<html') || rawText.includes('<!DOCTYPE')) {
      throw new Error(
        `O Datadog retornou uma página HTML em vez de dados JSON (HTTP ${res.status}). A sessão expirou ou requer validação no navegador.`
      );
    }
    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error(`Resposta inesperada de ${fallbackContext} (HTTP ${res.status}): ${rawText.slice(0, 120)}`);
    }
  }

  return await res.json();
}
function classifyMonitor(monitor: any) {
  const name = (monitor.name || '').toLowerCase();
  const query = (monitor.query || '').toLowerCase();
  const message = (monitor.message || '').toLowerCase();
  const type = (monitor.type || '').toLowerCase();

  const isLatency = /latency|latencia|duration|duraç|response_time|tempo|p50|p75|p90|p95|p99|timeout|delay/.test(
    `${name} ${query} ${message} ${type}`
  );
  const isError = /error|erro|5xx|500|502|503|504|fail|falha|exception|status:error|status:critical|anomaly/.test(
    `${name} ${query} ${message} ${type}`
  );

  const isCritical = monitor.overall_state === 'Alert';
  const isWarning = monitor.overall_state === 'Warn';
  const isOk = monitor.overall_state === 'OK';
  const isNoData = monitor.overall_state === 'No Data';

  let alertCategory: 'latency' | 'error' | 'both' | 'metric' = 'metric';
  if (isLatency && isError) alertCategory = 'both';
  else if (isLatency) alertCategory = 'latency';
  else if (isError) alertCategory = 'error';

  return {
    isCritical,
    isWarning,
    isOk,
    isNoData,
    isLatency,
    isError,
    alertCategory,
  };
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authenticate to Datadog with standard email & password or existing session
app.post('/api/datadog/login', async (req, res) => {
  try {
    const { email, password, domain: rawDomain, sessionCookie, twoFactorCode } = req.body;
    const domain = normalizeDomain(rawDomain);

    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // Scenario A: User provides their web session cookie or cURL command
    if (sessionCookie && typeof sessionCookie === 'string' && sessionCookie.trim()) {
      const parsed = extractCookieAndDomain(sessionCookie);

      if (parsed.error) {
        return res.json({
          success: false,
          error: parsed.error,
        });
      }

      const activeDomain = parsed.domain ? normalizeDomain(parsed.domain) : domain;
      const cleanCookie = sanitizeHeaderValue(parsed.cookie);

      if (!cleanCookie) {
        return res.json({
          success: false,
          error:
            'Nenhum cookie de autenticação válido foi identificado. Certifique-se de copiar todo o comando cURL ou o valor do cookie datadog_login.',
        });
      }

      try {
        const testRes = await fetch(`https://${activeDomain}/api/v1/user/self`, {
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
            Cookie: cleanCookie,
          },
        });

        if (testRes.ok) {
          const userData = await testRes.json().catch(() => ({}));
          return res.json({
            success: true,
            method: 'session_cookie',
            domain: activeDomain,
            cookie: cleanCookie,
            user: {
              email: userData?.user?.email || email || 'Usuário Datadog',
              name: userData?.user?.name || userData?.user?.handle || 'Conectado',
            },
          });
        }

        // Fallback check on /api/v1/monitor?count=1
        const monitorCheck = await fetch(`https://${activeDomain}/api/v1/monitor?count=1`, {
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
            Cookie: cleanCookie,
          },
        });

        if (monitorCheck.ok) {
          return res.json({
            success: true,
            method: 'session_cookie',
            domain: activeDomain,
            cookie: cleanCookie,
            user: {
              email: email || 'Sessão Datadog Ativa',
              name: 'Conectado',
            },
          });
        }

        return res.json({
          success: false,
          error: `Sessão do Datadog não autorizada ou expirada para o domínio ${activeDomain}. Verifique se sua conta continua logada no navegador.`,
        });
      } catch (fetchErr: any) {
        console.error('Session test fetch error:', fetchErr);
        return res.json({
          success: false,
          error: `Falha ao testar conexão com Datadog (${activeDomain}): ${fetchErr.message || 'Erro de rede'}`,
        });
      }
    }

    // Scenario B: User provides standard email & password
    if (!email || !password) {
      return res.json({
        success: false,
        error: 'Email e senha são obrigatórios para autenticação padrão.',
      });
    }

    // Step 1: Request the login page to gather initial CSRF tokens and cookies
    let initialCookies: Record<string, string> = {};
    let csrfToken = '';

    try {
      const loginPageRes = await fetch(`https://${domain}/account/login`, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
      });

      initialCookies = extractCookies(loginPageRes);
      const pageHtml = await loginPageRes.text();

      // Extract CSRF token if present in HTML (Datadog often embeds <input name="_csrf_token" value="..."> or meta tag)
      const csrfMatch =
        pageHtml.match(/name=["'](?:_csrf_token|csrf_token)["']\s+value=["']([^"']+)["']/) ||
        pageHtml.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/);
      if (csrfMatch && csrfMatch[1]) {
        csrfToken = csrfMatch[1];
      }
    } catch (err) {
      console.warn('Could not pre-fetch login page, continuing:', err);
    }

    // Step 2: Attempt POST login with standard credentials
    const loginPayload = new URLSearchParams();
    loginPayload.append('username', email);
    loginPayload.append('password', password);
    if (csrfToken) {
      loginPayload.append('_csrf_token', csrfToken);
    }
    if (twoFactorCode) {
      loginPayload.append('code', twoFactorCode);
    }

    const postHeaders: Record<string, string> = {
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/html, */*',
      Origin: `https://${domain}`,
      Referer: `https://${domain}/account/login`,
    };

    if (Object.keys(initialCookies).length > 0) {
      postHeaders['Cookie'] = serializeCookies(initialCookies);
    }

    const authRes = await fetch(`https://${domain}/account/login`, {
      method: 'POST',
      headers: postHeaders,
      body: loginPayload.toString(),
      redirect: 'manual',
    });

    const responseCookies = extractCookies(authRes, initialCookies);
    const serializedCookie = serializeCookies(responseCookies);
    const resStatus = authRes.status;
    const location = authRes.headers.get('location') || '';

    // Check if 2FA is prompted
    if (location.includes('two_factor') || location.includes('2fa') || resStatus === 303) {
      return res.json({
        success: false,
        requires2FA: true,
        tempCookie: serializedCookie,
        message: 'Autenticação de dois fatores (2FA) detectada na sua conta do Datadog.',
      });
    }

    // A redirect to / or /dashboard or /account/select indicates successful credential verification
    const isSuccessRedirect =
      resStatus === 302 &&
      (location === '/' ||
        location.startsWith('/dashboard') ||
        location.startsWith('/monitors') ||
        location.startsWith('/account/select'));

    // Check whether the session allows querying the API
    let verified = false;
    let userData: any = null;

    if (serializedCookie) {
      const verifyRes = await fetch(`https://${domain}/api/v1/user/self`, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
          Cookie: serializedCookie,
        },
      });

      if (verifyRes.ok) {
        verified = true;
        userData = await verifyRes.json().catch(() => ({}));
      } else {
        const monCheck = await fetch(`https://${domain}/api/v1/monitor?count=1`, {
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
            Cookie: serializedCookie,
          },
        });
        if (monCheck.ok) {
          verified = true;
        }
      }
    }

    if (isSuccessRedirect || verified) {
      return res.json({
        success: true,
        method: 'credentials',
        domain,
        cookie: serializedCookie,
        user: {
          email: userData?.user?.email || email,
          name: userData?.user?.name || userData?.user?.handle || email.split('@')[0],
        },
      });
    }

    // Datadog often protects /account/login with Cloudflare or reCAPTCHA to prevent automated bot attacks
    const responseText = await authRes.text();
    const isBotProtected =
      responseText.includes('recaptcha') ||
      responseText.includes('cf-turnstile') ||
      responseText.includes('challenge-running') ||
      resStatus === 403;

    if (isBotProtected) {
      return res.json({
        success: false,
        isBotProtected: true,
        error:
          'O Datadog bloqueou a tentativa de login automatizada exigindo verificação de navegador (reCAPTCHA). Utilize a aba de Sessão Web do seu navegador para conectar.',
        suggestion:
          'Para prosseguir com sua conta, copie o cookie de sessão `datadog_login` do seu navegador já autenticado no Datadog.',
      });
    }

    return res.json({
      success: false,
      error: 'Credenciais inválidas ou conta requer autenticação adicional (SSO/2FA).',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.json({
      success: false,
      error: error.message || 'Erro inesperado ao conectar ao Datadog.',
    });
  }
});

// Fetch a specific monitor state
app.post('/api/datadog/monitor/check', async (req, res) => {
  try {
    const { domain: rawDomain, sessionCookie, monitorIdOrUrl } = req.body;

    if (!monitorIdOrUrl) {
      return res.json({ success: false, error: 'ID ou URL do monitor é obrigatório.' });
    }

    // Extract numeric ID from input or URL
    const cleanInput = monitorIdOrUrl.toString().trim();
    const idMatch = cleanInput.match(/(\d{5,})/);
    const monitorId = idMatch ? idMatch[1] : cleanInput;

    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const parsed = extractCookieAndDomain(sessionCookie || '');
    const cleanCookie = sanitizeHeaderValue(parsed.cookie);
    const domain = normalizeDomain(parsed.domain || rawDomain);

    const monitorRes = await fetch(`https://${domain}/api/v1/monitor/${monitorId}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
        ...(cleanCookie ? { Cookie: cleanCookie } : {}),
      },
    });

    if ([301, 302, 303, 307, 308].includes(monitorRes.status)) {
      return res.json({
        success: false,
        error: 'Sessão do Datadog não autenticada (redirecionado para login). Conecte-se com email/senha ou insira o cookie de sessão.',
      });
    }

    if (monitorRes.status === 401 || monitorRes.status === 403) {
      return res.json({
        success: false,
        error: 'Sessão do Datadog expirada ou sem permissão para ler este monitor. Faça login novamente.',
      });
    }

    if (monitorRes.status === 404) {
      return res.json({
        success: false,
        error: `Monitor com ID #${monitorId} não foi encontrado no domínio ${domain}.`,
      });
    }

    if (!monitorRes.ok) {
      const errorText = await monitorRes.text().catch(() => '');
      return res.json({
        success: false,
        error: `Erro ao buscar monitor (${monitorRes.status}): ${errorText.slice(0, 150)}`,
      });
    }

    const monitor = await safeJsonFetch(monitorRes, 'Datadog Monitor');
    const classification = classifyMonitor(monitor);

    return res.json({
      success: true,
      monitor: {
        id: monitor.id,
        name: monitor.name || `Monitor #${monitor.id}`,
        type: monitor.type || 'metric alert',
        overall_state: monitor.overall_state || 'OK', // 'Alert' | 'Warn' | 'OK' | 'No Data'
        query: monitor.query || '',
        message: monitor.message || '',
        thresholds: monitor.options?.thresholds || {},
        last_triggered_ts: monitor.last_triggered_ts,
        classification,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Check monitor error:', error);
    return res.json({
      success: false,
      error: error.message || 'Erro ao verificar monitor no Datadog.',
    });
  }
});

// List monitors for current session
app.post('/api/datadog/monitors/list', async (req, res) => {
  try {
    const { domain: rawDomain, sessionCookie, search } = req.body;

    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const parsed = extractCookieAndDomain(sessionCookie || '');
    const cleanCookie = sanitizeHeaderValue(parsed.cookie);
    const domain = normalizeDomain(parsed.domain || rawDomain);

    const url = new URL(`https://${domain}/api/v1/monitor`);
    url.searchParams.set('page_size', '30');
    if (search) {
      url.searchParams.set('name', search);
    }

    const listRes = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
        ...(cleanCookie ? { Cookie: cleanCookie } : {}),
      },
    });

    if ([301, 302, 303, 307, 308].includes(listRes.status) || listRes.status === 401 || listRes.status === 403) {
      return res.json({
        success: false,
        error: 'Sessão do Datadog não autenticada ou expirada.',
      });
    }

    if (!listRes.ok) {
      return res.json({
        success: false,
        error: 'Não foi possível listar monitores. Sessão inválida ou sem permissão.',
      });
    }

    const monitorsList = await safeJsonFetch(listRes, 'Lista de Monitores');
    const simplified = (Array.isArray(monitorsList) ? monitorsList : []).map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      overall_state: m.overall_state,
      classification: classifyMonitor(m),
      query: m.query,
    }));

    return res.json({ success: true, monitors: simplified });
  } catch (error: any) {
    return res.json({ success: false, error: error.message });
  }
});

// Explicit catch-all for any unhandled /api requests to ensure JSON is always returned
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint de API não encontrado: ${req.method} ${req.originalUrl}`,
  });
});

// Vite middleware for development / static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
