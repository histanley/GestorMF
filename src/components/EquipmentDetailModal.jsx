import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  X,
  Camera,
  Layers,
  Hash,
  DollarSign,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Copy,
  Edit2,
  Plus,
  Upload,
  Calendar,
  Sparkles,
  Maximize2,
  ExternalLink,
  ZoomIn,
  Wrench,
} from 'lucide-react';
import { CATEGORY_LABELS, formatCurrency, formatDateBR, getEquipPhotoUrl, compressImageFile } from '../utils/rentalsData';
import { apiRequest } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';

export default function EquipmentDetailModal({
  equipment,
  rentals = [],
  onClose,
  onEdit,
  onRent,
  onUpdatePhoto,
  onEquipmentUpdated,
}) {
  const fileInputRef = useRef(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isFinishingMaintenance, setIsFinishingMaintenance] = useState(false);

  const handleFinishMaintenance = async () => {
    const maintQty = equipment.maintenanceQty || 1;
    const confirmed = await confirmDialog({
      title: 'Concluir Manutenção do Equipamento',
      message: `Deseja dar baixa na manutenção de "${equipment.name}" e liberar ${maintQty} unidade(s) de volta ao estoque disponível para locação?`,
      confirmLabel: 'Sim, Concluir e Liberar',
      cancelLabel: 'Cancelar',
      variant: 'success',
    });
    if (!confirmed) return;

    try {
      setIsFinishingMaintenance(true);
      const res = await apiRequest('/rentals.php?action=finish_maintenance', {
        method: 'POST',
        body: JSON.stringify({ equipmentId: equipment.id }),
      });
      if (res && res.success) {
        alertDialog({
          title: '✅ Manutenção Concluída!',
          message: `${equipment.name} foi finalizado e já está novamente disponível no estoque para novas locações.`,
          variant: 'success',
        });
        if (onEquipmentUpdated) {
          onEquipmentUpdated({
            ...equipment,
            availableQty: res.availableQty !== undefined ? res.availableQty : equipment.availableQty + maintQty,
            maintenanceQty: 0,
            status: 'available',
            maintenanceNotes: null,
          });
        }
      } else {
        throw new Error(res?.error || 'Erro ao concluir manutenção.');
      }
    } catch (e) {
      alertDialog({
        title: 'Erro ao Concluir Manutenção',
        message: e.message || 'Falha na comunicação com o servidor.',
        variant: 'danger',
      });
    } finally {
      setIsFinishingMaintenance(false);
    }
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  if (!equipment) return null;

  const isFullyRented = equipment.availableQty <= 0;
  const isPartiallyRented = equipment.availableQty < equipment.totalQty && equipment.availableQty > 0;
  const rentedQty = Math.max(0, equipment.totalQty - equipment.availableQty);

  // Percentual de disponibilidade para a barra visual
  const availPercent = equipment.totalQty > 0
    ? Math.round((equipment.availableQty / equipment.totalQty) * 100)
    : 0;

  // Todas as locações que envolvem este item
  const allRentalsWithItem = useMemo(() => {
    return (rentals || []).filter((r) => {
      const items = r.items || [];
      return items.some((it) => it.equipmentId === equipment.id || it.name === equipment.name);
    });
  }, [rentals, equipment.id, equipment.name]);

  // Locações ativas, agendadas/reservadas ou atrasadas
  const activeRentalsWithItem = useMemo(() => {
    return allRentalsWithItem.filter((r) => r.status === 'active' || r.status === 'overdue' || r.status === 'reserved');
  }, [allRentalsWithItem]);

  // Histórico de locações já devolvidas
  const pastRentalsWithItem = useMemo(() => {
    return allRentalsWithItem.filter((r) => r.status === 'returned');
  }, [allRentalsWithItem]);

  const handleCopySerial = async () => {
    if (!equipment.serialNumber) return;
    try {
      await navigator.clipboard.writeText(equipment.serialNumber);
      alertDialog({
        title: 'Copiado!',
        message: `Número de série "${equipment.serialNumber}" copiado para a área de transferência.`,
        variant: 'success',
      });
    } catch {}
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alertDialog({
        title: 'Arquivo Inválido',
        message: 'Por favor, selecione uma imagem válida (PNG, JPG, WEBP).',
        variant: 'warning',
      });
      return;
    }

    try {
      const compressedDataUrl = await compressImageFile(file, 1200, 0.85);
      if (compressedDataUrl && onUpdatePhoto) {
        await onUpdatePhoto(equipment.id, compressedDataUrl);
      }
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      alertDialog({
        title: 'Erro ao Carregar Foto',
        message: 'Não foi possível processar a imagem selecionada.',
        variant: 'danger',
      });
    }
  };

  return (
    <div className="modal-overlay edm-overlay" onClick={onClose}>
      <div className="modal-box equip-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Modal (Fixo) */}
        <div className="edm-header">
          <div className="edm-header-left">
            <span className="edm-cat-pill">
              <Camera size={13} /> {CATEGORY_LABELS[equipment.category] || equipment.category}
            </span>

            <span className={`status-pill ${equipment.maintenanceQty > 0 && equipment.availableQty <= 0 ? 'pill-maintenance' : isFullyRented ? 'pill-rented' : isPartiallyRented ? 'pill-partial' : 'pill-available'}`}>
              {equipment.maintenanceQty > 0 && equipment.availableQty <= 0
                ? `🛠️ Em Manutenção (${equipment.maintenanceQty} un.)`
                : isFullyRented
                ? '🔴 100% Alugado'
                : isPartiallyRented
                ? `🟡 ${equipment.availableQty} de ${equipment.totalQty} disp.`
                : '🟢 Totalmente Disponível'}
            </span>
            {equipment.maintenanceQty > 0 && equipment.availableQty > 0 && (
              <span className="status-pill pill-maintenance">
                🛠️ {equipment.maintenanceQty} em Manutenção
              </span>
            )}
          </div>

          <button
            type="button"
            className="modal-close edm-close-btn"
            onClick={onClose}
            title="Fechar Detalhes"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com Grid Prático de 2 Colunas (Tudo visível e rolável se necessário) */}
        <div className="edm-body-scrollable">
          <div className="edm-main-grid">
            {/* Coluna 1: Vitrine Visual (Foto 100% visível, NUNCA cortada) */}
            <div className="edm-photo-showcase">
              {equipment.photoUrl ? (
                <div
                  className="edm-photo-box"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Clique para ver a foto inteira ampliada em tela cheia"
                >
                  <img
                    src={getEquipPhotoUrl(equipment.photoUrl)}
                    alt={equipment.name}
                    className="edm-photo-contain"
                  />
                  <div className="edm-photo-zoom-hint">
                    <Maximize2 size={12} />
                    <span>Ver Foto Inteira</span>
                  </div>
                  <button
                    type="button"
                    className="edm-btn-change-photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    title="Trocar Foto do Equipamento"
                  >
                    <Camera size={13} /> Trocar Foto
                  </button>
                </div>
              ) : (
                <div className="edm-photo-placeholder" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={40} className="text-gold" />
                  <span className="edm-add-photo-text">Adicionar Foto</span>
                  <small>Clique para enviar imagem</small>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            {/* Coluna 2: Informações Técnicas & Comerciais */}
            <div className="edm-info-column">
              <h2 className="edm-title">{equipment.name}</h2>
              {equipment.description ? (
                <p className="edm-desc">{equipment.description}</p>
              ) : (
                <p className="edm-desc-empty">Nenhuma descrição ou acessório extra cadastrado.</p>
              )}

              {/* Grid Compacto de Especificações (Valor, Estoque e Série) */}
              <div className="edm-specs-grid">
                {/* 1. Valor da Diária */}
                <div className="edm-spec-card highlight-price">
                  <div className="edm-spec-icon">
                    <DollarSign size={17} className="text-emerald" />
                  </div>
                  <div className="edm-spec-info">
                    <span className="edm-spec-lbl">VALOR DA DIÁRIA</span>
                    <strong className="edm-price-val">
                      {formatCurrency(equipment.dailyRate)}
                      <span className="edm-unit"> /{equipment.rateUnit || 'diária'}</span>
                    </strong>
                  </div>
                </div>

                {/* 2. Estoque Total x Disponível */}
                <div className="edm-spec-card">
                  <div className="edm-spec-icon">
                    <Package size={17} className="text-cyan" />
                  </div>
                  <div className="edm-spec-info">
                    <span className="edm-spec-lbl">ESTOQUE &amp; DISP.</span>
                    <div className="edm-stock-numbers">
                      <span>Total: <strong>{equipment.totalQty}</strong></span>
                      <span>•</span>
                      <span className="text-emerald">Disp: <strong>{equipment.availableQty}</strong></span>
                      {rentedQty > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber">Alug: <strong>{rentedQty}</strong></span>
                        </>
                      )}
                    </div>
                    <div className="edm-progress-track">
                      <div
                        className={`edm-progress-bar ${availPercent === 0 ? 'bg-red' : availPercent < 50 ? 'bg-amber' : 'bg-emerald'}`}
                        style={{ width: `${availPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 3. Número de Série & Patrimônio */}
                <div className="edm-spec-card highlight-serial">
                  <div className="edm-spec-icon">
                    <Hash size={17} className="text-gold" />
                  </div>
                  <div className="edm-spec-info">
                    <span className="edm-spec-lbl">Nº DE SÉRIE / TAG</span>
                    <div className="edm-serial-row">
                      <strong className="edm-serial-val">
                        {equipment.serialNumber || 'Não cadastrado'}
                      </strong>
                      {equipment.serialNumber && (
                        <button
                          type="button"
                          className="edm-copy-btn"
                          onClick={handleCopySerial}
                          title="Copiar número de série"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Valor Patrimonial do Bem (Custo de Mercado / Seguro) */}
                <div className="edm-spec-card highlight-asset">
                  <div className="edm-spec-icon">
                    <Sparkles size={17} className="text-cyan" />
                  </div>
                  <div className="edm-spec-info">
                    <span className="edm-spec-lbl">VALOR PATRIMONIAL DO BEM</span>
                    <strong className="edm-price-val text-cyan">
                      {formatCurrency(equipment.assetValue || (equipment.dailyRate * 25))}
                    </strong>
                    <small className="edm-asset-total-sub">
                      Montante ({equipment.totalQty} un): {formatCurrency((equipment.assetValue || (equipment.dailyRate * 25)) * equipment.totalQty)}
                    </small>
                  </div>
                </div>
              </div>

              {/* Alerta & Ação de Manutenção Técnica */}
              {equipment.maintenanceQty > 0 && (
                <div className="edm-maintenance-alert-card">
                  <div className="emac-left">
                    <div className="emac-icon-circle">
                      <Wrench size={18} />
                    </div>
                    <div>
                      <div className="emac-title-row">
                        <strong>Equipamento em Manutenção Técnica</strong>
                        <span className="emac-badge">{equipment.maintenanceQty} unidade(s)</span>
                      </div>
                      <p className="emac-desc">
                        {equipment.maintenanceNotes || 'Item retirado do estoque disponível aguardando conserto ou revisão técnica.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-finish-maint-action"
                    onClick={handleFinishMaintenance}
                    disabled={isFinishingMaintenance}
                    title="Concluir conserto e retornar o equipamento como disponível no estoque"
                  >
                    <CheckCircle2 size={15} />
                    <span>{isFinishingMaintenance ? 'Liberando...' : 'Concluir Manutenção & Liberar Estoque'}</span>
                  </button>
                </div>
              )}

              {/* Seção de Locações Ativas & Missões com este Item */}
              <div className="edm-active-rentals-box">
                <h4 className="edm-section-title">
                  <Clock size={14} /> Paradeiro em Tempo Real (Locações &amp; Missões)
                </h4>

                {activeRentalsWithItem.length === 0 && (!equipment.missionAllocations || equipment.missionAllocations.length === 0) ? (
                  <div className="edm-rentals-empty">
                    <CheckCircle2 size={15} className="text-emerald" />
                    <span>Todas as unidades disponíveis na base da produtora. Nenhuma locação ou missão em andamento.</span>
                  </div>
                ) : (
                  <div className="edm-rentals-list">
                    {/* 1. Alocações em Missões da Produtora */}
                    {(equipment.missionAllocations || []).map((mAlloc, mIdx) => (
                      <div key={`m-${mIdx}`} className="edm-rental-item-card item-mission">
                        <div className="eric-left">
                          <div className="eric-client">
                            <span className="badge-mission-pill">🎬 Missão Interna</span>
                            <strong>{mAlloc.missionCode}: {mAlloc.description}</strong>
                          </div>
                          <div className="eric-dates">
                            <User size={12} className="text-gold" />
                            <span>Com: <strong>{mAlloc.collaboratorName}</strong></span>
                            <span>•</span>
                            <Calendar size={12} />
                            <span>Data: <strong>{formatDateBR(mAlloc.date)}</strong></span>
                          </div>
                        </div>
                        <div className="eric-right">
                          <span className="eric-qty-badge">{mAlloc.quantity} un.</span>
                          <span className="eric-mission-tag">Em Campo</span>
                        </div>
                      </div>
                    ))}

                    {/* 2. Locações Externas para Clientes */}
                    {activeRentalsWithItem.map((r) => {
                      const it = (r.items || []).find((x) => x.equipmentId === equipment.id || x.name === equipment.name);
                      const isReserved = r.status === 'reserved';
                      const isOverdue = !isReserved && (r.status === 'overdue' || r.endDate < new Date().toISOString().split('T')[0]);

                      return (
                        <div key={r.id} className={`edm-rental-item-card ${isOverdue ? 'item-overdue' : isReserved ? 'item-reserved' : ''}`}>
                          <div className="eric-left">
                            <div className="eric-client">
                              <User size={13} className="text-gold" />
                              <strong>{r.clientName}</strong>
                              <span className="eric-code">{r.code}</span>
                            </div>
                            <div className="eric-dates">
                              <Calendar size={12} />
                              <span>{isReserved ? 'Período Reservado:' : 'Devolução:'} <strong>{formatDateBR(r.startDate)} a {formatDateBR(r.endDate)} às {r.endTime || '18:00'}</strong></span>
                            </div>
                          </div>

                          <div className="eric-right">
                            <span className="eric-qty-badge">{it?.quantity || 1} un.</span>
                            {isReserved ? (
                              <span className="badge-reserved-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                                📅 Agendada
                              </span>
                            ) : isOverdue ? (
                              <span className="eric-overdue-tag">🚨 Atrasada</span>
                            ) : (
                              <span className="badge-active-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                                ⚡ Locação Ativa
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção de Histórico de Locações deste Equipamento */}
              {pastRentalsWithItem.length > 0 && (
                <div className="edm-past-rentals-box" style={{ marginTop: '16px' }}>
                  <h4 className="edm-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} className="text-gold" />
                    <span>Histórico de Locações deste Equipamento ({pastRentalsWithItem.length})</span>
                  </h4>
                  <div className="edm-rentals-list">
                    {pastRentalsWithItem.map((r) => {
                      const it = (r.items || []).find((x) => x.equipmentId === equipment.id || x.name === equipment.name);
                      return (
                        <div key={r.id} className="edm-rental-item-card item-returned">
                          <div className="eric-left">
                            <div className="eric-client">
                              <User size={13} className="text-muted" />
                              <strong>{r.clientName}</strong>
                              <span className="eric-code">{r.code}</span>
                            </div>
                            <div className="eric-dates">
                              <Calendar size={12} />
                              <span>Período: {formatDateBR(r.startDate)} a {formatDateBR(r.endDate)}</span>
                              {r.returnedAt && <span> • Devolvido em: {formatDateBR(r.returnedAt.split(/[T ]/)[0])}</span>}
                            </div>
                          </div>
                          <div className="eric-right">
                            <span className="eric-qty-badge">{it?.quantity || 1} un.</span>
                            <span className="badge-returned-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                              ✅ Devolvido
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé Fixo de Ações (Sempre 100% visível, nunca corta os botões) */}
        <div className="modal-footer edm-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(equipment);
            }}
          >
            <Edit2 size={14} /> Editar Cadastro
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={isFullyRented || equipment.availableQty <= 0}
            onClick={() => {
              onClose();
              if (onRent) onRent(equipment);
            }}
          >
            <Plus size={15} /> Alugar Este Equipamento
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL / LIGHTBOX: EXIBIÇÃO DA IMAGEM INTEIRA EM TELA CHEIA     */}
      {/* ============================================================== */}
      {isLightboxOpen && equipment.photoUrl && (
        <div
          className="edm-lightbox-overlay"
          onClick={() => setIsLightboxOpen(false)}
          title="Clique fora para fechar"
        >
          <div className="edm-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="edm-lightbox-header">
              <div className="edm-lightbox-title-area">
                <span className="edm-lightbox-category">
                  {CATEGORY_LABELS[equipment.category] || equipment.category}
                </span>
                <h3 className="edm-lightbox-item-name">{equipment.name}</h3>
              </div>
              <div className="edm-lightbox-actions">
                <a
                  href={getEquipPhotoUrl(equipment.photoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="edm-lightbox-btn-action"
                  title="Abrir imagem original em nova aba"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                  <span>Original</span>
                </a>
                <button
                  type="button"
                  className="edm-lightbox-close-btn"
                  onClick={() => setIsLightboxOpen(false)}
                  title="Fechar visualização da imagem"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="edm-lightbox-img-wrap" onClick={() => setIsLightboxOpen(false)}>
              <img
                src={getEquipPhotoUrl(equipment.photoUrl)}
                alt={equipment.name}
                className="edm-lightbox-img"
              />
            </div>

            <div className="edm-lightbox-footer">
              <span>Pressione <strong>ESC</strong> ou clique fora da imagem para fechar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
