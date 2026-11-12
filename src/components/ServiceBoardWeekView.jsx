import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Car,
  User,
  Plus,
  Sparkles,
} from 'lucide-react';
import { getMissionCode, formatDateBR } from '../utils/geo';

// Retorna a segunda-feira da semana de uma data dada
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  // No JS, 0 é Domingo, 1 é Segunda...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Formata Date para YYYY-MM-DD
function toDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEK_DAY_NAMES = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

export default function ServiceBoardWeekView({
  missions = [],
  vehicles = [],
  members = [],
  onSelectMission,
  onNewMission,
}) {
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getMonday(new Date()));

  // Avança / Recua semanas
  const handlePrevWeek = () => {
    setCurrentWeekMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setCurrentWeekMonday(getMonday(new Date()));
  };

  // Gera os 7 dias da semana
  const weekDays = useMemo(() => {
    const days = [];
    const todayISO = toDateISO(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekMonday);
      d.setDate(d.getDate() + i);
      const dateISO = toDateISO(d);
      const dayNum = d.getDate();
      const monthNum = d.getMonth() + 1;

      // Filtra missões que acontecem neste dia (suporta múltiplos dias / viagens)
      const dayMissions = missions.filter((m) => {
        const start = m.date || '';
        const end = m.endDate || m.date || '';
        return dateISO >= start && dateISO <= end;
      });

      days.push({
        date: d,
        dateISO,
        dayName: WEEK_DAY_NAMES[i],
        dayShort: WEEK_DAY_NAMES[i].slice(0, 3),
        dayNum,
        monthNum,
        isToday: dateISO === todayISO,
        missions: dayMissions,
      });
    }

    return days;
  }, [currentWeekMonday, missions]);

  // Total de missões na semana
  const totalMissionsInWeek = useMemo(() => {
    const seen = new Set();
    weekDays.forEach((day) => {
      day.missions.forEach((m) => seen.add(m.id));
    });
    return seen.size;
  }, [weekDays]);

  // Rótulo da semana (ex: "10 de Nov a 16 de Nov de 2026")
  const weekLabel = useMemo(() => {
    const monday = weekDays[0].date;
    const sunday = weekDays[6].date;
    const mStr = `${monday.getDate()} de ${monday.toLocaleString('pt-BR', { month: 'short' })}`;
    const sStr = `${sunday.getDate()} de ${sunday.toLocaleString('pt-BR', { month: 'short' })} de ${sunday.getFullYear()}`;
    return `${mStr} a ${sStr}`;
  }, [weekDays]);

  return (
    <div className="sb-week-view-wrapper">
      {/* Barra de Navegação da Semana */}
      <div className="sb-view-nav-bar">
        <div className="sb-nav-controls">
          <button
            type="button"
            className="sb-nav-arrow-btn"
            onClick={handlePrevWeek}
            title="Semana anterior"
          >
            <ChevronLeft size={16} /> Semana Anterior
          </button>
          <button
            type="button"
            className="sb-nav-today-btn"
            onClick={handleCurrentWeek}
            title="Ir para a semana atual"
          >
            Semana Atual (Hoje)
          </button>
          <button
            type="button"
            className="sb-nav-arrow-btn"
            onClick={handleNextWeek}
            title="Próxima semana"
          >
            Próxima Semana <ChevronRight size={16} />
          </button>
        </div>

        <div className="sb-nav-current-label">
          <Calendar size={16} className="text-amber" />
          <strong>{weekLabel}</strong>
          <span className="sb-nav-count-badge">
            {totalMissionsInWeek} {totalMissionsInWeek === 1 ? 'missão na semana' : 'missões na semana'}
          </span>
        </div>
      </div>

      {/* Grid de 7 Colunas para a Semana */}
      <div className="sb-week-columns-grid">
        {weekDays.map((day) => {
          return (
            <div
              key={day.dateISO}
              className={`sb-week-day-col ${day.isToday ? 'is-today' : ''}`}
            >
              {/* Cabeçalho do Dia */}
              <div className="sb-week-day-header">
                <div className="sb-wdh-info">
                  <span className="sb-wdh-name">{day.dayShort}</span>
                  <span className="sb-wdh-num">{day.dayNum}/{String(day.monthNum).padStart(2, '0')}</span>
                </div>
                {day.isToday && <span className="sb-today-pill">HOJE</span>}
                <span className="sb-wdh-badge-count">
                  {day.missions.length}
                </span>
              </div>

              {/* Lista de Missões do Dia */}
              <div className="sb-week-missions-list">
                {day.missions.length === 0 ? (
                  <div className="sb-week-empty-day">
                    <span>Sem pautas</span>
                  </div>
                ) : (
                  day.missions.map((mission) => {
                    const mCode = getMissionCode(mission, missions);
                    const isMulti = Boolean(mission.isMultiDay || (mission.endDate && mission.endDate !== mission.date));
                    const statusStr = mission.missionStatus || 'Agendada';
                    const statusSlug = statusStr.toLowerCase().replace(/\s+/g, '-');

                    return (
                      <div
                        key={`${day.dateISO}-${mission.id}`}
                        className={`sb-week-mission-card card-status-${statusSlug}`}
                        onClick={() => onSelectMission && onSelectMission(mission.id)}
                        title="Clique para abrir a ficha completa"
                      >
                        {/* Topo do card: código e horário */}
                        <div className="sb-wmc-top">
                          <span className="sb-wmc-code">#{mCode}</span>
                          <span className="sb-wmc-time">
                            🕒 {mission.departureTime || '--:--'}
                          </span>
                        </div>

                        {/* Status e Viagem */}
                        <div className="sb-wmc-tags">
                          <span className={`sb-wmc-status-tag tag-${statusSlug}`}>
                            {statusStr}
                          </span>
                          {isMulti && (
                            <span className="sb-wmc-multi-tag" title="Missão de múltiplos dias">
                              🏕️ Viagem
                            </span>
                          )}
                        </div>

                        {/* Título da Pauta */}
                        <h4 className="sb-wmc-title">
                          {mission.description}
                        </h4>

                        {/* Local */}
                        <div className="sb-wmc-loc">
                          <MapPin size={11} className="text-amber" />
                          <span>{mission.locationName || mission.address || 'Local não definido'}</span>
                        </div>

                        {/* Viatura & Motorista */}
                        <div className="sb-wmc-veh">
                          <Car size={11} />
                          <span>
                            {mission.vehicleNameDisplay ? mission.vehicleNameDisplay.split('(')[0].trim() : 'Sem viatura'}
                            {mission.driverName ? ` • ${mission.driverName.split(' ')[0]}` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
