// ==============================================================================
// GestorMF - Sistema de Notificações Push, Web Audio Chime & Vibração
// ==============================================================================

let sharedAudioCtx = null;

/**
 * Desbloqueia o motor de áudio no primeiro toque na tela do smartphone (iOS/Android)
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
        if (sharedAudioCtx.state === 'suspended') {
          sharedAudioCtx.resume();
        }
      }
    } catch (e) {}
  };
  window.addEventListener('click', unlock, { passive: true, once: true });
  window.addEventListener('touchstart', unlock, { passive: true, once: true });
}

// Inicia escuta automática
if (typeof window !== 'undefined') {
  initAudioUnlock();
}

/**
 * Toca um sinal sonoro moderno e agradável utilizando a Web Audio API nativa
 * (funciona instantaneamente sem necessidade de download de arquivos mp3 externos)
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }

    const ctx = sharedAudioCtx;

    // Primeiro tom suave (Frequência Ré: ~587 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.29);

    // Segundo tom harmonioso mais alto (Frequência Lá: ~880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
    gain2.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.56);
  } catch (e) {
    // Silencioso se bloqueado pelo navegador
  }
}

/**
 * Solicita permissão para exibir notificações nativas no celular / navegador
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') {
    registerPushSubscriptionWithServer().catch(() => {});
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      registerPushSubscriptionWithServer().catch(() => {});
    }
    return permission;
  } catch (e) {
    return 'denied';
  }
}

/**
 * Registra o dispositivo no backend para recebimento de Web Push (Item 06)
 */
export async function registerPushSubscriptionWithServer() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const subJson = subscription.toJSON ? subscription.toJSON() : subscription;
      await fetch('/api/push.php?action=subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys || {}
        })
      });
      return subscription;
    }
  } catch (err) {
    // Falha silenciosa em navegadores sem suporte total
  }
  return null;
}

/**
 * Envia uma notificação Push nativa com vibração e som
 */
export function sendPushNotification(title, options = {}) {
  // 1. Toca som e vibração no smartphone
  playNotificationSound();

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch (e) {}
  }

  // 2. Se as notificações do sistema estiverem autorizadas
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const defaultOptions = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'gestormf-mission-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200, 100, 300],
        ...options,
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, defaultOptions);
        });
      } else {
        new Notification(title, defaultOptions);
      }
    } catch (err) {
      console.warn('Falha ao disparar Notification nativa:', err);
    }
  }
}

