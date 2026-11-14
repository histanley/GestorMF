import React, { useRef } from 'react';
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
} from 'lucide-react';
import { CATEGORY_LABELS, formatCurrency, formatDateBR, getEquipPhotoUrl, compressImageFile } from '../utils/rentalsData';
import { alertDialog } from '../utils/dialog';

export default function EquipmentDetailModal({
  equipment,
  rentals = [],
  onClose,
  onEdit,
  onRent,
  onUpdatePhoto,
}) {
  const fileInputRef = useRef(null);

  if (!equipment) return null;

  const isFullyRented = equipment.availableQty <= 0;
  const isPartiallyRented = equipment.availableQty < equipment.totalQty && equipment.availableQty > 0;
  const rentedQty = Math.max(0, equipment.totalQty - equipment.availableQty);

  // Percentual de disponibilidade para a barra visual
  const availPercent = equipment.totalQty > 0
    ? Math.round((equipment.availableQty / equipment.totalQty) * 100)
    : 0;

  // Busca locações ativas que incluam este equipamento
  const activeRentalsWithItem = rentals.filter((r) => {
    if (r.status !== 'active' && r.status !== 'overdue') return false;
    const items = r.items || [];
    return items.some((it) => it.equipmentId === equipment.id || it.name === equipment.name);
  });

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

            <span className={`status-pill ${isFullyRented ? 'pill-rented' : isPartiallyRented ? 'pill-partial' : 'pill-available'}`}>
              {isFullyRented
                ? '🔴 100% Alugado'
                : isPartiallyRented
                ? `🟡 ${equipment.availableQty} de ${equipment.totalQty} disp.`
                : '🟢 Totalmente Disponível'}
            </span>
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
                <div className="edm-photo-box">
                  <img
                    src={getEquipPhotoUrl(equipment.photoUrl)}
                    alt={equipment.name}
                    className="edm-photo-contain"
                  />
                  <button
                    type="button"
                    className="edm-btn-change-photo"
                    onClick={() => fileInputRef.current?.click()}
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

                {/* 3. Número de Série & Patrimônio (Largura Total) */}
                <div className="edm-spec-card highlight-serial edm-spec-serial-full">
                  <div className="edm-spec-icon">
                    <Hash size={17} className="text-gold" />
                  </div>
                  <div className="edm-spec-info">
                    <span className="edm-spec-lbl">Nº DE SÉRIE / TAG DE PATRIMÔNIO</span>
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
              </div>

              {/* Seção de Locações Ativas com este Item */}
              <div className="edm-active-rentals-box">
                <h4 className="edm-section-title">
                  <Clock size={14} /> Locações Ativas deste Equipamento
                </h4>

                {activeRentalsWithItem.length === 0 ? (
                  <div className="edm-rentals-empty">
                    <CheckCircle2 size={15} className="text-emerald" />
                    <span>Nenhuma unidade alugada no momento. Todas disponíveis na sede.</span>
                  </div>
                ) : (
                  <div className="edm-rentals-list">
                    {activeRentalsWithItem.map((r) => {
                      const it = (r.items || []).find((x) => x.equipmentId === equipment.id || x.name === equipment.name);
                      const isOverdue = r.status === 'overdue' || r.endDate < new Date().toISOString().split('T')[0];

                      return (
                        <div key={r.id} className={`edm-rental-item-card ${isOverdue ? 'item-overdue' : ''}`}>
                          <div className="eric-left">
                            <div className="eric-client">
                              <User size={13} className="text-gold" />
                              <strong>{r.clientName}</strong>
                              <span className="eric-code">{r.code}</span>
                            </div>
                            <div className="eric-dates">
                              <Calendar size={12} />
                              <span>Devolução: <strong>{formatDateBR(r.endDate)} às {r.endTime || '18:00'}</strong></span>
                            </div>
                          </div>

                          <div className="eric-right">
                            <span className="eric-qty-badge">{it?.quantity || 1} un.</span>
                            {isOverdue && <span className="eric-overdue-tag">🚨 Atrasada</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
            disabled={isFullyRented}
            onClick={() => {
              onClose();
              if (onRent) onRent(equipment);
            }}
          >
            <Plus size={15} /> Alugar Este Equipamento
          </button>
        </div>
      </div>
    </div>
  );
}
