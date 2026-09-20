export interface DatadogUser {
  email: string;
  name: string;
}

export interface DatadogAuthSession {
  email: string;
  domain: string;
  sessionCookie: string;
  method: 'credentials' | 'session_cookie';
  connectedAt: string;
}

export interface MonitorThresholds {
  critical?: number;
  warning?: number;
  critical_recovery?: number;
  warning_recovery?: number;
  ok?: number;
}

export interface MonitorClassification {
  isCritical: boolean;
  isWarning: boolean;
  isOk: boolean;
  isNoData: boolean;
  isLatency: boolean;
  isError: boolean;
  alertCategory: 'latency' | 'error' | 'both' | 'metric';
}

export interface DatadogMonitorData {
  id: number | string;
  name: string;
  type: string;
  overall_state: 'Alert' | 'Warn' | 'OK' | 'No Data';
  query: string;
  message?: string;
  thresholds: MonitorThresholds;
  last_triggered_ts?: number;
  classification: MonitorClassification;
}

export interface AlertLogItem {
  id: string;
  timestamp: string;
  monitorId: string | number;
  monitorName: string;
  state: 'Alert' | 'Warn' | 'OK' | 'No Data';
  previousState?: string;
  alertType: 'latency' | 'error' | 'both' | 'general';
  title: string;
  details: string;
}

export interface DatacenterRegion {
  id: string;
  name: string;
  domain: string;
  flag: string;
}
