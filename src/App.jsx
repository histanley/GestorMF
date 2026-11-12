import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './App.css';
import logoDark from './assets/logo-dark.png';
import logoLight from './assets/logo-light.png';
import {
  MapPin,
  Film,
  Table,
  Car,
  Users,
  Settings,
  Plus,
  Navigation,
  Fuel,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Sun,
  Moon,
  Menu,
  X,
  Smartphone,
  Tablet,
  Monitor,
  LogOut,
  Sliders,
  Bell,
  BellRing,
  Radio,
  Shield,
  ShieldCheck,
  Zap,
  User,
} from 'lucide-react';

import MapView from './components/MapView';
import ServiceBoard from './components/ServiceBoard';
import VehicleManager from './components/VehicleManager';
import TeamManager from './components/TeamManager';
import AdminCenter from './components/AdminCenter';
import CollaboratorSpace from './components/CollaboratorSpace';
import MissionModal from './components/MissionModal';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import UserMenu from './components/UserMenu';
import UserProfileModal from './components/UserProfileModal';
import PermissionsModal from './components/PermissionsModal';
import ConfirmModal from './components/ConfirmModal';
import NotificationsCenter from './components/NotificationsCenter';
import SendMessageModal from './components/SendMessageModal';
import { registerDialogListener, confirmDialog, alertDialog } from './utils/dialog';

import {
  getCurrentUser,
  setCurrentUser as setStoredCurrentUser,
  getStoredUsers,
  logoutUser,
  ROLES,
  ROLE_CONFIG,
  normalizeRole,
} from './utils/auth';

import {
  DEFAULT_SETTINGS,
  DEFAULT_ROLES,
  INITIAL_VEHICLES,
  INITIAL_MEMBERS,
  INITIAL_MISSIONS,
} from './utils/initialData';
import {
  apiGetMissions,
  apiSaveMission,
  apiDeleteMission,
  apiGetVehicles,
  apiSaveVehicle,
  apiDeleteVehicle,
  apiGetMembers,
  apiSaveMember,
  apiDeleteMember,
  apiGetSettings,
  apiSaveSettings,
  subscribeToRealtimeSync,
  apiLogout,
  apiSyncUsers,
  apiSendGpsLocation,
  apiStopGpsLocation,
  apiGetMessages,
  apiSendMessage,
  apiMarkMessageRead,
  apiDeleteMessage,
  apiDismissAllMessages,
  apiRespondExtraHours,
  apiUpdatePixKey,
} from './utils/api';
import {
  sendPushNotification,
  requestNotificationPermission,
  playNotificationSound,
} from './utils/notifications';
import {
  fetchRouteOSRM,
  calculateFuelEstimate,
  calculateArrivalTime,
  getMissionTotalKm,
  computeMissionAutoStatus,
  getLocalTodayStr,
  computeVehicleFuelTelemetry,
  getMissionCode,
  formatDateBR,
  isElectricVehicle,
  sortMissionsByStatusPriority,
} from './utils/geo';
import {
  isNativeApp,
  getNativePosition,
  watchNativePosition,
  enqueueOfflineGpsPoint,
  flushOfflineGpsQueue,
  initNativeLifecycleListeners,
  requestLocationPermissions
} from './utils/nativeBridge';

// Limpeza única e definitiva para entrada em Produção (Zerar dados fictícios de demonstração)
const PROD_CLEAN_KEY = 'gestormf_prod_clean_v2';
if (typeof window !== 'undefined' && localStorage.getItem(PROD_CLEAN_KEY) !== 'true') {
  localStorage.setItem('gestormf_vehicles', JSON.stringify([]));
  localStorage.setItem('gestormf_members', JSON.stringify([]));
  localStorage.setItem('gestormf_missions', JSON.stringify([]));
  localStorage.setItem(PROD_CLEAN_KEY, 'true');
}

