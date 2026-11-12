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
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
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
  const [sortCriteria, setSortCriteria] = useState('score'); // score, missions, driving, multiday, capture, editing
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);

  // Normaliza texto para busca insensível a acentos
  const normalize = (txt) =>
    String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // --------------------------------------------------------------------------
  // 1. FILTRAGEM TEMPORAL DAS MISSÕES
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
  // 2. CÁLCULO DAS MÉTRICAS E SCORE GAMIFICADO POR COLABORADOR
  // --------------------------------------------------------------------------
  const membersStats = useMemo(() => {
    return members.map((member) => {
      const memIdStr = String(member.id);
      const memNameNorm = normalize(member.name);

      // Funções do colaborador (principal + secundárias)
      const allRoles = [
        member.role,
        ...(Array.isArray(member.secondaryRoles) ? member.secondaryRoles : []),
      ].filter(Boolean);

      const rolesLower = allRoles.map((r) => normalize(r));
      const isPhotographer = rolesLower.some((r) => r.includes('foto'));
      const isVideographer = rolesLower.some((r) => r.includes('cinegraf') || r.includes('camera') || r.includes('video'));
      const isDronePilot = rolesLower.some((r) => r.includes('drone'));
      const isEditor = rolesLower.some((r) => r.includes('editor') || r.includes('pos-producao'));

      let totalMissions = 0;
      let drivingCount = 0;
      let multiDayCount = 0;
      let photoCount = 0;
      let videoCount = 0;
      let droneCount = 0;
      let editorCount = 0;
      let completedCount = 0;
      let estimatedDistanceKm = 0;
      const missionHistory = [];

      filteredMissions.forEach((m) => {
        const descNorm = normalize(m.description || '');
        const locNorm = normalize(m.locationName || '');

        // 1. Checa se era motorista
        const allocations = Array.isArray(m.vehicleAllocations) ? m.vehicleAllocations : [];
        const isDriver =
          allocations.some(
            (a) =>
              (a.driverId && String(a.driverId) === memIdStr) ||
              (a.driverName && normalize(a.driverName) === memNameNorm)
          ) ||
          (m.driverId && String(m.driverId) === memIdStr) ||
          (m.driverName && normalize(m.driverName) === memNameNorm);

        // 2. Checa se estava na equipe de campo
        const teamIds = Array.isArray(m.teamIds) ? m.teamIds.map(String) : [];
        const inTeamIds = teamIds.includes(memIdStr);
        const inTeamMembers = Array.isArray(m.teamMembers) &&
          m.teamMembers.some((tm) => String(tm.id) === memIdStr || normalize(tm.name) === memNameNorm);
        const inTeamField = Array.isArray(m.team) &&
          m.team.some((t) => String(t) === memIdStr || normalize(t) === memNameNorm);

        // 3. Checa se estava na pós-produção / edição
        const editorIds = Array.isArray(m.editorIds) ? m.editorIds.map(String) : [];
        const inEditorIds = editorIds.includes(memIdStr);
        const inEditorDisplay = m.editorNamesDisplay && normalize(m.editorNamesDisplay).includes(memNameNorm);
        const isAssignedEditor = inEditorIds || inEditorDisplay;

        // Se o colaborador participou de qualquer forma
        if (isDriver || inTeamIds || inTeamMembers || inTeamField || isAssignedEditor) {
          totalMissions++;

          const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
          if (isMDay) multiDayCount++;

          if (isDriver) {
            drivingCount++;
            const dist = Number(m.routeInfo?.distanceKm || m.distanceKm || 0);
            if (dist > 0) estimatedDistanceKm += dist;
          }

          if (isAssignedEditor) {
            editorCount++;
          }

          // Atuação específica baseada no perfil e pauta da missão
          if (isVideographer || descNorm.includes('video') || descNorm.includes('gravac') || descNorm.includes('comercial')) {
            videoCount++;
          }
          if (isPhotographer || descNorm.includes('foto') || descNorm.includes('ensaio') || descNorm.includes('cobertura')) {
            photoCount++;
          }
          if (isDronePilot || descNorm.includes('drone') || descNorm.includes('aerea')) {
            droneCount++;
          }

          if (m.missionStatus === 'Finalizada') {
            completedCount++;
          }

          missionHistory.push({
            id: m.id,
            code: m.code || `#${m.id}`,
            date: m.date,
            endDate: m.endDate,
            isMultiDay: isMDay,
            description: m.description || 'Missão sem título',
            locationName: m.locationName || 'Local de gravação',
            roleInMission: isDriver ? 'Motorista / Condutor' : isAssignedEditor ? 'Editor / Pós-Produção' : 'Equipe de Campo',
            status: m.missionStatus || 'Agendada',
            distanceKm: Number(m.routeInfo?.distanceKm || m.distanceKm || 0),
          });
        }
      });

      // Cálculo de Pontuação (Score XP Corporativo):
      // - 15 pts por missão regular de campo
      // - 25 pts bônus por missão de longa duração (+1 dia / viagem)
      // - 10 pts adicionais quando assume o volante como condutor
      // - 10 pts por missão de pós-produção/edição
      // - 5 pts por missão concluída com sucesso
      const score =
        totalMissions * 15 +
        multiDayCount * 25 +
        drivingCount * 10 +
        editorCount * 10 +
        completedCount * 5;

      // Badges / Selos de Conquista
      const badges = [];
      if (drivingCount >= 3) {
        badges.push({ id: 'as-volante', icon: '🚗', name: 'Ás do Volante', desc: `${drivingCount} missões na condução de viaturas` });
      }
      if (multiDayCount >= 1) {
        badges.push({ id: 'desbravador', icon: '🏕️', name: 'Desbravador', desc: `${multiDayCount} viagens de campo com +1 dia` });
      }
      if (totalMissions >= 5) {
        badges.push({ id: 'veterano', icon: '⭐', name: 'Veterano de Campo', desc: `${totalMissions} missões operacionais` });
      }
      if (allRoles.length >= 2) {
        badges.push({ id: 'multifuncao', icon: '⚡', name: 'Multi-Função', desc: `${allRoles.length} funções na empresa` });
      }
      if (videoCount >= 3 || isVideographer) {
        badges.push({ id: 'lente-ouro', icon: '🎥', name: 'Lente de Ouro', desc: 'Especialista em captação de vídeo' });
      }
      if (photoCount >= 3 || isPhotographer) {
        badges.push({ id: 'foco-preciso', icon: '📸', name: 'Foco Preciso', desc: 'Coberturas fotográficas de destaque' });
      }
      if (droneCount >= 1 || isDronePilot) {
        badges.push({ id: 'asas-ouro', icon: '✈️', name: 'Piloto Ás', desc: 'Captação aérea com drone' });
      }
      if (editorCount >= 2 || isEditor) {
        badges.push({ id: 'mestre-edicao', icon: '🎬', name: 'Mestre da Ilha', desc: 'Edição e finalização de pautas' });
      }

      // Contagem fiel de cada uma das 11 funções exercidas pelo colaborador
      const roleCounts = computeMemberRoleCounts(member, filteredMissions);

      return {
        ...member,
        allRoles,
        roleCounts,
        totalMissions,
        drivingCount,
        multiDayCount,
        photoCount,
        videoCount,
        droneCount,
        editorCount,
        completedCount,
        estimatedDistanceKm: Math.round(estimatedDistanceKm),
        score,
        badges,
        missionHistory: missionHistory.sort((a, b) => String(b.date).localeCompare(String(a.date))),
      };
    });
  }, [members, filteredMissions]);

  // --------------------------------------------------------------------------
  // 3. FILTRAGEM POR EMPRESA, BUSCA E ORDENAÇÃO DO RANKING
  // --------------------------------------------------------------------------
  const rankedMembers = useMemo(() => {
    let list = [...membersStats];

    // Filtro por empresa
    if (companyFilter !== 'all') {
      list = list.filter((m) => m.company === companyFilter);
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
      if (sortCriteria === 'missions') return b.totalMissions - a.totalMissions || b.score - a.score;
      if (sortCriteria === 'driving') return b.drivingCount - a.drivingCount || b.score - a.score;
      if (sortCriteria === 'multiday') return b.multiDayCount - a.multiDayCount || b.score - a.score;
      if (sortCriteria === 'capture') return (b.videoCount + b.photoCount + b.droneCount) - (a.videoCount + a.photoCount + a.droneCount) || b.score - a.score;
      if (sortCriteria === 'editing') return b.editorCount - a.editorCount || b.score - a.score;
      // Default: score
      return b.score - a.score || b.totalMissions - a.totalMissions;
    });

    return list;
  }, [membersStats, companyFilter, searchTerm, sortCriteria]);

  // Colaboradores no Top 3 do pódio
  const top1 = rankedMembers[0] || null;
  const top2 = rankedMembers[1] || null;
  const top3 = rankedMembers[2] || null;

  // Pontuação máxima para escala de barra percentual
  const maxScore = top1 ? Math.max(top1.score, 100) : 100;

  // Destaques / Lideranças Globais
  const bestDriver = useMemo(() => {
    return [...membersStats].sort((a, b) => b.drivingCount - a.drivingCount)[0] || null;
  }, [membersStats]);

  const bestTraveler = useMemo(() => {
    return [...membersStats].sort((a, b) => b.multiDayCount - a.multiDayCount)[0] || null;
  }, [membersStats]);

  const bestCapture = useMemo(() => {
    return [...membersStats].sort((a, b) => (b.videoCount + b.photoCount + b.droneCount) - (a.videoCount + a.photoCount + a.droneCount))[0] || null;
  }, [membersStats]);

  const bestEditor = useMemo(() => {
    return [...membersStats].sort((a, b) => b.editorCount - a.editorCount)[0] || null;
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
              <option value="multiday">🏕️ Mais Viagens Longas (+1 dia)</option>
              <option value="capture">🎥 Mais Captação (Vídeo/Foto)</option>
              <option value="editing">🎬 Mais Pós-Produções / Edições</option>
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
      {/* 2. DESTAQUES DE LIDERANÇA / CARDS EXECUTIVOS                   */}
      {/* ============================================================== */}
      <div className="ranking-leader-cards-grid">
        {/* Mais Assíduo Geral */}
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

        {/* Desbravador de Longa Duração */}
        <div className="leader-kpi-card leader-card-amber">
          <div className="leader-kpi-icon-wrap">
            <Compass size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Desbravador (+1 Dia / Viagens)</span>
            <strong className="leader-kpi-name">{bestTraveler && bestTraveler.multiDayCount > 0 ? bestTraveler.name : 'Sem registros'}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">{bestTraveler ? bestTraveler.multiDayCount : 0} expedições</span>
              <span className="kpi-sub-metric">de longa duração</span>
            </div>
          </div>
        </div>

        {/* Mestre Audiovisual */}
        <div className="leader-kpi-card leader-card-purple">
          <div className="leader-kpi-icon-wrap">
            <Video size={22} />
          </div>
          <div className="leader-kpi-body">
            <span className="leader-kpi-label">Captação &amp; Finalização</span>
            <strong className="leader-kpi-name">{bestCapture && (bestCapture.videoCount + bestCapture.photoCount) > 0 ? bestCapture.name : (bestEditor ? bestEditor.name : 'Sem registros')}</strong>
            <div className="leader-kpi-metric">
              <span className="kpi-bold-metric">{bestCapture ? bestCapture.videoCount + bestCapture.photoCount : 0} coberturas</span>
              <span className="kpi-sub-metric">em vídeo e foto</span>
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
                    {top2.multiDayCount > 0 && <span>🏕️ {top2.multiDayCount}x viagens</span>}
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
                    {top1.multiDayCount > 0 && <span>🏕️ {top1.multiDayCount}x viagens</span>}
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
                    {top3.multiDayCount > 0 && <span>🏕️ {top3.multiDayCount}x viagens</span>}
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
        </div>
        <div className="rth-meta">
          <span>Critério: <strong>{sortCriteria === 'score' ? 'Pontuação Geral' : sortCriteria === 'missions' ? 'Missões Realizadas' : sortCriteria === 'driving' ? 'Condução' : 'Atividade'}</strong></span>
        </div>
      </div>

      {rankedMembers.length === 0 ? (
        <div className="ranking-empty-state">
          <Users size={36} />
          <h4>Nenhum colaborador encontrado</h4>
          <p>Tente ajustar os filtros de busca ou período temporal acima.</p>
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

                  {/* Chips rápidos das 11 funções cumpridas */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {OFFICIAL_COMPANY_ROLES.filter((r) => (member.roleCounts?.[r] || 0) > 0).map((r) => (
                      <span
                        key={r}
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#cbd5e1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span>{ROLE_ICONS_MAP[r] || '💼'}</span>
                        <span>{r}:</span>
                        <strong style={{ color: '#f59e0b' }}>{member.roleCounts[r]}x</strong>
                      </span>
                    ))}
                  </div>

                  {/* Barra de Engajamento */}
                  <div className="rmc-progress-track">
                    <div
                      className="rmc-progress-fill"
                      style={{ width: `${Math.max(progressPercent, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Métricas e Estatísticas Rápidas */}
                <div className="rmc-metrics-col">
                  <div className="rmc-metric-pill" title="Total de missões operacionais">
                    <span className="rmc-metric-num">{member.totalMissions}</span>
                    <span className="rmc-metric-txt">Missões</span>
                  </div>

                  <div className="rmc-metric-pill rmc-pill-driving" title="Vezes que atuou como motorista/condutor">
                    <span className="rmc-metric-num">{member.drivingCount}</span>
                    <span className="rmc-metric-txt">Ao Volante</span>
                  </div>

                  {member.multiDayCount > 0 ? (
                    <div className="rmc-metric-pill rmc-pill-multiday" title="Viagens de campo de mais de 1 dia">
                      <span className="rmc-metric-num">{member.multiDayCount}</span>
                      <span className="rmc-metric-txt">Viagens (+1d)</span>
                    </div>
                  ) : null}

                  {(member.videoCount > 0 || member.photoCount > 0 || member.droneCount > 0) ? (
                    <div className="rmc-metric-pill rmc-pill-capture" title="Gravações, fotos e voos de drone">
                      <span className="rmc-metric-num">{member.videoCount + member.photoCount + member.droneCount}</span>
                      <span className="rmc-metric-txt">Audiovisual</span>
                    </div>
                  ) : null}

                  {member.editorCount > 0 ? (
                    <div className="rmc-metric-pill rmc-pill-editor" title="Pautas de pós-produção e edição">
                      <span className="rmc-metric-num">{member.editorCount}</span>
                      <span className="rmc-metric-txt">Edições</span>
                    </div>
                  ) : null}
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
      {/* 5. MODAL DE RAIO-X COMPLETO DO COLABORADOR                     */}
      {/* ============================================================== */}
      {selectedMemberDetail && (
        <div className="modal-overlay" onClick={() => setSelectedMemberDetail(null)}>
          <div
            className="modal-box ranking-ray-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '780px' }}
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
                  <span className="rsb-score-title">Pontuação Operacional</span>
                  <div className="rsb-score-number">
                    <Trophy size={26} className="text-gold" />
                    <strong>{selectedMemberDetail.score}</strong>
                    <span>XP</span>
                  </div>
                  <span className="rsb-score-hint">Calculado com base em missões, conduções e viagens</span>
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
                    <span className="rsb-kpi-num text-purple">{selectedMemberDetail.editorCount}</span>
                    <span className="rsb-kpi-lbl">Edições</span>
                  </div>
                  <div className="rsb-kpi-item">
                    <span className="rsb-kpi-num text-green">{selectedMemberDetail.estimatedDistanceKm}</span>
                    <span className="rsb-kpi-lbl">Km Guiados</span>
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
                    Contagem fiel de missões exercidas em cada função
                  </span>
                </div>

                <div className="ray-roles-matrix-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: '0.6rem',
                  marginBottom: '1.25rem'
                }}>
                  {OFFICIAL_COMPANY_ROLES.map((roleName) => {
                    const count = selectedMemberDetail.roleCounts?.[roleName] || 0;
                    const isMainRole = normalizeToOfficialRole(selectedMemberDetail.role) === roleName;
                    const isSecRole = Array.isArray(selectedMemberDetail.secondaryRoles) &&
                      selectedMemberDetail.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
                    const icon = ROLE_ICONS_MAP[roleName] || '💼';

                    return (
                      <div
                        key={roleName}
                        style={{
                          background: count > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                          border: count > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '1.15rem' }}>{icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: count > 0 ? '#f8fafc' : '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }} title={roleName}>
                              {roleName}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: isMainRole ? '#fbbf24' : isSecRole ? '#38bdf8' : '#64748b' }}>
                              {isMainRole ? 'Principal' : isSecRole ? 'Secundária' : count > 0 ? 'Exercida' : 'Sem atuação'}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: count > 0 ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                          color: count > 0 ? '#0f172a' : '#64748b'
                        }}>
                          {count}x
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
                              <span className="rhr-multiday-badge">🏕️ Viagem</span>
                            )}
                          </div>
                          <strong className="rhr-desc">{m.description}</strong>
                          <span className="rhr-loc"><MapPin size={11} /> {m.locationName}</span>
                        </div>

                        <div className="rhr-right">
                          <span className={`rhr-role-badge ${m.roleInMission.includes('Motorista') ? 'role-driver' : m.roleInMission.includes('Editor') ? 'role-editor' : 'role-field'}`}>
                            {m.roleInMission}
                          </span>
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

