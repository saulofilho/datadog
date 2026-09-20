import React from 'react';
import { History, Trash2, AlertTriangle, CheckCircle, ShieldAlert, Gauge, Clock } from 'lucide-react';
import { AlertLogItem } from '../types';

interface AlertHistoryProps {
  history: AlertLogItem[];
  onClearHistory: () => void;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({ history, onClearHistory }) => {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2.5">
          <History className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Nenhum alerta registrado ainda</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          O histórico registrará automaticamente qualquer transição para alerta crítico de latência ou erro detectado no Datadog.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            Histórico de Alertas e Notificações ({history.length})
          </h3>
        </div>
        <button
          onClick={onClearHistory}
          className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpar</span>
        </button>
      </div>

      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {history.map((item) => {
          const isCritical = item.state === 'Alert';
          const isOk = item.state === 'OK';

          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                isCritical
                  ? 'bg-rose-50/60 border-rose-200'
                  : isOk
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-amber-50/50 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                    isCritical
                      ? 'bg-rose-600 text-white'
                      : isOk
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {isCritical ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isOk ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        isCritical
                          ? 'bg-rose-100 text-rose-800'
                          : isOk
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.state}
                    </span>
                    {item.alertType === 'latency' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                        <Gauge className="w-2.5 h-2.5" /> Latência
                      </span>
                    )}
                    {item.alertType === 'error' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.2 rounded">
                        <ShieldAlert className="w-2.5 h-2.5" /> Erro 5xx
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mt-1">{item.details}</p>
                  <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                    Monitor #{item.monitorId} • {item.monitorName}
                  </span>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-400 font-mono whitespace-nowrap">
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
