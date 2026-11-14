import React, { useState } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Maximize2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Save,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { formatCurrency, formatDateBR, compressImageFile } from '../utils/rentalsData';
import { apiRequest } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';

export default function RentalInspectionModal({
  rental,
  currentUser,
  onClose,
  onUpdated
}) {
  const [activeTab, setActiveTab] = useState(
    rental?.returnPhotos?.length > 0 ? 'comparison' : (rental?.status === 'returned' ? 'return' : 'pickup')
  );

  const [pickupPhotos, setPickupPhotos] = useState(rental?.pickupPhotos || []);
  const [returnPhotos, setReturnPhotos] = useState(rental?.returnPhotos || []);
  const [pickupNotes, setPickupNotes] = useState(rental?.pickupNotes || '');
  const [returnNotes, setReturnNotes] = useState(rental?.returnNotes || '');
  const [inspectionNotes, setInspectionNotes] = useState(rental?.inspectionNotes || '');
  const [hasDamage, setHasDamage] = useState(Boolean(rental?.hasDamage));

  // Form states para novo upload
  const [selectedEquipName, setSelectedEquipName] = useState(
    rental?.items?.[0]?.name || 'Geral'
  );
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoCondition, setPhotoCondition] = useState('ok'); // 'ok' ou 'damage'
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lightbox Zoom
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // Manipulador de upload de foto via Câmera ou Arquivo
  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      // Comprime a foto no navegador para economizar banda e armazenamento
      const compressedDataUrl = await compressImageFile(file, 1400, 0.85);

      const newPhotoObj = {
        id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        url: compressedDataUrl,
        caption: photoCaption.trim() || (photoCondition === 'damage' ? 'Avaria identificada' : 'Equipamento conferido'),
        equipmentName: selectedEquipName,
        condition: photoCondition,
        timestamp: new Date().toISOString(),
        registeredBy: currentUser?.name || 'Operador',
      };

      if (type === 'pickup') {
        setPickupPhotos((prev) => [newPhotoObj, ...prev]);
      } else {
        setReturnPhotos((prev) => [newPhotoObj, ...prev]);
        if (photoCondition === 'damage') {
          setHasDamage(true);
        }
      }

      setPhotoCaption('');
      // Reseta o input para permitir selecionar a mesma imagem se quiser
      e.target.value = '';

      alertDialog({
        title: '📸 Foto Registrada com Sucesso!',
        message: `Foto de ${type === 'pickup' ? 'Retirada (Saída)' : 'Devolução (Retorno)'} adicionada. Lembre-se de clicar em "Salvar Vistoria" para fixar no histórico do sistema.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      alertDialog({
        title: 'Erro ao Carregar Foto',
        message: 'Não foi possível processar a imagem: ' + (err.message || 'formato inválido'),
        variant: 'danger',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Remover foto da lista
  const handleDeletePhoto = async (photoId, type) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Foto da Vistoria',
      message: 'Tem certeza que deseja remover esta foto do registro da vistoria?',
      confirmLabel: 'Sim, Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) return;

    if (type === 'pickup') {
      setPickupPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else {
      setReturnPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  // Salvar vistoria completa no backend
  const handleSaveInspection = async () => {
    try {
      setIsSaving(true);
      const payload = {
        rentalId: rental.id,
        pickupPhotos,
        returnPhotos,
        pickupNotes,
        returnNotes,
        inspectionNotes,
        hasDamage,
      };

      const res = await apiRequest('/rentals.php?action=save_inspection', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res && res.success) {
        if (onUpdated) {
          onUpdated({
            ...rental,
            pickupPhotos: res.pickupPhotos || pickupPhotos,
            returnPhotos: res.returnPhotos || returnPhotos,
            pickupNotes,
            returnNotes,
            inspectionNotes,
            hasDamage: res.hasDamage !== undefined ? res.hasDamage : hasDamage,
          });
        }

        alertDialog({
          title: '✅ Vistoria Gravada no Histórico!',
          message: `Fotos e apontamentos da locação ${rental.code} foram arquivados com sucesso no banco de dados.`,
          variant: 'success',
        });
      } else {
        throw new Error(res?.error || 'Erro ao salvar no servidor.');
      }
    } catch (err) {
      console.warn('Salvando localmente em caso de offline:', err);
      if (onUpdated) {
        onUpdated({
          ...rental,
          pickupPhotos,
          returnPhotos,
          pickupNotes,
          returnNotes,
          inspectionNotes,
          hasDamage,
        });
      }
      alertDialog({
        title: 'Vistoria Salva Localmente',
        message: 'Os registros fotográficos foram atualizados.',
        variant: 'info',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isReserved = rental?.status === 'reserved';
  const isReturned = rental?.status === 'returned';

  return (
    <div className="modal-overlay rental-inspection-overlay" onClick={onClose}>
      <div
        className="modal-box inspection-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="inspection-modal-header">
          <div className="imh-left">
            <div className="imh-icon-wrap">
              <Camera size={22} className="text-gold" />
            </div>
            <div>
              <div className="imh-title-row">
                <h2>Vistoria Técnica &amp; Registro de Avarias</h2>
                <span className="rental-code-badge">{rental?.code}</span>
                {hasDamage ? (
                  <span className="damage-flag-badge danger">
                    <AlertTriangle size={13} /> Avaria Registrada
                  </span>
                ) : (
                  <span className="damage-flag-badge success">
                    <ShieldCheck size={13} /> Sem Avarias
                  </span>
                )}
              </div>
              <p className="imh-sub">
                Cliente: <strong>{rental?.clientName}</strong> • Período:{' '}
                {formatDateBR(rental?.startDate)} ({rental?.startTime || '08:00'}) ➜{' '}
                {formatDateBR(rental?.endDate)} ({rental?.endTime || '18:00'})
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="inspection-tabs-bar">
          <button
            type="button"
            className={`inspection-tab-btn ${activeTab === 'pickup' ? 'active' : ''}`}
            onClick={() => setActiveTab('pickup')}
          >
            <Upload size={16} />
            <span>1. Retirada / Saída</span>
            <span className="tab-counter">{pickupPhotos.length}</span>
          </button>

          <button
            type="button"
            className={`inspection-tab-btn ${activeTab === 'return' ? 'active' : ''}`}
            onClick={() => setActiveTab('return')}
          >
            <RotateCcw size={16} />
            <span>2. Devolução / Retorno</span>
            <span className="tab-counter">{returnPhotos.length}</span>
          </button>

          <button
            type="button"
            className={`inspection-tab-btn comparison-tab ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            <Layers size={16} />
            <span>3. Comparativo Antes &amp; Depois</span>
            <span className="tab-pulse-dot" />
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="inspection-body">
          {/* ================================================================ */}
          {/* ABA 1: FOTOS NA RETIRADA (CHECK-OUT)                             */}
          {/* ================================================================ */}
          {activeTab === 'pickup' && (
            <div className="inspection-pane">
              <div className="inspection-intro-banner">
                <Info size={18} className="text-gold" />
                <div>
                  <strong>Registro Visual na Saída do Equipamento:</strong>
                  <p>
                    Fotografe os equipamentos antes da entrega ao cliente (corpo, visor LCD,
                    lentes frontais/traseiras, cabos e cases). Isso resguarda a empresa contra danos prévios.
                  </p>
                </div>
              </div>

              {/* Form para adicionar nova foto de saída */}
              <div className="inspection-add-box">
                <div className="iab-row">
                  <div className="form-group flex-1">
                    <label>Equipamento da Foto:</label>
                    <select
                      value={selectedEquipName}
                      onChange={(e) => setSelectedEquipName(e.target.value)}
                    >
                      <option value="Geral (Todos os Itens)">Geral (Todos os Itens)</option>
                      {(rental?.items || []).map((it, idx) => (
                        <option key={idx} value={it.name}>
                          {it.quantity}x {it.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Condição do Equipamento:</label>
                    <select
                      value={photoCondition}
                      onChange={(e) => setPhotoCondition(e.target.value)}
                    >
                      <option value="ok">🟢 Perfeito Estado (Sem avarias)</option>
                      <option value="damage">⚠️ Detalhe / Marca Pré-existente</option>
                    </select>
                  </div>
                </div>

                <div className="iab-row">
                  <div className="form-group flex-2">
                    <label>Legenda / Observação:</label>
                    <input
                      type="text"
                      placeholder="Ex: Lente frontal sem riscos, sensor limpo, tela perfeita."
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                    />
                  </div>

                  <div className="form-group flex-1 photo-btn-group">
                    <label>&nbsp;</label>
                    <label className={`btn-primary btn-upload-photo ${isUploading ? 'disabled' : ''}`}>
                      <Camera size={16} />
                      <span>{isUploading ? 'Processando...' : 'Fotografar / Carregar'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'pickup')}
                        disabled={isUploading}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Galeria de Fotos de Retirada */}
              <div className="inspection-gallery-section">
                <div className="igs-header">
                  <h3>Fotos Registradas na Retirada ({pickupPhotos.length})</h3>
                </div>

                {pickupPhotos.length === 0 ? (
                  <div className="inspection-empty">
                    <Camera size={36} className="text-muted" />
                    <p>Nenhuma foto de saída registrada ainda.</p>
                    <small>Utilize a câmera do celular ou carregue fotos do acervo antes da saída.</small>
                  </div>
                ) : (
                  <div className="inspection-grid">
                    {pickupPhotos.map((photo) => (
                      <div key={photo.id} className="inspection-card">
                        <div
                          className="ic-img-wrap"
                          onClick={() => setLightboxPhoto(photo)}
                          title="Clique para ampliar"
                        >
                          <img src={photo.url} alt={photo.caption} />
                          <button type="button" className="ic-zoom-btn">
                            <Maximize2 size={14} />
                          </button>
                          <span
                            className={`ic-condition-tag ${
                              photo.condition === 'damage' ? 'tag-warn' : 'tag-ok'
                            }`}
                          >
                            {photo.condition === 'damage' ? '⚠️ Detalhe' : '🟢 Íntegro'}
                          </span>
                        </div>
                        <div className="ic-details">
                          <strong className="ic-equip-name">{photo.equipmentName}</strong>
                          <p className="ic-caption">{photo.caption || 'Sem observações'}</p>
                          <div className="ic-meta">
                            <span>
                              {formatDateBR(photo.timestamp?.split('T')?.[0] || photo.timestamp?.split(' ')?.[0])}{' '}
                              {photo.timestamp?.includes('T')
                                ? photo.timestamp?.split('T')?.[1]?.substring(0, 5)
                                : photo.timestamp?.split(' ')?.[1]?.substring(0, 5)}
                            </span>
                            <span>Por: {photo.registeredBy}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ic-delete-btn"
                          onClick={() => handleDeletePhoto(photo.id, 'pickup')}
                          title="Remover foto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 2: FOTOS NA DEVOLUÇÃO (CHECK-IN)                             */}
          {/* ================================================================ */}
          {activeTab === 'return' && (
            <div className="inspection-pane">
              <div className="inspection-intro-banner return-banner">
                <RotateCcw size={18} className="text-emerald" />
                <div>
                  <strong>Registro Visual na Devolução (Check-in):</strong>
                  <p>
                    Fotografe os itens devolvidos pelo cliente. Se identificar qualquer risco,
                    lente danificada, quebra ou peça faltando, selecione "Avaria Detectada"
                    para registrar no histórico com validade probatória.
                  </p>
                </div>
              </div>

              {/* Form para adicionar nova foto de devolução */}
              <div className="inspection-add-box">
                <div className="iab-row">
                  <div className="form-group flex-1">
                    <label>Equipamento Inspecionado:</label>
                    <select
                      value={selectedEquipName}
                      onChange={(e) => setSelectedEquipName(e.target.value)}
                    >
                      <option value="Geral (Todos os Itens)">Geral (Todos os Itens)</option>
                      {(rental?.items || []).map((it, idx) => (
                        <option key={idx} value={it.name}>
                          {it.quantity}x {it.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Status da Devolução deste Item:</label>
                    <select
                      value={photoCondition}
                      onChange={(e) => setPhotoCondition(e.target.value)}
                    >
                      <option value="ok">🟢 Devolvido Íntegro &amp; Perfeito</option>
                      <option value="damage">🚨 AVARIA / DANO / PEÇA FALTANTE</option>
                    </select>
                  </div>
                </div>

                <div className="iab-row">
                  <div className="form-group flex-2">
                    <label>Descrição do Estado / Avaria Detectada:</label>
                    <input
                      type="text"
                      placeholder="Ex: Risco profundo na tampa do conector HDMI, tela com avaria..."
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                    />
                  </div>

                  <div className="form-group flex-1 photo-btn-group">
                    <label>&nbsp;</label>
                    <label className={`btn-primary btn-upload-photo ${isUploading ? 'disabled' : ''}`}>
                      <Camera size={16} />
                      <span>{isUploading ? 'Processando...' : 'Fotografar Devolução'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'return')}
                        disabled={isUploading}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Switch Geral de Avarias */}
              <div className="damage-toggle-card">
                <div className="dtc-left">
                  <AlertTriangle
                    size={22}
                    className={hasDamage ? 'text-red' : 'text-muted'}
                  />
                  <div>
                    <strong>Conclusão da Vistoria de Devolução:</strong>
                    <p>
                      {hasDamage
                        ? '🚨 Avaria registrada nesta locação. O cliente poderá ser cobrado pelo reparo ou reposição.'
                        : '✅ Equipamentos devolvidos 100% íntegros e funcionando.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn-toggle-damage ${hasDamage ? 'active-danger' : 'active-safe'}`}
                  onClick={() => setHasDamage(!hasDamage)}
                >
                  {hasDamage ? '🚨 Avaria Marcada' : '🟢 100% Sem Avarias'}
                </button>
              </div>

              {/* Galeria de Fotos de Devolução */}
              <div className="inspection-gallery-section">
                <div className="igs-header">
                  <h3>Fotos Registradas na Devolução ({returnPhotos.length})</h3>
                </div>

                {returnPhotos.length === 0 ? (
                  <div className="inspection-empty">
                    <RotateCcw size={36} className="text-muted" />
                    <p>Nenhuma foto de devolução registrada ainda.</p>
                    <small>Ao receber o equipamento, clique no botão acima para registrar imagens do retorno.</small>
                  </div>
                ) : (
                  <div className="inspection-grid">
                    {returnPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`inspection-card ${
                          photo.condition === 'damage' ? 'card-has-damage' : ''
                        }`}
                      >
                        <div
                          className="ic-img-wrap"
                          onClick={() => setLightboxPhoto(photo)}
                          title="Clique para ampliar"
                        >
                          <img src={photo.url} alt={photo.caption} />
                          <button type="button" className="ic-zoom-btn">
                            <Maximize2 size={14} />
                          </button>
                          <span
                            className={`ic-condition-tag ${
                              photo.condition === 'damage' ? 'tag-damage' : 'tag-ok'
                            }`}
                          >
                            {photo.condition === 'damage' ? '🚨 Avaria' : '🟢 Íntegro'}
                          </span>
                        </div>
                        <div className="ic-details">
                          <strong className="ic-equip-name">{photo.equipmentName}</strong>
                          <p className="ic-caption">{photo.caption || 'Sem observações'}</p>
                          <div className="ic-meta">
                            <span>
                              {formatDateBR(photo.timestamp?.split('T')?.[0] || photo.timestamp?.split(' ')?.[0])}{' '}
                              {photo.timestamp?.includes('T')
                                ? photo.timestamp?.split('T')?.[1]?.substring(0, 5)
                                : photo.timestamp?.split(' ')?.[1]?.substring(0, 5)}
                            </span>
                            <span>Por: {photo.registeredBy}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ic-delete-btn"
                          onClick={() => handleDeletePhoto(photo.id, 'return')}
                          title="Remover foto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 3: COMPARATIVO ANTES & DEPOIS (AUDITORIA VISUAL DE AVARIAS)  */}
          {/* ================================================================ */}
          {activeTab === 'comparison' && (
            <div className="inspection-pane comparison-pane">
              {/* Resumo do Comparativo */}
              <div className="comparison-summary-card">
                <div className="csc-col">
                  <span className="csc-lbl">Fotos na Saída</span>
                  <strong className="csc-val">{pickupPhotos.length} fotos</strong>
                </div>
                <div className="csc-divider">
                  <ArrowRight size={20} className="text-gold" />
                </div>
                <div className="csc-col">
                  <span className="csc-lbl">Fotos no Retorno</span>
                  <strong className="csc-val">{returnPhotos.length} fotos</strong>
                </div>
                <div className="csc-divider">
                  <ArrowRight size={20} className="text-gold" />
                </div>
                <div className="csc-col">
                  <span className="csc-lbl">Diagnóstico de Avarias</span>
                  <strong
                    className={`csc-val ${hasDamage ? 'text-red' : 'text-emerald'}`}
                  >
                    {hasDamage ? '🚨 Avaria Detectada' : '✅ 100% Conforme'}
                  </strong>
                </div>
              </div>

              {pickupPhotos.length === 0 && returnPhotos.length === 0 ? (
                <div className="inspection-empty">
                  <Layers size={40} className="text-muted" />
                  <h3>Sem fotos registradas para comparação</h3>
                  <p>
                    Cadastre as fotos na aba <strong>"1. Retirada / Saída"</strong> e na aba{' '}
                    <strong>"2. Devolução / Retorno"</strong> para visualizá-las lado a lado.
                  </p>
                </div>
              ) : (
                <div className="side-by-side-wrapper">
                  {/* Coluna 1: Saída */}
                  <div className="sbs-column sbs-pickup-col">
                    <div className="sbs-col-header">
                      <div className="sbs-badge pickup">
                        <Upload size={14} /> 1. SAÍDA (Como Entregue)
                      </div>
                      <span className="sbs-count">{pickupPhotos.length} foto(s)</span>
                    </div>

                    {pickupPhotos.length === 0 ? (
                      <div className="sbs-empty-box">Nenhuma foto registrada na saída.</div>
                    ) : (
                      <div className="sbs-photos-flow">
                        {pickupPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="sbs-photo-item"
                            onClick={() => setLightboxPhoto(photo)}
                          >
                            <div className="sbs-img-box">
                              <img src={photo.url} alt={photo.caption} />
                              <span className="sbs-badge-tag ok">Saída</span>
                            </div>
                            <div className="sbs-info">
                              <strong>{photo.equipmentName}</strong>
                              <p>{photo.caption || 'Sem legenda'}</p>
                              <small>{photo.registeredBy}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Coluna 2: Retorno */}
                  <div className="sbs-column sbs-return-col">
                    <div className="sbs-col-header">
                      <div className="sbs-badge return">
                        <RotateCcw size={14} /> 2. RETORNO (Como Devolvido)
                      </div>
                      <span className="sbs-count">{returnPhotos.length} foto(s)</span>
                    </div>

                    {returnPhotos.length === 0 ? (
                      <div className="sbs-empty-box">Nenhuma foto registrada no retorno.</div>
                    ) : (
                      <div className="sbs-photos-flow">
                        {returnPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className={`sbs-photo-item ${
                              photo.condition === 'damage' ? 'item-has-damage' : ''
                            }`}
                            onClick={() => setLightboxPhoto(photo)}
                          >
                            <div className="sbs-img-box">
                              <img src={photo.url} alt={photo.caption} />
                              <span
                                className={`sbs-badge-tag ${
                                  photo.condition === 'damage' ? 'damage' : 'returned'
                                }`}
                              >
                                {photo.condition === 'damage' ? 'Avaria' : 'Retorno'}
                              </span>
                            </div>
                            <div className="sbs-info">
                              <strong>{photo.equipmentName}</strong>
                              <p>{photo.caption || 'Sem legenda'}</p>
                              <small>{photo.registeredBy}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observações Gerais da Auditoria */}
              <div className="form-group inspection-notes-group">
                <label>Parecer Técnico / Observações da Auditoria de Avarias:</label>
                <textarea
                  rows="3"
                  placeholder="Ex: Equipamentos inspecionados visualmente e funcionalmente na bancada de testes. Não foram identificados arranhões ou danos estruturais."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal com Ações */}
        <div className="modal-footer inspection-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn-primary btn-save-inspection"
            onClick={handleSaveInspection}
            disabled={isSaving}
          >
            <Save size={16} />
            <span>{isSaving ? 'Salvando Vistoria...' : 'Salvar Vistoria no Histórico'}</span>
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom da Foto em Tela Cheia */}
      {lightboxPhoto && (
        <div className="inspection-lightbox" onClick={() => setLightboxPhoto(null)}>
          <div className="ilb-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ilb-close"
              onClick={() => setLightboxPhoto(null)}
            >
              <X size={24} />
            </button>
            <img src={lightboxPhoto.url} alt={lightboxPhoto.caption} />
            <div className="ilb-caption">
              <strong>{lightboxPhoto.equipmentName}</strong>
              <p>{lightboxPhoto.caption}</p>
              <small>
                Registrado por {lightboxPhoto.registeredBy} em{' '}
                {formatDateBR(lightboxPhoto.timestamp?.split('T')?.[0] || lightboxPhoto.timestamp?.split(' ')?.[0])}
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
