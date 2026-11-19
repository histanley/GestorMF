import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  MapPin,
  Car,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Navigation,
  Wind,
  Droplets,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Calendar,
  Eye,
  Activity,
  Layers,
  Film,
  Users,
  Radio,
  Zap,
} from 'lucide-react';
import { formatDateBR, getMissionCode } from '../utils/geo';
import { isNativeApp } from '../utils/nativeBridge';
import { getLastLoginTime, formatLastLoginDisplay } from '../utils/auth';
import WeatherIllustration from './WeatherIllustration';

// Mapeia códigos de clima da WMO (Open-Meteo) para descrições, chave de ilustração e ícones (respeitando se é dia ou noite e todas as variações climáticas)
function getWeatherDetails(code, isDay = 1) {
  const c = Number(code);
  switch (c) {
    case 0:
      return {
        label: isDay ? 'Ensolarado' : 'Céu Limpo',
        icon: isDay ? '☀️' : '🌙',
        illustrationKey: isDay ? 'day-clear' : 'night-clear',
        condition: 'clear',
      };
    case 1:
      return {
        label: isDay ? 'Predomínio de Sol' : 'Noite Estrelada',
        icon: isDay ? '🌤️' : '🌙',
        illustrationKey: isDay ? 'day-clear' : 'night-clear',
        condition: 'clear',
      };
    case 2:
      return {
        label: isDay ? 'Parcialmente Nublado' : 'Noite com Nuvens',
        icon: isDay ? '⛅' : '🌙',
        illustrationKey: isDay ? 'day-partly-cloudy' : 'night-partly-cloudy',
        condition: 'cloudy',
      };
    case 3:
      return {
        label: isDay ? 'Nublado' : 'Noite Nublada',
        icon: isDay ? '☁️' : '🌙',
        illustrationKey: isDay ? 'day-cloudy' : 'night-cloudy',
        condition: 'cloudy',
      };
    case 45:
    case 48:
      return {
        label: 'Nevoeiro / Névoa',
        icon: '🌫️',
        illustrationKey: isDay ? 'day-fog' : 'night-fog',
        condition: 'fog',
      };
    case 51:
    case 53:
    case 55:
      return {
        label: 'Chuvisco Passageiro',
        icon: isDay ? '🌦️' : '🌧️',
        illustrationKey: isDay ? 'day-drizzle' : 'night-drizzle',
        condition: 'drizzle',
      };
    case 61:
    case 63:
    case 65:
      return {
        label: 'Chuva',
        icon: '🌧️',
        illustrationKey: isDay ? 'day-rain' : 'night-rain',
        condition: 'rain',
      };
    case 56:
    case 57:
    case 66:
    case 67:
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        label: isDay ? 'Nevando' : 'Neve Noturna',
        icon: '❄️',
        illustrationKey: isDay ? 'day-snow' : 'night-snow',
        condition: 'snow',
      };
    case 80:
    case 81:
    case 82:
      return {
        label: 'Pancadas de Chuva',
        icon: '🌧️',
        illustrationKey: isDay ? 'day-rain' : 'night-rain',
        condition: 'rain',
      };
    case 95:
    case 96:
    case 99:
      return {
        label: 'Trovoada / Temporal',
        icon: '⛈️',
        illustrationKey: isDay ? 'day-storm' : 'night-storm',
        condition: 'storm',
      };
    default:
      return {
        label: isDay ? 'Ensolarado' : 'Noite Clara',
        icon: isDay ? '☀️' : '🌙',
        illustrationKey: isDay ? 'day-clear' : 'night-clear',
        condition: 'clear',
      };
  }
}