export default function App() {
  // Estado de Autenticação do Usuário Atual (Administrador, Gestor, Usuário)
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Reconhecimento do Tipo de Dispositivo (Celular, Tablet ou PC)
  const [deviceInfo, setDeviceInfo] = useState(() => {
    if (typeof window === 'undefined') return { type: 'desktop', width: 1200, isTouch: false };
    const width = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const type = width <= 768 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';
    return { type, width, isTouch };
  });

  // Atualiza detecção em tempo real quando a tela ou rotação muda
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const type = width <= 768 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';
      setDeviceInfo({ type, width, isTouch });
      if (width > 1024) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ativação automática do Modo Compacto em dispositivos Móveis e Tablets
  useEffect(() => {
    const savedCompact = localStorage.getItem('gestormf_compact_mode');
    if (savedCompact !== null) {
      setCompactMode(savedCompact === 'true');
    } else {
      if (deviceInfo.type === 'mobile' || deviceInfo.type === 'tablet') {
        setCompactMode(true);
      }
    }
  }, [deviceInfo.type]);

  const handleSetCompactMode = (val) => {
    setCompactMode(val);
    localStorage.setItem('gestormf_compact_mode', val ? 'true' : 'false');
  };

  // Permissões por Nível de Acesso
  const userRole = normalizeRole(currentUser?.role);
  const isAdmin = userRole === ROLES.ADMIN;
  const isAdminUser = isAdmin;
  const canCreateMission = userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;
  const canManageSettings = userRole === ROLES.ADMIN;
  // Apenas Gestores e Administradores visualizam e acessam Viaturas e Equipes
  const canManageFleetAndTeams = userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;
  // Administradores e Gestores podem enviar mensagens e comunicados (para todos ou individual)
  const canSendMessage = userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;

  // Estado de Navegação de Abas: 'map' (Mapa), 'board' (Tabela de Serviço), 'vehicles' (Viaturas), 'teams' (Equipes)
  const [activeTab, setActiveTab] = useState('map');

  // Protege e direciona abas conforme permissões:
  // Administradores usam 'admin' (Central do Admin); Colaboradores usam 'me' (Meu Espaço)
  useEffect(() => {
    if (isAdminUser && activeTab === 'me') {
      setActiveTab('admin');
    }
    if (!isAdminUser && activeTab === 'admin') {
      setActiveTab('me');
    }
    if (!canManageFleetAndTeams && (activeTab === 'vehicles' || activeTab === 'teams')) {
      setActiveTab('map');
    }
  }, [isAdminUser, canManageFleetAndTeams, activeTab]);

  // Estado do Tema (Modo Escuro / Modo Claro) persistente no LocalStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('gestormf_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('gestormf_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Estados persistentes no LocalStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('gestormf_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.baseLocation || parsed.baseLocation.lat < 0 || parsed.baseLocation.address?.includes('Principal')) {
          return DEFAULT_SETTINGS;
        }
        if (Math.abs(Number(parsed.baseLocation.lat) - 2.825358) < 0.0002) {
          parsed.baseLocation.lat = 2.8293822995808733;
          parsed.baseLocation.lon = -60.730887232802566;
        }
        if (!parsed.companyName || parsed.companyName.trim().toLowerCase() === 'mega') {
          parsed.companyName = DEFAULT_SETTINGS.companyName;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [vehicles, setVehicles] = useState(() => {
    const saved = localStorage.getItem('gestormf_vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem('gestormf_members');
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [roles, setRoles] = useState(() => {
    const saved = localStorage.getItem('gestormf_roles');
    return saved ? JSON.parse(saved) : DEFAULT_ROLES;
  });

  const [missions, setMissions] = useState(() => {
    const saved = localStorage.getItem('gestormf_missions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOldData = parsed.some(
          (m) =>
            (m.lat !== null && m.lat < 0) ||
            m.address?.includes('Paulista') ||
            m.address?.includes('Ibirapuera')
        );
        if (hasOldData) {
          return INITIAL_MISSIONS;
        }
        // Garante que missões antigas sem rota viária recebam as coordenadas de rua iniciais e sanitiza dados
        return parsed
          .filter((m) => m && typeof m === 'object' && m.id)
          .map((m) => {
            const cleanLat = m.lat !== null && m.lat !== undefined && !isNaN(Number(m.lat)) ? Number(m.lat) : null;
            const cleanLon = m.lon !== null && m.lon !== undefined && !isNaN(Number(m.lon)) ? Number(m.lon) : null;
            const cleanRouteCoords = Array.isArray(m.routeCoordinates)
              ? m.routeCoordinates
                .filter((pt) => Array.isArray(pt) && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1])))
                .map((pt) => [Number(pt[0]), Number(pt[1])])
              : [];
            const cleanReturnCoords = Array.isArray(m.returnCoordinates)
              ? m.returnCoordinates
                .filter((pt) => Array.isArray(pt) && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1])))
                .map((pt) => [Number(pt[0]), Number(pt[1])])
              : [];

            const initialMatch = INITIAL_MISSIONS.find((init) => init.id === m.id);
            if (initialMatch && cleanRouteCoords.length <= 2) {
              return {
                ...m,
                lat: initialMatch.lat,
                lon: initialMatch.lon,
                distanceKm: initialMatch.distanceKm,
                totalDistanceKm: initialMatch.totalDistanceKm,
                drivingDurationMinutes: initialMatch.drivingDurationMinutes,
                roundTripDurationMinutes: initialMatch.roundTripDurationMinutes,
                routeCoordinates: initialMatch.routeCoordinates,
              };
            }
            return {
              ...m,
              lat: cleanLat,
              lon: cleanLon,
              routeCoordinates: cleanRouteCoords,
              returnCoordinates: cleanReturnCoords,
            };
          });
      } catch (e) {
        return INITIAL_MISSIONS;
      }
    }
    return INITIAL_MISSIONS;
  });

  // Estados de Modais e Seleções
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [initialCoordsForNewMission, setInitialCoordsForNewMission] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState(INITIAL_MISSIONS[0]?.id || null);
  const [mapMissionFilter, setMapMissionFilter] = useState('ativas'); // 'ativas' (Agendada + Em Preparo + Em Execução) | 'agendadas' | 'andamento' | 'finalizadas'

  // Estados de Notificações Push e Alertas em Tempo Real
  const knownMissionsRef = useRef(null);
  const prevMissionsMapRef = useRef(new Map());
  const [incomingMissionAlert, setIncomingMissionAlert] = useState(null);
  const [notificationPermissionState, setNotificationPermissionState] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [dismissNotificationPrompt, setDismissNotificationPrompt] = useState(false);

  // No aplicativo nativo (iOS e Android), solicita permissão de notificações nativas na inicialização
  useEffect(() => {
    if (isNativeApp()) {
      requestNotificationPermission().then((status) => {
        setNotificationPermissionState(status);
      }).catch(() => {});
    }
  }, []);

  // Central de Notificações & Mensagens Internas
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
  const notificationsRef = useRef(null);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('gestormf_notifications_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Salva histórico no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gestormf_notifications_v1', JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {}
  }, [notifications]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const target = notifications.find((n) => n.id === id);
    if (target?.type === 'system_message') {
      apiMarkMessageRead(id).catch(() => {});
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notifications.forEach((n) => {
      if (n.type === 'system_message' && !n.read) {
        apiMarkMessageRead(n.id).catch(() => {});
      }
    });
  };

  // Sincronização periódica de Mensagens Internas & Comunicados do Servidor
  const fetchServerMessages = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await apiGetMessages();
      if (res && res.success && Array.isArray(res.messages)) {
        setNotifications((prev) => {
          let hasNewUnread = false;
          const prevMsgIds = new Set(prev.filter((n) => n.type === 'system_message').map((n) => n.id));
          const mappedMsgs = res.messages.map((m) => {
            const notifId = m.id;
            if (!m.isRead && !prevMsgIds.has(notifId)) {
              hasNewUnread = true;
            }
            return {
              id: notifId,
              type: 'system_message',
              title: m.title,
              message: m.message,
              senderId: m.senderId,
              senderName: m.senderName,
              senderRole: m.senderRole,
              recipientType: m.recipientType,
              recipientName: m.recipientName,
              priority: m.priority,
              read: m.isRead,
              timestamp: new Date(m.createdAt).getTime(),
            };
          });

          if (hasNewUnread) {
            playNotificationSound();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try {
                navigator.vibrate([200, 100, 200, 100, 300]);
              } catch (e) {}
            }
            const firstUnread = mappedMsgs.find((m) => !m.read);
            if (firstUnread) {
              sendPushNotification(firstUnread.title || 'Novo Comunicado', {
                body: `${firstUnread.senderName ? firstUnread.senderName + ': ' : ''}${firstUnread.message || ''}`,
                tag: 'msg-' + firstUnread.id,
              });
            }
          }

          const nonMsgNotifs = prev.filter((n) => n.type !== 'system_message');
          return [...mappedMsgs, ...nonMsgNotifs];
        });
      }
    } catch (err) {}
  }, [currentUser]);

  useEffect(() => {
    fetchServerMessages();
    const interval = setInterval(fetchServerMessages, 12000);
    return () => clearInterval(interval);
  }, [fetchServerMessages]);

  // Verifica com precisão se o usuário faz parte da missão (motorista, equipe ou editor)
  const isUserInMission = useCallback((mis, user) => {
    if (!mis || !user) return false;
    const uId = String(user.id || '').trim();
    const uMemId = String(user.memberId || '').trim();
    const uName = (user.name || '').trim().toLowerCase();
    const firstWord = uName.split(' ')[0] || '';
    const isHgama = uName.includes('histanley') || uName.includes('hgama') || uName.includes('gama');
    const isJoaoPedro = uName.includes('joão') || uName.includes('pedro') || uName.includes('joao');

    const matchesName = (target) => {
      if (!target) return false;
      const t = String(target).trim().toLowerCase();
      if (t === uName) return true;
      if (firstWord.length >= 3 && (t.startsWith(firstWord) || t.includes(firstWord))) return true;
      if (isHgama && (t.includes('hgama') || t.includes('histanley') || t.includes('gama'))) return true;
      if (isJoaoPedro && (t.includes('pedro') || t.includes('joão') || t.includes('joao'))) return true;
      return false;
    };

    // 1. Motorista (driverId, driverIds, driverName ou vehicleAllocations)
    if (mis.driverId && (String(mis.driverId) === uId || (uMemId && String(mis.driverId) === uMemId))) return true;
    if (Array.isArray(mis.driverIds) && mis.driverIds.some((id) => String(id) === uId || (uMemId && String(id) === uMemId))) return true;
    if (mis.driverName && matchesName(mis.driverName)) return true;
    if (Array.isArray(mis.vehicleAllocations)) {
      if (
        mis.vehicleAllocations.some(
          (a) =>
            a &&
            (String(a.driverId) === uId ||
              (uMemId && String(a.driverId) === uMemId) ||
              (a.driverName && matchesName(a.driverName)))
        )
      ) {
        return true;
      }
    }

    // 2. Equipe Escalada em Campo (teamIds, teamMembers, teamNames, teamNamesDisplay)
    if (Array.isArray(mis.teamIds) && mis.teamIds.some((id) => String(id) === uId || (uMemId && String(id) === uMemId))) return true;
    if (
      Array.isArray(mis.teamMembers) &&
      mis.teamMembers.some(
        (tm) =>
          tm &&
          (String(tm.id) === uId ||
            (uMemId && String(tm.id) === uMemId) ||
            (tm.name && matchesName(tm.name)))
      )
    ) {
      return true;
    }
    if (Array.isArray(mis.teamNames) && mis.teamNames.some((tn) => matchesName(tn))) return true;
    if (mis.teamNamesDisplay) {
      const namesList = mis.teamNamesDisplay.split(',').map((s) => s.trim().toLowerCase());
      if (namesList.some((s) => matchesName(s))) return true;
    }

    // 3. Editor de Pós-Produção (editorId, editorIds, editorName, editorNamesDisplay)
    if (mis.editorId && (String(mis.editorId) === uId || (uMemId && String(mis.editorId) === uMemId))) return true;
    if (Array.isArray(mis.editorIds) && mis.editorIds.some((id) => String(id) === uId || (uMemId && String(id) === uMemId))) return true;
    if (mis.editorName && matchesName(mis.editorName)) return true;
    if (mis.editorNamesDisplay) {
      const editorsList = mis.editorNamesDisplay.split(',').map((s) => s.trim().toLowerCase());
      if (editorsList.some((s) => matchesName(s))) return true;
    }

    return false;
  }, []);

  // Regra de Governança e Operações:
  // Não permite excluir notificação de combustível até o carro ser abastecido (tanque > 10%)
  // e não permite excluir notificação de missão até o serviço/missão ser finalizado.
  const isNotificationLocked = useCallback(
    (notif) => {
      if (!notif) return { locked: false, reason: '' };

      // 1. Notificação de Combustível
      if (notif.type === 'fuel' && notif.vehicleId) {
        const v = vehicles.find((veh) => veh.id === notif.vehicleId);
        if (v) {
          const tel = computeVehicleFuelTelemetry(
            v,
            missions,
            settings?.fuelPricePerLiter || 6.45
          );
          if (tel.isReserveAlert) {
            return {
              locked: true,
              reason: `Viatura ${v.name} (${v.plate}) ainda está em reserva (${tel.currentPercent}%). Abasteça o veículo para liberar a exclusão.`,
            };
          }
        }
      }

      // 2. Notificação de Missão
      if (notif.type === 'mission' && notif.missionId) {
        const m = missions.find((mis) => mis.id === notif.missionId);
        if (m) {
          const isDone =
            m.missionStatus === 'Finalizado' ||
            m.missionStatus === 'Finalizada' ||
            m.missionStatus === 'Concluída' ||
            m.editionStatus === 'Edição Concluída' ||
            m.editionStatus === 'Entregue';
          if (!isDone) {
            return {
              locked: true,
              reason: `A missão "${m.description}" (#${m.code || ''}) ainda está em andamento. Conclua a tarefa para liberar a exclusão.`,
            };
          }
        }
      }

      return { locked: false, reason: '' };
    },
    [vehicles, missions, settings]
  );

  const handleDeleteNotification = async (id) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif) return;

    const lockStatus = isNotificationLocked(notif);
    if (lockStatus.locked) {
      await alertDialog({
        title: '🔒 Notificação Bloqueada',
        message: lockStatus.reason,
        description: 'Por política operacional, avisos de pendências ativas permanecem até que o veículo seja abastecido ou a missão seja concluída.',
        variant: 'warning',
      });
      return;
    }

    if (notif.type === 'system_message') {
      apiDeleteMessage(id).catch(() => {});
    }

    if (notif.type === 'mission' && notif.missionId) {
      try {
        const raw = localStorage.getItem('gestormf_dismissed_missions');
        const set = new Set(raw ? JSON.parse(raw) : []);
        set.add(notif.missionId);
        localStorage.setItem('gestormf_dismissed_missions', JSON.stringify(Array.from(set)));
      } catch (e) {}
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllNotifications = async () => {
    const lockedCount = notifications.filter((n) => isNotificationLocked(n).locked).length;
    const clearableCount = notifications.length - lockedCount;

    if (lockedCount > 0 && clearableCount === 0) {
      await alertDialog({
        title: '🔒 Nenhuma Notificação Pôde Ser Excluída',
        message: 'Todas as notificações atuais referem-se a viaturas que ainda precisam de combustível ou missões em andamento.',
        description: 'Elas serão liberadas para exclusão assim que as viaturas forem abastecidas ou as tarefas forem concluídas.',
        variant: 'info',
      });
      return;
    }

    apiDismissAllMessages().catch(() => {});

    try {
      const activeMisIds = notifications.filter((n) => n.type === 'mission' && n.missionId).map((n) => n.missionId);
      const raw = localStorage.getItem('gestormf_dismissed_missions');
      const set = new Set(raw ? JSON.parse(raw) : []);
      activeMisIds.forEach((id) => set.add(id));
      localStorage.setItem('gestormf_dismissed_missions', JSON.stringify(Array.from(set)));
    } catch (e) {}

    if (lockedCount > 0) {
      setNotifications((prev) => prev.filter((n) => isNotificationLocked(n).locked));
      await alertDialog({
        title: 'Notificações Resolvidas Limpas',
        message: `Foram removidas ${clearableCount} notificação(ões) já concluída(s).`,
        description: `${lockedCount} notificação(ões) com pendências ativas (carros em reserva ou missões abertas) foram mantidas até resolução.`,
        variant: 'info',
      });
    } else {
      setNotifications([]);
    }
  };

  const handleSelectNotification = (notif) => {
    if (notif.missionId) {
      setSelectedMissionId(notif.missionId);
      setActiveTab('map');
      setIsNotificationsOpen(false);
    }
  };

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Diálogo Global de Confirmação e Alertas Modernos
  const [activeDialog, setActiveDialog] = useState(null);

  useEffect(() => {
    return registerDialogListener((dialogData) => {
      setActiveDialog(dialogData);
    });
  }, []);

  // Estados do Transmissor GPS Automático em Segundo Plano (Smartphone e Computador)
  const [lastGpsCoords, setLastGpsCoords] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [gpsPermissionState, setGpsPermissionState] = useState('unknown'); // 'unknown' | 'granted' | 'denied'
  const lastGpsSentTimeRef = useRef(0);
  const lastGpsCoordsRef = useRef(null);
  const gpsAccuracyRef = useRef(null);
  const gpsWatchIdRef = useRef(null);

  // Carregamento inicial do banco MySQL HostGator e Atualização em Tempo Real (Sem F5)
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;

    async function loadDataFromApi() {
      try {
        const [mRes, vRes, memRes, sRes] = await Promise.all([
          apiGetMissions(),
          apiGetVehicles(),
          apiGetMembers(),
          apiGetSettings()
        ]);

        if (!isMounted) return;

        if (mRes.success && Array.isArray(mRes.missions)) {
          const now = new Date();
          const freshMissions = mRes.missions.map((m) => ({
            ...m,
            missionStatus: computeMissionAutoStatus(m, now),
          }));
          setMissions(freshMissions);

          // Detecção de Novas Missões em Tempo Real para envio de Push Notification e Central de Notificações
          if (knownMissionsRef.current !== null && currentUser) {
            const newMissions = freshMissions.filter(
              (m) => !knownMissionsRef.current.has(m.id)
            );

            newMissions.forEach((newMis) => {
              const isAssigned = isUserInMission(newMis, currentUser);
              const destination = newMis.locationName || newMis.address || 'Local Definido';
              const timeStr = newMis.departureTime ? `Saída às ${newMis.departureTime}` : 'Hoje';

              if (isAssigned) {
                sendPushNotification(`🎯 Missão Designada para Você!`, {
                  body: `${newMis.description} • ${timeStr} • ${destination} (#${newMis.code || ''})`,
                  data: { missionId: newMis.id },
                });
                setIncomingMissionAlert(newMis);
              } else {
                sendPushNotification(`📅 Nova Missão Cadastrada: #${newMis.code || ''}`, {
                  body: `${newMis.description} • ${destination} • ${timeStr}`,
                  data: { missionId: newMis.id },
                });
              }
            });

            // Adiciona novas missões à Central de Notificações para toda a equipe
            const createdNotifs = newMissions.map((newMis) => {
              const destination = newMis.locationName || newMis.address || 'Local Definido';
              const timeStr = newMis.departureTime ? `Saída às ${newMis.departureTime}` : 'Hoje';
              const isAssigned = isUserInMission(newMis, currentUser);

              return {
                id: `notif-${newMis.id}-${Date.now()}`,
                title: isAssigned ? '🎯 Missão Designada para Você!' : `📅 Nova Missão: #${newMis.code || ''}`,
                message: `${newMis.description} • ${destination} • ${timeStr}`,
                details: `Viatura: ${newMis.vehicleNameDisplay || 'Mega'} • Equipe: ${newMis.teamNamesDisplay || '--'}`,
                timestamp: Date.now(),
                type: 'mission',
                missionId: newMis.id,
                read: false,
              };
            });

            if (createdNotifs.length > 0) {
              setNotifications((prev) => [...createdNotifs, ...prev]);
            }
          } else if (knownMissionsRef.current === null && currentUser) {
            // Carga inicial: Garante que missões ativas apareçam na Central de Notificações
            let dismissedMissions = new Set();
            try {
              const rawD = localStorage.getItem('gestormf_dismissed_missions');
              if (rawD) dismissedMissions = new Set(JSON.parse(rawD));
            } catch (e) {}

            const activeMissionNotifs = [];
            freshMissions.forEach((newMis) => {
              if (newMis.missionStatus === 'Finalizada') return;
              if (dismissedMissions.has(newMis.id)) return;
              const isAssigned = isUserInMission(newMis, currentUser);
              const destination = newMis.locationName || newMis.address || 'Local Definido';
              const timeStr = newMis.departureTime ? `Saída às ${newMis.departureTime}` : 'Hoje';
              activeMissionNotifs.push({
                id: `notif-mis-${newMis.id}`,
                title: isAssigned ? '🎯 Missão Designada para Você!' : `📅 Nova Missão: #${newMis.code || ''}`,
                message: `${newMis.description} • ${destination} • ${timeStr}`,
                details: `Viatura: ${newMis.vehicleNameDisplay || 'Mega'} • Equipe: ${newMis.teamNamesDisplay || '--'} • Status: ${newMis.missionStatus}`,
                timestamp: newMis.updatedAt ? new Date(newMis.updatedAt).getTime() : Date.now(),
                type: 'mission',
                missionId: newMis.id,
                read: false,
              });
            });

            if (activeMissionNotifs.length > 0) {
              setNotifications((prev) => {
                const existingMisIds = new Set(prev.filter((n) => n.type === 'mission').map((n) => n.missionId));
                const toAdd = activeMissionNotifs.filter((n) => !existingMisIds.has(n.missionId));
                return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
              });
            }
          }

          // Notificações em Tempo Real para Transições Operacionais (Editor -> Gestor e Gestor -> Editor)
          if (prevMissionsMapRef.current.size > 0 && currentUser) {
            freshMissions.forEach((m) => {
              const prev = prevMissionsMapRef.current.get(m.id);
              if (!prev) return;

              // 1. Editor concluiu pós-produção e aguarda confirmação da gestão:
              if (
                prev.editionStatus !== 'Edição Concluída' &&
                m.editionStatus === 'Edição Concluída' &&
                m.missionStatus !== 'Finalizada' &&
                ['ADMIN', 'MANAGER'].includes(currentUser?.role)
              ) {
                const notifId = `await-appr-${m.id}-${m.version || Date.now()}`;
                const notifItem = {
                  id: notifId,
                  title: `🎬 Pós-Produção Concluída: #${m.code || ''}`,
                  description: `${m.editionCompletedBy || 'O editor'} concluiu a edição de "${m.description}". Aguardando sua confirmação.`,
                  message: `${m.editionCompletedBy || 'O editor'} concluiu a edição de "${m.description}". Aguardando sua confirmação.`,
                  timestamp: Date.now(),
                  read: false,
                  missionId: m.id,
                  type: 'mission',
                };
                setNotifications((p) => [notifItem, ...p.filter((n) => n.id !== notifId)]);
                sendPushNotification(`🎬 Pós-Produção Concluída: #${m.code || ''}`, {
                  body: `${m.editionCompletedBy || 'O editor'} concluiu "${m.description}". Aguardando sua confirmação.`,
                  data: { missionId: m.id },
                });
                playNotificationSound();
              }

              // 2. Administrador rejeitou e reabriu pauta para ajustes (notifica o editor):
              if (
                m.editionStatus !== 'Edição Concluída' &&
                prev.editionStatus === 'Edição Concluída' &&
                m.reopenReason &&
                isUserInMission(m, currentUser)
              ) {
                const notifId = `reopened-${m.id}-${m.version || Date.now()}`;
                const notifItem = {
                  id: notifId,
                  title: `⚠️ Ajustes Solicitados: #${m.code || ''}`,
                  description: `A gestão solicitou ajustes na pauta "${m.description}": "${m.reopenReason}".`,
                  message: `A gestão solicitou ajustes na pauta "${m.description}": "${m.reopenReason}".`,
                  timestamp: Date.now(),
                  read: false,
                  missionId: m.id,
                  type: 'mission',
                };
                setNotifications((p) => [notifItem, ...p.filter((n) => n.id !== notifId)]);
                sendPushNotification(`⚠️ Pauta Reaberta para Ajustes!`, {
                  body: `${m.description} • Ajustes: "${m.reopenReason}"`,
                  data: { missionId: m.id },
                });
                playNotificationSound();
              }

              // 3. Administrador aprovou a entrega e finalizou a missão (notifica o editor):
              if (
                m.missionStatus === 'Finalizada' &&
                prev.missionStatus !== 'Finalizada' &&
                isUserInMission(m, currentUser)
              ) {
                const notifId = `approved-${m.id}-${m.version || Date.now()}`;
                const notifItem = {
                  id: notifId,
                  title: `⭐ Missão Aprovada & Finalizada: #${m.code || ''}`,
                  description: `A gestão aprovou a pós-produção da pauta "${m.description}". Missão encerrada com sucesso!`,
                  message: `A gestão aprovou a pós-produção da pauta "${m.description}". Missão encerrada com sucesso!`,
                  timestamp: Date.now(),
                  read: false,
                  missionId: m.id,
                  type: 'mission',
                };
                setNotifications((p) => [notifItem, ...p.filter((n) => n.id !== notifId)]);
                sendPushNotification(`⭐ Missão Finalizada & Aprovada!`, {
                  body: `Pós-produção de "${m.description}" aprovada com sucesso.`,
                  data: { missionId: m.id },
                });
                playNotificationSound();
              }
            });
          }

          const nextMap = new Map();
          freshMissions.forEach((m) => nextMap.set(m.id, m));
          prevMissionsMapRef.current = nextMap;

          knownMissionsRef.current = new Set(freshMissions.map((m) => m.id));
        }
        if (vRes.success && Array.isArray(vRes.vehicles)) {
          setVehicles(vRes.vehicles);
        }
        if (memRes.success && Array.isArray(memRes.members)) {
          setMembers(memRes.members);
        }
        if (sRes.success && sRes.settings) {
          setSettings((prev) => ({ ...prev, ...sRes.settings }));
          if (Array.isArray(sRes.roles) && sRes.roles.length > 0) {
            setRoles(sRes.roles);
          }
        }
      } catch (err) {
        // Fallback para estado local
      }
    }

    loadDataFromApi();

    // Ativa Engine de Sincronização em Tempo Real (reflete mudanças instantâneas nos computadores)
    const unsubscribeSync = subscribeToRealtimeSync(() => {
      if (isMounted) {
        loadDataFromApi();
      }
    });

    // Fallback de polling de alta frequência (6s) para conexões móveis onde SSE pode sofrer timeout
    const fallbackPoll = setInterval(() => {
      if (isMounted && typeof document !== 'undefined' && !document.hidden) {
        loadDataFromApi();
      }
    }, 6000);

    return () => {
      isMounted = false;
      unsubscribeSync();
      clearInterval(fallbackPoll);
    };
  }, [currentUser]);

  // Garante a sincronização automática de usuários e credenciais locais para o banco MySQL na HostGator
  useEffect(() => {
    if (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')) {
      const localUsers = getStoredUsers().filter(
        (u) => !['admin@megagestao.com', 'gestor@megagestao.com', 'usuario@megagestao.com'].includes(u.email)
      );
      if (localUsers.length > 0) {
        apiSyncUsers(localUsers).catch((err) => {
          console.warn('Sincronização em segundo plano de usuários:', err);
        });
      }
    }
  }, [currentUser]);

  // Transmissor Contínuo e Automático de GPS em Tempo Real para Smartphone e Aplicativo Móvel
  // REGRA: Administradores NUNCA são rastreados nem transmitem localização GPS (apenas Gestores e Usuários)
  useEffect(() => {
    const isAdminUser = normalizeRole(currentUser?.role) === ROLES.ADMIN;

    if (!currentUser || isAdminUser) {
      if (gpsWatchIdRef.current !== null) {
        if (typeof gpsWatchIdRef.current.clear === 'function') {
          gpsWatchIdRef.current.clear();
        } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
        gpsWatchIdRef.current = null;
      }
      if (isAdminUser && currentUser?.id) {
        apiStopGpsLocation().catch(() => {});
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermissionState('denied');
      return;
    }

    // Leitura opcional do nível de bateria para acompanhamento da central
    if (navigator.getBattery) {
      navigator.getBattery()
        .then((battery) => {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        })
        .catch(() => {});
    }

    // Localiza se há missão ativa (Em Execução / Em Preparo) ou missão do dia para o colaborador
    const activeMissionForUser = missions.find((m) => {
      const isExec = m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Preparo';
      return isExec && isUserInMission(m, currentUser);
    }) || missions.find((m) => {
      return isUserInMission(m, currentUser) && m.missionStatus !== 'Finalizada';
    });

    const sendLocationPacket = (lat, lon, speed, heading, accuracy, capturedAt = null) => {
      lastGpsSentTimeRef.current = Date.now();
      const packet = {
        memberId: currentUser.memberId || currentUser.id,
        memberName: currentUser.name,
        missionId: activeMissionForUser?.id || null,
        lat,
        lon,
        speed: speed || 0,
        heading: heading || 0,
        accuracy: accuracy || 0,
        battery: batteryLevel,
        isActive: true,
        capturedAt: capturedAt || new Date().toISOString()
      };

      apiSendGpsLocation(packet)
        .then(() => {
          setGpsPermissionState('granted');
          // Descarrega histórico offline caso conexão tenha retornado
          flushOfflineGpsQueue(async (queuedPoint) => {
            try {
              const res = await apiSendGpsLocation(queuedPoint);
              return res && res.success !== false;
            } catch (e) {
              return false;
            }
          });
        })
        .catch(() => {
          // Em caso de falha de conexão ou offline, persiste na fila nativa
          enqueueOfflineGpsPoint(packet);
        });
    };

    const handlePosSuccess = (pos) => {
      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const capturedAt = pos.timestamp ? new Date(pos.timestamp).toISOString() : new Date().toISOString();
      setLastGpsCoords({ lat: latitude, lon: longitude });
      setGpsAccuracy(accuracy);
      lastGpsCoordsRef.current = { lat: latitude, lon: longitude };
      gpsAccuracyRef.current = accuracy;
      setGpsPermissionState('granted');
      sendLocationPacket(latitude, longitude, speed, heading, accuracy, capturedAt);
    };

    const handlePosError = (err) => {
      if (err.code === 1) { // PERMISSION_DENIED
        setGpsPermissionState('denied');
      }
    };

    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    };

    // Solicitação inicial de permissão compatível com Native Android / iOS e Web
    requestLocationPermissions().then((granted) => {
      if (granted) setGpsPermissionState('granted');
    }).catch(() => {});

    // 1. DISPARO IMEDIATO NA INICIALIZAÇÃO / LOGIN (Automático, sem necessidade de clique)
    if (isNativeApp()) {
      getNativePosition()
        .then((natPos) => {
          setLastGpsCoords({ lat: natPos.lat, lon: natPos.lon });
          setGpsAccuracy(natPos.accuracy);
          lastGpsCoordsRef.current = { lat: natPos.lat, lon: natPos.lon };
          gpsAccuracyRef.current = natPos.accuracy;
          setGpsPermissionState('granted');
          sendLocationPacket(natPos.lat, natPos.lon, natPos.speed, natPos.heading, natPos.accuracy, natPos.capturedAt);
        })
        .catch(() => {
          navigator.geolocation?.getCurrentPosition(handlePosSuccess, handlePosError, geoOptions);
        });
    } else {
      navigator.geolocation.getCurrentPosition(handlePosSuccess, handlePosError, geoOptions);
    }

    // 2. MONITORAMENTO CONTÍNUO DE MOVIMENTO (watchNativePosition - Nativo no iOS/Android, sem popups da webview)
    let nativeWatcher = null;
    watchNativePosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const capturedAt = pos.timestamp ? new Date(pos.timestamp).toISOString() : new Date().toISOString();
        setLastGpsCoords({ lat: latitude, lon: longitude });
        setGpsAccuracy(accuracy);
        lastGpsCoordsRef.current = { lat: latitude, lon: longitude };
        gpsAccuracyRef.current = accuracy;
        setGpsPermissionState('granted');

        const now = Date.now();
        // Transmite a cada 15 segundos em movimento
        if (now - lastGpsSentTimeRef.current >= 15000) {
          sendLocationPacket(latitude, longitude, speed, heading, accuracy, capturedAt);
        }
      },
      handlePosError,
      geoOptions
    ).then((watcher) => {
      nativeWatcher = watcher;
      gpsWatchIdRef.current = watcher;
    });

    // 3. HEARTBEAT CONTÍNUO A CADA 20 SEGUNDOS (Garante atualização na central mesmo com colaborador parado)
    const heartbeatInterval = setInterval(() => {
      if (isNativeApp()) {
        getNativePosition()
          .then((natPos) => {
            sendLocationPacket(natPos.lat, natPos.lon, natPos.speed, natPos.heading, natPos.accuracy, natPos.capturedAt);
          })
          .catch(() => {
            if (lastGpsCoordsRef.current?.lat && lastGpsCoordsRef.current?.lon) {
              sendLocationPacket(
                lastGpsCoordsRef.current.lat,
                lastGpsCoordsRef.current.lon,
                0,
                0,
                gpsAccuracyRef.current || 10
              );
            }
          });
      } else {
        navigator.geolocation.getCurrentPosition(
          handlePosSuccess,
          () => {
            if (lastGpsCoordsRef.current?.lat && lastGpsCoordsRef.current?.lon) {
              sendLocationPacket(
                lastGpsCoordsRef.current.lat,
                lastGpsCoordsRef.current.lon,
                0,
                0,
                gpsAccuracyRef.current || 10
              );
            }
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
        );
      }
    }, 20000);

    // Ouvinte nativo de ciclo de vida (retomada em primeiro plano) e restabelecimento de internet
    const handleOnlineFlush = () => {
      flushOfflineGpsQueue(async (queuedPoint) => {
        try {
          const res = await apiSendGpsLocation(queuedPoint);
          return res && res.success !== false;
        } catch (e) {
          return false;
        }
      });
    };
    window.addEventListener('online', handleOnlineFlush);

    const cleanupNativeLifecycle = initNativeLifecycleListeners(() => {
      handleOnlineFlush();
      if (isNativeApp()) {
        getNativePosition().then((natPos) => {
          sendLocationPacket(natPos.lat, natPos.lon, natPos.speed, natPos.heading, natPos.accuracy, natPos.capturedAt);
        }).catch(() => {});
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', handleOnlineFlush);
      cleanupNativeLifecycle();
      if (nativeWatcher && typeof nativeWatcher.clear === 'function') {
        nativeWatcher.clear();
      } else if (gpsWatchIdRef.current) {
        if (typeof gpsWatchIdRef.current.clear === 'function') {
          gpsWatchIdRef.current.clear();
        } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
        gpsWatchIdRef.current = null;
      }
    };
  }, [currentUser, missions, batteryLevel]);

  // Automação periódica de Status das Missões (verificação a cada 30 segundos)
  // (1h antes -> Em Preparo | Horário de saída -> Em Execução | 30min após término -> Finalizado)
  useEffect(() => {
    const updateTimeAndStatuses = () => {
      const now = new Date();

      setMissions((prevMissions) => {
        let changed = false;
        const nextMissions = prevMissions.map((m) => {
          const autoStatus = computeMissionAutoStatus(m, now);
          const needRoundTrip = m.isRoundTrip !== true;
          if (m.missionStatus !== autoStatus || needRoundTrip) {
            changed = true;
            return {
              ...m,
              isRoundTrip: true,
              missionStatus: autoStatus,
            };
          }
          return m;
        });
        return changed ? nextMissions : prevMissions;
      });
    };

    updateTimeAndStatuses();
    const interval = setInterval(updateTimeAndStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  // Persistência automática e aplicação de cores personalizadas
  useEffect(() => {
    localStorage.setItem('gestormf_settings', JSON.stringify(settings));
    if (settings?.accentColor) {
      document.documentElement.style.setProperty('--accent-gold', settings.accentColor);
    }
    if (settings?.accentColorSecondary) {
      document.documentElement.style.setProperty('--accent-cyan', settings.accentColorSecondary);
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('gestormf_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem('gestormf_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('gestormf_roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('gestormf_missions', JSON.stringify(missions));
  }, [missions]);

  // Sincroniza automaticamente as rotas viárias reais (OSRM rua a rua, estilo Waze/Google Maps)
  // para todas as missões cadastradas sempre que a base ou novas missões sem rota detalhada carregarem
  const isSyncingRoutesRef = useRef(false);

  useEffect(() => {
    const baseLat = settings?.baseLocation?.lat;
    const baseLon = settings?.baseLocation?.lon;
    if (!baseLat || !baseLon) return;
    if (isSyncingRoutesRef.current) return;

    const baseKey = `${baseLat.toFixed(5)},${baseLon.toFixed(5)}`;
    const needsSync = missions.filter(
      (m) =>
        m.lat &&
        m.lon &&
        !isNaN(Number(m.lat)) &&
        !isNaN(Number(m.lon)) &&
        m.osrmBaseKey !== baseKey
    );

    if (needsSync.length === 0) return;

    isSyncingRoutesRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const updatesById = {};
        for (const m of needsSync) {
          if (cancelled) break;
          const routeRes = await fetchRouteOSRM(baseLat, baseLon, Number(m.lat), Number(m.lon));
          if (cancelled) break;

          const veh = vehicles.find((v) => v.id === m.vehicleId);
          const autonomy = veh ? veh.autonomyKmPerLiter : settings?.defaultAutonomy || 12;
          const fuelRes = calculateFuelEstimate({
            distanceKm: routeRes.distanceKm,
            totalRoundTripKm: routeRes.totalRoundTripKm,
            roundTrip: m.isRoundTrip ?? true,
            autonomyKmPerLiter: autonomy,
            fuelPricePerLiter: settings?.fuelPricePerLiter || 6.45,
          });
          const arrival = calculateArrivalTime(m.departureTime, routeRes.durationMinutes);

          updatesById[m.id] = {
            distanceKm: routeRes.distanceKm,
            returnDistanceKm: routeRes.returnDistanceKm,
            totalDistanceKm: routeRes.totalRoundTripKm,
            drivingDurationMinutes: routeRes.durationMinutes,
            roundTripDurationMinutes: routeRes.roundTripDurationMinutes,
            routeCoordinates: routeRes.coordinates || [],
            returnCoordinates: routeRes.returnCoordinates || [],
            estimatedFuelLiters: fuelRes.litersNeeded,
            estimatedFuelCost: fuelRes.estimatedCost,
            arrivalTimeEstimated: arrival !== '--:--' ? arrival : m.arrivalTimeEstimated,
            osrmBaseKey: baseKey,
          };
        }

        if (!cancelled && Object.keys(updatesById).length > 0) {
          setMissions((prev) =>
            prev.map((item) => (updatesById[item.id] ? { ...item, ...updatesById[item.id] } : item))
          );
        }
      } catch (err) {
        console.warn('Erro ao sincronizar rotas OSRM:', err);
      } finally {
        isSyncingRoutesRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      isSyncingRoutesRef.current = false;
    };
  }, [settings?.baseLocation?.lat, settings?.baseLocation?.lon, missions.length]);

  // Handlers de Missões
  const handleOpenNewMission = (coords = null) => {
    if (!canCreateMission) {
      alert('Seu nível de acesso atual (Usuário) permite apenas consulta operacional e acompanhamento de status. A criação de novas missões é reservada para Gestores e Administradores.');
      return;
    }
    setEditingMission(null);
    setInitialCoordsForNewMission(coords);
    setIsMissionModalOpen(true);
  };

  const handleLogout = () => {
    apiLogout().catch(() => { });
    logoutUser();
    setCurrentUser(null);
  };

  const handleEditMission = (mission) => {
    setEditingMission(mission);
    setInitialCoordsForNewMission(null);
    setIsMissionModalOpen(true);
  };

  const handleSaveMission = async (savedMission) => {
    try {
      const res = await apiSaveMission(savedMission);
      if (res && !res.success) {
        return res;
      }

      const updatedRecord = {
        ...savedMission,
        id: res?.id || savedMission.id,
        version: res?.version || (savedMission.version ? savedMission.version + 1 : 1),
        updatedAt: res?.updatedAt || new Date().toISOString()
      };

      setMissions((prev) => {
        const index = prev.findIndex((m) => m.id === updatedRecord.id);
        let list;
        if (index >= 0) {
          list = [...prev];
          list[index] = updatedRecord;
        } else {
          list = [updatedRecord, ...prev];
        }

        // Se for criação de missão recorrente com agendamentos adicionais retornados pelo servidor:
        if (res && Array.isArray(res.createdMissions) && res.createdMissions.length > 0) {
          const map = new Map(list.map((m) => [m.id, m]));
          res.createdMissions.forEach((cm) => {
            const normalizedChild = {
              ...updatedRecord,
              ...cm,
              id: cm.id,
              code: cm.code,
              date: cm.date,
              deliveryDeadlineDate: cm.deliveryDeadlineDate || cm.date,
              isRecurring: true,
              recurrenceId: res.recurrenceId || updatedRecord.recurrenceId,
              recurrenceDays: updatedRecord.recurrenceDays,
              version: 1,
            };
            map.set(cm.id, normalizedChild);
            if (knownMissionsRef.current) knownMissionsRef.current.add(cm.id);
          });
          list = Array.from(map.values());
        }

        // Se estiver editando e optou por atualizar todas as futuras da série:
        if (savedMission.updateSeries && savedMission.recurrenceId) {
          list = list.map((m) => {
            if (m.recurrenceId === savedMission.recurrenceId && m.date > savedMission.date && m.id !== updatedRecord.id) {
              return {
                ...m,
                description: updatedRecord.description,
                locationName: updatedRecord.locationName,
                address: updatedRecord.address,
                lat: updatedRecord.lat,
                lon: updatedRecord.lon,
                departureTime: updatedRecord.departureTime,
                arrivalTimeEstimated: updatedRecord.arrivalTimeEstimated,
                returnTimeEstimated: updatedRecord.returnTimeEstimated,
                eventStartTime: updatedRecord.eventStartTime,
                antecedenceMinutes: updatedRecord.antecedenceMinutes,
                suggestedDepartureTime: updatedRecord.suggestedDepartureTime,
                vehicleId: updatedRecord.vehicleId,
                vehicleNameDisplay: updatedRecord.vehicleNameDisplay,
                vehicleAllocations: updatedRecord.vehicleAllocations,
                driverId: updatedRecord.driverId,
                driverName: updatedRecord.driverName,
                teamIds: updatedRecord.teamIds,
                teamNamesDisplay: updatedRecord.teamNamesDisplay,
                editorId: updatedRecord.editorId,
                editorName: updatedRecord.editorName,
                editorIds: updatedRecord.editorIds,
                editorNamesDisplay: updatedRecord.editorNamesDisplay,
                deliveryDeadlineTime: updatedRecord.deliveryDeadlineTime,
                distanceKm: updatedRecord.distanceKm,
                totalDistanceKm: updatedRecord.totalDistanceKm,
                drivingDurationMinutes: updatedRecord.drivingDurationMinutes,
                roundTripDurationMinutes: updatedRecord.roundTripDurationMinutes,
                estimatedFuelLiters: updatedRecord.estimatedFuelLiters,
                estimatedFuelCost: updatedRecord.estimatedFuelCost,
                routeCoordinates: updatedRecord.routeCoordinates,
                returnCoordinates: updatedRecord.returnCoordinates,
                notes: updatedRecord.notes,
                version: (m.version || 1) + 1,
                updatedAt: new Date().toISOString()
              };
            }
            return m;
          });
        }

        return list;
      });
      setSelectedMissionId(updatedRecord.id);

      // Marca imediatamente nos conhecidos para que o próprio usuário que salvou a missão não receba alerta de "Nova Missão Atribuída"
      if (knownMissionsRef.current) {
        knownMissionsRef.current.add(updatedRecord.id);
      }

      // Adiciona imediatamente a notificação da nova missão à Central de Notificações
      if (!editingMission) {
        const destStr = updatedRecord.locationName || updatedRecord.address || 'Local Definido';
        const timeStr = updatedRecord.departureTime ? `Saída às ${updatedRecord.departureTime}` : 'Hoje';
        const newNotifItem = {
          id: `notif-${updatedRecord.id}-${Date.now()}`,
          title: `📅 Nova Missão Cadastrada: #${updatedRecord.code || ''}`,
          message: `${updatedRecord.description} • ${destStr} • ${timeStr}`,
          details: `Viatura: ${updatedRecord.vehicleNameDisplay || 'Mega'} • Equipe: ${updatedRecord.teamNamesDisplay || '--'}`,
          timestamp: Date.now(),
          type: 'mission',
          missionId: updatedRecord.id,
          read: false,
        };
        setNotifications((prev) => [newNotifItem, ...prev.filter((n) => n.missionId !== updatedRecord.id)]);
        playNotificationSound();
      }

      // Notificações Push & Central de Notificações (APENAS para quem faz parte da missão)
      const isUserAssigned = isUserInMission(updatedRecord, currentUser);
      const isAssignedEditor = (updatedRecord.editorIds || []).some(
        (id) => String(id) === String(currentUser?.id) || String(id) === String(currentUser?.memberId)
      ) || (updatedRecord.editorName && updatedRecord.editorName.toLowerCase() === (currentUser?.name || '').toLowerCase());

      const historyArr = Array.isArray(updatedRecord.editionHistory) ? updatedRecord.editionHistory : [];
      const lastHistoryItem = historyArr.length > 0 ? historyArr[historyArr.length - 1] : null;

      if (lastHistoryItem && lastHistoryItem.type === 'MESSAGE') {
        const notifId = `msg-${lastHistoryItem.id || Date.now()}`;
        const notifItem = {
          id: notifId,
          title: `💬 Nova Mensagem na Missão #${updatedRecord.code || ''}`,
          description: `${lastHistoryItem.user}: "${lastHistoryItem.description}"`,
          message: `${lastHistoryItem.user}: "${lastHistoryItem.description}"`,
          timestamp: Date.now(),
          read: false,
          missionId: updatedRecord.id,
          type: 'mission',
        };
        setNotifications((prev) => [notifItem, ...prev]);
        sendPushNotification(`💬 Mensagem: #${updatedRecord.code || ''}`, {
          body: `${lastHistoryItem.user}: "${lastHistoryItem.description}"`,
          data: { missionId: updatedRecord.id },
        });
        playNotificationSound();
      } else if (lastHistoryItem && lastHistoryItem.type === 'APPROVED') {
        const notifId = `appr-${lastHistoryItem.id || Date.now()}`;
        const notifItem = {
          id: notifId,
          title: `⭐ Missão Finalizada & Aprovada: #${updatedRecord.code || ''}`,
          description: `A pós-produção da pauta "${updatedRecord.description}" foi aprovada e finalizada pela gestão.`,
          message: `A pós-produção da pauta "${updatedRecord.description}" foi aprovada e finalizada.`,
          timestamp: Date.now(),
          read: false,
          missionId: updatedRecord.id,
          type: 'mission',
        };
        setNotifications((prev) => [notifItem, ...prev]);
        sendPushNotification(`⭐ Missão Finalizada & Aprovada!`, {
          body: `${updatedRecord.description} foi concluída com sucesso.`,
          data: { missionId: updatedRecord.id },
        });
        playNotificationSound();
      } else if (updatedRecord.reopenReason && isUserAssigned) {
        const notifId = `reopen-${updatedRecord.id}-${Date.now()}`;
        const notifItem = {
          id: notifId,
          title: `⚠️ Pauta Reaberta para Ajustes: #${updatedRecord.code || ''}`,
          description: `${updatedRecord.description} — Motivo: "${updatedRecord.reopenReason}". Missão em atraso para retrabalho.`,
          message: `${updatedRecord.description} — Motivo: "${updatedRecord.reopenReason}"`,
          timestamp: Date.now(),
          read: false,
          missionId: updatedRecord.id,
          type: 'mission',
        };
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notifId)) return prev;
          return [notifItem, ...prev];
        });
        sendPushNotification(`⚠️ Pauta Reaberta para Ajustes!`, {
          body: `${updatedRecord.description} • Motivo: "${updatedRecord.reopenReason}"`,
          data: { missionId: updatedRecord.id },
        });
        playNotificationSound();
      } else if (updatedRecord.editionDeliveryStatus && updatedRecord.editionDeliveryStatus !== '') {
      const notifId = `comp-${savedMission.id}-${savedMission.editionDeliveryStatus}`;
      const notifItem = {
        id: notifId,
        title: `🎬 Edição Concluída (${savedMission.editionDeliveryStatus}): #${savedMission.code || ''}`,
        description: `${savedMission.description} finalizada por ${savedMission.editionCompletedBy || 'Editor'}.`,
        message: `${savedMission.description} finalizada por ${savedMission.editionCompletedBy || 'Editor'}.`,
        timestamp: Date.now(),
        read: false,
        missionId: savedMission.id,
        type: 'mission',
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev;
        return [notifItem, ...prev];
      });
      sendPushNotification(`🎬 Edição Concluída (${savedMission.editionDeliveryStatus})!`, {
        body: `${savedMission.description} por ${savedMission.editionCompletedBy || 'Editor'}`,
        data: { missionId: savedMission.id },
      });
      playNotificationSound();
    } else if (savedMission.editorNamesDisplay && isAssignedEditor) {
      const notifId = `assign-${savedMission.id}`;
      const deadlineInfo = savedMission.deliveryDeadlineDate ? `Prazo: ${formatDateBR(savedMission.deliveryDeadlineDate)} às ${savedMission.deliveryDeadlineTime || '18:00'}` : '';
      const notifItem = {
        id: notifId,
        title: `🎬 Pauta para Edição: #${savedMission.code || ''}`,
        description: `${savedMission.description} — Editor: ${savedMission.editorNamesDisplay}. ${deadlineInfo}`,
        message: `${savedMission.description} — Editor: ${savedMission.editorNamesDisplay}. ${deadlineInfo}`,
        timestamp: Date.now(),
        read: false,
        missionId: savedMission.id,
        type: 'mission',
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev;
        return [notifItem, ...prev];
      });
      sendPushNotification(`🎬 Nova Pauta para Edição!`, {
        body: `${savedMission.description} • ${deadlineInfo}`,
        data: { missionId: savedMission.id },
      });
      playNotificationSound();
    }

    return res || { success: true };
  } catch (e) {
    console.warn('Erro ao salvar missão na API:', e);
    return { success: false, error: e.message };
  }
};

  const handleDeleteMission = async (missionId) => {
    const mis = missions.find((m) => m.id === missionId);
    if (!mis) return;

    let deleteSeries = false;
    if (mis.isRecurring || mis.recurrenceId) {
      const choice = await confirmDialog({
        title: '🔁 Excluir Missão Recorrente',
        message: `A missão "${mis.description}" (#${mis.code || ''}) faz parte de uma série recorrente (${mis.recurrenceDays || 'Semanal'}).`,
        description: 'Deseja excluir apenas esta ocorrência ou todas as futuras missões desta série?',
        confirmText: 'Excluir Toda a Série',
        cancelText: 'Excluir Apenas Esta',
        variant: 'danger',
      });
      deleteSeries = Boolean(choice);
    } else {
      const confirmed = await confirmDialog({
        title: 'Excluir Missão',
        message: `Tem certeza que deseja excluir a missão "${mis.description}"?`,
        description: 'O agendamento, rota viária e os registros de combustível desta missão serão removidos.',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    try {
      const res = await apiDeleteMission(missionId, deleteSeries);
      if (res && res.success) {
        if (deleteSeries && mis.recurrenceId) {
          setMissions((prev) => prev.filter((m) => !(m.recurrenceId === mis.recurrenceId && m.date >= mis.date) && m.id !== missionId));
        } else {
          setMissions((prev) => prev.filter((m) => m.id !== missionId));
        }
        if (selectedMissionId === missionId) setSelectedMissionId(null);
      } else {
        await alertDialog({
          title: 'Erro ao Excluir',
          message: res?.error || 'Não foi possível excluir a missão.',
          variant: 'danger',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha ao conectar com o servidor para excluir a missão.',
        variant: 'danger',
      });
    }
  };

  const reloadServerMissions = async () => {
    try {
      const mRes = await apiGetMissions();
      if (mRes.success && Array.isArray(mRes.missions)) {
        const now = new Date();
        setMissions(
          mRes.missions.map((m) => ({
            ...m,
            missionStatus: computeMissionAutoStatus(m, now),
          }))
        );
      }
    } catch (e) {
      console.warn('Erro ao recarregar missões:', e);
    }
  };

  const handleUpdateMissionStatus = async (missionId, newStatus) => {
    const target = missions.find((m) => m.id === missionId);
    if (!target) return;
    const updated = { ...target, missionStatus: newStatus };
    try {
      const res = await apiSaveMission(updated);
      if (res && res.success) {
        setMissions((prev) =>
          prev.map((m) =>
            m.id === missionId
              ? { ...updated, version: res.version || (m.version ? m.version + 1 : 1) }
              : m
          )
        );
      } else if (res?.status === 409 || res?.conflict) {
        await reloadServerMissions();
        await alertDialog({
          title: 'Conflito de Concorrência',
          message: res.error || 'Esta missão foi alterada por outro usuário. Os dados mais recentes foram recarregados automaticamente.',
          variant: 'warning',
        });
      } else {
        await alertDialog({
          title: 'Erro ao Atualizar',
          message: res?.error || 'Não foi possível atualizar o status da missão.',
          variant: 'danger',
        });
      }
    } catch (e) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de comunicação com o servidor ao atualizar status.',
        variant: 'danger',
      });
    }
  };

  const handleUpdateEditionStatus = async (missionId, newStatus) => {
    const target = missions.find((m) => m.id === missionId);
    if (!target) return;

    const isEditionDone =
      newStatus === 'Edição Concluída' ||
      newStatus === 'Entregue' ||
      newStatus === 'Entregue ao Cliente' ||
      newStatus === 'Não se aplica' ||
      newStatus === 'Não se aplica (Mega Print / Instalação)';

    let nextMissionStatus = target.missionStatus;
    if (
      target.missionStatus === 'Finalizada' ||
      target.missionStatus === 'Finalizado' ||
      target.missionStatus === 'Pendente'
    ) {
      nextMissionStatus = isEditionDone ? 'Finalizada' : 'Pendente';
    } else {
      nextMissionStatus = computeMissionAutoStatus({ ...target, editionStatus: newStatus }, new Date(), true);
    }

    const updated = { ...target, editionStatus: newStatus, missionStatus: nextMissionStatus };
    try {
      const res = await apiSaveMission(updated);
      if (res && res.success) {
        setMissions((prev) =>
          prev.map((m) =>
            m.id === missionId
              ? { ...updated, version: res.version || (m.version ? m.version + 1 : 1) }
              : m
          )
        );
      } else if (res?.status === 409 || res?.conflict) {
        await reloadServerMissions();
        await alertDialog({
          title: 'Conflito de Concorrência',
          message: res.error || 'Esta missão foi alterada por outro usuário. Os dados mais recentes foram recarregados automaticamente.',
          variant: 'warning',
        });
      } else {
        await alertDialog({
          title: 'Erro ao Atualizar',
          message: res?.error || 'Não foi possível atualizar o status de pós-produção.',
          variant: 'danger',
        });
      }
    } catch (e) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de comunicação com o servidor ao atualizar pós-produção.',
        variant: 'danger',
      });
    }
  };

  // Handlers de Viaturas (P1-08: Confirmação síncrona com tratamento de erro e rollback)
  const handleAddVehicle = async (newVeh) => {
    try {
      const res = await apiSaveVehicle(newVeh);
      if (!res.success) {
        await alertDialog({
          title: 'Erro ao Salvar Viatura',
          message: res.error || 'Falha ao salvar viatura no servidor.',
          variant: 'danger',
        });
        return false;
      }
      const saved = { ...newVeh, id: res.id || newVeh.id };
      setVehicles((prev) => [...prev, saved]);
      return true;
    } catch (e) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha ao conectar com o servidor para salvar a viatura.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleUpdateVehicle = async (updatedVeh) => {
    const previous = vehicles;
    try {
      const res = await apiSaveVehicle(updatedVeh);
      if (!res.success) {
        await alertDialog({
          title: 'Erro ao Atualizar Viatura',
          message: res.error || 'Falha ao atualizar dados da viatura no servidor.',
          variant: 'danger',
        });
        return false;
      }
      setVehicles((prev) => prev.map((v) => (v.id === updatedVeh.id ? updatedVeh : v)));
      return true;
    } catch (e) {
      setVehicles(previous);
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de rede ao atualizar viatura.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleDeleteVehicle = async (vehId) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Viatura',
      message: 'Tem certeza que deseja excluir esta viatura permanentemente?',
      description: 'A viatura deixará de estar disponível para alocação em novas missões.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) return false;

    const previous = vehicles;
    setVehicles((prev) => prev.filter((v) => v.id !== vehId));
    try {
      const res = await apiDeleteVehicle(vehId);
      if (!res.success) {
        setVehicles(previous);
        await alertDialog({
          title: 'Erro ao Excluir Viatura',
          message: res.error || 'Falha ao excluir viatura no servidor.',
          variant: 'danger',
        });
        return false;
      }
      return true;
    } catch (e) {
      setVehicles(previous);
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha ao conectar com o servidor para excluir a viatura.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleAddFuelLog = (vehicleId, fuelLog) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          const logs = v.fuelLogs ? [...v.fuelLogs, fuelLog] : [fuelLog];
          const tempVeh = { ...v, fuelLogs: logs };
          const tel = computeVehicleFuelTelemetry(
            tempVeh,
            missions,
            settings?.fuelPricePerLiter || 6.45
          );
          const tankCap = parseFloat(v.tankCapacity) || 50;
          // Se o abastecimento completar/ultrapassar 100% da capacidade do tanque, calibra o teto em 100%
          // para que as próximas missões deduzam imediatamente a partir do tanque cheio (100%)
          const rawTotalLiters =
            tel.baseLiters + tel.refuelLitersAdded - tel.totalMissionsLitersConsumed;
          let nextBaseFuelPercent = v.baseFuelPercent;
          if (rawTotalLiters > tankCap) {
            const cappedBaseLiters =
              tankCap - (tel.refuelLitersAdded - tel.totalMissionsLitersConsumed);
            nextBaseFuelPercent = parseFloat(((cappedBaseLiters / tankCap) * 100).toFixed(4));
          }

          return {
            ...v,
            fuelLogs: logs,
            baseFuelPercent: nextBaseFuelPercent,
            currentFuelPercent: tel.currentPercent,
            currentKm: fuelLog.km ? Math.max(v.currentKm || 0, fuelLog.km) : v.currentKm,
          };
        }
        return v;
      })
    );
  };

  const handleDeleteFuelLog = (vehicleId, fuelLogId) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          return {
            ...v,
            fuelLogs: (v.fuelLogs || []).filter((f) => f.id !== fuelLogId),
          };
        }
        return v;
      })
    );
  };

  // Handlers de Funções da Empresa
  const handleAddRole = async (newRole) => {
    const trimmed = newRole ? newRole.trim() : '';
    if (!trimmed || roles.includes(trimmed)) return;
    const nextRoles = [...roles, trimmed];
    setRoles(nextRoles);
    localStorage.setItem('gestormf_roles', JSON.stringify(nextRoles));
    try {
      await apiSaveSettings(settings, nextRoles);
    } catch (err) {
      console.warn('Erro ao salvar nova função no servidor:', err);
    }
  };

  const handleUpdateRole = async (oldRole, updatedRole) => {
    const trimmedOld = oldRole ? oldRole.trim() : '';
    const trimmedNew = updatedRole ? updatedRole.trim() : '';
    if (!trimmedNew || trimmedOld === trimmedNew) return;

    const nextRoles = roles.map((r) => (r === trimmedOld ? trimmedNew : r));
    setRoles(nextRoles);
    localStorage.setItem('gestormf_roles', JSON.stringify(nextRoles));

    // Atualiza colaboradores que tinham essa função como principal ou secundária
    const membersToUpdate = [];
    const nextMembers = members.map((m) => {
      let changed = false;
      let newRole = m.role;
      let newSecRoles = Array.isArray(m.secondaryRoles) ? [...m.secondaryRoles] : [];

      if (m.role === trimmedOld) {
        newRole = trimmedNew;
        changed = true;
      }
      if (newSecRoles.includes(trimmedOld)) {
        newSecRoles = newSecRoles.map((sr) => (sr === trimmedOld ? trimmedNew : sr));
        changed = true;
      }

      if (changed) {
        const updatedMember = { ...m, role: newRole, secondaryRoles: newSecRoles };
        membersToUpdate.push(updatedMember);
        return updatedMember;
      }
      return m;
    });

    setMembers(nextMembers);
    localStorage.setItem('gestormf_members', JSON.stringify(nextMembers));

    try {
      // 1. Salva a lista de funções atualizada no servidor MySQL
      await apiSaveSettings(settings, nextRoles);

      // 2. Atualiza todos os colaboradores afetados no banco de dados
      for (const m of membersToUpdate) {
        await apiSaveMember(m);
      }
    } catch (err) {
      console.warn('Erro ao persistir renomeação de funções no servidor:', err);
    }
  };

  const handleDeleteRole = async (roleToDelete) => {
    const trimmed = roleToDelete ? roleToDelete.trim() : '';
    const nextRoles = roles.filter((r) => r !== trimmed);
    setRoles(nextRoles);
    localStorage.setItem('gestormf_roles', JSON.stringify(nextRoles));
    try {
      await apiSaveSettings(settings, nextRoles);
    } catch (err) {
      console.warn('Erro ao remover função no servidor:', err);
    }
  };

  // Handlers de Membros (P1-08: Confirmação síncrona com tratamento de erro e rollback)
  const handleAddMember = async (newMem) => {
    try {
      const res = await apiSaveMember(newMem);
      if (!res.success) {
        await alertDialog({
          title: 'Erro ao Salvar Colaborador',
          message: res.error || 'Falha ao salvar colaborador no servidor.',
          variant: 'danger',
        });
        return false;
      }
      const saved = { ...newMem, id: res.id || newMem.id };
      setMembers((prev) => [...prev, saved]);
      return true;
    } catch (e) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha ao conectar com o servidor para salvar o colaborador.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleUpdateMember = async (updatedMem) => {
    const previous = members;
    try {
      const res = await apiSaveMember(updatedMem);
      if (!res.success) {
        await alertDialog({
          title: 'Erro ao Atualizar Colaborador',
          message: res.error || 'Falha ao atualizar dados do colaborador no servidor.',
          variant: 'danger',
        });
        return false;
      }
      setMembers((prev) => prev.map((m) => (m.id === updatedMem.id ? updatedMem : m)));
      return true;
    } catch (e) {
      setMembers(previous);
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de rede ao atualizar dados do colaborador.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleDeleteMember = async (memId) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Colaborador',
      message: 'Tem certeza que deseja remover este colaborador permanentemente?',
      description: 'O colaborador deixará de estar disponível para escalas e equipes.',
      confirmText: 'Sim, Remover',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) return false;

    const previous = members;
    setMembers((prev) => prev.filter((m) => m.id !== memId));
    try {
      const res = await apiDeleteMember(memId);
      if (!res.success) {
        setMembers(previous);
        await alertDialog({
          title: 'Erro ao Remover Colaborador',
          message: res.error || 'Falha ao excluir colaborador no servidor.',
          variant: 'danger',
        });
        return false;
      }
      return true;
    } catch (e) {
      setMembers(previous);
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de rede ao remover colaborador.',
        variant: 'danger',
      });
      return false;
    }
  };

  const handleUpdatePixKey = async (memberId, newPixKey) => {
    const trimmed = (newPixKey || '').trim();
    setMembers((prev) => {
      const next = prev.map((m) => (m.id === memberId ? { ...m, pixKey: trimmed } : m));
      localStorage.setItem('gestormf_members', JSON.stringify(next));
      return next;
    });

    if (currentUser) {
      const updatedCur = { ...currentUser, pixKey: trimmed };
      setCurrentUser(updatedCur);
      setStoredCurrentUser(updatedCur);
    }

    try {
      await apiUpdatePixKey(trimmed);
    } catch (err) {
      console.warn('Erro ao sincronizar Chave PIX com o backend:', err);
    }
  };

  // Reset e Backup
  const handleResetDemoData = () => {
    setSettings(DEFAULT_SETTINGS);
    setVehicles([]);
    setMembers([]);
    setMissions([]);
    setSelectedMissionId(null);
    localStorage.setItem('gestormf_vehicles', JSON.stringify([]));
    localStorage.setItem('gestormf_members', JSON.stringify([]));
    localStorage.setItem('gestormf_missions', JSON.stringify([]));
    localStorage.setItem('gestormf_settings', JSON.stringify(DEFAULT_SETTINGS));
  };

  const handleClearMissions = () => {
    setMissions([]);
    setSelectedMissionId(null);
    localStorage.setItem('gestormf_missions', JSON.stringify([]));
  };

  const handleImportData = (data) => {
    if (data.settings) setSettings(data.settings);
    if (data.vehicles) setVehicles(data.vehicles);
    if (data.members) setMembers(data.members);
    if (data.missions) setMissions(data.missions);
  };

  // Filtros de Missões na aba Mapa & Frotas
  // Por padrão ('ativas'), exibe apenas missões Agendadas, Em Preparo e Em Execução (oculta Finalizadas)
  const isMissionAgendada = (m) => !m.missionStatus || m.missionStatus === 'Agendada';
  const isMissionEmAndamento = (m) =>
    m.missionStatus === 'Em Execução' ||
    m.missionStatus === 'Em Preparo' ||
    m.missionStatus === 'Saiu' ||
    m.missionStatus === 'Em Deslocamento';
  const isMissionFinalizada = (m) => {
    if (!m) return false;
    const s = (m.missionStatus || '').toLowerCase();
    return s === 'finalizada' || s === 'finalizado' || s === 'concluída' || s === 'concluida';
  };
  const isMissionAtiva = (m) => !isMissionFinalizada(m) && m.missionStatus !== 'Cancelada';

  const countAtivas = missions.filter(isMissionAtiva).length;
  const countAgendadas = missions.filter(isMissionAgendada).length;
  const countAndamento = missions.filter(isMissionEmAndamento).length;
  const countPendentes = missions.filter((m) => m.missionStatus === 'Pendente').length;
  const countFinalizadas = missions.filter(isMissionFinalizada).length;

  const filteredMapMissions = useMemo(() => {
    const list = missions.filter((m) => {
      if (mapMissionFilter === 'agendadas') return isMissionAgendada(m);
      if (mapMissionFilter === 'andamento') return isMissionEmAndamento(m);
      if (mapMissionFilter === 'pendentes') return m.missionStatus === 'Pendente';
      if (mapMissionFilter === 'finalizadas') return isMissionFinalizada(m);
      // Padrão ('ativas'): mostra Agendadas, Pendentes, Em Preparo e Em Execução (não mostra Finalizadas)
      return isMissionAtiva(m);
    });

    // Ordenação estrita por prioridade de status:
    // 1º: Em Execução / Em Andamento
    // 2º: Pendentes
    // 3º: Agendadas
    return sortMissionsByStatusPriority(list);
  }, [missions, mapMissionFilter]);

  // Totais rápidos para métricas (baseados na listagem visível)
  const totalKmScheduled = filteredMapMissions.reduce(
    (acc, m) => acc + getMissionTotalKm(m),
    0
  );
  const totalFuelCostScheduled = filteredMapMissions.reduce(
    (acc, m) => acc + (parseFloat(m.estimatedFuelCost) || 0),
    0
  );

  // Detecta viaturas em reserva crítica de combustível (<= 10% do tanque)
  const reserveAlertVehicles = vehicles
    .map((v) => ({
      vehicle: v,
      telemetry: computeVehicleFuelTelemetry(v, missions, settings?.fuelPricePerLiter || 6.45),
    }))
    .filter((item) => item.telemetry.isReserveAlert);

  // Sincroniza alertas de combustível da frota na Central de Notificações
  // REGRA DO USUÁRIO: NUNCA repete avisos de combustível já informados.
  useEffect(() => {
    if (reserveAlertVehicles.length > 0) {
      setNotifications((prev) => {
        const newAlerts = [];
        reserveAlertVehicles.forEach((item) => {
          const v = item.vehicle;
          const tel = item.telemetry || {};
          const currentLiters = tel.currentLiters ?? tel.fuelLiters ?? 0;
          const currentPercent = tel.currentPercent ?? tel.currentFuelPercent ?? 0;
          const isElec = isElectricVehicle(v);
          const unit = isElec ? 'kWh' : 'L';

          // Se já existe qualquer notificação para este veículo (mesmo que já lida), NÃO cria outra!
          const alreadyExists = prev.some(
            (n) => n.type === 'fuel' && n.vehicleId === v.id
          );

          if (!alreadyExists) {
            newAlerts.push({
              id: `fuel-res-${v.id}`,
              title: isElec ? `⚡ Bateria Baixa (${v.name})` : `⚠️ Reserva de Combustível (${v.name})`,
              message: `Viatura ${v.name} (${v.plate}) está com apenas ${Number(currentLiters).toFixed(1)} ${unit} (${Number(currentPercent).toFixed(0)}%).`,
              details: isElec ? 'Recarga imediata da bateria recomendada.' : 'Abastecimento imediato recomendado.',
              timestamp: Date.now(),
              type: 'fuel',
              vehicleId: v.id,
              read: false,
              isResolved: false,
            });
          }
        });
        return newAlerts.length > 0 ? [...newAlerts, ...prev] : prev;
      });
    }
  }, [reserveAlertVehicles]);

  // Atualização dinâmica de status: Quando o veículo é abastecido ou a missão é concluída,
  // marca a notificação como resolvida e atualiza a mensagem liberando a exclusão!
  useEffect(() => {
    setNotifications((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        // Veículo abastecido ou recarregado
        if (n.type === 'fuel' && n.vehicleId) {
          const v = vehicles.find((veh) => veh.id === n.vehicleId);
          if (v) {
            const tel = computeVehicleFuelTelemetry(v, missions, settings?.fuelPricePerLiter || 6.45);
            if (!tel.isReserveAlert && !n.isResolved) {
              changed = true;
              const isElec = isElectricVehicle(v);
              const unit = isElec ? 'kWh' : 'L';
              return {
                ...n,
                isResolved: true,
                details: `✅ Viatura ${isElec ? 'recarregada' : 'abastecida'} (${tel.currentPercent}% • ${tel.currentLiters}${unit}). Notificação liberada para exclusão.`,
              };
            }
          }
        }
        // Missão concluída
        if (n.type === 'mission' && n.missionId) {
          const m = missions.find((mis) => mis.id === n.missionId);
          if (m) {
            const isDone =
              m.missionStatus === 'Finalizado' ||
              m.missionStatus === 'Finalizada' ||
              m.missionStatus === 'Concluída' ||
              m.editionStatus === 'Edição Concluída' ||
              m.editionStatus === 'Entregue';
            if (isDone && !n.isResolved) {
              changed = true;
              return {
                ...n,
                isResolved: true,
                details: `✅ Missão finalizada (#${m.code || ''}). Notificação liberada para exclusão.`,
              };
            }
          }
        }
        return n;
      });
      return changed ? next : prev;
    });
  }, [vehicles, missions, settings]);

  // Inicialização inteligente única na primeira execução (apenas para missões atribuídas ao usuário)
  const hasCheckedSeedNotifsRef = useRef(false);
  useEffect(() => {
    const alreadySeeded = localStorage.getItem('gestormf_notifs_seeded_v1');
    if (!hasCheckedSeedNotifsRef.current && !alreadySeeded && missions.length > 0 && currentUser) {
      hasCheckedSeedNotifsRef.current = true;
      localStorage.setItem('gestormf_notifs_seeded_v1', 'true');
      setNotifications((prev) => {
        if (prev.length > 0) return prev;
        const myMissions = missions.filter((m) => isUserInMission(m, currentUser));
        return myMissions.slice(0, 3).map((m) => ({
          id: `seed-${m.id}`,
          title: `🎯 Missão: ${m.description}`,
          message: `${m.locationName || m.address || 'Local Definido'} • Saída: ${m.departureTime || '--'} (#${m.code || ''})`,
          details: `Viatura: ${m.vehicleNameDisplay || 'Mega'} • Status: ${m.missionStatus || 'Agendada'}`,
          timestamp: Date.now() - 1000 * 60 * 20,
          type: 'mission',
          missionId: m.id,
          read: false,
          isResolved: false,
        }));
      });
    }
  }, [missions, currentUser, isUserInMission]);

  // Saudação Dinâmica no Corpo da Página (Horário + Nome)
  const greetingInfo = useMemo(() => {
    const hr = new Date().getHours();
    let text = 'Boa noite';
    let icon = '🌙';
    if (hr >= 5 && hr < 12) {
      text = 'Bom dia';
      icon = '☀️';
    } else if (hr >= 12 && hr < 18) {
      text = 'Boa tarde';
      icon = '🌤️';
    }
    const firstName = currentUser?.name ? currentUser.name.trim().split(' ')[0] : 'Colaborador';
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return {
      text,
      icon,
      firstName,
      dateFormatted: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)
    };
  }, [currentUser]);

  // Solicitações de Horas Extras Pendentes para Administradores
  const pendingExtraHoursRequests = useMemo(() => {
    if (!isAdminUser) return [];
    const list = [];
    missions.forEach((m) => {
      const reqs = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
      reqs.forEach((r) => {
        if (r.status === 'PENDING') {
          list.push({
            ...r,
            missionId: m.id,
            missionTitle: m.description,
            missionCode: m.code,
          });
        }
      });
    });
    return list;
  }, [isAdminUser, missions]);

  const handleRespondExtraHours = async (missionId, requestId, decision) => {
    try {
      const res = await apiRespondExtraHours({ missionId, requestId, decision });
      if (res.success) {
        await alertDialog({
          title: decision === 'APPROVE' ? 'Hora Extra Aprovada' : 'Hora Extra Recusada',
          message: res.message || 'Status atualizado com sucesso.',
          variant: decision === 'APPROVE' ? 'success' : 'info',
        });
        reloadServerMissions();
      } else {
        await alertDialog({
          title: 'Erro',
          message: res.error || 'Não foi possível atualizar a solicitação.',
          variant: 'danger',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha ao processar solicitação de hora extra.',
        variant: 'danger',
      });
    }
  };

  const currentLogo = settings?.logoUrl || (theme === 'light' ? logoLight : logoDark);

  // Se nenhum usuário estiver logado, exibe a tela de login moderna com autenticação
  if (!currentUser) {
    return (
      <LoginScreen
        theme={theme}
        toggleTheme={toggleTheme}
        onLoginSuccess={(user) => {
          setStoredCurrentUser(user);
          setCurrentUser(user);
        }}
      />
    );
  }

  const hasFuelAlert = reserveAlertVehicles.length > 0 && activeTab !== 'vehicles' && canManageFleetAndTeams;

  return (
    <div className={`app-container ${compactMode ? 'compact-mode' : ''} ${hasFuelAlert ? 'has-fuel-alert' : ''} device-${deviceInfo.type}`}>
      {/* Barra de Navegação Superior Principal */}
      <header className="app-header">
        <div className="header-left">
          {/* Botão Menu Sanduíche para Celulares e Tablets */}
          {deviceInfo.type !== 'desktop' && (
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileDrawerOpen(true)}
              title="Abrir Menu Lateral"
              aria-label="Abrir Menu de Navegação"
            >
              <Menu size={22} />
              {unreadNotificationsCount > 0 && (
                <span
                  className="mobile-hamburger-badge"
                  title={`${unreadNotificationsCount} notificações não lidas`}
                >
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          <div
            className="brand-badge-box"
            onClick={() => setActiveTab('map')}
            title="Ir para Mapa & Frotas"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('map');
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <img
              src={currentLogo}
              alt="Mega Gestão - Ir para Mapa & Frotas"
              className="brand-logo-img"
            />
          </div>
        </div>

        {/* Abas Principais (Menu Moderno para Telas Maiores) */}
        <nav className="nav-tabs-container" aria-label="Menu principal">
          <button
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <span className="tab-icon-box">
              <Navigation size={15} />
            </span>
            <span className="tab-label">Mapa &amp; Frotas</span>
            <span className="tab-badge">{countAtivas}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            <span className="tab-icon-box">
              <Table size={15} />
            </span>
            <span className="tab-label">Tabela de Serviço</span>
          </button>

          {/* Abas Estratégicas: Exclusivas para Gestores e Administradores */}
          {canManageFleetAndTeams && (
            <>
              <button
                className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''} ${reserveAlertVehicles.length > 0 ? 'tab-btn-reserve-alert' : ''
                  }`}
                onClick={() => setActiveTab('vehicles')}
              >
                <span className="tab-icon-box">
                  <Car size={15} />
                </span>
                <span className="tab-label">Viaturas &amp; Combustível</span>
                <span className={`tab-badge ${reserveAlertVehicles.length > 0 ? 'badge-danger-pulse' : ''}`}>
                  {reserveAlertVehicles.length > 0
                    ? `⚠️ ${reserveAlertVehicles.length}`
                    : vehicles.length}
                </span>
              </button>

              <button
                className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
                onClick={() => setActiveTab('teams')}
              >
                <span className="tab-icon-box">
                  <Users size={15} />
                </span>
                <span className="tab-label">Equipes</span>
                <span className="tab-badge">{members.length}</span>
              </button>
            </>
          )}

          {/* Se for ADMINISTRADOR: Exibe a Central do Admin e NÃO exibe Meu Espaço */}
          {isAdminUser ? (
            <button
              className={`tab-btn tab-btn-admin ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
              title="Central do Administrador: Aprovações, Diárias & Fechamento, Inteligência & Ranking"
            >
              <span className="tab-icon-box">
                <ShieldCheck size={15} />
              </span>
              <span className="tab-label">Central do Admin</span>
              {pendingExtraHoursRequests.length > 0 && (
                <span className="tab-badge badge-danger-pulse">
                  ⏱️ {pendingExtraHoursRequests.length}
                </span>
              )}
            </button>
          ) : (
            /* Se for COLABORADOR: Exibe Meu Espaço */
            <button
              className={`tab-btn ${activeTab === 'me' ? 'active' : ''}`}
              onClick={() => setActiveTab('me')}
              title="Meu Espaço Individual: Horas Extras, Diárias e Funções"
            >
              <span className="tab-icon-box">
                <Sparkles size={15} />
              </span>
              <span className="tab-label">Meu Espaço</span>
            </button>
          )}
        </nav>

        {/* Ações Rápidas no Header */}
        <div className="header-right">
          {canCreateMission && (
            <button className="btn-new-mission" onClick={() => handleOpenNewMission()}>
              <span className="btn-new-mission-icon">
                <Plus size={15} />
              </span>
              <span>Nova Missão</span>
            </button>
          )}

          {/* Central de Notificações - No modo desktop fica no cabeçalho; no modo app/mobile fica dentro do menu */}
          <div className="notifications-header-wrapper" ref={notificationsRef}>
            {deviceInfo.type === 'desktop' && (
              <button
                type="button"
                className={`btn-notifications-header ${isNotificationsOpen ? 'is-open' : ''} ${unreadNotificationsCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                title={unreadNotificationsCount > 0 ? `Central de Notificações (${unreadNotificationsCount} novas)` : 'Central de Notificações'}
                aria-label="Central de Notificações"
              >
                <Bell size={18} />
                {unreadNotificationsCount > 0 && (
                  <span className="notifications-badge-count">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {isNotificationsOpen && (
              <NotificationsCenter
                notifications={notifications}
                onClose={() => setIsNotificationsOpen(false)}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                onClearAll={handleClearAllNotifications}
                onDeleteNotification={handleDeleteNotification}
                isNotificationLocked={isNotificationLocked}
                onSelectNotification={handleSelectNotification}
                canSendMessage={canSendMessage}
                onOpenSendMessage={() => {
                  setIsNotificationsOpen(false);
                  setIsSendMessageOpen(true);
                }}
              />
            )}
          </div>

          {/* Botão de Alternância de Tema (Modo Claro / Modo Escuro - Apenas Ícone) */}
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'light' ? 'is-light' : 'is-dark'}`}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            aria-label="Alternar entre modo claro e escuro"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {canManageSettings && (
            <button
              className="btn-settings-header"
              onClick={() => setIsSettingsModalOpen(true)}
              title="Configurações da Base & Combustível"
            >
              <Settings size={18} />
            </button>
          )}

          {/* Menu do Usuário Autenticado com Avatar e Níveis */}
          <UserMenu
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenPermissions={() => setIsPermissionsModalOpen(true)}
            compactMode={compactMode}
            setCompactMode={handleSetCompactMode}
            soundAlerts={soundAlerts}
            setSoundAlerts={setSoundAlerts}
          />
        </div>
      </header>

      {/* Menu Sanduíche Lateral Deslizante (Drawer) para Celulares e Tablets */}
      {isMobileDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileDrawerOpen(false)}>
          <aside className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="md-header">
              <div className="md-user-info">
                <div className="md-avatar">
                  {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} />
                  ) : (
                    <span>{currentUser?.name?.slice(0, 2).toUpperCase() || 'US'}</span>
                  )}
                </div>
                <div className="md-user-text">
                  <strong className="md-name">{currentUser?.name}</strong>
                  <span className="md-email">{currentUser?.email}</span>
                  <div className="md-badges-row">
                    <span className={`md-role-badge role-badge-${userRole}`}>
                      {ROLE_CONFIG[userRole]?.label || (userRole === 'admin' ? 'Administrador' : userRole === 'manager' ? 'Gestor' : 'Usuário')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="md-close-btn"
                onClick={() => setIsMobileDrawerOpen(false)}
                title="Fechar Menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Destaque para Central de Notificações no Menu do Modo App */}
            <div className="md-notif-highlight-section">
              <button
                type="button"
                className={`btn-md-notifications ${unreadNotificationsCount > 0 ? 'has-unread' : ''}`}
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsNotificationsOpen(true);
                }}
              >
                <div className="md-notif-left">
                  <div className="md-notif-icon-box">
                    <Bell size={19} />
                    {unreadNotificationsCount > 0 && <span className="md-notif-pulse-dot" />}
                  </div>
                  <div className="md-notif-text">
                    <span className="md-notif-title">Notificações &amp; Avisos</span>
                    <span className="md-notif-sub">
                      {unreadNotificationsCount > 0
                        ? `${unreadNotificationsCount} aviso${unreadNotificationsCount > 1 ? 's' : ''} novo${unreadNotificationsCount > 1 ? 's' : ''} pendente${unreadNotificationsCount > 1 ? 's' : ''}`
                        : 'Nenhuma notificação nova'}
                    </span>
                  </div>
                </div>
                {unreadNotificationsCount > 0 ? (
                  <span className="md-notif-badge">{unreadNotificationsCount}</span>
                ) : (
                  <span className="md-notif-badge empty">0</span>
                )}
              </button>
            </div>

            <nav className="md-nav-links">
              <button
                className={`md-nav-item ${activeTab === 'map' ? 'active' : ''}`}
                onClick={() => { setActiveTab('map'); setIsMobileDrawerOpen(false); }}
              >
                <Navigation size={18} />
                <span>Mapa &amp; Frotas</span>
                <span className="md-nav-badge">{countAtivas}</span>
              </button>

              <button
                className={`md-nav-item ${activeTab === 'board' ? 'active' : ''}`}
                onClick={() => { setActiveTab('board'); setIsMobileDrawerOpen(false); }}
              >
                <Table size={18} />
                <span>Tabela de Serviço</span>
                <span className="md-nav-badge">{missions.length}</span>
              </button>

              {canManageFleetAndTeams && (
                <>
                  <button
                    className={`md-nav-item ${activeTab === 'vehicles' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('vehicles'); setIsMobileDrawerOpen(false); }}
                  >
                    <Car size={18} />
                    <span>Viaturas &amp; Combustível</span>
                    {reserveAlertVehicles.length > 0 && (
                      <span className="md-nav-badge danger">⚠️ {reserveAlertVehicles.length}</span>
                    )}
                  </button>

                  <button
                    className={`md-nav-item ${activeTab === 'teams' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('teams'); setIsMobileDrawerOpen(false); }}
                  >
                    <Users size={18} />
                    <span>Equipes &amp; Administradores</span>
                    <span className="md-nav-badge">{members.length}</span>
                  </button>
                </>
              )}

              {isAdminUser ? (
                <button
                  className={`md-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('admin'); setIsMobileDrawerOpen(false); }}
                >
                  <ShieldCheck size={18} />
                  <span>Central do Admin</span>
                  {pendingExtraHoursRequests.length > 0 && (
                    <span className="md-nav-badge danger">⏱️ {pendingExtraHoursRequests.length}</span>
                  )}
                </button>
              ) : (
                <button
                  className={`md-nav-item ${activeTab === 'me' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('me'); setIsMobileDrawerOpen(false); }}
                >
                  <Sparkles size={18} />
                  <span>Meu Espaço (Colaborador)</span>
                </button>
              )}
            </nav>

            {canCreateMission && (
              <div className="md-quick-action">
                <button
                  type="button"
                  className="btn-md-new-mission"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    handleOpenNewMission();
                  }}
                >
                  <Plus size={18} />
                  <span>Nova Missão</span>
                </button>
              </div>
            )}

            <div className="md-settings-section">
              <div className="md-section-label">Preferências &amp; Ajustes</div>

              <div className="md-toggle-item">
                <div className="md-toggle-left">
                  <Sliders size={16} />
                  <span>Modo Compacto</span>
                </div>
                <label className="custom-switch">
                  <input
                    type="checkbox"
                    checked={compactMode}
                    onChange={(e) => handleSetCompactMode(e.target.checked)}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="md-toggle-item">
                <div className="md-toggle-left">
                  <Bell size={16} />
                  <span>Alertas Sonoros</span>
                </div>
                <label className="custom-switch">
                  <input
                    type="checkbox"
                    checked={soundAlerts}
                    onChange={(e) => setSoundAlerts(e.target.checked)}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <button
                type="button"
                className="md-action-item"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsNotificationsOpen(true);
                }}
              >
                <Bell size={16} />
                <span>Central de Notificações</span>
                {unreadNotificationsCount > 0 && (
                  <span
                    className="md-badge"
                    style={{
                      marginLeft: 'auto',
                      background: 'linear-gradient(135deg, #ef4444, #f97316)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {unreadNotificationsCount} nova{unreadNotificationsCount > 1 ? 's' : ''}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="md-action-item"
                onClick={() => {
                  toggleTheme();
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>Alternar para Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
              </button>

              <button
                type="button"
                className="md-action-item"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsProfileModalOpen(true);
                }}
              >
                <Shield size={16} />
                <span>Meu Perfil &amp; Senha</span>
              </button>

              {canManageSettings && (
                <button
                  type="button"
                  className="md-action-item"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                >
                  <Settings size={16} />
                  <span>Configurações da Base</span>
                </button>
              )}
            </div>

            <div className="md-footer">
              <button
                type="button"
                className="btn-md-logout"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  handleLogout();
                }}
              >
                <LogOut size={16} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ALERTA EM TEMPO REAL: NOVA MISSÃO ATRIBUÍDA */}
      {incomingMissionAlert && (
        <div className="incoming-mission-alert-banner">
          <div className="imab-left">
            <div className="imab-icon-pulse">
              <BellRing size={20} />
            </div>
            <div className="imab-text">
              <span className="imab-title">🚨 Nova Missão Atribuída a Você!</span>
              <span className="imab-desc">
                <strong>{incomingMissionAlert.description}</strong> • Saída: {incomingMissionAlert.departureTime || 'Hoje'} ({incomingMissionAlert.locationName || incomingMissionAlert.address || 'Local Definido'})
              </span>
            </div>
          </div>
          <div className="imab-actions">
            <button
              type="button"
              className="btn-imab-view"
              onClick={() => {
                setSelectedMissionId(incomingMissionAlert.id);
                setActiveTab('map');
                setIncomingMissionAlert(null);
              }}
            >
              Abrir no Mapa
            </button>
            <button
              type="button"
              className="btn-imab-close"
              onClick={() => setIncomingMissionAlert(null)}
              title="Dispensar aviso"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* BANNER DE SOLICITAÇÃO DE PERMISSÃO DE NOTIFICAÇÃO NO CELULAR */}
      {notificationPermissionState === 'default' && !dismissNotificationPrompt && currentUser && (
        <div className="notification-permission-prompt">
          <div className="npp-left">
            <Bell size={18} className="npp-icon-anim" />
            <span>
              <strong>Ative as notificações no seu celular</strong> para receber pushs e avisos sonoros de novas missões instantaneamente!
            </span>
          </div>
          <div className="npp-actions">
            <button
              type="button"
              className="btn-npp-allow"
              onClick={async () => {
                const res = await requestNotificationPermission();
                setNotificationPermissionState(res);
              }}
            >
              Ativar Notificações 🔔
            </button>
            <button
              type="button"
              className="btn-npp-dismiss"
              onClick={() => setDismissNotificationPrompt(true)}
            >
              Depois
            </button>
          </div>
        </div>
      )}

      {/* AVISO GLOBAL DE RESERVA / BATERIA BAIXA (<= 10%) EM QUALQUER TELA (Apenas Gestor/Admin) */}
      {reserveAlertVehicles.length > 0 && activeTab !== 'vehicles' && canManageFleetAndTeams && (() => {
        const hasElecReserve = reserveAlertVehicles.some(({ vehicle: rv }) => isElectricVehicle(rv));
        const allElecReserve = reserveAlertVehicles.every(({ vehicle: rv }) => isElectricVehicle(rv));

        return (
          <div className="global-fuel-reserve-bar">
            <div className="gfr-left">
              <AlertCircle size={17} className="gfr-icon" />
              <span>
                <strong>
                  {allElecReserve
                    ? '⚡ ALERTA DE BATERIA BAIXA (≤ 10%):'
                    : hasElecReserve
                    ? '⚡🚨 ALERTA DE BATERIA / RESERVA CRÍTICA (≤ 10%):'
                    : '🚨 ALERTA DE RESERVA DE COMBUSTÍVEL (≤ 10%):'}
                </strong>{' '}
                {reserveAlertVehicles
                  .map(({ vehicle: rv, telemetry: rt }) => {
                    const unit = isElectricVehicle(rv) ? 'kWh' : 'L';
                    return `${rv.name} (${rv.plate}: ${rt.currentPercent}% • ${rt.currentLiters}${unit})`;
                  })
                  .join(' | ')}{' '}
                —{' '}
                <strong>
                  {allElecReserve
                    ? 'Recarga imediata da bateria necessária!'
                    : hasElecReserve
                    ? 'Recarga / Abastecimento imediato necessário!'
                    : 'Abastecimento imediato necessário!'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              className="btn-gfr-action"
              onClick={() => setActiveTab('vehicles')}
            >
              {hasElecReserve ? <Zap size={14} /> : <Fuel size={14} />} Ir para{' '}
              {hasElecReserve ? 'Recarga / Frotas' : 'Abastecimento'}
            </button>
          </div>
        );
      })()}

      {/* Conteúdo Principal com Abas */}
      <main className="app-main-content">
        {/* ============================================================== */}
        {/* SAUDAÇÃO AUTOMÁTICA NO CORPO DA PÁGINA (Abaixo do Menu)        */}
        {/* ============================================================== */}
        <div className="dynamic-body-greeting">
          <div className="dbg-left">
            <div className="dbg-icon-badge">{greetingInfo.icon}</div>
            <div className="dbg-text">
              <h1 className="dbg-title">
                {greetingInfo.text}, <span className="dbg-name">{greetingInfo.firstName}</span>!
              </h1>
              <p className="dbg-subtitle">
                {greetingInfo.dateFormatted} • {countAtivas} {countAtivas === 1 ? 'missão ativa' : 'missões ativas'} na base
              </p>
            </div>
          </div>

          <div className="dbg-right">
            {isAdminUser ? (
              activeTab !== 'admin' ? (
                <button
                  type="button"
                  className="dbg-btn-space"
                  onClick={() => setActiveTab('admin')}
                  title="Abrir Central do Administrador: Aprovações, Diárias & Fechamento, Inteligência & Ranking"
                >
                  <ShieldCheck size={14} />
                  <span>Central do Admin</span>
                  {pendingExtraHoursRequests.length > 0 && (
                    <span className="dbg-badge-count">
                      ⏱️ {pendingExtraHoursRequests.length}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="dbg-btn-space active"
                  onClick={() => setActiveTab('map')}
                  title="Voltar ao monitoramento de missões"
                >
                  <Navigation size={14} />
                  <span>Mapa &amp; Frotas</span>
                </button>
              )
            ) : (
              activeTab !== 'me' ? (
                <button
                  type="button"
                  className="dbg-btn-space"
                  onClick={() => setActiveTab('me')}
                  title="Ver meu extrato financeiro, histórico de missões e métricas"
                >
                  <Sparkles size={14} />
                  <span>Meu Espaço</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="dbg-btn-space active"
                  onClick={() => setActiveTab('map')}
                  title="Voltar ao monitoramento de missões"
                >
                  <Navigation size={14} />
                  <span>Mapa &amp; Frotas</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* ALERTA DE HORAS EXTRAS PENDENTES (Para Administradores fora da aba admin) */}
        {isAdminUser && activeTab !== 'admin' && pendingExtraHoursRequests.length > 0 && (
          <div className="ehr-pending-admin-alert">
            <div className="ehr-alert-header">
              <Clock size={16} className="text-amber" />
              <strong>⏱️ {pendingExtraHoursRequests.length} Solicitação{pendingExtraHoursRequests.length !== 1 ? 'ões' : ''} de Hora Extra Aguardando Sua Aprovação</strong>
            </div>
            <p className="ehr-alert-msg">
              Colaboradores de campo solicitaram horas extras que necessitam da sua validação para cômputo na folha.
            </p>
            <button
              type="button"
              className="btn-ehr-open-admin"
              onClick={() => setActiveTab('admin')}
            >
              <span>Avaliar na Central do Admin</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ABA 1: MAPA E MONITORAMENTO DE MISSÕES EM TEMPO REAL (Prioritária) */}
        {activeTab === 'map' && (
          <div className="map-view-layout">
            {/* Barra Lateral com Lista de Missões e Resumo do Dia */}
            <aside className="map-missions-sidebar">
              <div className="sidebar-header">
                <h3>Missões & Deslocamentos</h3>
                <span className="sidebar-count">{filteredMapMissions.length} exibidas</span>
              </div>

              {/* Filtro de Status em Mapa & Frotas: Ativas (Padrão), Em Andamento, Pendentes, Agendadas, Finalizadas */}
              <div className="map-sidebar-filters">
                <button
                  type="button"
                  className={`map-filter-btn ${mapMissionFilter === 'ativas' ? 'active filter-all' : ''}`}
                  onClick={() => setMapMissionFilter('ativas')}
                  title="Exibe todas as missões ativas (Em Execução, Pendentes e Agendadas)"
                >
                  <span>Ativas</span>
                  <span className="filter-count">{countAtivas}</span>
                </button>
                <button
                  type="button"
                  className={`map-filter-btn ${mapMissionFilter === 'andamento' ? 'active filter-andamento' : ''}`}
                  onClick={() => setMapMissionFilter('andamento')}
                  title="Exibe missões Em Preparo e Em Execução"
                >
                  <span>Em Andamento</span>
                  <span className="filter-count">{countAndamento}</span>
                </button>
                <button
                  type="button"
                  className={`map-filter-btn ${mapMissionFilter === 'pendentes' ? 'active filter-pendente' : ''}`}
                  onClick={() => setMapMissionFilter('pendentes')}
                  title="Exibe missões concluídas em campo aguardando pós-produção"
                >
                  <span>Pendentes</span>
                  <span className="filter-count">{countPendentes}</span>
                </button>
                <button
                  type="button"
                  className={`map-filter-btn ${mapMissionFilter === 'agendadas' ? 'active filter-agendadas' : ''}`}
                  onClick={() => setMapMissionFilter('agendadas')}
                >
                  <span>Agendadas</span>
                  <span className="filter-count">{countAgendadas}</span>
                </button>
                <button
                  type="button"
                  className={`map-filter-btn ${mapMissionFilter === 'finalizadas' ? 'active filter-finalizadas' : ''}`}
                  onClick={() => setMapMissionFilter('finalizadas')}
                  title="Clique para visualizar missões já finalizadas"
                >
                  <span>Finalizadas</span>
                  <span className="filter-count">{countFinalizadas}</span>
                </button>
              </div>

              {/* Resumo Rápido de Combustível e Deslocamento (Visível apenas para Administradores e Gestores) */}
              {canManageFleetAndTeams && (
                <div className="day-overview-card">
                  <div className="overview-item">
                    <span className="overview-label">KM Previsto Total</span>
                    <strong className="overview-val">{totalKmScheduled.toFixed(1)} km</strong>
                  </div>
                  <div className="overview-item">
                    <span className="overview-label">Combustível Total</span>
                    <strong className="overview-val gold">R$ {totalFuelCostScheduled.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="missions-scroll-list">
                {filteredMapMissions.length === 0 ? (
                  <div className="empty-list-notice">
                    {missions.length === 0
                      ? 'Nenhuma missão cadastrada. Clique no mapa ou no botão "+ Nova Missão" para agendar.'
                      : mapMissionFilter === 'ativas' && countFinalizadas > 0
                        ? `Nenhuma missão ativa no momento (${countFinalizadas} finalizada${countFinalizadas > 1 ? 's' : ''
                        } oculta${countFinalizadas > 1 ? 's' : ''
                        } — clique no filtro "Finalizadas" acima se desejar visualizá-las).`
                        : 'Nenhuma missão encontrada neste filtro de status.'}
                  </div>
                ) : (
                  filteredMapMissions.map((m) => {
                    const isSelected = selectedMissionId === m.id;
                    const isExecuting = m.missionStatus === 'Em Execução';
                    const mCode = getMissionCode(m, missions);
                    return (
                      <div
                        key={m.id}
                        className={`mission-list-item ${isSelected ? 'active' : ''} ${isExecuting ? 'item-executing' : ''
                          }`}
                        onClick={() => setSelectedMissionId(m.id)}
                      >
                        <div className="item-status-bar">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="mission-code-mini">#{mCode}</span>
                            <span className={`status-tag tag-${(m.missionStatus || 'Agendada').toLowerCase().replace(/\s+/g, '-')}`}>
                              {isExecuting && <span className="exec-pulse-dot"></span>}
                              {m.missionStatus || 'Agendada'}
                            </span>
                            {Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date)) && (
                              <span className="mission-multiday-tag" title={`Missão de múltiplos dias: de ${m.date} a ${m.endDate}`}>
                                🗓️ {m.date && m.endDate ? `${m.date.slice(8, 10)}/${m.date.slice(5, 7)} a ${m.endDate.slice(8, 10)}/${m.endDate.slice(5, 7)}` : 'Múltiplos Dias'}
                              </span>
                            )}
                          </div>
                          <div className="item-schedule-meta">
                            <span className="item-date">
                              📅 {Boolean(m.isMultiDay && m.endDate && m.endDate !== m.date)
                                ? `${formatDateBR(m.date)} a ${formatDateBR(m.endDate)}`
                                : formatDateBR(m.date)}
                            </span>
                            <span className="item-time">Saída: {m.departureTime || '--:--'}</span>
                          </div>
                        </div>

                        <h4 className="item-title">{m.description}</h4>

                        <div className="item-location">
                          <MapPin size={13} className="icon-accent" />
                          <span>{m.locationName || m.address || 'Local não definido'}</span>
                        </div>

                        <div className="item-footer">
                          <div className="item-veh">
                            <Car size={13} />
                            <span>
                              {m.vehicleNameDisplay ? m.vehicleNameDisplay.split('(')[0].trim() : 'Sem carro'}
                              {m.driverName ? ` • 🛞 ${m.driverName.split(' ')[0]}` : ''}
                            </span>
                          </div>

                          <div className="item-fuel" title={`Ida: ${m.distanceKm} km | Total Ida e Volta: ${getMissionTotalKm(m)} km`}>
                            <Navigation size={12} />
                            <span>{getMissionTotalKm(m)} km</span>
                            {canManageFleetAndTeams && (
                              <>
                                <span style={{ opacity: 0.45 }}>•</span>
                                <Fuel size={13} />
                                <span>R$ {Number(m.estimatedFuelCost || 0).toFixed(2)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Espaçador inferior generoso para a barra de rolagem nunca cortar o último card */}
                {filteredMapMissions.length > 0 && (
                  <div className="missions-scroll-bottom-spacer" style={{ height: '90px', flexShrink: 0 }} />
                )}
              </div>
            </aside>

            {/* Mapa Interativo Leaflet */}
            <section className="map-canvas-section">
              <MapView
                baseLocation={settings.baseLocation}
                missions={filteredMapMissions}
                selectedMissionId={selectedMissionId}
                onSelectMission={(id) => setSelectedMissionId(id)}
                onOpenNewMissionAtCoord={(lat, lon) => handleOpenNewMission({ lat, lon })}
                theme={theme}
                userRole={userRole}
              />
            </section>
          </div>
        )}

        {/* ABA 2: TABELA DE SERVIÇO (Idêntica e modernizada da foto) */}
        {activeTab === 'board' && (
          <ServiceBoard
            missions={missions}
            vehicles={vehicles}
            members={members}
            baseLocation={settings.baseLocation}
            fuelPricePerLiter={settings.fuelPricePerLiter}
            settings={settings}
            userRole={userRole}
            currentUser={currentUser}
            onNewMission={() => handleOpenNewMission()}
            onEditMission={handleEditMission}
            onDeleteMission={handleDeleteMission}
            onSaveMission={handleSaveMission}
            onSelectMissionOnMap={(id) => {
              const target = missions.find((m) => m.id === id);
              if (target && isMissionFinalizada(target)) {
                setMapMissionFilter('finalizadas');
              } else {
                setMapMissionFilter('ativas');
              }
              setSelectedMissionId(id);
              setActiveTab('map');
            }}
            onUpdateMissionStatus={handleUpdateMissionStatus}
            onUpdateEditionStatus={handleUpdateEditionStatus}
          />
        )}

        {/* ABA 3: CONTROLE DE VIATURAS & COMBUSTÍVEL (Apenas Gestores e Administradores) */}
        {activeTab === 'vehicles' && canManageFleetAndTeams && (
          <VehicleManager
            vehicles={vehicles}
            missions={missions}
            members={members}
            fuelPricePerLiter={settings.fuelPricePerLiter}
            settings={settings}
            userRole={userRole}
            onAddVehicle={handleAddVehicle}
            onUpdateVehicle={handleUpdateVehicle}
            onDeleteVehicle={handleDeleteVehicle}
            onAddFuelLog={handleAddFuelLog}
            onDeleteFuelLog={handleDeleteFuelLog}
          />
        )}

        {/* ABA 4: EQUIPES & MEMBROS (Apenas Gestores e Administradores) */}
        {activeTab === 'teams' && canManageFleetAndTeams && (
          <TeamManager
            members={members}
            missions={missions}
            roles={roles}
            userRole={userRole}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onAddRole={handleAddRole}
            onUpdateRole={handleUpdateRole}
            onDeleteRole={handleDeleteRole}
          />
        )}

        {/* ABA 5: CENTRAL DO ADMINISTRADOR (Exclusiva para Administradores) */}
        {activeTab === 'admin' && isAdminUser && (
          <AdminCenter
            currentUser={currentUser}
            members={members}
            missions={missions}
            onUpdateMember={handleUpdateMember}
            onRespondExtraHours={handleRespondExtraHours}
            onSaveMission={handleSaveMission}
            reloadServerMissions={reloadServerMissions}
          />
        )}

        {/* ABA 6: MEU ESPAÇO (Área Individual do Colaborador - Apenas para Colaboradores) */}
        {activeTab === 'me' && !isAdminUser && (
          <CollaboratorSpace
            currentUser={currentUser}
            members={members}
            missions={missions}
            onReloadMissions={reloadServerMissions}
            onUpdatePixKey={handleUpdatePixKey}
          />
        )}
      </main>

      {/* Modal de Nova/Editar Missão com Rota Automática */}
      <MissionModal
        isOpen={isMissionModalOpen}
        onClose={() => setIsMissionModalOpen(false)}
        onSaveMission={handleSaveMission}
        editingMission={editingMission}
        initialCoords={initialCoordsForNewMission}
        baseLocation={settings.baseLocation}
        fuelPricePerLiter={settings.fuelPricePerLiter}
        settings={settings}
        vehicles={vehicles}
        members={members}
        missions={missions}
      />

      {/* Modal de Configurações da Sede & Combustível (Apenas Administrador) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          apiSaveSettings(newSettings, roles).catch((e) => console.warn('Erro ao salvar settings na API:', e));
        }}
        onResetDemoData={handleResetDemoData}
        onClearMissions={handleClearMissions}
        allDataToExport={{ settings, vehicles, members, missions, roles }}
        onImportData={handleImportData}
        roles={roles}
        onAddRole={handleAddRole}
        onUpdateRole={handleUpdateRole}
        onDeleteRole={handleDeleteRole}
      />

      {/* Modal de Perfil e Credenciais do Usuário */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        members={members}
        onUserUpdated={(updated) => {
          setStoredCurrentUser(updated);
          setCurrentUser(updated);
          setMembers((prev) =>
            prev.map((m) =>
              (updated.memberId && m.id === updated.memberId) ||
                (!updated.memberId && m.name && m.name.toLowerCase() === updated.name.toLowerCase())
                ? {
                    ...m,
                    photoUrl: updated.avatar,
                    name: updated.name,
                    phone: updated.phone || m.phone,
                    pixKey: updated.pixKey !== undefined ? updated.pixKey : m.pixKey,
                  }
                : m
            )
          );
        }}
      />

      {/* Modal de Matriz de Permissões de Acesso */}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        currentRole={currentUser?.role}
      />

      {/* Modal de Envio de Mensagens e Comunicados (Admin e Gestor -> Toda Equipe ou Individual) */}
      <SendMessageModal
        isOpen={isSendMessageOpen}
        onClose={() => setIsSendMessageOpen(false)}
        members={members}
        onMessageSent={fetchServerMessages}
        alertDialog={alertDialog}
      />

      {/* Barra de Navegação Inferior para Celulares (Estilo App Nativo) */}
      {deviceInfo.type === 'mobile' && (
        <nav className="mobile-bottom-nav" aria-label="Navegação rápida do aplicativo">
          <button
            type="button"
            className={`mbn-item ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <Navigation size={19} />
            <span>Mapa</span>
          </button>

          <button
            type="button"
            className={`mbn-item ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            <Table size={19} />
            <span>Pautas</span>
            {missions.length > 0 && <span className="mbn-badge">{missions.length}</span>}
          </button>

          {canCreateMission && (
            <button
              type="button"
              className="mbn-center-action"
              onClick={() => handleOpenNewMission()}
              title="Nova Missão"
              aria-label="Criar Nova Missão"
            >
              <Plus size={24} />
            </button>
          )}

          {canManageFleetAndTeams && (
            <button
              type="button"
              className={`mbn-item ${activeTab === 'vehicles' ? 'active' : ''}`}
              onClick={() => setActiveTab('vehicles')}
            >
              <Car size={19} />
              <span>Viaturas</span>
              {reserveAlertVehicles.length > 0 && (
                <span className="mbn-badge danger">!</span>
              )}
            </button>
          )}

          {isAdminUser ? (
            <button
              type="button"
              className={`mbn-item ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <ShieldCheck size={19} />
              <span>Admin</span>
              {pendingExtraHoursRequests.length > 0 && (
                <span className="mbn-badge danger">{pendingExtraHoursRequests.length}</span>
              )}
            </button>
          ) : canManageFleetAndTeams ? (
            <button
              type="button"
              className={`mbn-item ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              <Users size={19} />
              <span>Equipes</span>
            </button>
          ) : (
            <button
              type="button"
              className={`mbn-item ${activeTab === 'me' ? 'active' : ''}`}
              onClick={() => setActiveTab('me')}
            >
              <Sparkles size={19} />
              <span>Meu Espaço</span>
            </button>
          )}
        </nav>
      )}
      {/* Modal e Diálogo Global de Confirmação & Alertas Modernos */}
      <ConfirmModal dialog={activeDialog} onClose={() => setActiveDialog(null)} />
    </div>
  );
}
