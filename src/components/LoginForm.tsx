import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Globe,
  Key,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { DatadogAuthSession, DatacenterRegion } from '../types';
import { apiFetchJson } from '../utils/api';
import { extractCookieAndDomain, parseAnyCookieInput } from '../utils/cookie';

interface LoginFormProps {
  onSuccess: (session: DatadogAuthSession) => void;
  savedSession: DatadogAuthSession | null;
}

const REGIONS: DatacenterRegion[] = [
  { id: 'us1', name: 'US1 (app.datadoghq.com)', domain: 'app.datadoghq.com', flag: '🇺🇸' },
  { id: 'us3', name: 'US3 (us3.datadoghq.com)', domain: 'us3.datadoghq.com', flag: '🇺🇸' },
  { id: 'us5', name: 'US5 (us5.datadoghq.com)', domain: 'us5.datadoghq.com', flag: '🇺🇸' },
  { id: 'eu1', name: 'EU (app.datadoghq.eu)', domain: 'app.datadoghq.eu', flag: '🇪🇺' },
  { id: 'ap1', name: 'AP1 (ap1.datadoghq.com)', domain: 'ap1.datadoghq.com', flag: '🇯🇵' },
];

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, savedSession }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'cookie'>('credentials');
  const [email, setEmail] = useState(savedSession?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(savedSession?.domain || 'app.datadoghq.com');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [manualSessionCookie, setManualSessionCookie] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [botProtectionNotice, setBotProtectionNotice] = useState<string | null>(null);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('copy(document.cookie)');
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const parsedSession = extractCookieAndDomain(manualSessionCookie);

  const handleCookieInput = (val: string) => {
    setManualSessionCookie(val);
    const parsed = extractCookieAndDomain(val);
    if (parsed.domain) {
      setSelectedDomain(parsed.domain);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setBotProtectionNotice(null);

    try {
      const payload: any = {
        domain: selectedDomain,
      };

      if (activeTab === 'cookie') {
        if (!manualSessionCookie.trim()) {
          setErrorMessage('Por favor, cole o cookie da sua sessão ativa do Datadog ou comando cURL.');
          setLoading(false);
          return;
        }
        if (parsedSession.error) {
          setErrorMessage(parsedSession.error);
          setLoading(false);
          return;
        }
        if (!parsedSession.cookie) {
          setErrorMessage('Nenhum cookie de sessão reconhecido. Copie o comando cURL completo ou o valor de datadog_login.');
          setLoading(false);
          return;
        }
        payload.sessionCookie = parsedSession.cookie;
        if (parsedSession.domain) {
          payload.domain = parsedSession.domain;
        }
        payload.email = email.trim() || 'Usuário Datadog';
      } else {
        if (!email.trim() || !password) {
          setErrorMessage('Por favor, informe seu email e senha cadastrados no Datadog.');
          setLoading(false);
          return;
        }
        payload.email = email.trim();
        payload.password = password;
        if (requires2FA && twoFactorCode) {
          payload.twoFactorCode = twoFactorCode.trim();
        }
      }

      const data = await apiFetchJson('/api/datadog/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!data.success) {
        if (data.requires2FA) {
          setRequires2FA(true);
          setErrorMessage('Autenticação em duas etapas detectada. Insira o código 2FA do seu aplicativo autenticador.');
        } else if (data.isBotProtected) {
          setBotProtectionNotice(
            'O Datadog exigiu verificação reCAPTCHA/Navegador para este login direto. Por favor, utilize a aba "Sessão Web do Navegador" para conectar diretamente com sua conta ativa.'
          );
          setActiveTab('cookie');
        } else {
          setErrorMessage(data.error || 'Falha ao autenticar no Datadog. Verifique suas credenciais.');
        }
        setLoading(false);
        return;
      }

      // Successful auth
      const newSession: DatadogAuthSession = {
        email: data.user?.email || email || 'datadog-user',
        domain: data.domain || selectedDomain,
        sessionCookie: data.cookie || '',
        method: data.method || 'credentials',
        connectedAt: new Date().toISOString(),
      };

      onSuccess(newSession);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-11 h-11 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
          DD
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Autenticação Padrão do Datadog
          </h2>
          <p className="text-sm text-slate-500">
            Conecte com sua conta sem precisar de API Key ou privilégios de administrador.
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 mb-5">
        <button
          id="tab-login-credentials"
          type="button"
          onClick={() => {
            setActiveTab('credentials');
            setErrorMessage(null);
          }}
          className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
            activeTab === 'credentials'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Login com Email & Senha
        </button>
        <button
          id="tab-login-cookie"
          type="button"
          onClick={() => {
            setActiveTab('cookie');
            setErrorMessage(null);
          }}
          className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cookie'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Sessão Web do Navegador
        </button>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {botProtectionNotice && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 text-sm">
          <HelpCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold mb-1">Proteção contra bots do Datadog ativada</p>
            <p className="text-amber-800">{botProtectionNotice}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datacenter Region */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Região / Datacenter do Datadog
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              id="datadog-region-select"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white text-slate-800"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.domain}>
                  {r.flag} {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTab === 'credentials' ? (
          <>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email de Acesso
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="datadog-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@suaempresa.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white text-slate-800"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Senha Padrão
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="datadog-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white text-slate-800"
                />
                <button
                  id="toggle-password-visibility-btn"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 2FA Code if required */}
            {requires2FA && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="block text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1.5">
                  Código de Autenticação 2FA (6 dígitos)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-purple-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="datadog-2fa-input"
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="123456"
                    maxLength={8}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-mono tracking-wider"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          /* Manual session cookie input */
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-3">
              <div className="font-semibold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  Como obter a sessão ativa do seu navegador (15 segundos):
                </span>
                <a
                  href={`https://${selectedDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 hover:underline font-medium inline-flex items-center gap-1 text-[11px]"
                >
                  Abrir Datadog
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
              </div>

              {/* Method 1: Copy as cURL (Most reliable) */}
              <div className="bg-white border border-slate-200 rounded p-2.5 space-y-1.5">
                <p className="font-semibold text-purple-900 text-xs">
                  Opção A (Mais fácil e 100% garantida — via aba Rede):
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Na aba do Datadog no navegador, pressione <kbd className="bg-slate-100 border px-1 rounded">F12</kbd> e clique na aba <strong>Network</strong> (Rede).</li>
                  <li>Recarregue a página (<kbd className="bg-slate-100 border px-1 rounded">F5</kbd>) ou clique em qualquer link do Datadog.</li>
                  <li>Clique com o <strong>botão direito</strong> em qualquer requisição da lista &rarr; <strong>Copy</strong> &rarr; <strong>Copy as cURL</strong>.</li>
                  <li>Cole o texto copiado diretamente na caixa abaixo (o sistema extrai o cookie automaticamente).</li>
                </ol>
              </div>

              {/* Method 2: Cookie datadog_login in Application tab */}
              <div className="bg-white border border-slate-200 rounded p-2.5 space-y-1.5">
                <p className="font-semibold text-slate-800 text-xs">
                  Opção B (Via aba Application/Armazenamento):
                </p>
                <p className="text-slate-600">
                  Pressione <kbd className="bg-slate-100 border px-1 rounded">F12</kbd> &rarr; aba <strong>Application</strong> &rarr; <strong>Cookies</strong> &rarr; <code className="text-purple-700 bg-purple-50 px-1 rounded">{selectedDomain}</code> &rarr; Copie o valor do cookie <strong>datadog_login</strong>.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Cole aqui o cURL ou o Cookie da Sessão
                </label>
                {manualSessionCookie.trim() && (
                  <div>
                    {parsedSession.cookie ? (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Sessão reconhecida {parsedSession.domain ? `(${parsedSession.domain})` : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        {manualSessionCookie.toLowerCase().includes('curl') ? 'cURL sem cabeçalho Cookie' : 'Formato incompleto'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <textarea
                id="datadog-cookie-input"
                value={manualSessionCookie}
                onChange={(e) => handleCookieInput(e.target.value)}
                placeholder="Cole aqui o cURL copiado do DevTools ou o valor de datadog_login..."
                rows={3}
                required
                className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white text-slate-800"
              />

              {parsedSession.error && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Atenção ao copiar o cURL:</p>
                    <p>{parsedSession.error}</p>
                    <p className="text-[11px] text-amber-800">
                      <strong>Dica:</strong> No Datadog, certifique-se de copiar uma requisição da aba Rede após recarregar a página (F5) para garantir que ela inclua o cabeçalho <code>-H "cookie: ..."</code>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            id="datadog-login-button"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando no Datadog...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>{activeTab === 'cookie' ? 'Conectar com Sessão' : 'Conectar com Credenciais'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
