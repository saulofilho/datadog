import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Activity,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Radio,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DatadogAuthSession, DatadogMonitorData, AlertLogItem } from './types';
import { LoginForm } from './components/LoginForm';
import { MonitorStatusCard } from './components/MonitorStatusCard';
import { MonitorConfig } from './components/MonitorConfig';
import { NotificationBanner } from './components/NotificationBanner';
import { AlertHistory } from './components/AlertHistory';
import { SimulationBar } from './components/SimulationBar';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerPushAlert,
} from './utils/notifications';
import { apiFetchJson } from './utils/api';

const SESSION_STORAGE_KEY = 'datadog_alerter_session_v1';
const HISTORY_STORAGE_KEY = 'datadog_alerter_history_v1';
const DEFAULT_MONITOR_ID = '18392019';

export default function App() {
  // Session State
  const [session, setSession] = useState<DatadogAuthSession | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Monitor Settings
  const [monitorInput, setMonitorInput] = useState<string>(() => {
    return localStorage.getItem('datadog_last_monitor_id') || DEFAULT_MONITOR_ID;
  });
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState<number>(30);
  const [alertFilter, setAlertFilter] = useState<'critical_only' | 'latency_critical' | 'error_critical' | 'all'>('critical_only');

  // Monitor Telemetry State
  const [activeMonitor, setActiveMonitor] = useState<DatadogMonitorData | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  const [secondsUntilNextCheck, setSecondsUntilNextCheck] = useState<number>(30);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Notification & Sound State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return getNotificationPermission();
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Alert History
  const [alertHistory, setAlertHistory] = useState<AlertLogItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const previousStateRef = useRef<string | null>(null);

  // Save session when updated
  const handleLoginSuccess = (newSession: DatadogAuthSession) => {
    setSession(newSession);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.warn('Failed to persist session:', e);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setActiveMonitor(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }
  };

  const handleClearHistory = () => {
    setAlertHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  };

  // Check monitor status
  const checkMonitorState = useCallback(
    async (monitorIdOrUrl?: string) => {
      const targetId = monitorIdOrUrl || monitorInput;
      if (!targetId || !session) return;

      setIsChecking(true);
      setErrorMessage(null);

      try {
        const data = await apiFetchJson('/api/datadog/monitor/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: session.domain,
            sessionCookie: session.sessionCookie,
            monitorIdOrUrl: targetId,
          }),
        });

        if (!data.success) {
          setErrorMessage(data.error || 'Não foi possível ler o monitor do Datadog.');
          return;
        }

        const monitor: DatadogMonitorData = data.monitor;
        setActiveMonitor(monitor);
        setLastCheckedTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );

        // Process Alert Dispatch
        const currentState = monitor.overall_state;
        const prevState = previousStateRef.current;
        previousStateRef.current = currentState;

        const isAlert = currentState === 'Alert';
        const isWarn = currentState === 'Warn';
        const isCriticalLatency = isAlert && monitor.classification.isLatency;
        const isCriticalError = isAlert && monitor.classification.isError;

        let shouldNotify = false;
        let alertCategory: 'latency' | 'error' | 'both' | 'general' = 'general';

        if (alertFilter === 'critical_only' && isAlert) {
          shouldNotify = true;
          if (isCriticalLatency && isCriticalError) alertCategory = 'both';
          else if (isCriticalLatency) alertCategory = 'latency';
          else if (isCriticalError) alertCategory = 'error';
        } else if (alertFilter === 'latency_critical' && isCriticalLatency) {
          shouldNotify = true;
          alertCategory = 'latency';
        } else if (alertFilter === 'error_critical' && isCriticalError) {
          shouldNotify = true;
          alertCategory = 'error';
        } else if (alertFilter === 'all' && (isAlert || isWarn)) {
          shouldNotify = true;
          if (isCriticalLatency) alertCategory = 'latency';
          else if (isCriticalError) alertCategory = 'error';
        }

        // Check if transition into alert occurred or state changed
        const stateChanged = prevState !== null && prevState !== currentState;
        const enteredAlert = stateChanged && isAlert;

        if ((enteredAlert || (prevState === null && isAlert)) && shouldNotify) {
          const alertTitle = isCriticalLatency
            ? `🚨 ALERTA CRÍTICO: Latência Elevada (#${monitor.id})`
            : isCriticalError
            ? `🚨 ALERTA CRÍTICO: Erros Detectados (#${monitor.id})`
            : `🚨 ALERTA CRÍTICO: Monitor Datadog (#${monitor.id})`;

          const alertBody = `Monitor "${monitor.name}" mudou para estado ${currentState}. Limiar crítico acionado!`;

          // Trigger Push Notification and Audio
          triggerPushAlert({
            title: alertTitle,
            body: alertBody,
            isCritical: true,
            soundEnabled,
            tag: `monitor-${monitor.id}`,
          });

          // Record in history
          const newLog: AlertLogItem = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            monitorId: monitor.id,
            monitorName: monitor.name,
            state: currentState,
            previousState: prevState || 'Início',
            alertType: alertCategory,
            title: alertTitle,
            details: alertBody,
          };

          setAlertHistory((prev) => {
            const updated = [newLog, ...prev.slice(0, 49)];
            try {
              localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to persist history:', e);
            }
            return updated;
          });
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Falha de comunicação com o servidor de checagem.');
      } finally {
        setIsChecking(false);
        setSecondsUntilNextCheck(pollingIntervalSeconds);
      }
    },
    [session, monitorInput, pollingIntervalSeconds, alertFilter, soundEnabled]
  );

  // Apply new monitor ID or URL
  const handleApplyMonitor = (newIdOrUrl: string) => {
    setMonitorInput(newIdOrUrl);
    try {
      localStorage.setItem('datadog_last_monitor_id', newIdOrUrl);
    } catch (e) {
      console.warn('Failed to persist monitor id:', e);
    }
    checkMonitorState(newIdOrUrl);
  };

  // Permission request handler
  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
  };

  // Interval Countdown & Auto-polling
  useEffect(() => {
    if (!session) return;

    // Initial check if we don't have active monitor data yet
    if (!activeMonitor && !isChecking) {
      checkMonitorState();
    }

    const timer = setInterval(() => {
      setSecondsUntilNextCheck((prev) => {
        if (prev <= 1) {
          checkMonitorState();
          return pollingIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session, pollingIntervalSeconds, checkMonitorState, activeMonitor, isChecking]);

  // Simulation handler for testing latency / error spikes
  const handleSimulate = (type: 'latency' | 'error' | 'both' | 'recovery') => {
    const id = activeMonitor?.id || monitorInput || '18392019';
    const now = new Date().toISOString();

    if (type === 'recovery') {
      const recoveredMonitor: DatadogMonitorData = {
        id,
        name: activeMonitor?.name || 'Monitor de API - Latência & Erros',
        type: 'metric alert',
        overall_state: 'OK',
        query: 'avg(last_5m):avg:trace.http.request.duration{service:api} > 1.5',
        thresholds: { critical: 1.5, warning: 1.0 },
        last_triggered_ts: Math.floor(Date.now() / 1000),
        classification: {
          isCritical: false,
          isWarning: false,
          isOk: true,
          isNoData: false,
          isLatency: true,
          isError: false,
          alertCategory: 'latency',
        },
      };

      setActiveMonitor(recoveredMonitor);
      previousStateRef.current = 'OK';
      triggerPushAlert({
        title: '✅ Recuperado: Monitor Datadog Normalizado',
        body: `Monitor #${id} voltou ao estado normal (OK). Latência e erros restabelecidos.`,
        isCritical: false,
        soundEnabled,
        tag: `monitor-${id}`,
      });

      const log: AlertLogItem = {
        id: `${Date.now()}`,
        timestamp: now,
        monitorId: id,
        monitorName: recoveredMonitor.name,
        state: 'OK',
        previousState: 'Alert',
        alertType: 'general',
        title: '✅ Recuperado: Monitor Datadog Normalizado',
        details: 'Métricas retornaram aos limites saudáveis de operação.',
      };
      setAlertHistory((prev) => [log, ...prev.slice(0, 49)]);
      return;
    }

    const isLat = type === 'latency' || type === 'both';
    const isErr = type === 'error' || type === 'both';

    const simulatedMonitor: DatadogMonitorData = {
      id,
      name: isLat && isErr
        ? 'Pico Crítico de Latência (>2.5s) e Erro 5xx (>5%)'
        : isLat
        ? 'Alerta Crítico: Latência p99 Excedeu 2.500ms'
        : 'Alerta Crítico: Taxa de Erros 5xx Acima de 8.4%',
      type: 'metric alert',
      overall_state: 'Alert',
      query: isLat
        ? 'avg(last_5m):avg:trace.http.request.duration{service:checkout} > 1.5'
        : 'sum(last_5m):sum:trace.http.request.errors{service:checkout}.as_rate() > 0.05',
      thresholds: { critical: isLat ? 1.5 : 0.05, warning: isLat ? 1.0 : 0.02 },
      last_triggered_ts: Math.floor(Date.now() / 1000),
      classification: {
        isCritical: true,
        isWarning: false,
        isOk: false,
        isNoData: false,
        isLatency: isLat,
        isError: isErr,
        alertCategory: isLat && isErr ? 'both' : isLat ? 'latency' : 'error',
      },
    };

    setActiveMonitor(simulatedMonitor);
    previousStateRef.current = 'Alert';

    const title = isLat && isErr
      ? `🚨 ALERTA CRÍTICO: Latência e Erros (#${id})`
      : isLat
      ? `🚨 ALERTA CRÍTICO: Latência Alta p99 (#${id})`
      : `🚨 ALERTA CRÍTICO: Erros 5xx Elevados (#${id})`;

    const body = `Limiar crítico excedido no Datadog. Ação imediata necessária!`;

    triggerPushAlert({
      title,
      body,
      isCritical: true,
      soundEnabled,
      tag: `monitor-${id}`,
    });

    const newLog: AlertLogItem = {
      id: `${Date.now()}`,
      timestamp: now,
      monitorId: id,
      monitorName: simulatedMonitor.name,
      state: 'Alert',
      previousState: 'OK',
      alertType: isLat && isErr ? 'both' : isLat ? 'latency' : 'error',
      title,
      details: body,
    };

    setAlertHistory((prev) => [newLog, ...prev.slice(0, 49)]);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-700 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm">
              DD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Datadog Monitor Alerter
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                  Push Alerts
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Aviso instantâneo de latência e erros críticos via push notification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">
                    {session.email}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {session.domain}
                  </div>
                </div>
                <button
                  id="logout-session-btn"
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                  title="Desconectar do Datadog"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Autenticação Direta</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!session ? (
          /* Login View with Standard Credentials */
          <div className="py-6 sm:py-12">
            <LoginForm onSuccess={handleLoginSuccess} savedSession={session} />
          </div>
        ) : (
          /* Authenticated Monitoring Dashboard */
          <div className="space-y-6">
            {/* Notification Permission & Audio banner */}
            <NotificationBanner
              permission={notificationPermission}
              onRequestPermission={handleRequestPermission}
              soundEnabled={soundEnabled}
              onToggleSound={setSoundEnabled}
              isIframe={isIframe}
            />

            {/* Error banner if check failed */}
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Aviso ao consultar monitor</div>
                  <div className="text-rose-700 mt-0.5">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Live Active Monitor Card */}
            {activeMonitor ? (
              <MonitorStatusCard
                monitor={activeMonitor}
                isChecking={isChecking}
                onRefreshNow={() => checkMonitorState()}
                lastCheckedTime={lastCheckedTime}
                secondsUntilNextCheck={secondsUntilNextCheck}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
                <Radio className="w-8 h-8 text-purple-600 animate-pulse mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 text-base">Iniciando leitura do monitor...</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Consultando o estado atual do monitor #{monitorInput} no Datadog.
                </p>
              </div>
            )}

            {/* Monitor Configuration Box */}
            <MonitorConfig
              session={session}
              monitorInput={monitorInput}
              onMonitorInputChange={setMonitorInput}
              onApplyMonitor={handleApplyMonitor}
              pollingIntervalSeconds={pollingIntervalSeconds}
              onIntervalChange={setPollingIntervalSeconds}
              alertFilter={alertFilter}
              onFilterChange={setAlertFilter}
              isChecking={isChecking}
            />

            {/* Interactive Alert Simulator Laboratory */}
            <SimulationBar
              onSimulate={handleSimulate}
              isSimulating={false}
            />

            {/* Historic Alerts Log */}
            <AlertHistory
              history={alertHistory}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Datadog Monitor Alerter • Focado exclusivamente no aviso de latência e erros</span>
          <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
            <span>Polling: {pollingIntervalSeconds}s</span>
            <span>•</span>
            <span>Som: {soundEnabled ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
