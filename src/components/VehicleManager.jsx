import React, { useState } from 'react';
import {
  Car,
  Fuel,
  Gauge,
  Plus,
  TrendingUp,
  History,
  Trash2,
  Edit,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
  X,
  AlertTriangle,
  Route,
  Wrench,
  Eye,
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  User,
  Users,
  Zap,
} from 'lucide-react';
import {
  getActiveMissionForVehicle,
  computeVehicleFuelTelemetry,
  getFuelPriceForVehicle,
  isVehicleInMission,
  getMissionAllocations,
  getMissionTotalKm,
  getMissionCode,
  isElectricVehicle,
  getFuelUnit,
  getFuelNoun,
  getFuelActionNoun,
  getFuelTypeIcon,
  getFuelTypeBadgeClass,
} from '../utils/geo';
import { confirmDialog, alertDialog } from '../utils/dialog';

// =====================================================
// Componente Principal: Gerenciador de Viaturas
// =====================================================
export default function VehicleManager({
  vehicles = [],
  missions = [],
  members = [],
  fuelPricePerLiter = 6.45,
  settings = null,
  userRole = 'admin',
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onAddFuelLog,
  onDeleteFuelLog,
}) {
  const fuelSettings = settings || (typeof fuelPricePerLiter === 'object' ? fuelPricePerLiter : { gasolinePricePerLiter: fuelPricePerLiter, dieselPricePerLiter: 6.89 });
  // Apenas Administrador pode cadastrar novas viaturas e ver KPIs financeiros agregados
  const canAddVehicle = userRole === 'admin';
  const canFuelVehicle = userRole === 'admin' || userRole === 'manager';
  const canEditVehicle = userRole === 'admin';
  const canDeleteVehicle = userRole === 'admin';
  const canDeleteFuelLog = userRole === 'admin';
  const canViewFinancialKpis = userRole === 'admin';
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalTab, setHistoryModalTab] = useState('missions'); // 'missions' | 'fuel'
  const [selectedVehicleForFuel, setSelectedVehicleForFuel] = useState(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  // Formata data YYYY-MM-DD para DD/MM/AAAA
  const formatDateBR = (dateStr) => {
    if (!dateStr || !String(dateStr).includes('-')) return dateStr || '--/--/----';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // Retorna todas as missões onde esta viatura foi alocada, ordenadas das mais recentes para as mais antigas
  const getVehicleMissions = (vehicle) => {
    if (!vehicle || !Array.isArray(missions)) return [];
    return missions
      .filter((m) => isVehicleInMission(vehicle, m))
      .sort((a, b) => {
        const dtA = new Date(`${a.date || '2000-01-01'}T${a.departureTime || '00:00'}`);
        const dtB = new Date(`${b.date || '2000-01-01'}T${b.departureTime || '00:00'}`);
        return dtB - dtA;
      });
  };

  // Identifica o motorista específico que conduziu esta viatura na missão
  const getMissionVehicleDriver = (mission, vehicle) => {
    if (!mission || !vehicle) return 'Não informado';
    const allocations = getMissionAllocations(mission, vehicles, members);
    const myAlloc = allocations.find(
      (a) => a.vehicleId === vehicle.id || (a.vehicle && a.vehicle.id === vehicle.id)
    );
    if (myAlloc && myAlloc.driverName) return myAlloc.driverName;
    if (myAlloc && myAlloc.driverMember?.name) return myAlloc.driverMember.name;
    if (mission.driverName) return mission.driverName;
    if (mission.driverId) {
      const byId = members.find((x) => x.id === mission.driverId);
      if (byId) return byId.name;
    }
    if (Array.isArray(mission.teamIds) && mission.teamIds.length > 0) {
      const first = members.find((x) => x.id === mission.teamIds[0]);
      if (first) return first.name;
    }
    return 'Não informado';
  };

  // Identifica a equipe / pessoas responsáveis pela missão
  const getMissionTeamNames = (mission) => {
    if (!mission) return 'Não especificada';
    if (Array.isArray(mission.teamIds) && mission.teamIds.length > 0) {
      const names = mission.teamIds
        .map((id) => members.find((x) => x.id === id)?.name)
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    if (mission.teamNamesDisplay) return mission.teamNamesDisplay;
    return 'Equipe não especificada';
  };

  // ---- Form State para Nova/Editar Viatura ----
  const [vehFormData, setVehFormData] = useState({
    name: '',
    plate: '',
    company: 'MegaFilmes',
    type: 'Picape / Carga',
    fuelType: 'Gasolina',
    autonomyKmPerLiter: 12,
    tankCapacity: 50,
    currentFuelPercent: 80,
    currentKm: 30000,
    status: 'Disponível',
  });

  // ---- Form State para Abastecimento ----
  const [fuelFormData, setFuelFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amountSpent: '',
    liters: '',
    km: '',
    station: '',
  });

  // Abre modal de cadastro de nova viatura
  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setVehFormData({
      name: '',
      plate: '',
      company: 'MegaFilmes',
      type: 'Picape / Carga',
      fuelType: 'Gasolina',
      autonomyKmPerLiter: 12,
      tankCapacity: 50,
      currentFuelPercent: 80,
      currentKm: 30000,
      status: 'Disponível',
    });
    setShowAddVehicleModal(true);
  };

  // Abre modal para editar dados de uma viatura existente
  const handleOpenEdit = (v) => {
    const telemetry = computeVehicleFuelTelemetry(v, missions, fuelSettings);
    setEditingVehicle(v);
    setVehFormData({
      name: v.name,
      plate: v.plate,
      company: v.company || 'MegaFilmes',
      type: v.type || 'Hatch / Produção',
      fuelType: v.fuelType || 'Gasolina',
      autonomyKmPerLiter: v.autonomyKmPerLiter || 12,
      tankCapacity: v.tankCapacity || 50,
      currentFuelPercent: telemetry.currentPercent,
      currentKm: v.currentKm || 0,
      status: v.status || 'Disponível',
    });
    setShowAddVehicleModal(true);
  };

  // Salva cadastro ou edição de viatura (calibrando o nível base para refletir oscilações exatas)
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vehFormData.name || !vehFormData.plate) {
      await alertDialog({
        title: 'Campos Obrigatórios',
        message: 'Por favor, informe o Modelo e a Placa da viatura.',
        variant: 'warning',
      });
      return;
    }

    const newAutonomy = parseFloat(vehFormData.autonomyKmPerLiter) || 12;
    const newTankCap = parseFloat(vehFormData.tankCapacity) || 50;
    const desiredPercent = Math.max(
      0,
      Math.min(100, parseFloat(vehFormData.currentFuelPercent) || 0)
    );

    if (editingVehicle) {
      const tempVeh = {
        ...editingVehicle,
        autonomyKmPerLiter: newAutonomy,
        tankCapacity: newTankCap,
      };
      const telemetry = computeVehicleFuelTelemetry(tempVeh, missions, fuelSettings);
      const netDeltaLiters =
        telemetry.refuelLitersAdded - telemetry.totalMissionsLitersConsumed;
      const desiredLiters = (desiredPercent / 100) * newTankCap;
      const calibratedBaseLiters = desiredLiters - netDeltaLiters;
      const calibratedBasePercent = parseFloat(
        ((calibratedBaseLiters / newTankCap) * 100).toFixed(4)
      );

      onUpdateVehicle({
        ...editingVehicle,
        ...vehFormData,
        autonomyKmPerLiter: newAutonomy,
        tankCapacity: newTankCap,
        currentFuelPercent: desiredPercent,
        baseFuelPercent: calibratedBasePercent,
        currentKm: parseInt(vehFormData.currentKm, 10) || 0,
      });
    } else {
      const newV = {
        id: 'v-' + Date.now(),
        ...vehFormData,
        autonomyKmPerLiter: newAutonomy,
        tankCapacity: newTankCap,
        currentFuelPercent: desiredPercent,
        baseFuelPercent: desiredPercent,
        currentKm: parseInt(vehFormData.currentKm, 10) || 0,
        fuelLogs: [],
      };
      onAddVehicle(newV);
    }
    setShowAddVehicleModal(false);
  };

  // Abre modal de abastecimento para viatura selecionada
  const handleOpenFuelModal = (v) => {
    const telemetry = computeVehicleFuelTelemetry(v, missions, fuelSettings);
    setSelectedVehicleForFuel(v);
    setFuelFormData({
      date: new Date().toISOString().slice(0, 10),
      amountSpent: '',
      liters: '',
      km: Math.round(telemetry.effectiveOdometerKm || v.currentKm || 0),
      station: 'Posto Shell Convênio',
    });
    setShowFuelModal(true);
  };

  // Abre modal de histórico da viatura (missões realizadas ou abastecimentos)
  const handleOpenHistory = (v, defaultTab = 'missions') => {
    setSelectedVehicleForHistory(v);
    setHistoryModalTab(defaultTab);
    setShowHistoryModal(true);
  };

  // Salva registro de abastecimento
  const handleSaveFuel = async (e) => {
    e.preventDefault();
    if (!fuelFormData.amountSpent || !fuelFormData.liters) {
      await alertDialog({
        title: 'Dados Incompletos',
        message: 'Preencha o valor em R$ e os litros colocados.',
        variant: 'warning',
      });
      return;
    }

    const log = {
      id: 'f-' + Date.now(),
      date: fuelFormData.date,
      amountSpent: parseFloat(fuelFormData.amountSpent) || 0,
      liters: parseFloat(fuelFormData.liters) || 0,
      km: parseInt(fuelFormData.km, 10) || selectedVehicleForFuel.currentKm || 0,
      station: fuelFormData.station || 'Posto de Abastecimento',
    };

    onAddFuelLog(selectedVehicleForFuel.id, log);
    setShowFuelModal(false);
  };

  // Exclui um registro do histórico de abastecimento
  const handleDeleteFuelLog = async (vehicleId, logId) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Abastecimento',
      message: 'Deseja excluir esse registro de abastecimento?',
      description: 'O valor e os litros colocados serão removidos do histórico da viatura.',
      confirmText: 'Excluir Registro',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (confirmed) {
      onDeleteFuelLog(vehicleId, logId);
      // Atualiza o veículo exibido no modal de histórico
      const updated = vehicles.find((v) => v.id === vehicleId);
      if (updated) setSelectedVehicleForHistory(updated);
    }
  };

  // Alterna expansão do card de viatura para mostrar histórico inline
  const toggleCardExpand = (vId) => {
    setExpandedCards((prev) => ({ ...prev, [vId]: !prev[vId] }));
  };

  // Detecta missões ativas (Em Preparo 1h antes, Em Execução ou Saiu) para cada viatura
  const getMissionForVehicle = (vehicle) => getActiveMissionForVehicle(vehicle, missions);

  // Calcula telemetria de combustível de todas as viaturas
  const vehiclesWithTelemetry = vehicles.map((v) => ({
    vehicle: v,
    telemetry: computeVehicleFuelTelemetry(v, missions, fuelSettings),
  }));

  const reserveVehicles = vehiclesWithTelemetry.filter((item) => item.telemetry.isReserveAlert);

  // ---- Estatísticas Gerais da Frota ----
  const totalSpent = vehicles.reduce((acc, v) => {
    return acc + (v.fuelLogs || []).reduce((sub, f) => sub + (f.amountSpent || 0), 0);
  }, 0);

  const totalLiters = vehicles.reduce((acc, v) => {
    return acc + (v.fuelLogs || []).reduce((sub, f) => sub + (f.liters || 0), 0);
  }, 0);

  const disponiveis = vehicles.filter(
    (v) => v.status === 'Disponível' && !getMissionForVehicle(v)
  ).length;

  const emMissao = vehicles.filter(
    (v) => v.status === 'Em Missão' || getMissionForVehicle(v)
  ).length;

  // Calcula KM total rodada por todas as viaturas (odômetro base + km das missões)
  const totalKmFrota = vehiclesWithTelemetry.reduce(
    (acc, item) => acc + (item.telemetry.effectiveOdometerKm || 0),
    0
  );

  return (
    <div className="vehicle-manager-container">
      {/* Cabeçalho do Módulo de Frotas */}
      <div className="vehicles-header">
        <div>
          <div className="board-badge">CONTROLE DE FROTAS</div>
          <h1 className="board-main-title">Viaturas MegaFilmes &amp; Mega Print</h1>
          <p className="board-subtitle">
            Gestão de veículos, oscilação minuciosa do tanque por missão, reserva (≤ 10%) e histórico de abastecimentos
          </p>
        </div>

        {canAddVehicle && (
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Cadastrar Nova Viatura
          </button>
        )}
      </div>

      {/* BANNER GLOBAL DE ALERTA DE RESERVA DE COMBUSTÍVEL (<= 10%) */}
      {reserveVehicles.length > 0 && (
        <div className="fleet-reserve-alert-banner">
          <div className="frab-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="frab-content">
            <strong>
              🚨 ALERTA DE RESERVA DE COMBUSTÍVEL ({reserveVehicles.length} viatura
              {reserveVehicles.length > 1 ? 's' : ''} com tanque ≤ 10%) — ABASTECIMENTO IMEDIATO NECESSÁRIO!
            </strong>
            <div className="frab-vehicles-list">
              {reserveVehicles.map(({ vehicle: rv, telemetry: rt }) => (
                <div key={rv.id} className="frab-veh-chip">
                  <span>
                    <strong>{rv.name}</strong> ({rv.plate}) — Restam apenas{' '}
                    <strong>
                      {rt.currentLiters} L ({rt.currentPercent}%)
                    </strong>{' '}
                    de {rt.tankCapacity} L (~{rt.remainingRangeKm} km)
                  </span>
                  <button
                    type="button"
                    className="btn-frab-refuel"
                    onClick={() => handleOpenFuelModal(rv)}
                  >
                    <Fuel size={13} /> Abastecer Agora
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPIs de Resumo da Frota */}
      <div className="fleet-kpi-grid">
        <div className="kpi-card kpi-gold">
          <div className="kpi-icon-box bg-gold">
            <Car size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total da Frota</span>
            <span className="kpi-value">{vehicles.length} Veículos</span>
          </div>
        </div>

        <div className="kpi-card kpi-green">
          <div className="kpi-icon-box bg-green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Disponíveis</span>
            <span className="kpi-value">{disponiveis} Livres</span>
          </div>
        </div>

        <div className="kpi-card kpi-blue" style={{ borderColor: emMissao > 0 ? 'var(--accent-cyan)' : undefined }}>
          <div className="kpi-icon-box bg-blue">
            <Route size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Em Missão</span>
            <span className="kpi-value" style={{ color: emMissao > 0 ? 'var(--accent-cyan)' : undefined }}>
              {emMissao} Viaturas
            </span>
          </div>
        </div>

        {/* KPIs Financeiros e Globais: Exclusivos para Administrador */}
        {canViewFinancialKpis && (
          <>
            <div className="kpi-card kpi-purple">
              <div className="kpi-icon-box bg-purple">
                <TrendingUp size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">KM Total Frota</span>
                <span className="kpi-value">{totalKmFrota.toLocaleString('pt-BR')} km</span>
              </div>
            </div>

            <div className="kpi-card kpi-green">
              <div className="kpi-icon-box bg-green">
                <DollarSign size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Gasto Combustível</span>
                <span className="kpi-value">
                  R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="kpi-card kpi-blue">
              <div className="kpi-icon-box bg-blue">
                <Fuel size={20} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Volume Abastecido</span>
                <span className="kpi-value">{totalLiters.toFixed(1)} Litros</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Aviso se não houver viaturas */}
      {vehicles.length === 0 && (
        <div className="empty-list-notice" style={{ marginTop: '2rem' }}>
          Nenhuma viatura cadastrada. Clique em "Cadastrar Nova Viatura" para adicionar.
        </div>
      )}

      {/* Grid de Cards de Viaturas */}
      <div className="vehicles-cards-grid">
        {vehiclesWithTelemetry.map(({ vehicle: v, telemetry }) => {
          const fuelLogs = v.fuelLogs || [];
          const fuelLogsCount = fuelLogs.length;
          const lastFuel = fuelLogsCount > 0 ? fuelLogs[fuelLogsCount - 1] : null;
          const activeMission = getMissionForVehicle(v);
          const isExpanded = expandedCards[v.id] || false;
          const vMissions = getVehicleMissions(v);
          const latestMission = vMissions[0];
          const lastDriverName = latestMission
            ? getMissionVehicleDriver(latestMission, v)
            : 'Sem registro';
          const lastLocation = latestMission
            ? (latestMission.locationName || latestMission.address || 'Destino não informado')
            : null;

          const isInMaintenance = v.status === 'Manutenção';
          const isInPrep = !isInMaintenance && activeMission?.missionStatus === 'Em Preparo';
          const isInUse =
            !isInMaintenance &&
            !isInPrep &&
            (!!activeMission || v.status === 'Em Missão');

          const statusThemeClass = isInMaintenance
            ? 'card-status-manutencao'
            : isInUse
            ? 'card-status-em-uso'
            : isInPrep
            ? 'card-status-preparo'
            : 'card-status-disponivel';

          const isElec = isElectricVehicle(v);
          const isDiesel = (v.fuelType || '').toLowerCase() === 'diesel';
          const unit = isElec ? 'kWh' : 'L';
          const noun = isElec ? 'Bateria' : 'Tanque';
          const actionNoun = isElec ? 'Recarga' : 'Abastecimento';

          return (
            <div
              key={v.id}
              className={`vehicle-card ${statusThemeClass} ${
                telemetry.isReserveAlert ? 'card-reserve-alert' : ''
              }`}
            >
              {/* Cabeçalho Compacto e Alinhado */}
              <div className="veh-card-header">
                <div className="veh-card-top-bar">
                  <span
                    className={`veh-company-tag ${
                      v.company === 'Mega Print' ? 'tag-print' : 'tag-filmes'
                    }`}
                  >
                    {v.company}
                  </span>

                  <div className="veh-status-badge">
                    {isInUse ? (
                      <span className="status-pill-veh pill-veh-uso">
                        <span className="pulse-dot dot-red"></span>
                        Em Uso • Missão
                      </span>
                    ) : isInPrep ? (
                      <span className="status-pill-veh pill-veh-preparo">
                        <span className="pulse-dot dot-amber"></span>
                        Em Preparo
                      </span>
                    ) : isInMaintenance ? (
                      <span className="status-pill-veh pill-veh-manutencao">
                        <Wrench size={11} /> Manutenção
                      </span>
                    ) : (
                      <span className="status-pill-veh pill-veh-disponivel">
                        <CheckCircle size={11} /> Disponível
                      </span>
                    )}
                  </div>
                </div>

                <div className="veh-identity-row">
                  <h3 className="veh-title-text" title={v.name}>
                    {v.name}
                  </h3>
                  <span className="veh-plate-badge">{v.plate}</span>
                </div>

                <div className="veh-meta-badges">
                  {v.type && (
                    <span className="veh-type-label" title={v.type}>
                      {v.type}
                    </span>
                  )}
                  <span className={`veh-fuel-badge ${getFuelTypeBadgeClass(v)}`}>
                    {isElec ? '⚡ Elétrico' : isDiesel ? '🛢️ Diesel' : '⛽ Gasolina'}
                  </span>
                </div>
              </div>

              {/* Faixa Compacta de Status Operacional / Missão Ativa (altura uniforme) */}
              {activeMission ? (
                <div
                  className={`veh-operational-strip ${
                    isInPrep ? 'strip-preparo' : 'strip-em-uso'
                  }`}
                >
                  <div className="vos-main">
                    <Route size={13} className="vos-icon" />
                    <span className="vos-title" title={activeMission.description}>
                      <strong>{isInPrep ? 'Preparo (-1h):' : 'Em Uso:'}</strong>{' '}
                      {activeMission.description}
                    </span>
                  </div>
                  <div className="vos-sub">
                    <span>
                      🕒 {activeMission.departureTime}–{activeMission.returnTimeEstimated || '--:--'}
                    </span>
                    {activeMission.driverName && (
                      <span>🛞 {activeMission.driverName}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`veh-operational-strip ${
                    isInMaintenance ? 'strip-manutencao' : 'strip-disponivel'
                  }`}
                >
                  <div className="vos-main">
                    <CheckCircle size={13} className="vos-icon" />
                    <span className="vos-title">
                      {isInMaintenance
                        ? 'Viatura em manutenção / oficina'
                        : 'Pronta na base para nova missão'}
                    </span>
                  </div>
                  <div className="vos-sub">
                    <span>Alcance atual: ~{telemetry.remainingRangeKm} km</span>
                    <span>1 {noun.toLowerCase()}: {telemetry.maxRangeKm} km</span>
                  </div>
                </div>
              )}

              {/* Grid Compacto 2x2 de Especificações e Odômetro */}
              <div className="veh-specs-grid">
                <div className="veh-spec-item">
                  <div className="spec-top-line">
                    <span className="spec-label">Autonomia</span>
                    <small className="spec-inline-hint">Máx {telemetry.maxRangeKm} km</small>
                  </div>
                  <strong className="spec-value">{telemetry.autonomy} {isElec ? 'km/kWh' : 'km/L'}</strong>
                </div>

                <div className="veh-spec-item spec-km-total">
                  <div className="spec-top-line">
                    <span className="spec-label">Odômetro</span>
                    {telemetry.totalMissionsKm > 0 && (
                      <small className="spec-inline-hint text-gold">
                        +{telemetry.totalMissionsKm} km
                      </small>
                    )}
                  </div>
                  <strong className="spec-value spec-value-highlight">
                    {telemetry.effectiveOdometerKm.toLocaleString('pt-BR')} km
                  </strong>
                </div>

                <div className="veh-spec-item">
                  <div className="spec-top-line">
                    <span className="spec-label">{noun}</span>
                    <small className="spec-inline-hint">Res. {telemetry.reserveThresholdLiters} {unit}</small>
                  </div>
                  <strong className="spec-value">{telemetry.tankCapacity} {unit}</strong>
                </div>

                <div className="veh-spec-item">
                  <div className="spec-top-line">
                    <span className="spec-label">{isElec ? 'Carga Bateria' : 'Combustível'}</span>
                    <small className="spec-inline-hint">~{telemetry.remainingRangeKm} km</small>
                  </div>
                  <strong
                    className={`spec-value ${
                      telemetry.isReserveAlert ? 'text-danger-bright' : 'text-green-bright'
                    }`}
                  >
                    {telemetry.currentLiters}{unit} ({telemetry.currentPercent}%)
                  </strong>
                </div>
              </div>

              {/* Barra Visual de Nível do Tanque / Bateria */}
              <div className="fuel-level-bar-container">
                <div className="fuel-bar-labels">
                  <span>
                    {noun} ({telemetry.currentLiters}{unit} / {telemetry.tankCapacity}{unit})
                  </span>
                  <strong
                    className={
                      telemetry.isReserveAlert ? 'text-danger-bright' : 'text-green-bright'
                    }
                  >
                    {telemetry.currentPercent}%
                  </strong>
                </div>
                <div
                  className="fuel-progress-bg"
                  title={`Reserva crítica em 10% (${telemetry.reserveThresholdLiters} ${unit})`}
                >
                  <div
                    className="fuel-reserve-marker"
                    style={{ left: '10%' }}
                    title={`Limite de Reserva: 10% (${telemetry.reserveThresholdLiters} ${unit})`}
                  />
                  <div
                    className={`fuel-progress-fill ${
                      telemetry.isReserveAlert ? 'fill-danger reserve-pulse' : 'fill-good'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, telemetry.currentPercent))}%` }}
                  ></div>
                </div>

                <div className="fuel-oscillation-strip">
                  <span
                    className="osc-item osc-consumed"
                    title={`Deduzido automaticamente pelas missões desta viatura (${unit})`}
                  >
                    🔻 Missões ({telemetry.missionsCount}):{' '}
                    <strong>-{telemetry.totalMissionsLitersConsumed}{unit}</strong> (
                    {telemetry.totalMissionsKm} km)
                  </span>
                  {telemetry.refuelLitersAdded > 0 ? (
                    <span className="osc-item osc-refueled">
                      {isElec ? '⚡' : '⛽'} <strong>+{telemetry.refuelLitersAdded}{unit}</strong>
                    </span>
                  ) : (
                    <span className="osc-item osc-remaining">
                      Restam <strong>~{telemetry.remainingRangeKm} km</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* ALERTA DE RESERVA / BATERIA BAIXA (<= 10%) */}
              {telemetry.isReserveAlert && (
                <div className="fuel-reserve-critical-banner">
                  <div className="frc-top">
                    <AlertTriangle size={14} className="frc-icon" />
                    <div>
                      <strong>{isElec ? 'BATERIA BAIXA' : 'RESERVA DE COMBUSTÍVEL'} ({telemetry.currentPercent}%)</strong>
                      <span>
                        Restam {telemetry.currentLiters}{unit} (≤ 10%) — {isElec ? 'recarga imediata da bateria necessária!' : 'abastecimento imediato!'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-frc-refuel-now"
                    onClick={() => handleOpenFuelModal(v)}
                  >
                    {isElec ? <Zap size={12} /> : <Fuel size={12} />} {isElec ? 'Recarregar Agora' : 'Abastecer Agora'} (+{telemetry.litersToFullTank}{unit})
                  </button>
                </div>
              )}

              {/* Linha de Último Deslocamento & Motorista */}
              <div
                className="veh-last-movement-row"
                onClick={() => handleOpenHistory(v, 'missions')}
                title="Clique para ver o histórico completo de missões e destinos deste veículo"
                style={{ cursor: 'pointer' }}
              >
                <div className="vlm-header-line">
                  <div className="vlm-driver-pill">
                    <span className="vlm-wheel">🛞</span>
                    <span className="vlm-label">Último Condutor:</span>
                    <strong className="vlm-driver-name">{lastDriverName}</strong>
                  </div>
                  {vMissions.length > 0 && (
                    <span className="vlm-badge">
                      {vMissions.length} {vMissions.length === 1 ? 'missão' : 'missões'}
                    </span>
                  )}
                </div>

                {latestMission ? (
                  <div className="vlm-dest-line">
                    <MapPin size={12} className="vlm-pin" />
                    <span className="vlm-dest-text" title={`${latestMission.locationName || ''} - ${latestMission.address || ''}`}>
                      Destino: <strong>{lastLocation}</strong> · <span className="vlm-date">{formatDateBR(latestMission.date)}</span>
                    </span>
                  </div>
                ) : (
                  <div className="vlm-dest-line text-muted">
                    <Navigation size={12} className="vlm-pin" />
                    <span className="vlm-dest-text">Sem missões realizadas ainda</span>
                  </div>
                )}
              </div>

              {/* Linha Única: Último Abastecimento / Recarga + Botão Compacto de Expandir */}
              <div className="last-fuel-compact-row">
                <div className="lfc-left">
                  {isElec ? (
                    <Zap size={12} className={lastFuel ? 'icon-green' : 'icon-muted'} />
                  ) : (
                    <Fuel size={12} className={lastFuel ? 'icon-accent' : 'icon-muted'} />
                  )}
                  {lastFuel ? (
                    <span className="lfc-text" title={`${lastFuel.date} • ${lastFuel.station || ''}`}>
                      Última {actionNoun.toLowerCase()}: <strong>R$ {Number(lastFuel.amountSpent || 0).toFixed(2)}</strong> ({lastFuel.liters}{unit}) ·{' '}
                      {lastFuel.date}
                    </span>
                  ) : (
                    <span className="lfc-text text-muted">Sem {actionNoun.toLowerCase()} registrado</span>
                  )}
                </div>

                {fuelLogsCount > 0 && (
                  <button
                    type="button"
                    className="btn-expand-history-inline"
                    onClick={() => toggleCardExpand(v.id)}
                    title={isExpanded ? 'Ocultar histórico' : 'Ver histórico rápido'}
                  >
                    <span>{fuelLogsCount} reg.</span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="fuel-history-inline">
                  {[...fuelLogs].reverse().map((log) => (
                    <div key={log.id} className="fuel-log-row">
                      <div className="log-date">
                        <Calendar size={11} />
                        {log.date}
                      </div>
                      <div className="log-details">
                        <span className="log-value">R$ {Number(log.amountSpent || 0).toFixed(2)}</span>
                        <span className="log-sep">·</span>
                        <span>{log.liters}{unit}</span>
                        {log.km > 0 && (
                          <>
                            <span className="log-sep">·</span>
                            <span>{log.km.toLocaleString('pt-BR')} km</span>
                          </>
                        )}
                        {log.station && (
                          <>
                            <span className="log-sep">·</span>
                            <span className="log-station">{log.station}</span>
                          </>
                        )}
                      </div>
                      {onDeleteFuelLog && canDeleteFuelLog && (
                        <button
                          className="btn-del-log"
                          onClick={() => handleDeleteFuelLog(v.id, log.id)}
                          title="Excluir este registro (Apenas Admin)"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Ações do Card */}
              <div className="veh-card-actions">
                {canFuelVehicle && (
                  <button
                    type="button"
                    className={`btn-fuel-action ${isElec ? 'btn-charge-action' : ''}`}
                    onClick={() => handleOpenFuelModal(v)}
                    title={isElec ? 'Registrar Recarga Elétrica' : 'Registrar Abastecimento'}
                  >
                    {isElec ? <Zap size={13} /> : <Fuel size={13} />} {isElec ? 'Recarregar' : 'Abastecer'}
                  </button>
                )}

                <button
                  type="button"
                  className="btn-history-action"
                  onClick={() => handleOpenHistory(v, 'missions')}
                  title="Ver histórico de missões, destinos, motoristas e abastecimentos"
                >
                  <History size={13} /> Histórico ({vMissions.length})
                </button>

                {canEditVehicle && (
                  <button
                    className="btn-icon-action"
                    onClick={() => handleOpenEdit(v)}
                    title="Editar dados da viatura"
                  >
                    <Edit size={13} />
                  </button>
                )}

                {canDeleteVehicle && (
                  <button
                    className="btn-icon-action text-danger"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: 'Excluir Viatura',
                        message: `Deseja remover a viatura ${v.name} (${v.plate})?`,
                        description: 'Todos os registros de consumo e histórico desta viatura serão desvinculados.',
                        confirmText: 'Excluir Viatura',
                        cancelText: 'Cancelar',
                        variant: 'danger',
                      });
                      if (confirmed) {
                        onDeleteVehicle(v.id);
                      }
                    }}
                    title="Excluir Viatura"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =============================================================== */}
      {/* Modal de Cadastro / Edição de Viatura                           */}
      {/* =============================================================== */}
      {showAddVehicleModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h2>{editingVehicle ? 'Editar Viatura' : 'Nova Viatura da Frota'}</h2>
              <button className="modal-close" onClick={() => setShowAddVehicleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveVehicle} className="modal-form">
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Modelo e Nome do Veículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fiat Strada Cabine Dupla, Kwid..."
                    value={vehFormData.name}
                    onChange={(e) => setVehFormData({ ...vehFormData, name: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Placa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ABC-1234"
                    value={vehFormData.plate}
                    onChange={(e) => setVehFormData({ ...vehFormData, plate: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Empresa Pertencente</label>
                  <select
                    value={vehFormData.company}
                    onChange={(e) => setVehFormData({ ...vehFormData, company: e.target.value })}
                  >
                    <option value="MegaFilmes">MegaFilmes</option>
                    <option value="Mega Print">Mega Print</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Tipo de Combustível / Energia *</label>
                  <select
                    value={vehFormData.fuelType || 'Gasolina'}
                    onChange={(e) => {
                      const newFuel = e.target.value;
                      const wasElec = isElectricVehicle(vehFormData.fuelType);
                      const isNowElec = isElectricVehicle(newFuel);
                      let newAutonomy = vehFormData.autonomyKmPerLiter;
                      let newTank = vehFormData.tankCapacity;

                      if (isNowElec && !wasElec) {
                        // Sugere parâmetros elétricos típicos se ainda estiver no padrão de combustão
                        if (!newAutonomy || newAutonomy === 12 || newAutonomy === 10) newAutonomy = 6.5;
                        if (!newTank || newTank === 50) newTank = 60;
                      } else if (!isNowElec && wasElec) {
                        if (newAutonomy === 6.5) newAutonomy = 12;
                        if (newTank === 60) newTank = 50;
                      }

                      setVehFormData({
                        ...vehFormData,
                        fuelType: newFuel,
                        autonomyKmPerLiter: newAutonomy,
                        tankCapacity: newTank,
                      });
                    }}
                  >
                    <option value="Gasolina">⛽ Gasolina</option>
                    <option value="Diesel">🛢️ Diesel</option>
                    <option value="Elétrico">⚡ Elétrico (100% Bateria)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Categoria / Tipo</label>
                <input
                  type="text"
                  placeholder="Ex: Picape, Van, Hatch, Furgão..."
                  value={vehFormData.type}
                  onChange={(e) => setVehFormData({ ...vehFormData, type: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>
                    {isElectricVehicle(vehFormData.fuelType)
                      ? 'Eficiência Média (km/kWh) *'
                      : 'Autonomia Média (km/L) *'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    placeholder={isElectricVehicle(vehFormData.fuelType) ? 'Ex: 6.5' : 'Ex: 11.5'}
                    value={vehFormData.autonomyKmPerLiter}
                    onChange={(e) => setVehFormData({ ...vehFormData, autonomyKmPerLiter: e.target.value })}
                  />
                  <small className="helper-text">
                    {isElectricVehicle(vehFormData.fuelType)
                      ? 'Eficiência da bateria em km por kWh'
                      : 'Usado no cálculo de consumo das missões'}
                  </small>
                </div>
                <div className="form-group flex-1">
                  <label>
                    {isElectricVehicle(vehFormData.fuelType)
                      ? 'Capacidade da Bateria (kWh) *'
                      : 'Capacidade do Tanque (L) *'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    placeholder={isElectricVehicle(vehFormData.fuelType) ? 'Ex: 60' : 'Ex: 50'}
                    value={vehFormData.tankCapacity}
                    onChange={(e) => setVehFormData({ ...vehFormData, tankCapacity: e.target.value })}
                  />
                  <small className="helper-text">
                    {isElectricVehicle(vehFormData.fuelType)
                      ? 'Capacidade total utilizável da bateria (kWh)'
                      : 'Volume máximo do tanque de combustível'}
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>KM / Odômetro Atual</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="Ex: 45000"
                    value={vehFormData.currentKm}
                    onChange={(e) => setVehFormData({ ...vehFormData, currentKm: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>
                    {isElectricVehicle(vehFormData.fuelType)
                      ? 'Carga Atual da Bateria (%) *'
                      : 'Nível de Combustível Atual (%) *'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="Ex: 80"
                    value={vehFormData.currentFuelPercent}
                    onChange={(e) => setVehFormData({ ...vehFormData, currentFuelPercent: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status Operacional</label>
                <select
                  value={vehFormData.status}
                  onChange={(e) => setVehFormData({ ...vehFormData, status: e.target.value })}
                >
                  <option value="Disponível">Disponível</option>
                  <option value="Em Missão">Em Missão</option>
                  <option value="Manutenção">Manutenção / Oficina</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddVehicleModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Viatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Modal de Abastecimento / Recarga Elétrica                       */}
      {/* =============================================================== */}
      {showFuelModal && selectedVehicleForFuel && (() => {
        const isElec = isElectricVehicle(selectedVehicleForFuel);
        const isDiesel = (selectedVehicleForFuel.fuelType || '').toLowerCase() === 'diesel';
        const unit = isElec ? 'kWh' : 'L';
        const noun = isElec ? 'Bateria' : 'Tanque';
        const actionNoun = isElec ? 'Recarga' : 'Abastecimento';
        const priceL = getFuelPriceForVehicle(selectedVehicleForFuel, fuelSettings);
        const fuelTel = computeVehicleFuelTelemetry(selectedVehicleForFuel, missions, fuelSettings);
        const addedLiters = Math.max(0, parseFloat(fuelFormData.liters) || 0);
        const projectedLiters = parseFloat(
          Math.min(fuelTel.tankCapacity, fuelTel.currentLiters + addedLiters).toFixed(2)
        );
        const projectedPercent = parseFloat(
          ((projectedLiters / fuelTel.tankCapacity) * 100).toFixed(1)
        );
        const projectedRangeKm = parseFloat((projectedLiters * fuelTel.autonomy).toFixed(1));

        return (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-header">
                <h2>
                  {isElec ? '⚡' : isDiesel ? '🛢️' : '⛽'}{' '}
                  {isElec
                    ? 'Registrar Recarga Elétrica (Bateria)'
                    : `Registrar Abastecimento (${isDiesel ? 'Diesel' : 'Gasolina'})`}
                </h2>
                <button className="modal-close" onClick={() => setShowFuelModal(false)}>✕</button>
              </div>
              <div className="modal-veh-summary">
                <div>
                  <strong>{selectedVehicleForFuel.name}</strong> ({selectedVehicleForFuel.plate}) — {selectedVehicleForFuel.company}
                  <span
                    className={`veh-fuel-badge ${getFuelTypeBadgeClass(selectedVehicleForFuel)}`}
                    style={{ marginLeft: 8 }}
                  >
                    {isElec ? '⚡ Elétrico' : isDiesel ? '🛢️ Diesel' : '⛽ Gasolina'} • R$ {priceL.toFixed(2)}/{unit}
                  </span>
                </div>
                <span className="modal-veh-tank-pill">
                  {noun} atual: <strong>{fuelTel.currentLiters}{unit} / {fuelTel.tankCapacity}{unit} ({fuelTel.currentPercent}%)</strong>
                </span>
              </div>

              {/* Atalhos Rápidos de Abastecimento / Recarga */}
              <div className="fuel-quick-fill-bar">
                <span className="fqf-label">Preencher rápido:</span>
                {fuelTel.litersToFullTank > 0 && (
                  <button
                    type="button"
                    className="btn-fqf-chip chip-full"
                    onClick={() =>
                      setFuelFormData((prev) => ({
                        ...prev,
                        liters: fuelTel.litersToFullTank.toFixed(2),
                        amountSpent: fuelTel.costToFullTank.toFixed(2),
                      }))
                    }
                  >
                    {isElec ? '⚡ Bateria Completa' : '⛽ Completar Tanque'} (+{fuelTel.litersToFullTank}{unit} • R$ {fuelTel.costToFullTank.toFixed(2)})
                  </button>
                )}
                {[10, 20, 30].map((lit) => (
                  <button
                    key={lit}
                    type="button"
                    className="btn-fqf-chip"
                    onClick={() =>
                      setFuelFormData((prev) => ({
                        ...prev,
                        liters: String(lit),
                        amountSpent: (lit * priceL).toFixed(2),
                      }))
                    }
                  >
                    +{lit} {unit} (R$ {(lit * priceL).toFixed(2)})
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveFuel} className="modal-form">
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>{isElec ? 'Energia Recarregada (kWh) *' : 'Litros Abastecidos (L) *'}</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={`Ex: ${fuelTel.litersToFullTank || (isElec ? 30 : 25)}`}
                      value={fuelFormData.liters}
                      onChange={(e) => {
                        const litVal = e.target.value;
                        const numL = parseFloat(litVal);
                        setFuelFormData({
                          ...fuelFormData,
                          liters: litVal,
                          amountSpent: !isNaN(numL) && numL >= 0 ? (numL * priceL).toFixed(2) : '',
                        });
                      }}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>{isElec ? 'Valor Total da Recarga (R$) *' : 'Valor Total Colocado (R$) *'}</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Ex: 50.00"
                      value={fuelFormData.amountSpent}
                      onChange={(e) => {
                        const amount = e.target.value;
                        const numAmt = parseFloat(amount);
                        setFuelFormData({
                          ...fuelFormData,
                          amountSpent: amount,
                          liters: !isNaN(numAmt) && numAmt >= 0 ? (numAmt / priceL).toFixed(2) : '',
                        });
                      }}
                    />
                  </div>
                </div>

                {/* Simulação em Tempo Real do Novo Nível da Bateria / Tanque */}
                <div className="fuel-refill-preview-box">
                  <div className="frp-row">
                    <span>Antes: <strong>{fuelTel.currentLiters} {unit} ({fuelTel.currentPercent}%)</strong></span>
                    <span className="frp-arrow">➔ +{addedLiters.toFixed(2)} {unit} ➔</span>
                    <span className="frp-after">
                      Novo Nível: <strong>{projectedLiters} {unit} / {fuelTel.tankCapacity} {unit} ({projectedPercent}%)</strong>
                    </span>
                  </div>
                  <div className="fuel-progress-bg" style={{ marginTop: 6 }}>
                    <div
                      className={`fuel-progress-fill ${
                        projectedPercent <= 10 ? 'fill-danger reserve-pulse' : 'fill-good'
                      }`}
                      style={{ width: `${Math.min(100, projectedPercent)}%` }}
                    />
                  </div>
                  <small className="frp-sub">
                    Autonomia após {actionNoun.toLowerCase()}: <strong>~{projectedRangeKm} km</strong> ({isElec ? 'Tarifa' : 'Preço base'}: R$ {priceL.toFixed(2)}/{unit})
                  </small>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Data da {actionNoun}</label>
                    <input
                      type="date"
                      required
                      value={fuelFormData.date}
                      onChange={(e) => setFuelFormData({ ...fuelFormData, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>KM Atual do Odômetro</label>
                    <input
                      type="number"
                      placeholder="Ex: 42300"
                      value={fuelFormData.km}
                      onChange={(e) => setFuelFormData({ ...fuelFormData, km: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{isElec ? 'Ponto de Recarga / Eletroposto / Obs' : 'Posto / Observações'}</label>
                  <input
                    type="text"
                    placeholder={
                      isElec
                        ? 'Ex: Ponto de Recarga Sede, Wallbox 7kW, Eletroposto...'
                        : 'Ex: Posto Shell Av. Central, Gasolina Aditivada...'
                    }
                    value={fuelFormData.station}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, station: e.target.value })}
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowFuelModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    {isElec ? '⚡ Salvar e Recarregar Bateria' : 'Salvar e Acrescentar ao Tanque'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* =============================================================== */}
      {/* Modal de Histórico Completo da Viatura: Missões & Abastecimentos */}
      {/* =============================================================== */}
      {showHistoryModal && selectedVehicleForHistory && (() => {
        // Busca versão atualizada da viatura no array de vehicles
        const vehData = vehicles.find((v) => v.id === selectedVehicleForHistory.id) || selectedVehicleForHistory;
        const isElecHist = isElectricVehicle(vehData);
        const unitHist = isElecHist ? 'kWh' : 'L';
        const actionNounHist = isElecHist ? 'Recarga' : 'Abastecimento';
        const actionPluralHist = isElecHist ? 'Recargas' : 'Abastecimentos';
        const vMissions = getVehicleMissions(vehData);
        const logs = [...(vehData.fuelLogs || [])].reverse();
        const totalGasto = logs.reduce((acc, l) => acc + (l.amountSpent || 0), 0);
        const totalLitrosV = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
        const totalMissionsKm = vMissions.reduce((acc, m) => acc + getMissionTotalKm(m), 0);
        const latestM = vMissions[0];
        const lastDriverName = latestM ? getMissionVehicleDriver(latestM, vehData) : 'Nenhum';

        return (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div className="modal-box modal-box-large veh-history-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <div className="modal-icon-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <History size={20} />
                  </div>
                  <div>
                    <h2>Histórico da Viatura &amp; Deslocamentos</h2>
                    <p>Missões já realizadas, destinos, condutores responsáveis e registros de {isElecHist ? 'recargas elétricas' : 'combustível'}</p>
                  </div>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
              </div>

              {/* Faixa de Identificação da Viatura */}
              <div className="modal-veh-summary veh-history-summary-strip">
                <div className="vh-ident-left">
                  <Car size={18} className="vh-car-icon" />
                  <div>
                    <strong className="vh-name">{vehData.name}</strong>
                    <span className="vh-plate">{vehData.plate}</span>
                    <span className="vh-company">{vehData.company}</span>
                    <span className={`veh-fuel-badge ${getFuelTypeBadgeClass(vehData)}`} style={{ marginLeft: 6 }}>
                      {isElecHist ? '⚡ Elétrico' : (vehData.fuelType || '').toLowerCase() === 'diesel' ? '🛢️ Diesel' : '⛽ Gasolina'}
                    </span>
                  </div>
                </div>
                <div className="vh-ident-right">
                  <span className="vh-odometer-label">
                    Odômetro atual: <strong>{(vehData.currentKm || 0).toLocaleString('pt-BR')} km</strong>
                  </span>
                </div>
              </div>

              {/* Indicadores Rápidos (KPIs) */}
              <div className="history-kpi-row veh-kpi-quad">
                <div className="history-kpi">
                  <Route size={16} />
                  <div>
                    <span className="kpi-label">Missões Realizadas</span>
                    <strong>{vMissions.length} {vMissions.length === 1 ? 'missão' : 'missões'}</strong>
                  </div>
                </div>
                <div className="history-kpi">
                  <Navigation size={16} />
                  <div>
                    <span className="kpi-label">KM em Missões</span>
                    <strong>{totalMissionsKm.toFixed(1)} km</strong>
                  </div>
                </div>
                <div className="history-kpi">
                  <User size={16} />
                  <div>
                    <span className="kpi-label">Último Condutor</span>
                    <strong className="kpi-truncate" title={lastDriverName}>{lastDriverName}</strong>
                  </div>
                </div>
                <div className="history-kpi">
                  {isElecHist ? <Zap size={16} /> : <Fuel size={16} />}
                  <div>
                    <span className="kpi-label">{actionPluralHist}</span>
                    <strong>{logs.length} reg. (R$ {totalGasto.toFixed(2)})</strong>
                  </div>
                </div>
              </div>

              {/* Seletor de Abas no Modal */}
              <div className="veh-history-tabs">
                <button
                  type="button"
                  className={`veh-htab-btn ${historyModalTab === 'missions' ? 'active' : ''}`}
                  onClick={() => setHistoryModalTab('missions')}
                >
                  <Route size={15} />
                  <span>Missões &amp; Deslocamentos ({vMissions.length})</span>
                </button>
                <button
                  type="button"
                  className={`veh-htab-btn ${historyModalTab === 'fuel' ? 'active' : ''}`}
                  onClick={() => setHistoryModalTab('fuel')}
                >
                  {isElecHist ? <Zap size={15} /> : <Fuel size={15} />}
                  <span>Histórico de {actionPluralHist} ({logs.length})</span>
                </button>
              </div>

              <div className="modal-body veh-history-modal-body">
                {/* ABA 1: MISSÕES E DESLOCAMENTOS DA VIATURA */}
                {historyModalTab === 'missions' && (
                  <div className="veh-missions-history-tab">
                    {vMissions.length === 0 ? (
                      <div className="empty-list-notice" style={{ margin: '2rem auto', textAlign: 'center' }}>
                        <Route size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                        <p>Nenhuma missão registrada para esta viatura até o momento.</p>
                      </div>
                    ) : (
                      <div className="veh-missions-timeline">
                        {vMissions.map((m) => {
                          const mCode = getMissionCode(m, missions);
                          const driver = getMissionVehicleDriver(m, vehData);
                          const teamNames = getMissionTeamNames(m);
                          const totalKm = getMissionTotalKm(m);
                          const statusSlug = (m.missionStatus || 'Agendada')
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/\s+/g, '-');

                          return (
                            <div key={m.id} className={`veh-mission-history-item status-border-${statusSlug}`}>
                              {/* Topo do Registro */}
                              <div className="vmh-header">
                                <div className="vmh-header-left">
                                  <span className="mission-code-pill">#{mCode}</span>
                                  <span className={`status-pill-veh pill-veh-${statusSlug === 'concluida' || statusSlug === 'finalizado' ? 'disponivel' : statusSlug === 'em-execucao' || statusSlug === 'em-preparo' ? 'uso' : 'preparo'}`}>
                                    {m.missionStatus || 'Agendada'}
                                  </span>
                                </div>
                                <div className="vmh-datetime">
                                  <Calendar size={12} />
                                  <span>{formatDateBR(m.date)}</span>
                                  <span className="vmh-sep">•</span>
                                  <Clock size={12} />
                                  <span>Saída: {m.departureTime || '--:--'}</span>
                                  {m.returnTimeEstimated && (
                                    <>
                                      <span className="vmh-sep">→</span>
                                      <span>Retorno: {m.returnTimeEstimated}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Pauta / Descrição */}
                              <div className="vmh-body">
                                <strong className="vmh-title">{m.description}</strong>
                                {m.notes && <p className="vmh-notes">{m.notes}</p>}

                                {/* Grade de Detalhes da Missão */}
                                <div className="vmh-details-grid">
                                  {/* Destino e Local */}
                                  <div className="vmh-detail-card">
                                    <div className="vmh-dc-label">
                                      <MapPin size={13} className="icon-dest" />
                                      <span>Destino / Para onde foi</span>
                                    </div>
                                    <strong className="vmh-dc-value">{m.locationName || 'Local não informado'}</strong>
                                    {m.address && <span className="vmh-dc-sub">{m.address}</span>}
                                    {totalKm > 0 && (
                                      <span className="vmh-km-tag">
                                        🛣️ <strong>{totalKm} km</strong> ida e volta ({m.distanceKm || 0} km/trecho)
                                      </span>
                                    )}
                                  </div>

                                  {/* Motorista Condutor */}
                                  <div className="vmh-detail-card">
                                    <div className="vmh-dc-label">
                                      <span className="icon-wheel">🛞</span>
                                      <span>Motorista Responsável</span>
                                    </div>
                                    <strong className="vmh-dc-value highlight-driver">{driver}</strong>
                                    <span className="vmh-dc-sub">Condutor da Viatura</span>
                                  </div>

                                  {/* Equipe Escalada / Responsáveis */}
                                  <div className="vmh-detail-card">
                                    <div className="vmh-dc-label">
                                      <Users size={13} className="icon-team" />
                                      <span>Equipe / Responsáveis</span>
                                    </div>
                                    <strong className="vmh-dc-value">{teamNames}</strong>
                                    <span className="vmh-dc-sub">Profissionais escalados</span>
                                  </div>

                                  {/* Consumo Estimado */}
                                  {m.estimatedFuelLiters > 0 && (
                                    <div className="vmh-detail-card">
                                      <div className="vmh-dc-label">
                                        {isElecHist ? <Zap size={13} className="icon-fuel text-green" /> : <Fuel size={13} className="icon-fuel" />}
                                        <span>Consumo Estimado</span>
                                      </div>
                                      <strong className="vmh-dc-value">-{m.estimatedFuelLiters} {unitHist}</strong>
                                      <span className="vmh-dc-sub">
                                        {m.estimatedFuelCost > 0 ? `R$ ${Number(m.estimatedFuelCost).toFixed(2)}` : 'Estimativa calculada'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 2: ABASTECIMENTOS / RECARGAS DA VIATURA */}
                {historyModalTab === 'fuel' && (
                  <div className="veh-fuel-history-tab">
                    {logs.length === 0 ? (
                      <div className="empty-list-notice" style={{ margin: '2rem auto', textAlign: 'center' }}>
                        {isElecHist ? <Zap size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} /> : <Fuel size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />}
                        <p>Nenhum {actionNounHist.toLowerCase()} registrado para esta viatura.</p>
                      </div>
                    ) : (
                      <div className="fuel-history-table-wrapper">
                        <table className="fuel-history-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Valor (R$)</th>
                              <th>{isElecHist ? 'Energia (kWh)' : 'Litros'}</th>
                              <th>KM Odôm.</th>
                              <th>{isElecHist ? 'Ponto de Recarga / Obs' : 'Posto / Obs'}</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => (
                              <tr key={log.id}>
                                <td>
                                  <Calendar size={12} style={{ marginRight: 4 }} />
                                  {log.date}
                                </td>
                                <td className="td-value">R$ {Number(log.amountSpent || 0).toFixed(2)}</td>
                                <td>{log.liters} {unitHist}</td>
                                <td>{log.km > 0 ? `${log.km.toLocaleString('pt-BR')} km` : '—'}</td>
                                <td className="td-station">{log.station || '—'}</td>
                                <td>
                                  {onDeleteFuelLog && canDeleteFuelLog && (
                                    <button
                                      type="button"
                                      className="btn-del-log"
                                      onClick={() => handleDeleteFuelLog(vehData.id, log.id)}
                                      title="Excluir este registro (Apenas Admin)"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {canFuelVehicle && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setShowHistoryModal(false);
                      handleOpenFuelModal(vehData);
                    }}
                  >
                    <Fuel size={14} /> Novo Abastecimento
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setShowHistoryModal(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
