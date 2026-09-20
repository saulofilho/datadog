import React from 'react';
import { PlayCircle, ShieldAlert, Gauge, CheckCircle2, Flame } from 'lucide-react';

interface SimulationBarProps {
  onSimulate: (type: 'latency' | 'error' | 'both' | 'recovery') => void;
  isSimulating: boolean;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({ onSimulate, isSimulating }) => {
  return (
    <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-700/80 flex items-center justify-center text-purple-200">
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-wide uppercase text-purple-200">
              Laboratório de Teste de Alertas
            </h4>
            <p className="text-xs text-slate-300">
              Simule o disparo de alertas críticos para validar a notificação push e a sirene sonora.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSimulate('latency')}
            className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-400/30"
            title="Disparar estado de alerta crítico de latência"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Simular Latência Crítica</span>
          </button>

          <button
            onClick={() => onSimulate('error')}
            className="px-2.5 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-red-400/30"
            title="Disparar estado de alerta crítico de erros 5xx"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Simular Erro Crítico (5xx)</span>
          </button>

          <button
            onClick={() => onSimulate('recovery')}
            className="px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-400/30"
            title="Simular volta ao normal (OK)"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Simular Recuperação (OK)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
