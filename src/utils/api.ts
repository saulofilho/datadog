/**
 * Client-side safe API request helper.
 * Validates Content-Type header to ensure JSON is returned before attempting to parse,
 * providing clear user-facing messages instead of SyntaxError "Unexpected token '<'".
 */
export async function apiFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error(err.message || 'Falha de conexão com o servidor local.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    if (res.status === 403 || rawText.includes('403 Forbidden') || rawText.includes('Forbidden')) {
      throw new Error(
        'O Datadog exigiu verificação de proteção contra bots (reCAPTCHA) ou a requisição foi recusada. Conecte utilizando a aba "Sessão Web do Navegador" para autenticar com sua sessão ativa.'
      );
    }
    if (res.status === 401 || rawText.includes('401 Unauthorized')) {
      throw new Error('Sessão expirada ou credenciais não autorizadas pelo Datadog.');
    }
    if (rawText.includes('<html') || rawText.includes('<!doctype') || rawText.includes('<!DOCTYPE')) {
      throw new Error(
        `O servidor retornou uma resposta não esperada (HTTP ${res.status}). Verifique a conectividade ou tente conectar através do Cookie de Sessão.`
      );
    }
    throw new Error(`Resposta inválida recebida (HTTP ${res.status}): ${rawText.slice(0, 100)}`);
  }

  const data = await res.json();
  return data as T;
}
