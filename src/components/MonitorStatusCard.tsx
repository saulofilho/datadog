import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  Activity,
  Gauge,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { DatadogMonitorData } from '../types';

interface MonitorStatusCardProps {
  monitor: DatadogMonitorData;
  isChecking: boolean;
  onRefreshNow: () => void;
  lastCheckedTime: string | null;
  secondsUntilNextCheck: number;
}

export const MonitorStatusCard: React.FC<MonitorStatusCardProps> = ({
  monitor,
  isChecking,
  onRefreshNow,
  lastCheckedTime,
  secondsUntilNextCheck,
}) => {
  const { overall_state, name, type, classification, thresholds, query, last_triggered_ts } = monitor;

  const isAlert = overall_state === 'Alert';
  const isWarn = overall_state === 'Warn';
  const isOk = overall_state === 'OK';

  const badgeConfig = isAlert
    ? {
        bg: 'bg-rose-500',
        cardBorder: 'border-rose-300 ring-4 ring-rose-100',
        cardBg: 'bg-rose-50/40',
        badgeText: 'text-white',
        statusTitle: 'ALERTA CRÍTICO ATIVO',
        description: 'O monitor do Datadog atingiu o limiar crítico configurado!',
        Icon: AlertTriangle,
      }
    : isWarn
    ? {
        bg: 'bg-amber-500',
        cardBorder: 'border-amber-300 ring-2 ring-amber-100',
        cardBg: 'bg-amber-50/40',
        badgeText: 'text-white',
        statusTitle: 'AVISO / DEGRADADO',
        description: 'O monitor atingiu o limiar de aviso (atenção necessária).',
        Icon: AlertCircle,
      }
    : isOk
    ? {
        bg: 'bg-emerald-500',
        cardBorder: 'border-emerald-200',
        cardBg: 'bg-emerald-50/30',
        badgeText: 'text-white',
        statusTitle: 'SAUDÁVEL / NORMAL (OK)',
        description: 'Métricas de latência e erros operando dentro da normalidade.',
        Icon: CheckCircle2,
      }
    : {
        bg: 'bg-slate-400',
        cardBorder: 'border-slate-200',
        cardBg: 'bg-slate-50',
        badgeText: 'text-white',
        statusTitle: 'SEM DADOS (NO DATA)',
        description: 'Nenhuma telemetria recente recebida pelo Datadog para esta consulta.',
        Icon: HelpCircle,
      };

  const StatusIcon = badgeConfig.Icon;

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 p-6 ${badgeConfig.cardBorder} ${badgeConfig.cardBg} bg-white shadow-sm`}
    >
      {/* Top Bar with Status Badge and Manual Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl ${badgeConfig.bg} flex items-center justify-center text-white shadow-sm ${
              isAlert ? 'animate-pulse' : ''
            }`}
          >
            <StatusIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${badgeConfig.bg} ${badgeConfig.badgeText}`}
              >
                {overall_state.toUpperCase()}
              </span>
              {classification.alertCategory === 'latency' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  <Gauge className="w-3 h-3" /> Latência
                </span>
              )}
              {classification.alertCategory === 'error' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800">
                  <ShieldAlert className="w-3 h-3" /> Taxa de Erro
                </span>
              )}
              {classification.alertCategory === 'both' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                  <Zap className="w-3 h-3" /> Latência & Erro
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{badgeConfig.statusTitle}</h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-500 hidden sm:block">
            <div className="flex items-center gap-1 justify-end font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Próxima leitura: {secondsUntilNextCheck}s</span>
            </div>
            {lastCheckedTime && <div>Última checagem: {lastCheckedTime}</div>}
          </div>

          <button
            id="refresh-monitor-now-btn"
            type="button"
            onClick={onRefreshNow}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-purple-600' : ''}`} />
            <span>{isChecking ? 'Verificando...' : 'Verificar Agora'}</span>
          </button>
        </div>
      </div>

      {/* Monitor Name & Query info */}
      <div className="mt-5 space-y-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Monitor Monitorado (#{monitor.id})
          </div>
          <h2 className="text-lg font-bold text-slate-900 leading-snug">{name}</h2>
          <p className="text-sm text-slate-600 mt-0.5">{badgeConfig.description}</p>
        </div>

        {/* Query details */}
        {query && (
          <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-slate-800">
            <div className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Query Datadog:</div>
            <code>{query}</code>
          </div>
        )}

        {/* Metrics & Thresholds Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-white/80 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Tipo de Monitor
            </span>
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              {type || 'Metric Alert'}
            </span>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Limiar Crítico
            </span>
            <span className="text-sm font-bold text-rose-600 flex items-center gap-1.5 mt-1">
              {thresholds.critical !== undefined ? thresholds.critical : 'Configurado na Query'}
            </span>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Limiar de Aviso
            </span>
            <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 mt-1">
              {thresholds.warning !== undefined ? thresholds.warning : 'N/A'}
            </span>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Último Disparo
            </span>
            <span className="text-sm font-medium text-slate-700 mt-1 block">
              {last_triggered_ts
                ? new Date(last_triggered_ts * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Sem registro'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