export default function SmartHeaderGreeting({
  currentUser = null,
  userRole = 'user',
  missions = [],
  members = [],
  vehicles = [],
  baseLocation = null,
  countAtivas = 0,
  pendingExtraHoursRequests = [],
  activeTab = 'map',
  onNavigateTab = () => { },
  onOpenDetailMission = null,
}) {
  // Ocultar em celulares (iOS e Android / Telas Mobile)
  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (isNativeApp()) return true;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    return window.innerWidth <= 900;
  });

  useEffect(() => {
    const handleResize = () => {
      const isMobile =
        isNativeApp() ||
        /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') ||
        window.innerWidth <= 900;
      setIsMobileDevice(isMobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAdminUser = String(userRole || '').trim().toLowerCase() === 'admin';

  // Relógio digital e data em tempo real
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    if (isMobileDevice) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isMobileDevice]);

  // Saudação por horário
  const greeting = useMemo(() => {
    const hr = currentTime.getHours();
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
    const dateFormatted = currentTime.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeFormatted = currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      text,
      icon,
      firstName,
      timeFormatted,
      dateFormatted: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1),
    };
  }, [currentTime, currentUser]);

  // Última vez que a pessoa logou no sistema (dia e hora)
  const lastLoginFormatted = useMemo(() => {
    const rawTime = getLastLoginTime(currentUser);
    return formatLastLoginDisplay(rawTime);
  }, [currentUser]);

  // Clima em Tempo Real (Boa Vista - RR por padrão ou coordenadas da base) com Cache de 30min
  const [weatherData, setWeatherData] = useState(() => {
    const curHour = new Date().getHours();
    const isCurrentlyDay = curHour >= 6 && curHour < 18 ? 1 : 0;
    try {
      const cached = localStorage.getItem('gestormf_weather_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return { ...parsed.data, isDay: isCurrentlyDay };
        }
      }
    } catch (_) { }
    return {
      temperature: 32,
      apparentTemperature: 35,
      humidity: 65,
      windSpeed: 14,
      weatherCode: 0,
      isDay: isCurrentlyDay,
      cityName: 'Boa Vista, RR',
    };
  });

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const lat = baseLocation?.lat || 2.8235;
        const lon = baseLocation?.lon || -60.6758;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.current && isMounted) {
          const fresh = {
            temperature: Math.round(json.current.temperature_2m),
            apparentTemperature: Math.round(json.current.apparent_temperature),
            humidity: json.current.relative_humidity_2m,
            windSpeed: Math.round(json.current.wind_speed_10m),
            weatherCode: json.current.weather_code,
            isDay: json.current.is_day,
            cityName: baseLocation?.name ? baseLocation.name.split('-')[0].trim() : 'Boa Vista, RR',
          };
          setWeatherData(fresh);
          localStorage.setItem(
            'gestormf_weather_cache',
            JSON.stringify({ timestamp: Date.now(), data: fresh })
          );
        }
      } catch (err) {
        // Fallback silencioso mantendo valor anterior
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 20 * 60 * 1000); // Atualiza a cada 20 min
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [baseLocation?.lat, baseLocation?.lon, baseLocation?.name]);

  const isNight = useMemo(() => {
    const hr = currentTime.getHours();
    return hr >= 18 || hr < 6;
  }, [currentTime]);

  const weatherDetails = useMemo(() => {
    const curHour = currentTime.getHours();
    const effectiveIsDay = curHour >= 6 && curHour < 18 ? 1 : 0;
    return getWeatherDetails(weatherData.weatherCode, effectiveIsDay);
  }, [weatherData.weatherCode, currentTime]);

  // Chave da ilustração visual que respeita estritamente o clima e se é dia ou noite
  const headerIllustrationKey = useMemo(() => {
    return weatherDetails.illustrationKey || (isNight ? 'night-clear' : 'day-clear');
  }, [weatherDetails.illustrationKey, isNight]);

  // Ilustração principal de turno e clima (Sol de dia, Lua à noite, obedecendo variações de nuvens, chuva e tempestade)
  const headerWeatherIcon = useMemo(() => {
    return (
      <WeatherIllustration
        type={headerIllustrationKey}
        size={42}
        className="sh-hero-svg"
        title={weatherDetails.label}
      />
    );
  }, [headerIllustrationKey, weatherDetails.label]);

  // Dica operacional de gravação externa baseada no clima
  const operationalTip = useMemo(() => {
    if (weatherDetails.condition === 'storm') {
      return { text: 'Tempestade • Pautas externas suspensas', type: 'danger' };
    }
    if (weatherDetails.condition === 'rain') {
      return { text: 'Chuva na Região • Proteja equipamentos', type: 'warning' };
    }
    if (weatherDetails.condition === 'drizzle') {
      return { text: 'Chuvisco Passageiro • Cuidado com lentes', type: 'warning' };
    }
    if (weatherData.temperature >= 34) {
      return { text: 'Calor Intenso • Hidratação das equipes', type: 'hot' };
    }
    if (weatherData.windSpeed >= 28) {
      return { text: 'Vento Forte • Atenção a voos com drone', type: 'warning' };
    }
    return { text: 'Céu Aberto • Condição Ideal para Pauta Externa', type: 'good' };
  }, [weatherDetails.condition, weatherData.temperature, weatherData.windSpeed]);

  // Identificação da Missão em Destaque
  // 1. Se for Colaborador: Próxima missão em que ele está escalado
  // 2. Se for Admin: Missão em andamento agora ou a mais próxima do dia
  const featuredMission = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const curId = String(currentUser?.id || '');
    const curName = String(currentUser?.name || '').trim().toLowerCase();

    const isUserAssigned = (m) => {
      if (!currentUser) return false;
      if (m.driverId && String(m.driverId) === curId) return true;
      if (m.driverName && m.driverName.toLowerCase() === curName) return true;
      if (m.editorId && String(m.editorId) === curId) return true;
      if (Array.isArray(m.teamIds) && m.teamIds.some((id) => String(id) === curId)) return true;
      if (Array.isArray(m.editorIds) && m.editorIds.some((id) => String(id) === curId)) return true;
      if (m.teamNamesDisplay && m.teamNamesDisplay.toLowerCase().includes(curName)) return true;
      return false;
    };

    const isUpcomingScheduled = (m) => {
      if (!m) return false;
      const s = String(m.missionStatus || 'Agendada').trim().toLowerCase();
      if (
        s === 'pendente' ||
        s === 'pendente (pós-prod.)' ||
        s === 'pós-produção' ||
        s === 'finalizada' ||
        s === 'finalizado' ||
        s === 'concluída' ||
        s === 'concluida' ||
        s === 'cancelada'
      ) {
        return false;
      }
      // Deve ser missão ativa/agendada para hoje ou data futura (nunca pauta passada)
      const mDate = String(m.date || '');
      return mDate >= todayStr;
    };

    const sortUpcoming = (a, b) => {
      const dComp = String(a.date || '').localeCompare(String(b.date || ''));
      if (dComp !== 0) return dComp;
      return (a.departureTime || '00:00').localeCompare(b.departureTime || '00:00');
    };

    if (!isAdminUser) {
      // Procura primeiro missão em execução do colaborador
      const executing = missions.find(
        (m) => (m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Andamento') && isUserAssigned(m)
      );
      if (executing) return { mission: executing, type: 'executing' };

      // Depois missão em preparo hoje
      const preparing = missions.find(
        (m) => m.missionStatus === 'Em Preparo' && isUserAssigned(m)
      );
      if (preparing) return { mission: preparing, type: 'preparing' };

      // Depois próxima missão agendada
      const scheduledToday = missions
        .filter((m) => isUserAssigned(m) && isUpcomingScheduled(m))
        .sort(sortUpcoming);

      if (scheduledToday.length > 0) {
        return { mission: scheduledToday[0], type: 'scheduled' };
      }
      return null;
    } else {
      // ADMIN: Missão em execução no momento
      const executing = missions.find(
        (m) => m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Andamento'
      );
      if (executing) return { mission: executing, type: 'executing' };

      // Missão em preparo
      const preparing = missions.find((m) => m.missionStatus === 'Em Preparo');
      if (preparing) return { mission: preparing, type: 'preparing' };

      // Próxima missão agendada de campo (exclui datas passadas e Pendentes de pós-produção)
      const nextScheduled = missions
        .filter(isUpcomingScheduled)
        .sort(sortUpcoming);

      if (nextScheduled.length > 0) {
        return { mission: nextScheduled[0], type: 'scheduled' };
      }
      return null;
    }
  }, [missions, currentUser, isAdminUser]);

  if (isMobileDevice) {
    return null;
  }

  return (
    <div className={`dynamic-body-greeting premium-smart-header theme-${headerIllustrationKey} ${isNight ? 'is-night' : 'is-day'}`}>
      {/* 1. LADO ESQUERDO: ÍCONE DE CLIMA/HORÁRIO (SOL/LUA) & INFOS EMPILHADAS E ALINHADAS */}
      <div className="sh-hero-identity">
        <div
          className={`sh-hero-icon-wrap wi-badge-${headerIllustrationKey}`}
          title={`Horário e Clima em ${weatherData.cityName}: ${weatherDetails.label} (${weatherData.temperature}°C)`}
        >
          <span className="sh-hero-icon">{headerWeatherIcon}</span>
        </div>

        <div className="sh-hero-info">
          {/* Linha 1: Saudação */}
          <div className="sh-hero-greeting-row">
            <h1 className="sh-hero-title">
              {greeting.text}, <span className="sh-hero-name">{greeting.firstName}</span>!
            </h1>
          </div>

          {/* Linha 2: Último Login */}
          <div className="sh-hero-login-row">
            <span className="sh-login-line-item sh-last-login-tag" title="Horário do seu último acesso registrado no sistema">
              <Clock size={12} className="sh-login-icon text-amber" />
              <span>Último login: <strong className="sh-login-highlight">{lastLoginFormatted}</strong></span>
            </span>
          </div>

          {/* Linha 3: Data Oficial */}
          <div className="sh-hero-date-row">
            <span className="sh-date-line-item" title="Data oficial">
              <Calendar size={12} className="sh-date-icon text-cyan" />
              <span className="sh-date-val">{greeting.dateFormatted}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. CENTRO: MISSÕES ATIVAS CENTRALIZADAS */}
      <div className="sh-hero-center">
        <button
          type="button"
          className="sh-hero-badge-active sh-hero-badge-active-centered is-clickable"
          onClick={() => onNavigateTab && onNavigateTab('table')}
          title="Clique para ver a grade de missões ativas na Tabela de Serviço"
        >
          <span className="sh-pulse-dot green" />
          <span className="sh-active-missions-count">{countAtivas}</span>
          <span className="sh-active-missions-label">
            {countAtivas === 1 ? 'missão ativa' : 'missões ativas'}
          </span>
        </button>
      </div>

      {/* 3. LADO DIREITO: CÁPSULAS EXECUTIVAS (CLIMA, MISSÃO & AÇÕES) */}
      <div className="sh-hero-widgets">
        {/* CÁPSULA A: CLIMA & OPERAÇÃO DE CAMPO */}
        <div className="sh-capsule sh-weather-capsule" title={`Clima em ${weatherData.cityName}: Sensação ${weatherData.apparentTemperature}°C, Vento ${weatherData.windSpeed} km/h, Umidade ${weatherData.humidity}%`}>
          <div className="sh-capsule-icon-box" title={weatherDetails.label}>
            <WeatherIllustration
              type={weatherDetails.illustrationKey}
              size={26}
              className="sh-weather-capsule-svg"
              title={weatherDetails.label}
            />
          </div>
          <div className="sh-weather-content">
            <div className="sh-weather-headline">
              <strong className="sh-weather-degree">{weatherData.temperature}°C</strong>
              <span className="sh-weather-condition">{weatherDetails.label}</span>
            </div>
            <div className="sh-weather-subinfo">
              <span>Sensação {weatherData.apparentTemperature}°C</span>
              <span>•</span>
              <span><Wind size={10} /> {weatherData.windSpeed} km/h</span>
              {operationalTip.type === 'heat' && (
                <span className="sh-heat-warning-tag" title="Recomendada hidratação frequente e protetor solar em campo">
                  <Flame size={10} /> Hidratação
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CÁPSULA B: MISSÃO EM DESTAQUE / PAUTA DO MOMENTO */}
        {featuredMission ? (
          <div
            className={`sh-capsule sh-mission-capsule is-clickable status-${featuredMission.type}`}
            onClick={() => onOpenDetailMission && onOpenDetailMission(featuredMission.mission)}
            title="Clique para abrir a ficha completa desta missão"
            role="button"
            tabIndex={0}
          >
            <div className="sh-mission-badge-line">
              <span className={`sh-mission-status-pill pill-${featuredMission.type}`}>
                {featuredMission.type === 'executing' ? (
                  <>
                    <span className="sh-pulse-dot red" />
                    <span>Em Andamento</span>
                  </>
                ) : featuredMission.type === 'preparing' ? (
                  <>
                    <span className="sh-pulse-dot amber" />
                    <span>Saída às {featuredMission.mission.departureTime || 'Breve'}</span>
                  </>
                ) : (
                  <>
                    <Navigation size={10} />
                    <span>Próxima Saída: {featuredMission.mission.departureTime || 'Agendada'}</span>
                  </>
                )}
              </span>
              <span className="sh-mission-id">#{getMissionCode(featuredMission.mission, missions)}</span>
            </div>

            <div className="sh-mission-body">
              <h4 className="sh-mission-subject" title={featuredMission.mission.description}>
                {featuredMission.mission.description}
              </h4>
              <div className="sh-mission-meta">
                <span className="sh-meta-loc">
                  <MapPin size={11} />
                  <span>{featuredMission.mission.locationName || featuredMission.mission.address || 'Local Definido'}</span>
                </span>
                {featuredMission.mission.vehicleNameDisplay && (
                  <span className="sh-meta-veh">
                    <Car size={11} />
                    <span>{featuredMission.mission.vehicleNameDisplay.split('(')[0].trim()}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="sh-mission-arrow" title="Ver Detalhes">
              <ChevronRight size={15} />
            </div>
          </div>
        ) : (
          <div className="sh-capsule sh-standby-capsule">
            <div className="sh-standby-icon">
              <CheckCircle2 size={16} className="text-emerald" />
            </div>
            <div className="sh-standby-content">
              <strong>Base em Operação Normal</strong>
              <small>Equipes em prontidão para novas pautas</small>
            </div>
          </div>
        )}

        {/* CÁPSULA C: ATALHO DE AÇÃO RÁPIDA (ADMIN / MEU ESPAÇO) */}
        <div className="sh-action-wrap">
          {isAdminUser ? (
            activeTab !== 'admin' ? (
              <button
                type="button"
                className="sh-hero-action-btn admin-mode"
                onClick={() => onNavigateTab('admin')}
                title="Abrir Central do Administrador: Aprovações, Fechamento de Diárias & Performance"
              >
                <div className="sh-action-icon-circle">
                  <ShieldCheck size={16} />
                </div>
                <div className="sh-action-text-col">
                  <span className="sh-action-primary">Central do Admin</span>
                  <span className="sh-action-secondary">Gestão &amp; Decisão</span>
                </div>
                {pendingExtraHoursRequests.length > 0 && (
                  <span className="sh-action-badge-alert" title="Solicitações de horas extras pendentes de aprovação">
                    {pendingExtraHoursRequests.length}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="sh-hero-action-btn map-mode"
                onClick={() => onNavigateTab('map')}
                title="Voltar ao monitoramento de mapa e frotas"
              >
                <div className="sh-action-icon-circle">
                  <Navigation size={15} />
                </div>
                <div className="sh-action-text-col">
                  <span className="sh-action-primary">Mapa &amp; Frotas</span>
                  <span className="sh-action-secondary">Painel de Campo</span>
                </div>
              </button>
            )
          ) : (
            activeTab !== 'me' ? (
              <button
                type="button"
                className="sh-hero-action-btn me-mode"
                onClick={() => onNavigateTab('me')}
                title="Ver meu extrato financeiro, diárias, chave PIX e disponibilidade"
              >
                <div className="sh-action-icon-circle">
                  <Sparkles size={15} />
                </div>
                <div className="sh-action-text-col">
                  <span className="sh-action-primary">Meu Espaço</span>
                  <span className="sh-action-secondary">Extrato &amp; PIX</span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                className="sh-hero-action-btn map-mode"
                onClick={() => onNavigateTab('map')}
                title="Voltar ao monitoramento de mapa e frotas"
              >
                <div className="sh-action-icon-circle">
                  <Navigation size={15} />
                </div>
                <div className="sh-action-text-col">
                  <span className="sh-action-primary">Mapa &amp; Frotas</span>
                  <span className="sh-action-secondary">Painel de Campo</span>
                </div>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
