import React, { useState } from 'react';
import { Search, Sliders, Clock, Bell, ListFilter, Check, Loader2 } from 'lucide-react';
import { DatadogAuthSession } from '../types';
import { apiFetchJson } from '../utils/api';

interface MonitorConfigProps {
  session: DatadogAuthSession;
  monitorInput: string;
  onMonitorInputChange: (val: string) => void;
  onApplyMonitor: (monitorIdOrUrl: string) => void;
  pollingIntervalSeconds: number;
  onIntervalChange: (secs: number) => void;
  alertFilter: 'critical_only' | 'latency_critical' | 'error_critical' | 'all';
  onFilterChange: (filter: 'critical_only' | 'latency_critical' | 'error_critical' | 'all') => void;
  isChecking: boolean;
}

export const MonitorConfig: React.FC<MonitorConfigProps> = ({
  session,
  monitorInput,
  onMonitorInputChange,
  onApplyMonitor,
  pollingIntervalSeconds,
  onIntervalChange,
  alertFilter,
  onFilterChange,
  isChecking,
}) => {
  const [fetchingMonitors, setFetchingMonitors] = useState(false);
  const [discoveredMonitors, setDiscoveredMonitors] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const handleFetchMonitors = async () => {
    setFetchingMonitors(true);
    setPickerError(null);
    try {
      const data = await apiFetchJson('/api/datadog/monitors/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: session.domain,
          sessionCookie: session.sessionCookie,
        }),
      });
      if (data.success && Array.isArray(data.monitors)) {
        setDiscoveredMonitors(data.monitors);
        setShowPicker(true);
      } else {
        setPickerError(data.error || 'Não foi possível carregar a lista de monitores da conta.');
      }
    } catch (err: any) {
      setPickerError(err.message || 'Erro ao consultar lista.');
    } finally {
      setFetchingMonitors(false);
    }
  };

  const handleSelectFromList = (id: number | string) => {
    onMonitorInputChange(id.toString());
    onApplyMonitor(id.toString());
    setShowPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (monitorInput.trim()) {
      onApplyMonitor(monitorInput.trim());
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-base">Configuração do Monitor Datadog</h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Domínio: <strong className="text-slate-700">{session.domain}</strong>
        </span>
      </div>

      {/* Monitor URL or ID input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          ID ou URL do Monitor no Datadog
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="monitor-id-url-input"
              type="text"
              value={monitorInput}
              onChange={(e) => onMonitorInputChange(e.target.value)}
              placeholder="Ex: 18392019 ou https://app.datadoghq.com/monitors/18392019"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white text-slate-800"
            />
          </div>
          <button
            id="apply-monitor-btn"
            type="submit"
            disabled={isChecking || !monitorInput.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isChecking ? 'Carregando...' : 'Monitorar'}
          </button>
          <button
            id="list-monitors-btn"
            type="button"
            onClick={handleFetchMonitors}
            disabled={fetchingMonitors}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            title="Listar monitores disponíveis na sua conta"
          >
            {fetchingMonitors ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ListFilter className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Buscar Monitores</span>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Dica: Você pode colar a URL inteira da página do monitor no Datadog ou somente o ID numérico.
        </p>
      </form>

      {/* Discovered monitors picker modal / list */}
      {pickerError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          {pickerError}
        </div>
      )}

      {showPicker && discoveredMonitors.length > 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-52 overflow-y-auto space-y-1.5">
          <div className="flex items-center justify-between pb-1 text-xs font-semibold text-slate-600">
            <span>Selecione um monitor da sua conta ({discoveredMonitors.length} encontrados):</span>
            <button
              onClick={() => setShowPicker(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Fechar
            </button>
          </div>
          {discoveredMonitors.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelectFromList(m.id)}
              className="w-full text-left p-2 rounded bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 transition-colors flex items-center justify-between gap-2 text-xs"
            >
              <div className="truncate flex-1">
                <span className="font-semibold text-slate-800">#{m.id}</span> - {m.name}
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  m.overall_state === 'Alert'
                    ? 'bg-rose-100 text-rose-700'
                    : m.overall_state === 'Warn'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {m.overall_state}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Polling frequency and trigger criteria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        {/* Polling Interval */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Frequência de Verificação Automática
          </label>
          <select
            id="polling-frequency-select"
            value={pollingIntervalSeconds}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800"
          >
            <option value={15}>A cada 15 segundos (Alta Frequência)</option>
            <option value={30}>A cada 30 segundos (Recomendado)</option>
            <option value={60}>A cada 1 minuto</option>
            <option value={120}>A cada 2 minutos</option>
            <option value={300}>A cada 5 minutos</option>
          </select>
        </div>

        {/* Push Notification Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-slate-400" />
            Condição para Disparar Notificação Push
          </label>
          <select
            id="alert-filter-select"
            value={alertFilter}
            onChange={(e) => onFilterChange(e.target.value as any)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800"
          >
            <option value="critical_only">Somente Alerta Crítico (Alert / Latência ou Erro)</option>
            <option value="latency_critical">Somente Latência Crítica</option>
            <option value="error_critical">Somente Taxa de Erro Crítica</option>
            <option value="all">Qualquer Alerta ou Aviso (Alert + Warn)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
