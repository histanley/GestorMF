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
} from 'lucide-react';
import { formatDateBR, getMissionCode } from '../utils/geo';

// Mapeia códigos de clima da WMO (Open-Meteo) para descrições e ícones
function getWeatherDetails(code, isDay = 1) {
  const c = Number(code);
  switch (c) {
    case 0:
      return { label: isDay ? 'Ensolarado' : 'Céu Limpo', icon: isDay ? '☀️' : '🌙', condition: 'clear' };
    case 1:
      return { label: isDay ? 'Predomínio de Sol' : 'Céu Estrelado', icon: isDay ? '🌤️' : '🌙', condition: 'clear' };
    case 2:
      return { label: 'Parcialmente Nublado', icon: isDay ? '⛅' : '☁️', condition: 'cloudy' };
    case 3:
      return { label: 'Nublado', icon: '☁️', condition: 'cloudy' };
    case 45:
    case 48:
      return { label: 'Nevoeiro / Névoa', icon: '🌫️', condition: 'fog' };
    case 51:
    case 53:
    case 55:
      return { label: 'Chuvisco Passageiro', icon: '🌦️', condition: 'drizzle' };
    case 61:
    case 63:
    case 65:
      return { label: 'Chuva', icon: '🌧️', condition: 'rain' };
    case 80:
    case 81:
    case 82:
      return { label: 'Pancadas de Chuva', icon: '🌧️', condition: 'rain' };
    case 95:
    case 96:
    case 99:
      return { label: 'Trovoada / Temporal', icon: '⛈️', condition: 'storm' };
    default:
      return { label: isDay ? 'Ensolarado' : 'Tempo Bom', icon: isDay ? '☀️' : '🌙', condition: 'clear' };
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
  onNavigateTab = () => {},
  onOpenDetailMission = null,
}) {
  const isAdminUser = userRole === 'admin' || userRole === 'manager';

  // Relógio digital e data em tempo real
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Clima em Tempo Real (Boa Vista - RR por padrão ou coordenadas da base) com Cache de 30min
  const [weatherData, setWeatherData] = useState(() => {
    try {
      const cached = localStorage.getItem('gestormf_weather_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (_) {}
    return {
      temperature: 32,
      apparentTemperature: 35,
      humidity: 65,
      windSpeed: 14,
      weatherCode: 0,
      isDay: 1,
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

  const weatherDetails = useMemo(() => {
    return getWeatherDetails(weatherData.weatherCode, weatherData.isDay);
  }, [weatherData.weatherCode, weatherData.isDay]);

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
        .filter((m) => isUserAssigned(m) && (m.missionStatus === 'Agendada' || m.missionStatus === 'Pendente'))
        .sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));

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

      // Próxima missão agendada
      const nextScheduled = missions
        .filter((m) => m.missionStatus === 'Agendada' || m.missionStatus === 'Pendente')
        .sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));

      if (nextScheduled.length > 0) {
        return { mission: nextScheduled[0], type: 'scheduled' };
      }
      return null;
    }
  }, [missions, currentUser, isAdminUser]);

  // Contadores operacionais rápidos para Administradores
  const operationalStats = useMemo(() => {
    if (!isAdminUser) return null;
    const inField = missions.filter(
      (m) => m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Preparo'
    ).length;
    const pendingPostProd = missions.filter(
      (m) => m.editionStatus === 'Pendente' || m.editionStatus === 'Em Edição'
    ).length;
    return { inField, pendingPostProd };
  }, [isAdminUser, missions]);

  return (
    <div className="dynamic-body-greeting premium-smart-header">
      {/* 1. LADO ESQUERDO: SAUDAÇÃO & DATA OPERACIONAL */}
      <div className="sh-hero-identity">
        <div className="sh-hero-icon-wrap" title="Horário de Boa Vista, RR">
          <span className="sh-hero-icon">{greeting.icon}</span>
        </div>
        <div className="sh-hero-info">
          <div className="sh-hero-greeting-row">
            <h1 className="sh-hero-title">
              {greeting.text}, <span className="sh-hero-name">{greeting.firstName}</span>!
            </h1>
            <span className="sh-hero-clock">
              <Clock size={12} /> {greeting.timeFormatted}
            </span>
          </div>
          <div className="sh-hero-sub-row">
            <span className="sh-hero-date">{greeting.dateFormatted}</span>
            <span className="sh-hero-dot">•</span>
            <span className="sh-hero-badge-active">
              <span className="sh-pulse-dot green" />
              {countAtivas} {countAtivas === 1 ? 'missão ativa' : 'missões ativas'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. LADO DIREITO: CÁPSULAS EXECUTIVAS (CLIMA, MISSÃO & AÇÕES) */}
      <div className="sh-hero-widgets">
        {/* CÁPSULA A: CLIMA & OPERAÇÃO DE CAMPO */}
        <div className="sh-capsule sh-weather-capsule" title={`Clima em ${weatherData.cityName}: Sensação ${weatherData.apparentTemperature}°C, Vento ${weatherData.windSpeed} km/h, Umidade ${weatherData.humidity}%`}>
          <div className="sh-capsule-icon-box">
            <span className="sh-weather-emoji">{weatherDetails.icon}</span>
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
