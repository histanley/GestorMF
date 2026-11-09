import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  MapPin,
  Fuel,
  RotateCcw,
  Download,
  Upload,
  LocateFixed,
  Search,
  Building2,
  Users,
  Palette,
  Tag,
  Car,
  ListChecks,
  ImagePlus,
  X,
  Plus,
  Edit2,
  Trash2,
  Save,
  Check,
  AlertTriangle,
  Globe,
  Phone,
  Mail,
  FileText,
  ChevronRight,
  Sliders,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { apiGetAuditLogs, apiDownloadBackup, apiRestoreBackup } from '../utils/api';
import { searchAddressNominatim } from '../utils/geo';
import { confirmDialog, alertDialog } from '../utils/dialog';

// ======================================================
// Sub-componente: Seção de título de formulário
// ======================================================
function SectionTitle({ icon: Icon, label }) {
  return (
    <div className="settings-section-title">
      {Icon && <Icon size={15} />}
      <span>{label}</span>
    </div>
  );
}

// ======================================================
// Sub-componente: Lista editável genérica (add/rename/delete)
// ======================================================
function EditableList({ items = [], onAdd, onRename, onDelete, placeholder = 'Nova entrada...' }) {
  const [newItem, setNewItem] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingVal, setEditingVal] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewItem('');
  };

  const handleSaveEdit = (original) => {
    const trimmed = editingVal.trim();
    if (trimmed && trimmed !== original) onRename(original, trimmed);
    setEditingIdx(null);
  };

  return (
    <div className="editable-list">
      <div className="editable-list-add-row">
        <input
          className="editable-list-input"
          type="text"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
        <button className="btn-primary btn-sm" onClick={handleAdd} disabled={!newItem.trim()}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <div className="editable-list-items">
        {items.length === 0 && (
          <p className="editable-list-empty">Nenhum item cadastrado ainda.</p>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="editable-list-item">
            {editingIdx === idx ? (
              <>
                <input
                  className="editable-list-edit-input"
                  type="text"
                  value={editingVal}
                  autoFocus
                  onChange={(e) => setEditingVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(item);
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                />
                <button className="btn-icon-action text-green" onClick={() => handleSaveEdit(item)} title="Salvar">
                  <Save size={13} />
                </button>
                <button className="btn-icon-action" onClick={() => setEditingIdx(null)} title="Cancelar">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <span className="editable-list-item-text">{item}</span>
                <div className="editable-list-item-actions">
                  <button className="btn-icon-action" onClick={() => { setEditingIdx(idx); setEditingVal(item); }} title="Renomear">
                    <Edit2 size={13} />
                  </button>
                  <button className="btn-icon-action text-danger" onClick={() => onDelete(item)} title="Excluir">
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================================================
// Componente Principal: Painel de Configurações
// ======================================================
export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetDemoData,
  onClearMissions,
  allDataToExport,
  onImportData,
  // Funções de colaboradores
  roles = [],
  onAddRole,
  onUpdateRole,
  onDeleteRole,
}) {
  // ---- Aba ativa ----
  const [activeTab, setActiveTab] = useState('empresa');

  // ---- Dados da empresa ----
  const [formData, setFormData] = useState({
    companyName: settings?.companyName || 'MegaFilmes & Mega Print',
    companyName2: settings?.companyName2 || 'Mega Print',
    tagline: settings?.tagline || 'Sistema de Agendas, Equipes e Viaturas',
    phone: settings?.phone || '(95) 99999-9999',
    email: settings?.email || 'contato@megafilmes.com.br',
    website: settings?.website || '',
    cnpj: settings?.cnpj || '',
    // Combustível
    fuelPricePerLiter: settings?.fuelPricePerLiter || 6.45,
    gasolinePricePerLiter: settings?.gasolinePricePerLiter ?? (settings?.fuelPricePerLiter || 6.45),
    dieselPricePerLiter: settings?.dieselPricePerLiter ?? 6.89,
    electricPricePerKwh: settings?.electricPricePerKwh ?? 0.95,
    defaultAutonomy: settings?.defaultAutonomy || 10,
    // Sede MegaFilmes & Mega Print
    baseName: settings?.baseLocation?.name || 'Sede MegaFilmes & Mega Print',
    baseAddress: settings?.baseLocation?.address || 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
    baseLat: settings?.baseLocation?.lat ?? 2.8293822995808733,
    baseLon: settings?.baseLocation?.lon ?? -60.730887232802566,
    // Visual
    accentColor: settings?.accentColor || '#f59e0b',
    accentColorSecondary: settings?.accentColorSecondary || '#06b6d4',
    logoUrl: settings?.logoUrl || '',
  });

  // Atualiza os campos sempre que as configurações do banco forem carregadas ou a modal for aberta
  useEffect(() => {
    if (isOpen && settings) {
      setFormData({
        companyName: settings.companyName || 'MegaFilmes & Mega Print',
        companyName2: settings.companyName2 || 'Mega Print',
        tagline: settings.tagline || 'Sistema de Agendas, Equipes e Viaturas',
        phone: settings.phone || '(95) 99999-9999',
        email: settings.email || 'contato@megafilmes.com.br',
        website: settings.website || '',
        cnpj: settings.cnpj || '',
        fuelPricePerLiter: settings.fuelPricePerLiter || 6.45,
        gasolinePricePerLiter: settings.gasolinePricePerLiter ?? (settings.fuelPricePerLiter || 6.45),
        dieselPricePerLiter: settings.dieselPricePerLiter ?? 6.89,
        electricPricePerKwh: settings.electricPricePerKwh ?? 0.95,
        defaultAutonomy: settings.defaultAutonomy || 10,
        baseName: settings.baseLocation?.name || 'Sede MegaFilmes & Mega Print',
        baseAddress: settings.baseLocation?.address || 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
        baseLat: settings.baseLocation?.lat ?? 2.8293822995808733,
        baseLon: settings.baseLocation?.lon ?? -60.730887232802566,
        accentColor: settings.accentColor || '#f59e0b',
        accentColorSecondary: settings.accentColorSecondary || '#06b6d4',
        logoUrl: settings.logoUrl || '',
      });
    }
  }, [isOpen, settings]);

  // ---- Status de missão personalizáveis ----
  const [missionStatuses, setMissionStatuses] = useState(
    settings?.missionStatuses || ['Agendada', 'Saiu', 'Em Execução', 'Concluída', 'Cancelada']
  );

  // ---- Status de edição personalizáveis ----
  const [editionStatuses, setEditionStatuses] = useState(
    settings?.editionStatuses || ['Pendente', 'Em Edição', 'Revisando', 'Entregue', 'Não se aplica']
  );

  // ---- Tipos de veículo personalizáveis ----
  const [vehicleTypes, setVehicleTypes] = useState(
    settings?.vehicleTypes || [
      'Hatch / Produção Leve',
      'Picape / Carga',
      'Furgão / Entregas e Fachadas',
      'Minivan / Equipe Completa',
      'SUV / Terreno',
      'Van / Transporte',
    ]
  );

  // ---- Empresas personalizáveis ----
  const [companies, setCompanies] = useState(
    settings?.companies || ['MegaFilmes', 'Mega Print']
  );

  // ---- Feedback de busca ----
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const logoInputRef = useRef(null);

  // ---- GPS ----
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alertDialog({ title: 'GPS Indisponível', message: 'Geolocalização não suportada no seu navegador.', variant: 'warning' });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          baseLat: parseFloat(pos.coords.latitude.toFixed(6)),
          baseLon: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        alertDialog({ title: 'Erro de GPS', message: 'Não foi possível obter coordenadas: ' + err.message, variant: 'warning' });
      },
      { timeout: 10000 }
    );
  };

  // ---- Busca de endereço ----
  const handleSearchAddress = async () => {
    if (!formData.baseAddress) return;
    setIsSearching(true);
    const res = await searchAddressNominatim(formData.baseAddress);
    setSearchResults(res);
    setIsSearching(false);
  };

  const handleApplyAddress = (item) => {
    setFormData((prev) => ({ ...prev, baseAddress: item.name, baseLat: item.lat, baseLon: item.lon }));
    setSearchResults([]);
  };

  // ---- Upload de logotipo ----
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      await alertDialog({
        title: 'Tamanho da Imagem',
        message: 'Logotipo muito grande. Use uma imagem menor que 2 MB.',
        variant: 'warning',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setFormData((prev) => ({ ...prev, logoUrl: ev.target.result }));
    reader.readAsDataURL(file);
  };

  // ---- Salvar todas as configurações ----
  const handleSave = () => {
    onSaveSettings({
      companyName: formData.companyName,
      companyName2: formData.companyName2,
      tagline: formData.tagline,
      phone: formData.phone,
      email: formData.email,
      website: formData.website,
      cnpj: formData.cnpj,
      fuelPricePerLiter: parseFloat(formData.gasolinePricePerLiter) || parseFloat(formData.fuelPricePerLiter) || 6.45,
      gasolinePricePerLiter: parseFloat(formData.gasolinePricePerLiter) || 6.45,
      dieselPricePerLiter: parseFloat(formData.dieselPricePerLiter) || 6.89,
      electricPricePerKwh: parseFloat(formData.electricPricePerKwh) || 0.95,
      defaultAutonomy: parseFloat(formData.defaultAutonomy) || 12,
      accentColor: formData.accentColor,
      accentColorSecondary: formData.accentColorSecondary,
      logoUrl: formData.logoUrl,
      missionStatuses,
      editionStatuses,
      vehicleTypes,
      companies,
      baseLocation: {
        name: formData.baseName,
        address: formData.baseAddress,
        lat: parseFloat(formData.baseLat),
        lon: parseFloat(formData.baseLon),
      },
    });
    setSaveSuccess(true);
    setTimeout(() => { setSaveSuccess(false); onClose(); }, 900);
  };

  // ---- Exportar JSON ----
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(allDataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestormf_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Importar JSON ----
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.vehicles && parsed.missions) {
          onImportData(parsed);
          await alertDialog({
            title: 'Backup Restaurado',
            message: 'Backup restaurado com sucesso no GestorMF!',
            variant: 'success',
          });
          onClose();
        } else {
          await alertDialog({
            title: 'Arquivo Inválido',
            message: 'O arquivo JSON selecionado não é um backup compatível com o GestorMF.',
            variant: 'danger',
          });
        }
      } catch (err) {
        await alertDialog({
          title: 'Erro no Arquivo',
          message: 'Erro ao processar arquivo: ' + err.message,
          variant: 'danger',
        });
      }
    };
    reader.readAsText(file);
  };

  // ---- Definição das abas ----
  const TABS = [
    { id: 'empresa',    icon: Building2,   label: 'Empresa' },
    { id: 'sede',       icon: MapPin,       label: 'Sede / Base' },
    { id: 'combustivel',icon: Fuel,         label: 'Combustível' },
    { id: 'visual',     icon: Palette,      label: 'Visual & Logo' },
    { id: 'funcoes',    icon: Tag,          label: 'Funções' },
    { id: 'status',     icon: ListChecks,   label: 'Status & Tipos' },
    { id: 'backup',     icon: Download,     label: 'Backup & Dados' },
    { id: 'auditoria',  icon: ShieldCheck,  label: 'Auditoria' },
  ];

  // ---- Trilha de Auditoria (Audit Logs) ----
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModuleFilter, setAuditModuleFilter] = useState('');

  const loadAuditLogs = async (mod = auditModuleFilter) => {
    setAuditLoading(true);
    try {
      const res = await apiGetAuditLogs(mod, '', 100);
      if (res.success && Array.isArray(res.logs)) {
        setAuditLogs(res.logs);
      }
    } catch (e) {
      console.warn('Erro ao carregar logs de auditoria:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'auditoria') {
      loadAuditLogs();
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay settings-overlay">
      <div className="modal-box settings-modal-box">
        {/* ---- Cabeçalho ---- */}
        <div className="settings-modal-header">
          <div className="settings-header-left">
            <div className="settings-icon-badge">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="settings-title">Configurações do Sistema</h2>
              <p className="settings-subtitle">Personalize tudo: empresa, visual, funções, status e dados</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-layout">
          {/* ---- Barra Lateral de Abas ---- */}
          <nav className="settings-sidebar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
                {activeTab === tab.id && <ChevronRight size={14} className="tab-arrow" />}
              </button>
            ))}
          </nav>

          {/* ---- Conteúdo da Aba ---- */}
          <div className="settings-content">

            {/* ========== ABA: EMPRESA ========== */}
            {activeTab === 'empresa' && (
              <div className="settings-panel">
                <SectionTitle icon={Building2} label="Dados da Empresa" />

                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Nome da Empresa Principal</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Ex: MegaFilmes"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Empresa Secundária</label>
                    <input
                      type="text"
                      value={formData.companyName2}
                      onChange={(e) => setFormData({ ...formData, companyName2: e.target.value })}
                      placeholder="Ex: Mega Print"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Slogan / Tagline do Sistema</label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="Ex: Sistema de Agendas, Equipes e Viaturas"
                  />
                  <small className="helper-text">Aparece abaixo do nome no cabeçalho do sistema</small>
                </div>

                <SectionTitle icon={Phone} label="Contato" />

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Telefone / WhatsApp</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(95) 99999-9999"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@megafilmes.com.br"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Site / Redes Sociais</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://megafilmes.com.br"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>CNPJ</label>
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                </div>

                <SectionTitle icon={Building2} label="Empresas Cadastradas no Sistema" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  As empresas abaixo aparecem nos menus de seleção de viaturas e colaboradores.
                </p>
                <EditableList
                  items={companies}
                  placeholder="Nova empresa... (Ex: Mega Eventos)"
                  onAdd={(v) => setCompanies((p) => [...p, v])}
                  onRename={(old, nw) => setCompanies((p) => p.map((c) => (c === old ? nw : c)))}
                  onDelete={async (v) => {
                    if (companies.length <= 1) {
                      await alertDialog({
                        title: 'Limite Mínimo',
                        message: 'Deve haver pelo menos uma empresa cadastrada no sistema.',
                        variant: 'warning',
                      });
                      return;
                    }
                    const confirmed = await confirmDialog({
                      title: 'Excluir Empresa',
                      message: `Deseja remover a empresa "${v}"?`,
                      confirmText: 'Excluir Empresa',
                      variant: 'danger',
                    });
                    if (confirmed) {
                      setCompanies((p) => p.filter((c) => c !== v));
                    }
                  }}
                />
              </div>
            )}

            {/* ========== ABA: SEDE ========== */}
            {activeTab === 'sede' && (
              <div className="settings-panel">
                <SectionTitle icon={MapPin} label="Sede / Base de Saída" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Este endereço é o ponto de partida padrão para cálculo de rotas e distâncias de todas as missões.
                </p>

                <div className="form-group">
                  <label>Nome da Base</label>
                  <input
                    type="text"
                    value={formData.baseName}
                    onChange={(e) => setFormData({ ...formData, baseName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Endereço Completo</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="Rua, número, bairro, cidade..."
                      value={formData.baseAddress}
                      onChange={(e) => setFormData({ ...formData, baseAddress: e.target.value })}
                    />
                    <button type="button" className="btn-search-coords" onClick={handleSearchAddress} disabled={isSearching}>
                      <Search size={14} /> {isSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results-dropdown">
                    {searchResults.map((item, i) => (
                      <div key={i} className="search-result-item" onClick={() => handleApplyAddress(item)}>
                        <MapPin size={13} className="pin-accent" />
                        <span className="res-text">{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Latitude</label>
                    <input
                      type="number" step="0.000001"
                      value={formData.baseLat}
                      onChange={(e) => setFormData({ ...formData, baseLat: e.target.value })}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Longitude</label>
                    <input
                      type="number" step="0.000001"
                      value={formData.baseLon}
                      onChange={(e) => setFormData({ ...formData, baseLon: e.target.value })}
                    />
                  </div>
                </div>

                <button type="button" className="btn-gps-detect" onClick={handleDetectGPS} disabled={gpsLoading}>
                  <LocateFixed size={16} />
                  {gpsLoading ? 'Detectando GPS...' : 'Usar Minha Localização Atual como Sede'}
                </button>

                <div className="settings-info-box">
                  <AlertTriangle size={14} />
                  <span>
                    Alterar as coordenadas da sede afeta todos os cálculos de rota e custo de combustível de missões novas e existentes.
                  </span>
                </div>
              </div>
            )}

            {/* ========== ABA: COMBUSTÍVEL ========== */}
            {activeTab === 'combustivel' && (
              <div className="settings-panel">
                <SectionTitle icon={Fuel} label="Configurações de Combustível" />

                <div className="form-row">
                  <div className="form-group">
                    <label>⛽ Preço da Gasolina (R$/L)</label>
                    <input
                      type="number" step="0.01" min="1"
                      value={formData.gasolinePricePerLiter}
                      onChange={(e) => setFormData({ ...formData, gasolinePricePerLiter: e.target.value })}
                    />
                    <small className="helper-text">
                      Referência Boa Vista - RR: R$ 6.45/L.
                    </small>
                  </div>
                  <div className="form-group">
                    <label>🛢️ Preço do Diesel (R$/L)</label>
                    <input
                      type="number" step="0.01" min="1"
                      value={formData.dieselPricePerLiter}
                      onChange={(e) => setFormData({ ...formData, dieselPricePerLiter: e.target.value })}
                    />
                    <small className="helper-text">
                      Referência Boa Vista - RR: R$ 6.89/L.
                    </small>
                  </div>
                  <div className="form-group">
                    <label>⚡ Tarifa de Energia / kWh (R$/kWh)</label>
                    <input
                      type="number" step="0.01" min="0.1"
                      value={formData.electricPricePerKwh}
                      onChange={(e) => setFormData({ ...formData, electricPricePerKwh: e.target.value })}
                    />
                    <small className="helper-text">
                      Referência Roraima Energia: R$ 0.95/kWh.
                    </small>
                  </div>
                </div>

                <div className="fuel-preview-section">
                  <div className="fuel-preview-block">
                    <div className="fuel-preview-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: 8 }}>
                      ⛽ Simulação Gasolina (R$ {parseFloat(formData.gasolinePricePerLiter || 6.45).toFixed(2)}/L)
                    </div>
                    <div className="fuel-price-preview">
                      <div className="preview-item">
                        <span>50 km a {formData.defaultAutonomy || 12} km/L</span>
                        <strong>R$ {((50 / (parseFloat(formData.defaultAutonomy) || 12)) * parseFloat(formData.gasolinePricePerLiter || 6.45)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>100 km a {formData.defaultAutonomy || 12} km/L</span>
                        <strong>R$ {((100 / (parseFloat(formData.defaultAutonomy) || 12)) * parseFloat(formData.gasolinePricePerLiter || 6.45)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>Tanque 50L</span>
                        <strong>R$ {(50 * parseFloat(formData.gasolinePricePerLiter || 6.45)).toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="fuel-preview-block" style={{ marginTop: 12 }}>
                    <div className="fuel-preview-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: 8 }}>
                      🛢️ Simulação Diesel (R$ {parseFloat(formData.dieselPricePerLiter || 6.89).toFixed(2)}/L)
                    </div>
                    <div className="fuel-price-preview">
                      <div className="preview-item">
                        <span>50 km a {formData.defaultAutonomy || 12} km/L</span>
                        <strong>R$ {((50 / (parseFloat(formData.defaultAutonomy) || 12)) * parseFloat(formData.dieselPricePerLiter || 6.89)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>100 km a {formData.defaultAutonomy || 12} km/L</span>
                        <strong>R$ {((100 / (parseFloat(formData.defaultAutonomy) || 12)) * parseFloat(formData.dieselPricePerLiter || 6.89)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>Tanque 50L</span>
                        <strong>R$ {(50 * parseFloat(formData.dieselPricePerLiter || 6.89)).toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="fuel-preview-block" style={{ marginTop: 12 }}>
                    <div className="fuel-preview-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-green, #10b981)', marginBottom: 8 }}>
                      ⚡ Simulação Carro Elétrico (R$ {parseFloat(formData.electricPricePerKwh || 0.95).toFixed(2)}/kWh)
                    </div>
                    <div className="fuel-price-preview">
                      <div className="preview-item">
                        <span>50 km a 6.5 km/kWh</span>
                        <strong>R$ {((50 / 6.5) * parseFloat(formData.electricPricePerKwh || 0.95)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>100 km a 6.5 km/kWh</span>
                        <strong>R$ {((100 / 6.5) * parseFloat(formData.electricPricePerKwh || 0.95)).toFixed(2)}</strong>
                      </div>
                      <div className="preview-item">
                        <span>Bateria 60 kWh</span>
                        <strong>R$ {(60 * parseFloat(formData.electricPricePerKwh || 0.95)).toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <SectionTitle icon={Car} label="Autonomia Padrão para Novas Viaturas" />
                <div className="form-group">
                  <label>Autonomia Padrão (km/L)</label>
                  <input
                    type="number" step="0.1" min="1"
                    value={formData.defaultAutonomy}
                    onChange={(e) => setFormData({ ...formData, defaultAutonomy: e.target.value })}
                  />
                  <small className="helper-text">
                    Valor pré-preenchido ao cadastrar uma nova viatura. Pode ser ajustado por veículo individualmente.
                  </small>
                </div>
              </div>
            )}

            {/* ========== ABA: VISUAL & LOGO ========== */}
            {activeTab === 'visual' && (
              <div className="settings-panel">
                <SectionTitle icon={ImagePlus} label="Logotipo da Empresa" />

                <div className="logo-upload-zone" onClick={() => logoInputRef.current?.click()}>
                  {formData.logoUrl ? (
                    <div className="logo-preview-wrapper">
                      <img src={formData.logoUrl} alt="Logotipo" className="logo-preview-img" />
                      <button
                        className="logo-remove-btn"
                        onClick={(e) => { e.stopPropagation(); setFormData((p) => ({ ...p, logoUrl: '' })); }}
                        title="Remover logotipo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="logo-upload-placeholder">
                      <ImagePlus size={32} />
                      <span>Clique para enviar logotipo</span>
                      <small>PNG, JPG, SVG — máx 2 MB</small>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                </div>

                <SectionTitle icon={Palette} label="Cores de Destaque do Sistema" />

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Cor Principal (Dourado)</label>
                    <div className="color-input-row">
                      <input
                        type="color"
                        className="color-picker"
                        value={formData.accentColor}
                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="color-hex-input"
                        value={formData.accentColor}
                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                        maxLength={7}
                        placeholder="#f59e0b"
                      />
                    </div>
                    <small className="helper-text">Usado em títulos, botões e destaques principais.</small>
                  </div>

                  <div className="form-group flex-1">
                    <label>Cor Secundária (Ciano)</label>
                    <div className="color-input-row">
                      <input
                        type="color"
                        className="color-picker"
                        value={formData.accentColorSecondary}
                        onChange={(e) => setFormData({ ...formData, accentColorSecondary: e.target.value })}
                      />
                      <input
                        type="text"
                        className="color-hex-input"
                        value={formData.accentColorSecondary}
                        onChange={(e) => setFormData({ ...formData, accentColorSecondary: e.target.value })}
                        maxLength={7}
                        placeholder="#06b6d4"
                      />
                    </div>
                    <small className="helper-text">Usado em mapas, missões ativas e badges de status.</small>
                  </div>
                </div>

                {/* Preview das cores escolhidas */}
                <div className="color-preview-bar" style={{
                  background: `linear-gradient(135deg, ${formData.accentColor} 0%, ${formData.accentColorSecondary} 100%)`,
                }}>
                  <span>Prévia das cores selecionadas</span>
                </div>

                <div className="settings-info-box">
                  <Palette size={14} />
                  <span>
                    As cores são salvas nas configurações. O design do sistema usa variáveis CSS — algumas
                    mudanças visuais profundas podem exigir reload da página.
                  </span>
                </div>
              </div>
            )}

            {/* ========== ABA: FUNÇÕES ========== */}
            {activeTab === 'funcoes' && (
              <div className="settings-panel">
                <SectionTitle icon={Tag} label="Funções / Cargos dos Colaboradores" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  As funções abaixo ficam disponíveis no cadastro de membros da equipe.
                  Ao renomear uma função, todos os colaboradores com ela são atualizados automaticamente.
                </p>
                <EditableList
                  items={roles}
                  placeholder="Nova função... (Ex: Colorista, Produtor Executivo)"
                  onAdd={onAddRole}
                  onRename={onUpdateRole}
                  onDelete={async (role) => {
                    const confirmed = await confirmDialog({
                      title: 'Excluir Função',
                      message: `Tem certeza que deseja excluir a função "${role}"?`,
                      confirmText: 'Excluir Função',
                      variant: 'danger',
                    });
                    if (confirmed) onDeleteRole(role);
                  }}
                />
              </div>
            )}

            {/* ========== ABA: STATUS & TIPOS ========== */}
            {activeTab === 'status' && (
              <div className="settings-panel">
                <SectionTitle icon={ListChecks} label="Status de Missão" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Aparecem na tabela de serviço e nos cards do mapa para indicar o andamento de cada serviço.
                </p>
                <EditableList
                  items={missionStatuses}
                  placeholder="Novo status... (Ex: Em Trânsito, Aguardando Cliente)"
                  onAdd={(v) => setMissionStatuses((p) => [...p, v])}
                  onRename={(old, nw) => setMissionStatuses((p) => p.map((s) => (s === old ? nw : s)))}
                  onDelete={async (v) => {
                    if (missionStatuses.length <= 2) {
                      await alertDialog({
                        title: 'Limite Mínimo',
                        message: 'Deve haver pelo menos 2 status de missão cadastrados.',
                        variant: 'warning',
                      });
                      return;
                    }
                    setMissionStatuses((p) => p.filter((s) => s !== v));
                  }}
                />

                <SectionTitle icon={FileText} label="Status de Edição / Pós-Produção" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Usado na coluna "Edição" da tabela de serviço para acompanhar o status do material gravado.
                </p>
                <EditableList
                  items={editionStatuses}
                  placeholder="Novo status... (Ex: Exportando, Aprovado pelo Cliente)"
                  onAdd={(v) => setEditionStatuses((p) => [...p, v])}
                  onRename={(old, nw) => setEditionStatuses((p) => p.map((s) => (s === old ? nw : s)))}
                  onDelete={async (v) => {
                    if (editionStatuses.length <= 2) {
                      await alertDialog({
                        title: 'Limite Mínimo',
                        message: 'Deve haver pelo menos 2 status de edição cadastrados.',
                        variant: 'warning',
                      });
                      return;
                    }
                    setEditionStatuses((p) => p.filter((s) => s !== v));
                  }}
                />

                <SectionTitle icon={Car} label="Tipos / Categorias de Veículos" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Categorias disponíveis no cadastro de novas viaturas da frota.
                </p>
                <EditableList
                  items={vehicleTypes}
                  placeholder="Novo tipo... (Ex: Caminhonete, Moto Mensageiro)"
                  onAdd={(v) => setVehicleTypes((p) => [...p, v])}
                  onRename={(old, nw) => setVehicleTypes((p) => p.map((t) => (t === old ? nw : t)))}
                  onDelete={async (v) => {
                    if (vehicleTypes.length <= 1) {
                      await alertDialog({
                        title: 'Limite Mínimo',
                        message: 'Deve haver pelo menos 1 categoria de viatura.',
                        variant: 'warning',
                      });
                      return;
                    }
                    setVehicleTypes((p) => p.filter((t) => t !== v));
                  }}
                />
              </div>
            )}

            {/* ========== ABA: BACKUP & DADOS ========== */}
            {activeTab === 'backup' && (
              <div className="settings-panel">
                <SectionTitle icon={Download} label="Exportar Dados" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Salve um backup completo de todas as configurações, missões, viaturas e membros.
                </p>

                <div className="backup-info-grid">
                  <div className="backup-count-item">
                    <span className="backup-count">{allDataToExport?.missions?.length || 0}</span>
                    <span>Missões</span>
                  </div>
                  <div className="backup-count-item">
                    <span className="backup-count">{allDataToExport?.vehicles?.length || 0}</span>
                    <span>Viaturas</span>
                  </div>
                  <div className="backup-count-item">
                    <span className="backup-count">{allDataToExport?.members?.length || 0}</span>
                    <span>Colaboradores</span>
                  </div>
                </div>

                <button className="btn-backup-export" onClick={handleExportJSON}>
                  <Download size={16} /> Baixar Backup Completo (JSON)
                </button>

                <button
                  type="button"
                  className="btn-backup-export"
                  style={{ marginTop: '8px', background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.4)', color: 'var(--accent-cyan)' }}
                  onClick={async () => {
                    try {
                      await apiDownloadBackup();
                    } catch (e) {
                      alertDialog({
                        title: 'Erro no Download',
                        message: e.message || 'Falha ao baixar backup do banco de dados.',
                        variant: 'danger',
                      });
                    }
                  }}
                >
                  <Download size={16} /> Baixar Snapshot Oficial do Banco de Dados (HostGator MySQL)
                </button>

                <SectionTitle icon={Upload} label="Restaurar Backup" />
                <p style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.75rem' }}>
                  Importe um arquivo JSON gerado pelo GestorMF para restaurar todos os dados.
                </p>
                <label className="btn-backup-import">
                  <Upload size={16} /> Importar Arquivo de Backup
                  <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                </label>

                <SectionTitle icon={Trash2} label="Limpeza para Produção (Zerar Missões)" />
                <div className="settings-info-box" style={{ marginBottom: '12px', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'inherit' }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '3px' }}>Pronto para iniciar com dados reais?</strong>
                    <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                      Apaga todas as missões e rotas de teste cadastradas no sistema, mantendo suas viaturas, equipe e configurações da sede intactas.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-outline-action"
                  style={{ width: '100%', justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', marginBottom: '24px' }}
                  onClick={async () => {
                    const confirmed = await confirmDialog({
                      title: 'Limpar Missões de Teste',
                      message: 'Deseja realmente apagar todas as missões de teste?',
                      description: 'Suas viaturas, equipe e configurações mestres serão mantidas intactas.',
                      confirmText: 'Apagar Missões de Teste',
                      cancelText: 'Cancelar',
                      variant: 'warning',
                    });
                    if (confirmed) {
                      if (onClearMissions) onClearMissions();
                      await alertDialog({
                        title: 'Sistema Pronto',
                        message: 'Missões de teste removidas com sucesso! O sistema está pronto para a operação real.',
                        variant: 'success',
                      });
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={15} /> Limpar Todas as Missões de Teste
                </button>

                <SectionTitle icon={RotateCcw} label="Redefinir Dados do Sistema" />
                <div className="settings-danger-zone">
                  <div className="danger-zone-text">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>Zona de Perigo</strong>
                      <p>Esta ação redefine todas as configurações e limpa o armazenamento local do navegador.</p>
                    </div>
                  </div>
                  <button
                    className="btn-danger-reset"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: '⚠️ Redefinição Total do Sistema',
                        message: 'Atenção! Todos os dados serão apagados e o sistema será reiniciado do zero.',
                        description: 'Esta é uma ação destrutiva definitiva e irreversível. Deseja continuar?',
                        confirmText: 'Sim, Reiniciar do Zero',
                        cancelText: 'Cancelar',
                        variant: 'danger',
                      });
                      if (confirmed) {
                        onResetDemoData();
                        onClose();
                      }
                    }}
                  >
                    <RotateCcw size={14} /> Redefinir Dados
                  </button>
                </div>
              </div>
            )}

            {/* ========== ABA: AUDITORIA ========== */}
            {activeTab === 'auditoria' && (
              <div className="settings-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <SectionTitle icon={ShieldCheck} label="Trilha de Auditoria & Histórico de Alterações" />
                  <button
                    type="button"
                    className="btn-outline-action"
                    onClick={() => loadAuditLogs(auditModuleFilter)}
                    disabled={auditLoading}
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    <RefreshCw size={13} className={auditLoading ? 'spin-anim' : ''} />
                    <span>Atualizar</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
                  Registro imutável de todas as alterações feitas no sistema (quem criou, editou ou excluiu missões, viaturas, combustível e configurações).
                </p>

                {/* Filtro de Módulos */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {['', 'MISSIONS', 'FLEET', 'TEAMS', 'AUTH', 'CONFIG'].map((mod) => (
                    <button
                      key={mod}
                      type="button"
                      className={`btn-tab-chip ${auditModuleFilter === mod ? 'active' : ''}`}
                      onClick={() => {
                        setAuditModuleFilter(mod);
                        loadAuditLogs(mod);
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        borderRadius: '20px',
                        border: '1px solid var(--border-subtle)',
                        background: auditModuleFilter === mod ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.05)',
                        color: auditModuleFilter === mod ? '#0b0f19' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {mod === '' ? 'Todos os Registros' : mod === 'FLEET' ? 'Frotas & Viaturas' : mod === 'MISSIONS' ? 'Missões' : mod === 'TEAMS' ? 'Equipes' : mod}
                    </button>
                  ))}
                </div>

                {auditLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>Carregando trilha de auditoria...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="empty-list-notice" style={{ padding: '20px', textAlign: 'center' }}>
                    Nenhum registro de auditoria encontrado para este filtro.
                  </div>
                ) : (
                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Data / Hora</th>
                          <th style={{ padding: '8px 12px' }}>Usuário</th>
                          <th style={{ padding: '8px 12px' }}>Módulo</th>
                          <th style={{ padding: '8px 12px' }}>Ação / Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {log.user_name}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--accent-gold)'
                              }}>
                                {log.module}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', opacity: 0.9 }}>
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
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
        </div>

        {/* ---- Rodapé Global com Salvar ---- */}
        <div className="settings-footer">
          <span className="settings-footer-hint">
            As configurações são aplicadas imediatamente e salvas localmente no dispositivo.
          </span>
          <div className="settings-footer-actions">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              className={`btn-primary ${saveSuccess ? 'btn-success-pulse' : ''}`}
              onClick={handleSave}
            >
              {saveSuccess ? <><Check size={15} /> Salvo!</> : <><Save size={15} /> Salvar Configurações</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
