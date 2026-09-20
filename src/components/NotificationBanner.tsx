import React from 'react';
import { Bell, BellOff, Volume2, VolumeX, ExternalLink, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { triggerPushAlert } from '../utils/notifications';

interface NotificationBannerProps {
  permission: NotificationPermission;
  onRequestPermission: () => Promise<void>;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  isIframe: boolean;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  permission,
  onRequestPermission,
  soundEnabled,
  onToggleSound,
  isIframe,
}) => {
  const handleTestAlert = () => {
    triggerPushAlert({
      title: '🚨 Teste Datadog: Alerta Crítico Detectado!',
      body: 'Latência p99 excedeu 2400ms (Limiar crítico: > 1500ms). Notificação push e aviso sonoro funcionando!',
      isCritical: true,
      soundEnabled,
      tag: 'test-datadog-alert',
    });
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Permission status */}
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              permission === 'granted'
                ? 'bg-emerald-100 text-emerald-700'
                : permission === 'denied'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {permission === 'granted' ? (
              <Bell className="w-5 h-5" />
            ) : permission === 'denied' ? (
              <BellOff className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5 animate-bounce" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Notificações Push do Sistema Operacional
              </h4>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  permission === 'granted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : permission === 'denied'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {permission === 'granted'
                  ? 'Ativadas'
                  : permission === 'denied'
                  ? 'Bloqueadas no Navegador'
                  : 'Aguardando Permissão'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {permission === 'granted'
                ? 'Você receberá avisos no desktop/celular mesmo se estiver em outra aba ou tela.'
                : permission === 'denied'
                ? 'Notificações de sistema foram bloqueadas nas configurações do navegador. Use o alerta sonoro em segundo plano.'
                : 'Clique no botão ao lado para autorizar avisos imediatos de latência e erros críticos.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {permission !== 'granted' && (
            <button
              id="request-push-perm-btn"
              type="button"
              onClick={onRequestPermission}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Ativar Notificações Push</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            id="toggle-sound-btn"
            type="button"
            onClick={() => onToggleSound(!soundEnabled)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title="Sirene sonora para alertas críticos"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Som: {soundEnabled ? 'Ligado' : 'Mudo'}</span>
          </button>

          {/* Test Alert Button */}
          <button
            id="test-alert-btn"
            type="button"
            onClick={handleTestAlert}
            className="px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 text-purple-600" />
            <span>Testar Alerta Agora</span>
          </button>

          {/* Open in New Tab if inside iframe */}
          {isIframe && (
            <button
              id="open-in-tab-btn"
              type="button"
              onClick={handleOpenNewTab}
              className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              title="Abrir em aba cheia para garantir push notifications mesmo com o navegador minimizado"
            >
              <ExternalLink className="w-3 h-3 text-slate-500" />
              <span>Abrir em Nova Aba</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
