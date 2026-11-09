// ==============================================================================
// GestorMF - Ponte Nativa Híbrida (Capacitor Android / iOS / Web)
// ==============================================================================
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

const OFFLINE_GPS_QUEUE_KEY = 'gestormf_native_offline_gps_v1';
const MAX_QUEUE_SIZE = 500; // Proteção contra consumo excessivo de armazenamento

/**
 * Retorna se a aplicação está rodando em ambiente nativo (APK Android ou iOS)
 */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

/**
 * Retorna a plataforma atual: 'android' | 'ios' | 'web'
 */
export function getAppPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch (e) {
    return 'web';
  }
}

/**
 * Inicializa ouvintes nativos de ciclo de vida (quando o app volta do segundo plano)
 */
export function initNativeLifecycleListeners(onResumeCallback) {
  if (!isNativeApp()) return () => {};

  try {
    const listenerPromise = App.addListener('appStateChange', (state) => {
      if (state.isActive && typeof onResumeCallback === 'function') {
        onResumeCallback();
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  } catch (e) {
    return () => {};
  }
}

/**
 * Solicita permissões de localização (com suporte nativo no Android e iOS)
 */
export async function requestLocationPermissions() {
  if (isNativeApp()) {
    try {
      const status = await Geolocation.requestPermissions({
        permissions: ['location']
      });
      return status.location === 'granted';
    } catch (e) {
      console.warn('[NativeBridge] Erro ao solicitar permissões nativas:', e);
      return false;
    }
  }

  // Fallback para Web / PC
  if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
    try {
      const res = await navigator.permissions.query({ name: 'geolocation' });
      return res.state === 'granted' || res.state === 'prompt';
    } catch (e) {}
  }
  return true;
}

/**
 * Obtém a posição atual do sensor de satélite GPS com alta precisão
 */
export async function getNativePosition() {
  const capturedAt = new Date().toISOString();

  if (isNativeApp()) {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      });

      return {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        speed: pos.coords.speed !== null && pos.coords.speed !== undefined ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : 0, // km/h
        heading: pos.coords.heading || 0,
        accuracy: Math.round(pos.coords.accuracy || 0),
        capturedAt,
        isNative: true,
        platform: getAppPlatform()
      };
    } catch (err) {
      console.warn('[NativeBridge] Erro ao capturar posição nativa:', err);
    }
  }

  // Fallback padrão Web
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocalização não suportada neste dispositivo.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speed: pos.coords.speed !== null && pos.coords.speed !== undefined ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : 0,
          heading: pos.coords.heading || 0,
          accuracy: Math.round(pos.coords.accuracy || 0),
          capturedAt,
          isNative: false,
          platform: 'web'
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      }
    );
  });
}

/**
 * Fila Offline Persistente: Armazena pontos quando o veículo estiver sem sinal de internet
 */
export async function enqueueOfflineGpsPoint(point) {
  try {
    const raw = await Preferences.get({ key: OFFLINE_GPS_QUEUE_KEY });
    const queue = raw.value ? JSON.parse(raw.value) : [];

    // Mantém no máximo MAX_QUEUE_SIZE para não saturar memória
    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift();
    }

    queue.push({
      ...point,
      id: 'pt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    });

    await Preferences.set({
      key: OFFLINE_GPS_QUEUE_KEY,
      value: JSON.stringify(queue)
    });
  } catch (e) {
    // Fallback localStorage
    try {
      const q = JSON.parse(localStorage.getItem(OFFLINE_GPS_QUEUE_KEY) || '[]');
      if (q.length >= MAX_QUEUE_SIZE) q.shift();
      q.push(point);
      localStorage.setItem(OFFLINE_GPS_QUEUE_KEY, JSON.stringify(q));
    } catch (err) {}
  }
}

/**
 * Envia todos os pontos pendentes da fila offline assim que a conexão restabelecer
 */
export async function flushOfflineGpsQueue(senderFunction) {
  if (typeof senderFunction !== 'function') return;

  let queue = [];
  try {
    const raw = await Preferences.get({ key: OFFLINE_GPS_QUEUE_KEY });
    queue = raw.value ? JSON.parse(raw.value) : [];
  } catch (e) {
    try {
      queue = JSON.parse(localStorage.getItem(OFFLINE_GPS_QUEUE_KEY) || '[]');
    } catch (err) {}
  }

  if (queue.length === 0) return;

  const remaining = [];
  for (const point of queue) {
    try {
      const success = await senderFunction(point);
      if (!success) {
        remaining.push(point);
      }
    } catch (e) {
      remaining.push(point);
    }
  }

  try {
    await Preferences.set({
      key: OFFLINE_GPS_QUEUE_KEY,
      value: JSON.stringify(remaining)
    });
  } catch (e) {
    try {
      localStorage.setItem(OFFLINE_GPS_QUEUE_KEY, JSON.stringify(remaining));
    } catch (err) {}
  }
}

