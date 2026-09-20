import { playCriticalAlarm, playRecoveryChime } from './audioAlert';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações de sistema.');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn('Erro ao solicitar permissão de notificação:', error);
    return 'denied';
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  isCritical?: boolean;
  soundEnabled?: boolean;
  tag?: string;
  data?: any;
}

export function triggerPushAlert(payload: PushNotificationPayload) {
  const { title, body, isCritical = true, soundEnabled = true, tag = 'datadog-alert' } = payload;

  // 1. Play sound
  if (soundEnabled) {
    if (isCritical) {
      playCriticalAlarm();
    } else {
      playRecoveryChime();
    }
  }

  // 2. Dispatch Browser Push Notification if supported and granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        tag,
        requireInteraction: isCritical,
        icon: isCritical
          ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
          : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2322c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.warn('Falha ao instanciar Notification:', err);
    }
  }
}
