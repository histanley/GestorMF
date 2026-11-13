import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Flame,
  Star,
  Sparkles,
  TrendingUp,
  Compass,
  Calendar,
  Clock,
  Route,
  Car,
  Camera,
  Video,
  Film,
  Plane,
  Eye,
  Shield,
  Users,
  CheckCircle,
  ChevronRight,
  X,
  Search,
  Filter,
  Layers,
  MapPin,
  Check,
  Building,
  Activity,
  Zap,
  Briefcase,
  Radio,
  Sliders,
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  ROLE_XP_POINTS,
  ACTIVITY_XP_POINTS,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
  calculateMemberPerformanceProfile,
  isMissionCompleted,
} from '../utils/companyRoles';

// Formata data ISO para PT-BR (dd/mm/aaaa)
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function TeamPerformanceRanking({
  members = [],
  missions = [],
  onOpenEditMember = null,
}) {
  const [periodFilter, setPeriodFilter] = useState('all'); // all, month, 30days, 90days, year
  const [companyFilter, setCompanyFilter] = useState('all'); // all, MegaFilmes, Mega Print
  const [roleFilter, setRoleFilter] = useState('all'); // all ou uma das 11 funções oficiais
  const [sortCriteria, setSortCriteria] = useState('score'); // score, missions, driving, distance, multiday, extrahours, completed, role_...
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);

  // Normaliza texto para busca insensível a acentos
  const normalize = (txt) =>
    String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // --------------------------------------------------------------------------
  // 1. FILTRAGEM TEMPORAL E ESTRITA DAS MISSÕES (SOMENTE CONCLUÍDAS/FINALIZADAS)
  // --------------------------------------------------------------------------
  const filteredMissions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonth}`;

    const pastDate = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };

    return missions.filter((m) => {
      // REGRA FUNDAMENTAL: Somente missões que foram realmente concluídas/finalizadas
      // são computadas no ranking para garantir pontuação 100% fiel e real.
      // Missões agendadas, futuras ou canceladas não são contabilizadas.
      if (!isMissionCompleted(m)) return false;

      const mDate = m.date || '';
      if (!mDate) return true;

      if (periodFilter === 'month') {
        return mDate.startsWith(currentYearMonth);
      }
      if (periodFilter === '30days') {
        return mDate >= pastDate(30);
      }
      if (periodFilter === '90days') {
        return mDate >= pastDate(90);
      }
      if (periodFilter === 'year') {
        return mDate.startsWith(String(currentYear));
      }
      return true; // 'all'
    });
  }, [missions, periodFilter]);

  // --------------------------------------------------------------------------
  // 2. CÁLCULO DAS MÉTRICAS E SCORE GAMIFICADO FIEL POR COLABORADOR
  // --------------------------------------------------------------------------
  const membersStats = useMemo(() => {
    return members.map((member) => {
      return calculateMemberPerformanceProfile(member, filteredMissions);
    });
  }, [members, filteredMissions]);

  // --------------------------------------------------------------------------
  // 3. FILTRAGEM POR EMPRESA, FUNÇÃO, BUSCA E ORDENAÇÃO DO RANKING
  // --------------------------------------------------------------------------
  const rankedMembers = useMemo(() => {
    let list = [...membersStats];

    // Filtro por empresa
    if (companyFilter !== 'all') {
      list = list.filter((m) => m.company === companyFilter);
    }

    // Filtro por Modalidade / Função Específica
    if (roleFilter !== 'all') {
      list = list.filter((m) => {
        const isOfficialMain = normalizeToOfficialRole(m.role) === roleFilter;
        const hasSecondary = Array.isArray(m.secondaryRoles) &&
          m.secondaryRoles.map(normalizeToOfficialRole).includes(roleFilter);
        const hasExercised = (m.roleCounts?.[roleFilter] || 0) > 0;
        return isOfficialMain || hasSecondary || hasExercised;
      });
    }

    // Busca textual por nome ou função
    if (searchTerm.trim()) {
      const q = normalize(searchTerm);
      list = list.filter((m) => {
        const inName = normalize(m.name).includes(q);
        const inRole = m.allRoles.some((r) => normalize(r).includes(q));
        return inName || inRole;
      });
    }

    // Ordenação dinâmica
    list.sort((a, b) => {
      if (sortCriteria === 'missions') {
        return b.totalMissions - a.totalMissions || b.score - a.score;
      }
      if (sortCriteria === 'driving') {
        return b.drivingCount - a.drivingCount || b.score - a.score;
      }
      if (sortCriteria === 'distance') {
        return b.estimatedDistanceKm - a.estimatedDistanceKm || b.score - a.score;
      }
      if (sortCriteria === 'multiday') {
        return b.multiDayCount - a.multiDayCount || b.score - a.score;
      }
      if (sortCriteria === 'extrahours') {
        return b.totalApprovedExtraHours - a.totalApprovedExtraHours || b.score - a.score;
      }
      if (sortCriteria === 'completed') {
        return b.completedCount - a.completedCount || b.score - a.score;
      }
      if (sortCriteria.startsWith('role_')) {
        const targetRole = sortCriteria.replace('role_', '');
        const countB = b.roleCounts?.[targetRole] || 0;
        const countA = a.roleCounts?.[targetRole] || 0;
        return countB - countA || b.score - a.score;
      }
      // Padrão: Maior pontuação (Score XP)
      return b.score - a.score || b.totalMissions - a.totalMissions;
    });

    return list;
  }, [membersStats, companyFilter, roleFilter, searchTerm, sortCriteria]);

  // Colaboradores no Top 3 do pódio
  const top1 = rankedMembers[0] || null;
  const top2 = rankedMembers[1] || null;
  const top3 = rankedMembers[2] || null;

  // Pontuação máxima para escala de barra percentual
  const maxScore = top1 ? Math.max(top1.score, 100) : 100;

  // Destaques / Lideranças Globais por Modalidade
  const bestDriver = useMemo(() => {
    return [...membersStats].sort((a, b) => b.drivingCount - a.drivingCount || b.estimatedDistanceKm - a.estimatedDistanceKm)[0] || null;
  }, [membersStats]);

  const bestTraveler = useMemo(() => {
    return [...membersStats].sort((a, b) => b.multiDayCount - a.multiDayCount)[0] || null;
  }, [membersStats]);

  const bestCine = useMemo(() => {
    return [...membersStats].sort((a, b) => (b.roleCounts['Cinegrafista'] || 0) - (a.roleCounts['Cinegrafista'] || 0))[0] || null;
  }, [membersStats]);

  const bestDrone = useMemo(() => {
    return [...membersStats].sort((a, b) => (b.roleCounts['Piloto de Drone'] || 0) - (a.roleCounts['Piloto de Drone'] || 0))[0] || null;
  }, [membersStats]);

  const bestEditor = useMemo(() => {
    return [...membersStats].sort((a, b) => (b.roleCounts['Editor de Vídeo'] || 0) - (a.roleCounts['Editor de Vídeo'] || 0))[0] || null;
  }, [membersStats]);

  const bestStreamer = useMemo(() => {
    return [...membersStats].sort((a, b) => (b.roleCounts['Transmissão (Streamer)'] || 0) - (a.roleCounts['Transmissão (Streamer)'] || 0))[0] || null;
  }, [membersStats]);

  return (
    <div className="team-ranking-dashboard">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE FILTROS E INTELIGÊNCIA OPERACIONAL        */}
      {/* ============================================================== */}
      <div className="ranking-toolbar-panel">
        <div className="ranking-toolbar-left">
          <div className="ranking-scope-badge">
            <Shield size={14} className="text-purple" />
            <span>Exclusivo para Administradores</span>
          </div>

          <div
            className="ranking-completed-only-badge"
            title="Apenas missões formalmente finalizadas e entregues geram pontos no ranking. Missões agendadas ou em andamento não computam."
          >
            <CheckCircle size={13} className="text-emerald" />
            <span>Apenas Missões Concluídas</span>
          </div>

          <div className="ranking-filter-pill-group">
            <span className="ranking-filter-lbl">Período:</span>
            {[
              { id: 'all', label: 'Todo o Histórico' },
              { id: 'month', label: 'Este Mês' },
              { id: '30days', label: 'Últimos 30 Dias' },
              { id: '90days', label: 'Últimos 90 Dias' },
              { id: 'year', label: 'Este Ano' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ranking-period-btn ${periodFilter === p.id ? 'is-active' : ''}`}
                onClick={() => setPeriodFilter(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ranking-toolbar-right">
          {/* Filtro por Empresa */}
          <div className="ranking-select-wrap">
            <Building size={14} />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="ranking-select"
            >
              <option value="all">Todas as Empresas</option>
              <option value="MegaFilmes">MegaFilmes</option>
              <option value="Mega Print">Mega Print</option>
            </select>
          </div>

          {/* Filtro por Modalidade / Função Oficial */}
          <div className="ranking-select-wrap">
            <Briefcase size={14} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ranking-select"
            >
              <option value="all">Todas as Funções ({OFFICIAL_COMPANY_ROLES.length})</option>
              {OFFICIAL_COMPANY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_ICONS_MAP[r] || '💼'} {r}
                </option>
              ))}
            </select>
          </div>

          {/* Critério de Ordenação */}
          <div className="ranking-select-wrap">
            <TrendingUp size={14} />
            <select
              value={sortCriteria}
              onChange={(e) => setSortCriteria(e.target.value)}
              className="ranking-select"
            >
              <option value="score">🏆 Maior Pontuação (Score XP)</option>
              <option value="missions">🎯 Mais Missões de Campo</option>
              <option value="driving">🚗 Mais Vezes Dirigindo</option>
              <option value="distance">🛣️ Mais Km Conduzidos</option>
              <option value="multiday">🧭 Mais Viagens Longas (+1 dia)</option>
              <option value="extrahours">⚡ Mais Horas Extras Dedicadas</option>
              <option value="completed">✅ Mais Missões Concluídas</option>
              <optgroup label="Classificar por Atuação em Função:">
                {OFFICIAL_COMPANY_ROLES.map((r) => (
                  <option key={r} value={`role_${r}`}>
                    {ROLE_ICONS_MAP[r] || '💼'} Mais Atuações: {r}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="ranking-search-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar colaborador ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ranking-search-input"
            />
            {searchTerm && (
              <button className="ranking-search-clear" onClick={() => setSearchTerm('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* BARRA RÁPIDA DE FILTRO POR MODALIDADES / 11 FUNÇÕES OFICIAIS   */}
      {/* ============================================================== */}
      <div className="ranking-role-pills-bar">
        <span className="ranking-role-pills-label">Modalidade:</span>
        <button
          type="button"
          className={`ranking-role-quick-btn ${roleFilter === 'all' ? 'active' : ''}`}
          onClick={() => setRoleFilter('all')}
        >
          <span>🌐 Todas as Funções</span>
        </button>
        {OFFICIAL_COMPANY_ROLES.map((roleName) => {
          const isAct = roleFilter === roleName;
          const icon = ROLE_ICONS_MAP[roleName] || '💼';
          const color = ROLE_COLORS_MAP[roleName] || '#3b82f6';
          return (
            <button
              key={roleName}
              type="button"
              className={`ranking-role-quick-btn ${isAct ? 'active' : ''}`}
              style={{
                borderColor: isAct ? color : 'rgba(255,255,255,0.08)',
                background: isAct ? `${color}25` : 'rgba(255,255,255,0.03)',
                color: isAct ? '#ffffff' : '#cbd5e1',
              }}
              onClick={() => setRoleFilter(roleName)}
            >
              <span>{icon}</span>
              <span>{roleName}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 2. DESTAQUES DE LIDERANÇA / CARDS EXECUTIVOS                   */}
      {/* ============================================================== */}
      <div className="ranking-leader-cards-grid">
        {/* Líder Geral XP */}
        <div className="leader-kpi-card leader-card-gold">
          <div className="leader-kpi-icon-wrap">
            <Crown size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Líder Geral de Engajamento</span>
            <strong className="leader-kpi-name">{top1 ? top1.name : 'Nenhum'}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">{top1 ? top1.score : 0} XP</span>
              <span className="kpi-sub-metric">({top1 ? top1.totalMissions : 0} missões)</span>
            </div>
          </div>
        </div>

        {/* Piloto Ás da Frota */}
        <div className="leader-kpi-card leader-card-blue">
          <div className="leader-kpi-icon-wrap">
            <Car size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Piloto Ás da Frota (Condutor)</span>
            <strong className="leader-kpi-name">{bestDriver && bestDriver.drivingCount > 0 ? bestDriver.name : 'Sem registros'}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">{bestDriver ? bestDriver.drivingCount : 0} viagens</span>
              <span className="kpi-sub-metric">({bestDriver ? bestDriver.estimatedDistanceKm : 0} km guiados)</span>
            </div>
          </div>
        </div>

        {/* Mestre da Câmera (Cinegrafista) */}
        <div className="leader-kpi-card leader-card-purple">
          <div className="leader-kpi-icon-wrap">
            <Video size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Lente de Ouro (Cinegrafia)</span>
            <strong className="leader-kpi-name">{bestCine && (bestCine.roleCounts['Cinegrafista'] || 0) > 0 ? bestCine.name : 'Sem registros'}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">{bestCine ? (bestCine.roleCounts['Cinegrafista'] || 0) : 0} pautas</span>
              <span className="kpi-sub-metric">em captação de vídeo</span>
            </div>
          </div>
        </div>

        {/* Transmissão & Streaming / Pós-Produção */}
        <div className="leader-kpi-card leader-card-amber">
          <div className="leader-kpi-icon-wrap">
            <Radio size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Voz &amp; Sinal (Transmissão Ao Vivo)</span>
            <strong className="leader-kpi-name">{bestStreamer && (bestStreamer.roleCounts['Transmissão (Streamer)'] || 0) > 0 ? bestStreamer.name : (bestEditor && (bestEditor.roleCounts['Editor de Vídeo'] || 0) > 0 ? bestEditor.name : 'Sem registros')}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">
                {bestStreamer && (bestStreamer.roleCounts['Transmissão (Streamer)'] || 0) > 0
                  ? `${bestStreamer.roleCounts['Transmissão (Streamer)']} transmissões`
                  : bestEditor
                  ? `${bestEditor.roleCounts['Editor de Vídeo'] || 0} edições`
                  : '0 registros'}
              </span>
              <span className="kpi-sub-metric">ao vivo &amp; switchers</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. PÓDIO DOS CAMPEÕES (TOP 3 VISUAL DE DESTAQUE)               */}
      {/* ============================================================== */}
      {rankedMembers.length >= 2 && !searchTerm && (
        <div className="ranking-podium-section">
          <div className="podium-title-row">
            <Trophy size={18} className="text-gold" />
            <h3>Pódio de Reconhecimento &amp; Desempenho</h3>
            <span className="podium-sub-pill">Colaboradores Mais Participativos</span>
          </div>

          <div className="ranking-podium-container">
            {/* 2º Lugar - Prata */}
            {top2 && (
              <div
                className="podium-step podium-step-silver"
                onClick={() => setSelectedMemberDetail(top2)}
                title="Clique para ver o raio-x completo"
              >
                <div className="podium-card-content">
                  <div className="podium-medal-badge silver-medal">
                    <Medal size={20} />
                    <span>2º Lugar</span>
                  </div>

                  <div className="podium-avatar-wrap silver-glow">
                    {top2.photoUrl ? (
                      <img src={top2.photoUrl} alt={top2.name} className="podium-avatar-img" />
                    ) : (
                      <div className="podium-avatar-placeholder">
                        {top2.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h4 className="podium-member-name">{top2.name}</h4>
                  <span className="podium-member-role">{top2.role}</span>

                  <div className="podium-score-pill">
                    <Zap size={13} />
                    <strong>{top2.score} XP</strong>
                  </div>

                  <div className="podium-quick-stats">
                    <span>🎯 {top2.totalMissions} missões</span>
                    <span>🚗 {top2.drivingCount}x ao volante</span>
                    {top2.multiDayCount > 0 && <span>🧭 {top2.multiDayCount}x viagens</span>}
                  </div>
                </div>
                <div className="podium-pedestal pedestal-silver">
                  <span className="pedestal-number">2</span>
                </div>
              </div>
            )}

            {/* 1º Lugar - Ouro (Destaque Central) */}
            {top1 && (
              <div
                className="podium-step podium-step-gold"
                onClick={() => setSelectedMemberDetail(top1)}
                title="Clique para ver o raio-x completo"
              >
                <div className="podium-card-content">
                  <div className="podium-crown-icon">
                    <Crown size={28} />
                  </div>
                  <div className="podium-medal-badge gold-medal">
                    <Trophy size={20} />
                    <span>1º Lugar • Campeão</span>
                  </div>

                  <div className="podium-avatar-wrap gold-glow">
                    {top1.photoUrl ? (
                      <img src={top1.photoUrl} alt={top1.name} className="podium-avatar-img" />
                    ) : (
                      <div className="podium-avatar-placeholder">
                        {top1.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h4 className="podium-member-name">{top1.name}</h4>
                  <span className="podium-member-role">{top1.role}</span>

                  <div className="podium-score-pill gold-score">
                    <Sparkles size={14} />
                    <strong>{top1.score} XP</strong>
                  </div>

                  <div className="podium-quick-stats">
                    <span>🎯 {top1.totalMissions} missões</span>
                    <span>🚗 {top1.drivingCount}x ao volante</span>
                    {top1.multiDayCount > 0 && <span>🧭 {top1.multiDayCount}x viagens</span>}
                  </div>
                </div>
                <div className="podium-pedestal pedestal-gold">
                  <span className="pedestal-number">1</span>
                </div>
              </div>
            )}

            {/* 3º Lugar - Bronze */}
            {top3 && (
              <div
                className="podium-step podium-step-bronze"
                onClick={() => setSelectedMemberDetail(top3)}
                title="Clique para ver o raio-x completo"
              >
                <div className="podium-card-content">
                  <div className="podium-medal-badge bronze-medal">
                    <Award size={20} />
                    <span>3º Lugar</span>
                  </div>

                  <div className="podium-avatar-wrap bronze-glow">
                    {top3.photoUrl ? (
                      <img src={top3.photoUrl} alt={top3.name} className="podium-avatar-img" />
                    ) : (
                      <div className="podium-avatar-placeholder">
                        {top3.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h4 className="podium-member-name">{top3.name}</h4>
                  <span className="podium-member-role">{top3.role}</span>

                  <div className="podium-score-pill">
                    <Zap size={13} />
                    <strong>{top3.score} XP</strong>
                  </div>

                  <div className="podium-quick-stats">
                    <span>🎯 {top3.totalMissions} missões</span>
                    <span>🚗 {top3.drivingCount}x ao volante</span>
                    {top3.multiDayCount > 0 && <span>🧭 {top3.multiDayCount}x viagens</span>}
                  </div>
                </div>
                <div className="podium-pedestal pedestal-bronze">
                  <span className="pedestal-number">3</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. LISTA COMPLETA DOS COLABORADORES (CARDS INTERATIVOS)        */}
      {/* ============================================================== */}
      <div className="ranking-table-header-row">
        <div className="rth-title">
          <Activity size={17} className="text-cyan" />
          <h3>Classificação Geral da Equipe ({rankedMembers.length} Colaboradores)</h3>
          {roleFilter !== 'all' && (
            <span className="rth-filter-tag">
              Filtrado por: {ROLE_ICONS_MAP[roleFilter] || ''} {roleFilter}
            </span>
          )}
        </div>
        <div className="rth-meta">
          <span>Critério: <strong>{sortCriteria === 'score' ? 'Pontuação Geral (Score XP)' : sortCriteria === 'missions' ? 'Missões Realizadas' : sortCriteria === 'driving' ? 'Condução ao Volante' : sortCriteria.startsWith('role_') ? `Atuação: ${sortCriteria.replace('role_', '')}` : 'Atividade Operacional'}</strong></span>
        </div>
      </div>

      {rankedMembers.length === 0 ? (
        <div className="ranking-empty-state">
          <Users size={36} />
          <h4>Nenhum colaborador encontrado</h4>
          <p>Tente ajustar os filtros de busca, modalidade ou período temporal acima.</p>
        </div>
      ) : (
        <div className="ranking-members-grid">
          {rankedMembers.map((member, index) => {
            const rankPosition = index + 1;
            const progressPercent = Math.min(Math.round((member.score / maxScore) * 100), 100);

            let rankClass = 'rank-regular';
            if (rankPosition === 1) rankClass = 'rank-gold';
            else if (rankPosition === 2) rankClass = 'rank-silver';
            else if (rankPosition === 3) rankClass = 'rank-bronze';

            return (
              <div
                key={member.id}
                className={`ranking-member-card ${rankClass}`}
                onClick={() => setSelectedMemberDetail(member)}
              >
                {/* Posição no ranking */}
                <div className="rmc-position-col">
                  <div className={`rmc-rank-badge ${rankClass}`}>
                    {rankPosition === 1 ? '🥇' : rankPosition === 2 ? '🥈' : rankPosition === 3 ? '🥉' : `#${rankPosition}`}
                  </div>
                </div>

                {/* Avatar e Perfil */}
                <div className="rmc-avatar-col">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="rmc-avatar-img" />
                  ) : (
                    <div className="rmc-avatar-placeholder">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Informações e Funções */}
                <div className="rmc-info-col">
                  <div className="rmc-name-row">
                    <strong className="rmc-name">{member.name}</strong>
                    <span className="rmc-company-tag">{member.company}</span>
                    {member.canDrive && (
                      <span className="rmc-cnh-tag" title={`Habilitado CNH ${member.cnhCategory || 'AB'}`}>
                        🚗 {member.cnhCategory || 'CNH'}
                      </span>
                    )}
                  </div>

                  <div className="rmc-roles-wrap">
                    <span className="rmc-primary-role">{member.role}</span>
                    {Array.isArray(member.secondaryRoles) && member.secondaryRoles.map((sr) => (
                      <span key={sr} className="rmc-sec-role-pill">+{sr}</span>
                    ))}
                  </div>

                  {/* Chips Fiéis das 11 Funções Oficiais Cumpridas */}
                  <div className="rmc-roles-chips-strip">
                    {OFFICIAL_COMPANY_ROLES.filter((r) => (member.roleCounts?.[r] || 0) > 0).map((r) => {
                      const count = member.roleCounts[r];
                      const pts = member.rolePoints?.[r] || (count * (ROLE_XP_POINTS[r] || 15));
                      const icon = ROLE_ICONS_MAP[r] || '💼';
                      const color = ROLE_COLORS_MAP[r] || '#3b82f6';
                      return (
                        <span
                          key={r}
                          className="rmc-role-chip-tag"
                          style={{
                            borderColor: `${color}40`,
                            background: `${color}12`,
                          }}
                          title={`${count}x como ${r} (+${pts} XP)`}
                        >
                          <span className="rmc-role-chip-icon">{icon}</span>
                          <span className="rmc-role-chip-name">{r}:</span>
                          <strong className="rmc-role-chip-count" style={{ color }}>{count}x</strong>
                        </span>
                      );
                    })}
                  </div>

                  {/* Barra de Engajamento */}
                  <div className="rmc-progress-track">
                    <div
                      className="rmc-progress-fill"
                      style={{ width: `${Math.max(progressPercent, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Métricas e Estatísticas Fiéis e Detalhadas */}
                <div className="rmc-metrics-col">
                  {/* Total de Missões */}
                  <div className="rmc-metric-pill" title="Total de missões operacionais">
                    <span className="rmc-metric-num">{member.totalMissions}</span>
                    <span className="rmc-metric-txt">Missões</span>
                  </div>

                  {/* Pílulas Dinâmicas das Funções Reais Exercidas */}
                  {Array.isArray(member.activeRolesSummary) && member.activeRolesSummary.slice(0, 3).map((ar) => (
                    <div
                      key={ar.role}
                      className="rmc-metric-pill rmc-pill-role-dynamic"
                      style={{ borderColor: `${ar.color}40`, background: `${ar.color}15` }}
                      title={`${ar.count}x atuações como ${ar.role} (+${ar.points} XP)`}
                    >
                      <span className="rmc-metric-num" style={{ color: ar.color }}>
                        {ar.icon} {ar.count}
                      </span>
                      <span className="rmc-metric-txt">{ar.role.split(' ')[0]}</span>
                    </div>
                  ))}

                  {/* Quilometragem ao Volante */}
                  {member.drivingCount > 0 && (
                    <div className="rmc-metric-pill rmc-pill-driving" title={`${member.drivingCount}x ao volante (${member.estimatedDistanceKm} km guiados)`}>
                      <span className="rmc-metric-num text-cyan">🚗 {member.drivingCount}</span>
                      <span className="rmc-metric-txt">Ao Volante</span>
                    </div>
                  )}

                  {/* Viagens de Mais de 1 Dia */}
                  {member.multiDayCount > 0 && (
                    <div className="rmc-metric-pill rmc-pill-multiday" title={`${member.multiDayCount}x viagens de longa duração (+1 dia / diária fora)`}>
                      <span className="rmc-metric-num text-amber">🧭 {member.multiDayCount}</span>
                      <span className="rmc-metric-txt">Viagens (+1d)</span>
                    </div>
                  )}

                  {/* Horas Extras Aprovadas */}
                  {member.totalApprovedExtraHours > 0 && (
                    <div className="rmc-metric-pill rmc-pill-extrahours" title={`${member.totalApprovedExtraHours}h extras aprovadas de dedicação em campo`}>
                      <span className="rmc-metric-num text-amber">⚡ +{member.totalApprovedExtraHours}h</span>
                      <span className="rmc-metric-txt">Extras</span>
                    </div>
                  )}
                </div>

                {/* Pontuação XP e Ação */}
                <div className="rmc-score-col">
                  <div className="rmc-score-box">
                    <span className="rmc-score-val">{member.score}</span>
                    <span className="rmc-score-lbl">XP Pontos</span>
                  </div>
                  <button
                    type="button"
                    className="btn-view-member-ray"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMemberDetail(member);
                    }}
                    title="Ver Raio-X Detalhado do Colaborador"
                  >
                    <Eye size={14} />
                    <span>Raio-X</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL DE RAIO-X COMPLETO DO COLABORADOR COM EXTRATO FIEL     */}
      {/* ============================================================== */}
      {selectedMemberDetail && (
        <div className="modal-overlay" onClick={() => setSelectedMemberDetail(null)}>
          <div
            className="modal-box ranking-ray-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px' }}
          >
            <div className="modal-header">
              <div className="ray-header-info">
                <div className="ray-avatar-large">
                  {selectedMemberDetail.photoUrl ? (
                    <img src={selectedMemberDetail.photoUrl} alt={selectedMemberDetail.name} />
                  ) : (
                    <div className="ray-avatar-placeholder">
                      {selectedMemberDetail.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="ray-title-row">
                    <h2>{selectedMemberDetail.name}</h2>
                    <span className="ray-company-pill">{selectedMemberDetail.company}</span>
                    {selectedMemberDetail.canDrive && (
                      <span className="ray-cnh-pill">🚗 CNH {selectedMemberDetail.cnhCategory || 'AB'}</span>
                    )}
                  </div>
                  <div className="ray-roles-list">
                    <span className="ray-role-main">💼 {selectedMemberDetail.role}</span>
                    {Array.isArray(selectedMemberDetail.secondaryRoles) &&
                      selectedMemberDetail.secondaryRoles.map((sr) => (
                        <span key={sr} className="ray-sec-role">+{sr}</span>
                      ))}
                  </div>
                </div>
              </div>

              <button className="modal-close" onClick={() => setSelectedMemberDetail(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form ray-modal-body">
              {/* Placar de Pontuação e Assiduidade */}
              <div className="ray-score-banner">
                <div className="rsb-score-col">
                  <span className="rsb-score-title">Pontuação Operacional Total</span>
                  <div className="rsb-score-number">
                    <Trophy size={26} className="text-gold" />
                    <strong>{selectedMemberDetail.score}</strong>
                    <span>XP</span>
                  </div>
                  <span className="rsb-score-hint">Pontuação fiel de todas as 11 funções oficiais e atividades de campo</span>
                </div>

                <div className="rsb-kpi-grid">
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num">{selectedMemberDetail.totalMissions}</span>
                    <span className="rsb-kpi-lbl">Missões Totais</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-cyan">{selectedMemberDetail.drivingCount}</span>
                    <span className="rsb-kpi-lbl">Ao Volante</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-amber">{selectedMemberDetail.multiDayCount}</span>
                    <span className="rsb-kpi-lbl">Viagens (+1d)</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-green">{selectedMemberDetail.estimatedDistanceKm}</span>
                    <span className="rsb-kpi-lbl">Km Guiados</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-amber">+{selectedMemberDetail.totalApprovedExtraHours}h</span>
                    <span className="rsb-kpi-lbl">Horas Extras</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-purple">{selectedMemberDetail.completedCount}</span>
                    <span className="rsb-kpi-lbl">Concluídas</span>
                  </div>
                </div>
              </div>

              {/* EXTRATO DISCRIMINADO DE PONTUAÇÃO XP */}
              <div className="ray-breakdown-card">
                <h4 className="ray-sub-heading" style={{ marginBottom: '8px' }}>
                  <Sparkles size={15} className="text-gold" /> Extrato Transparente de Pontuação (Score XP)
                </h4>
                <div className="ray-breakdown-grid">
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Atuações Técnicas nas 11 Funções:</span>
                    <strong className="rbi-value text-blue">+{selectedMemberDetail.breakdown?.rolesTotalXP || 0} XP</strong>
                  </div>
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Presença Base em Escalas ({selectedMemberDetail.totalMissions}x):</span>
                    <strong className="rbi-value">+{selectedMemberDetail.breakdown?.missionBaseXP || 0} XP</strong>
                  </div>
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Expedições de Longa Duração (+1 dia / {selectedMemberDetail.multiDayCount}x):</span>
                    <strong className="rbi-value text-amber">+{selectedMemberDetail.breakdown?.multiDayXP || 0} XP</strong>
                  </div>
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Quilometragem Conduzida ({selectedMemberDetail.estimatedDistanceKm} km):</span>
                    <strong className="rbi-value text-cyan">+{selectedMemberDetail.breakdown?.drivingKmXP || 0} XP</strong>
                  </div>
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Horas Extras em Campo ({selectedMemberDetail.totalApprovedExtraHours}h):</span>
                    <strong className="rbi-value text-amber">+{selectedMemberDetail.breakdown?.extraHoursXP || 0} XP</strong>
                  </div>
                  <div className="ray-breakdown-item">
                    <span className="rbi-label">Missões Concluídas com Sucesso ({selectedMemberDetail.completedCount}x):</span>
                    <strong className="rbi-value text-green">+{selectedMemberDetail.breakdown?.completedBonusXP || 0} XP</strong>
                  </div>
                </div>
              </div>

              {/* ATUAÇÃO FIEL PELAS 11 FUNÇÕES DA EMPRESA */}
              <div className="ray-roles-matrix-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '4px' }}>
                  <h4 className="ray-sub-heading" style={{ margin: 0 }}>
                    <Briefcase size={15} /> Atuação por Função na Empresa (11 Funções Oficiais)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Rastreamento fiel e pontuação individual de cada cargo
                  </span>
                </div>

                <div className="ray-roles-matrix-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.65rem',
                  marginBottom: '1.25rem'
                }}>
                  {OFFICIAL_COMPANY_ROLES.map((roleName) => {
                    const count = selectedMemberDetail.roleCounts?.[roleName] || 0;
                    const pts = selectedMemberDetail.rolePoints?.[roleName] || (count * (ROLE_XP_POINTS[roleName] || 15));
                    const isMainRole = normalizeToOfficialRole(selectedMemberDetail.role) === roleName;
                    const isSecRole = Array.isArray(selectedMemberDetail.secondaryRoles) &&
                      selectedMemberDetail.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
                    const icon = ROLE_ICONS_MAP[roleName] || '💼';
                    const color = ROLE_COLORS_MAP[roleName] || '#3b82f6';

                    return (
                      <div
                        key={roleName}
                        style={{
                          background: count > 0 ? `${color}10` : 'rgba(255,255,255,0.02)',
                          border: count > 0 ? `1.5px solid ${color}55` : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: count > 0 ? '#f8fafc' : '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }} title={roleName}>
                              {roleName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: isMainRole ? '#fbbf24' : isSecRole ? '#38bdf8' : count > 0 ? color : '#64748b' }}>
                              {isMainRole ? 'Principal' : isSecRole ? 'Secundária' : count > 0 ? 'Exercida' : 'Sem atuação'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            background: count > 0 ? color : 'rgba(255,255,255,0.06)',
                            color: count > 0 ? '#0f172a' : '#64748b'
                          }}>
                            {count}x
                          </div>
                          {count > 0 && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                              +{pts} XP
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Badges / Conquistas */}
              {selectedMemberDetail.badges.length > 0 && (
                <div className="ray-badges-section">
                  <h4 className="ray-sub-heading">
                    <Award size={15} /> Conquistas &amp; Selos de Reconhecimento
                  </h4>
                  <div className="ray-badges-grid">
                    {selectedMemberDetail.badges.map((b) => (
                      <div key={b.id} className="ray-badge-item">
                        <span className="ray-badge-icon">{b.icon}</span>
                        <div>
                          <strong className="ray-badge-name">{b.name}</strong>
                          <span className="ray-badge-desc">{b.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico Recente de Missões */}
              <div className="ray-history-section">
                <h4 className="ray-sub-heading">
                  <Clock size={15} /> Histórico de Missões ({selectedMemberDetail.missionHistory.length})
                </h4>

                {selectedMemberDetail.missionHistory.length === 0 ? (
                  <p className="ray-empty-history">
                    Nenhuma missão registrada no período selecionado.
                  </p>
                ) : (
                  <div className="ray-history-list">
                    {selectedMemberDetail.missionHistory.map((m) => (
                      <div key={m.id} className="ray-history-row">
                        <div className="rhr-left">
                          <div className="rhr-code-row">
                            <span className="rhr-code">{m.code}</span>
                            <span className="rhr-date">
                              <Calendar size={12} /> {formatDateBR(m.date)}
                              {m.isMultiDay && m.endDate && ` a ${formatDateBR(m.endDate)}`}
                            </span>
                            {m.isMultiDay && (
                              <span className="rhr-multiday-badge">🧭 Viagem</span>
                            )}
                            {m.extraHours > 0 && (
                              <span className="rhr-multiday-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                                ⚡ +{m.extraHours}h extra
                              </span>
                            )}
                          </div>
                          <strong className="rhr-desc">{m.description}</strong>
                          <span className="rhr-loc"><MapPin size={11} /> {m.locationName}</span>
                        </div>

                        <div className="rhr-right">
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {Array.isArray(m.rolesExercised) && m.rolesExercised.map((role) => (
                              <span
                                key={role}
                                className="rhr-role-badge"
                                style={{
                                  background: `${ROLE_COLORS_MAP[role] || '#3b82f6'}20`,
                                  borderColor: `${ROLE_COLORS_MAP[role] || '#3b82f6'}50`,
                                  color: ROLE_COLORS_MAP[role] || '#93c5fd'
                                }}
                              >
                                {ROLE_ICONS_MAP[role] || '💼'} {role}
                              </span>
                            ))}
                          </div>
                          <span className="rhr-status-pill">{m.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="modal-footer" style={{ marginTop: '16px' }}>
                {onOpenEditMember && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const mem = selectedMemberDetail;
                      setSelectedMemberDetail(null);
                      onOpenEditMember(mem);
                    }}
                  >
                    Editar Colaborador
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setSelectedMemberDetail(null)}
                >
                  Fechar Raio-X
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
