import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Car,
  Sparkles,
} from 'lucide-react';
import { getMissionCode, formatDateBR } from '../utils/geo';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEK_HEADER = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ServiceBoardMonthView({
  missions = [],
  onSelectMission,
  onNewMission,
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Navegação de mês
  const handlePrevMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = MONTH_NAMES[month];

  // Matriz de dias do calendário
  const calendarDays = useMemo(() => {
    const todayISO = toDateISO(new Date());
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Dia da semana do 1º dia (0 = Dom, 1 = Seg...)
    const startDayOfWeek = firstDayOfMonth.getDay();

    // Dias do mês anterior para completar a primeira semana
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Dias do mês anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateISO = toDateISO(d);
      const dayMissions = missions.filter((m) => {
        const start = m.date || '';
        const end = m.endDate || m.date || '';
        return dateISO >= start && dateISO <= end;
      });

      days.push({
        date: d,
        dateISO,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dateISO === todayISO,
        missions: dayMissions,
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const d = new Date(year, month, day);
      const dateISO = toDateISO(d);
      const dayMissions = missions.filter((m) => {
        const start = m.date || '';
        const end = m.endDate || m.date || '';
        return dateISO >= start && dateISO <= end;
      });

      days.push({
        date: d,
        dateISO,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateISO === todayISO,
        missions: dayMissions,
      });
    }

    // Dias do próximo mês para completar a grade em múltiplos de 7
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let day = 1; day <= remainingDays; day++) {
        const d = new Date(year, month + 1, day);
        const dateISO = toDateISO(d);
        const dayMissions = missions.filter((m) => {
          const start = m.date || '';
          const end = m.endDate || m.date || '';
          return dateISO >= start && dateISO <= end;
        });

        days.push({
          date: d,
          dateISO,
          dayNum: day,
          isCurrentMonth: false,
          isToday: dateISO === todayISO,
          missions: dayMissions,
        });
      }
    }

    return days;
  }, [year, month, missions]);

  // Contagem de missões únicas no mês atual
  const totalMissionsInMonth = useMemo(() => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const seen = new Set();
    missions.forEach((m) => {
      const start = m.date || '';
      const end = m.endDate || m.date || '';
      if (start.startsWith(monthKey) || end.startsWith(monthKey)) {
        seen.add(m.id);
      }
    });
    return seen.size;
  }, [year, month, missions]);

  return (
    <div className="sb-month-view-wrapper">
      {/* Barra de Navegação do Mês */}
      <div className="sb-view-nav-bar">
        <div className="sb-nav-controls">
          <button
            type="button"
            className="sb-nav-arrow-btn"
            onClick={handlePrevMonth}
            title="Mês anterior"
          >
            <ChevronLeft size={16} /> Mês Anterior
          </button>
          <button
            type="button"
            className="sb-nav-today-btn"
            onClick={handleCurrentMonth}
            title="Ir para o mês atual"
          >
            Mês Atual (Hoje)
          </button>
          <button
            type="button"
            className="sb-nav-arrow-btn"
            onClick={handleNextMonth}
            title="Próximo mês"
          >
            Próximo Mês <ChevronRight size={16} />
          </button>
        </div>

        <div className="sb-nav-current-label">
          <Calendar size={16} className="text-amber" />
          <strong>{monthName} de {year}</strong>
          <span className="sb-nav-count-badge">
            {totalMissionsInMonth} {totalMissionsInMonth === 1 ? 'missão neste mês' : 'missões neste mês'}
          </span>
        </div>
      </div>

      {/* Tabela / Grade Mensal */}
      <div className="sb-month-calendar-grid">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="sb-month-header-row">
          {WEEK_HEADER.map((wName) => (
            <div key={wName} className="sb-month-col-head">
              {wName}
            </div>
          ))}
        </div>

        {/* Células dos Dias */}
        <div className="sb-month-days-matrix">
          {calendarDays.map((day) => {
            return (
              <div
                key={day.dateISO}
                className={`sb-month-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'is-today' : ''}`}
              >
                {/* Topo da Célula: Número do Dia */}
                <div className="sb-mcell-top">
                  <span className={`sb-mcell-day-num ${day.isToday ? 'today-pill' : ''}`}>
                    {day.dayNum}
                  </span>
                  {day.missions.length > 0 && (
                    <span className="sb-mcell-count-dot" title={`${day.missions.length} missão(ões)`}>
                      {day.missions.length}
                    </span>
                  )}
                </div>

                {/* Lista de Pílulas de Missões no Dia */}
                <div className="sb-mcell-missions-scroll">
                  {day.missions.map((mission) => {
                    const statusStr = mission.missionStatus || 'Agendada';
                    const statusSlug = statusStr.toLowerCase().replace(/\s+/g, '-');
                    const isMulti = Boolean(mission.isMultiDay || (mission.endDate && mission.endDate !== mission.date));

                    return (
                      <div
                        key={`${day.dateISO}-${mission.id}`}
                        className={`sb-mcell-pill pill-status-${statusSlug}`}
                        onClick={() => onSelectMission && onSelectMission(mission.id)}
                        title={`${mission.departureTime || '--:--'} • ${mission.description} • ${mission.locationName || ''}`}
                      >
                        <span className="sb-mpill-time">{mission.departureTime || '--:--'}</span>
                        <span className="sb-mpill-title">
                          {isMulti ? '🏕️ ' : ''}{mission.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
