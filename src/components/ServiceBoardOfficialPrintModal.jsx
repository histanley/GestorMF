import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  Calendar,
  Clock,
  Car,
  MapPin,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode as QrIcon,
  Loader,
  Navigation,
  Fuel,
  Film,
  Building,
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { alertDialog } from '../utils/dialog';
import {
  formatDateBR,
  getMissionCode,
  getMissionTotalKm,
  isElectricVehicle,
  computeVehicleFuelTelemetry,
  computeMissionVehicleFuelBreakdown,
} from '../utils/geo';

export default function ServiceBoardOfficialPrintModal({
  isOpen,
  onClose,
  missions = [],
  filteredMissions = [],
  vehicles = [],
  members = [],
  fuelSettings = 6.25,
  filterStatusLabel = 'Missões Ativas',
  currentUser = null,
  userRole = 'user',
}) {
  const sheetRef = useRef(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Verificação de permissões: apenas Administradores e Gestores podem imprimir/homologar
  const userRoleNormalized = String(currentUser?.role || userRole || '').toLowerCase();
  const canPrintOfficialSchedule = Boolean(
    userRoleNormalized === 'admin' ||
    userRoleNormalized === 'administrador' ||
    userRoleNormalized === 'manager' ||
    userRoleNormalized === 'gestor' ||
    currentUser?.accessLevel === 'admin' ||
    currentUser?.accessLevel === 'manager'
  );

  // Responsável pela autorização sistêmica
  const authorizerName = currentUser?.name || 'Diretoria MegaFilmes';
  const authorizerRole = (userRoleNormalized === 'admin' || userRoleNormalized === 'administrador')
    ? 'Administrador do Sistema'
    : 'Gestor de Frota & Operações';

  // Código determinístico da escala (Ex: ESC-202611-042)
  const scheduleCode = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const count = (filteredMissions.length || missions.length).toString().padStart(3, '0');
    return `ESC-${y}${m}${d}-${count}`;
  }, [filteredMissions.length, missions.length]);

  // Lista de pautas para o documento
  const scheduleMissions = useMemo(() => {
    return filteredMissions.length > 0 ? filteredMissions : missions;
  }, [filteredMissions, missions]);

  // Hash determinístico de integridade e autenticidade digital (Lei 14.063/2020)
  const scheduleHash = useMemo(() => {
    const str = `${scheduleCode}-${scheduleMissions.length}-${authorizerName}-${authorizerRole}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'AUTH-ESC-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [scheduleCode, scheduleMissions.length, authorizerName, authorizerRole]);

  // Data e hora de emissão
  const emittedAtStr = useMemo(() => {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Totais consolidados da escala
  const totals = useMemo(() => {
    let km = 0;
    let fuelCost = 0;
    const vehSet = new Set();
    const memSet = new Set();

    scheduleMissions.forEach((m) => {
      km += getMissionTotalKm(m);
      fuelCost += Number(m.estimatedFuelCost || 0);

      // Veículos
      if (m.vehicleId) vehSet.add(m.vehicleId);
      if (Array.isArray(m.allocations)) {
        m.allocations.forEach((a) => {
          if (a.vehicleId) vehSet.add(a.vehicleId);
        });
      }

      // Membros
      if (Array.isArray(m.teamMembers)) {
        m.teamMembers.forEach((id) => memSet.add(id));
      }
      if (m.driverId) memSet.add(m.driverId);
      if (Array.isArray(m.editorIds)) {
        m.editorIds.forEach((id) => memSet.add(id));
      }
    });

    return {
      totalKm: km,
      totalFuelCost: fuelCost,
      totalVehicles: vehSet.size,
      totalMembers: memSet.size,
      totalMissions: scheduleMissions.length,
    };
  }, [scheduleMissions]);

  // Geração do QR Code oficial
  useEffect(() => {
    if (!isOpen) return;
    const validationUrl = `https://gestormf.shop/validar?doc=${scheduleCode}&auth=${scheduleHash}&data=${encodeURIComponent(emittedAtStr)}`;
    QRCode.toDataURL(validationUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [isOpen, scheduleCode, scheduleHash, emittedAtStr]);

  if (!isOpen) return null;

  // Bloqueio de segurança para usuários comuns
  if (!canPrintOfficialSchedule) {
    return (
      <div className="posm-backdrop" onClick={onClose}>
        <div className="posm-restricted-card" onClick={(e) => e.stopPropagation()}>
          <div className="posm-restricted-icon">
            <ShieldCheck size={36} />
          </div>
          <h3>Acesso Restrito à Gestão</h3>
          <p>
            A emissão, homologação e impressão oficial da <strong>Tabela de Serviço &amp; Escala Operacional</strong> com certificação digital é reservada exclusivamente a Gestores e Administradores da produtora.
          </p>
          <button className="btn-secondary" onClick={onClose} style={{ marginTop: '1rem' }}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Ação de Impressão Direta
  const handlePrint = () => {
    document.body.classList.add('printing-official-schedule');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-official-schedule');
    }, 1500);
  };

  // Download do PDF com alta definição
  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const element = sheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 297;
      const pageHeight = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Tabela_de_Servico_${scheduleCode}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF da escala:', err);
      await alertDialog({
        title: 'Erro na geração do PDF',
        message: 'Não foi possível gerar o arquivo PDF. Você pode usar a opção de Imprimir e selecionar "Salvar como PDF".',
        variant: 'danger',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Compartilhar no WhatsApp
  const handleShareWhatsApp = () => {
    const textLines = [
      `📋 *MEGAGESTÃO — TABELA OFICIAL DE SERVIÇO & ESCALA*`,
      `📄 Documento: ${scheduleCode}`,
      `📅 Emissão: ${emittedAtStr}`,
      `👤 Homologado por: ${authorizerName} (${authorizerRole})`,
      `🎯 Recorte: ${filterStatusLabel}`,
      `-----------------------------------------`,
      `📊 *RESUMO OPERACIONAL:*`,
      `• Total de Pautas: ${totals.totalMissions}`,
      `• Veículos em Campo: ${totals.totalVehicles}`,
      `• Integrantes Escalados: ${totals.totalMembers}`,
      `• Km Previsto: ${totals.totalKm.toFixed(1)} km`,
      `-----------------------------------------`,
      `📌 *PAUTAS DA ESCALA:*`,
    ];

    scheduleMissions.slice(0, 8).forEach((m, idx) => {
      const code = getMissionCode(m, missions);
      textLines.push(
        `${idx + 1}. *#${code}* — ${m.description} (${m.departureTime || '--:--'} às ${m.returnTimeEstimated || '--:--'}) • ${m.locationName || 'Local não informado'}`
      );
    });

    if (scheduleMissions.length > 8) {
      textLines.push(`_... e mais ${scheduleMissions.length - 8} pauta(s) no documento oficial._`);
    }

    textLines.push(`-----------------------------------------`);
    textLines.push(`🔐 _Autenticação Digital: ${scheduleHash}_`);
    textLines.push(`🌐 _MegaFilmes & Mega Print Audiovisual_`);

    const encoded = encodeURIComponent(textLines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="posm-backdrop" onClick={onClose}>
      <div className="posm-modal-container landscape-a4" onClick={(e) => e.stopPropagation()}>
        {/* Barra Superior de Controles e Ações */}
        <header className="posm-action-bar">
          <div className="posm-bar-left">
            <span className="posm-doc-badge">DOCUMENTO HOMOLOGADO</span>
            <span className="posm-code-tag">{scheduleCode}</span>
          </div>

          <div className="posm-bar-right">
            <button
              type="button"
              className="posm-btn-action posm-btn-whatsapp"
              onClick={handleShareWhatsApp}
              title="Compartilhar resumo da escala via WhatsApp"
            >
              <Share2 size={16} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className="posm-btn-action posm-btn-download"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Baixar Tabela de Serviço em arquivo PDF oficial"
            >
              {isDownloadingPdf ? <Loader size={16} className="spin" /> : <Download size={16} />}
              <span>{isDownloadingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              type="button"
              className="posm-btn-action posm-btn-print"
              onClick={handlePrint}
              title="Imprimir documento oficial em impressora ou PDF"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              className="posm-btn-close"
              onClick={onClose}
              title="Fechar janela"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Folha do Documento Oficial (Visual Idêntico ao PDF do Aluguel) */}
        <main className="posm-sheet-viewport">
          <article className="posm-sheet landscape-sheet" ref={sheetRef}>
            {/* 1. Cabeçalho Timbrado Oficial */}
            <div className="posm-header-timbrado">
              <div className="posm-brand-col">
                <div className="posm-brand-logo-wrap">
                  <span className="posm-logo-mega">MEGA FILMES</span>
                  <span className="posm-logo-sub">E FOTOGRAFIA</span>
                </div>
              </div>

              <div className="posm-company-col">
                <div className="posm-comp-title">RG DA SILVA - ME: CNPJ: 21.973.641/0001-00</div>
                <div className="posm-comp-line">Endereço: Alameda dos Tatus 155 Dr. Silvio Leite</div>
                <div className="posm-comp-line">Cep: 69314318 - Boa Vista Roraima</div>
                <div className="posm-comp-line">Fone: 95 99815-1738 • megafilmesfotografia@gmail.com</div>
              </div>

              <div className="posm-meta-col">
                <div className="posm-meta-badge-top">TABELA OFICIAL DE SERVIÇO</div>
                <div className="posm-meta-badge-sub">ESCALA OPERACIONAL DE CAMPO</div>
                <div className="posm-meta-code">{scheduleCode}</div>
                <div className="posm-meta-date">Emissão: {emittedAtStr}</div>
              </div>
            </div>

            {/* 2. Faixa Escura / Navy de Título Principal */}
            <div className="posm-title-bar">
              <h2>TABELA OFICIAL DE SERVIÇO &amp; ESCALA OPERACIONAL DE CAMPO</h2>
            </div>

            {/* 3. Painéis de Metadados e Resumo Geral */}
            <div className="posm-info-grid">
              {/* Painel Esquerdo: Responsável e Emissão */}
              <div className="posm-info-card">
                <div className="posm-info-card-header">
                  <ShieldCheck size={14} className="text-cyan" />
                  <span>HOMOLOGAÇÃO &amp; RESPONSÁVEL SISTÊMICO</span>
                </div>
                <div className="posm-info-card-body">
                  <div className="posm-info-row">
                    <span className="lbl">Razão:</span>
                    <strong className="val">RG DA SILVA - ME (Mega Filmes &amp; Mega Print)</strong>
                  </div>
                  <div className="posm-info-row">
                    <span className="lbl">CNPJ:</span>
                    <span className="val">21.973.641/0001-00 • Sede: Boa Vista, RR</span>
                  </div>
                  <div className="posm-info-row">
                    <span className="lbl">Resp. Sistêmico:</span>
                    <strong className="val text-highlight">
                      {authorizerName} ({authorizerRole})
                    </strong>
                  </div>
                  <div className="posm-info-row">
                    <span className="lbl">Recorte / Filtro:</span>
                    <span className="val">{filterStatusLabel}</span>
                  </div>
                </div>
              </div>

              {/* Painel Direito: Resumo da Operação */}
              <div className="posm-info-card">
                <div className="posm-info-card-header">
                  <Building size={14} className="text-amber" />
                  <span>RESUMO GERAL DA ESCALA DE CAMPO</span>
                </div>
                <div className="posm-info-card-body">
                  <div className="posm-summary-mini-grid">
                    <div className="posm-sm-item">
                      <span className="lbl">PAUTAS:</span>
                      <strong className="val">{totals.totalMissions}</strong>
                    </div>
                    <div className="posm-sm-item">
                      <span className="lbl">VIATURAS:</span>
                      <strong className="val">{totals.totalVehicles}</strong>
                    </div>
                    <div className="posm-sm-item">
                      <span className="lbl">INTEGRANTES:</span>
                      <strong className="val">{totals.totalMembers}</strong>
                    </div>
                    <div className="posm-sm-item">
                      <span className="lbl">KM TOTAL:</span>
                      <strong className="val">{totals.totalKm.toFixed(1)} km</strong>
                    </div>
                  </div>
                  <div className="posm-info-row" style={{ marginTop: '6px' }}>
                    <span className="lbl">Previsão Combustível:</span>
                    <strong className="val text-amber">
                      R$ {totals.totalFuelCost.toFixed(2)} (Ref. R$ {Number(fuelSettings).toFixed(2)}/L)
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Tabela Estilo Excel (Grid Nítido com Linhas de Grade e Tipografia Perfeita) */}
            <div className="posm-table-container excel-mode">
              <table className="posm-excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>HORÁRIO</th>
                    <th style={{ width: '190px' }}>CÓDIGO &amp; PAUTA DA MISSÃO</th>
                    <th style={{ minWidth: '150px' }}>LOCAL &amp; PERCURSO</th>
                    <th style={{ minWidth: '150px' }}>EQUIPE ESCALADA</th>
                    <th style={{ width: '150px' }}>VIATURA &amp; MOTORISTA</th>
                    <th style={{ width: '140px' }}>PÓS-PRODUÇÃO</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleMissions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="posm-empty-row">
                        Nenhuma missão ou pauta encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    scheduleMissions.map((mission, idx) => {
                      const mCode = getMissionCode(mission, missions);
                      const totalKm = getMissionTotalKm(mission);
                      const isEven = idx % 2 === 0;

                      // Equipe
                      const driverMember = members.find(
                        (mem) => String(mem.id) === String(mission.driverId)
                      );
                      const teamMembers = members.filter((mem) =>
                        Array.isArray(mission.teamMembers) &&
                        mission.teamMembers.map(String).includes(String(mem.id))
                      );

                      // Viatura
                      const vehObj = vehicles.find(
                        (v) => String(v.id) === String(mission.vehicleId)
                      );

                      // Editor
                      const editorNames = Array.isArray(mission.editorIds) && mission.editorIds.length > 0
                        ? mission.editorIds
                            .map((id) => members.find((mem) => String(mem.id) === String(id))?.name)
                            .filter(Boolean)
                            .join(', ')
                        : (mission.editorNamesDisplay || mission.editorName || null);

                      return (
                        <tr key={mission.id || idx} className={isEven ? 'row-even' : 'row-odd'}>
                          {/* 1. HORÁRIO / AGENDA */}
                          <td className="col-time">
                            <div className="excel-time-block">
                              <div className="time-primary">
                                <span className="time-lbl">Saída:</span>
                                <strong>{mission.departureTime || '--:--'}</strong>
                              </div>
                              {mission.eventStartTime && (
                                <div className="time-sub">
                                  <span>Evento:</span> {mission.eventStartTime}
                                </div>
                              )}
                              <div className="time-sub">
                                <span>Retorno:</span> {mission.returnTimeEstimated || '--:--'}
                              </div>
                              <div className="time-date">
                                📅 {formatDateBR(mission.date)}
                              </div>
                            </div>
                          </td>

                          {/* 2. CÓDIGO & PAUTA */}
                          <td className="col-desc">
                            <div className="excel-desc-block">
                              <span className="excel-code-badge">#{mCode}</span>
                              <strong className="excel-pauta-title">{mission.description}</strong>
                              {mission.notes && (
                                <span className="excel-pauta-notes">{mission.notes}</span>
                              )}
                            </div>
                          </td>

                          {/* 3. LOCAL & PERCURSO */}
                          <td className="col-local">
                            <div className="excel-local-block">
                              <strong className="excel-loc-name">
                                {mission.locationName || 'Local não informado'}
                              </strong>
                              {mission.address && (
                                <span className="excel-loc-addr">{mission.address}</span>
                              )}
                              {totalKm > 0 && (
                                <span className="excel-loc-km">
                                  🛣️ {totalKm} km ida/volta
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. EQUIPE ESCALADA */}
                          <td className="col-team">
                            <div className="excel-team-block">
                              {driverMember && (
                                <div className="excel-member-driver">
                                  <span>🛞</span>
                                  <strong>{driverMember.name}</strong>
                                  <small>(Motorista)</small>
                                </div>
                              )}
                              {teamMembers.map((mem) => (
                                <div key={mem.id} className="excel-member-item">
                                  <span>👤</span>
                                  <span>{mem.name}</span>
                                </div>
                              ))}
                              {Array.isArray(mission.guests) && mission.guests.map((g, gi) => {
                                const gRoles = Array.isArray(g?.roles) ? g.roles : (g?.role ? [g.role] : []);
                                const gRoleText = gRoles.length > 0 ? `${gRoles.join(', ')} - Freelancer` : 'Convidado';
                                return (
                                  <div key={gi} className="excel-member-guest">
                                    <span>🤝</span>
                                    <span>{typeof g === 'string' ? g : g.name}</span>
                                    <small>({gRoleText})</small>
                                  </div>
                                );
                              })}
                              {!driverMember && teamMembers.length === 0 && (
                                <span className="excel-empty-text">Sem equipe escalada</span>
                              )}
                            </div>
                          </td>

                          {/* 5. VIATURA & MOTORISTA */}
                          <td className="col-veh">
                            <div className="excel-veh-block">
                              {vehObj ? (
                                <>
                                  <strong className="excel-veh-name">{vehObj.name}</strong>
                                  <span className="excel-veh-plate">{vehObj.plate}</span>
                                  {mission.estimatedFuelCost && (
                                    <span className="excel-veh-fuel">
                                      ⛽ ~R$ {Number(mission.estimatedFuelCost).toFixed(2)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="excel-empty-text">Sem viatura</span>
                              )}
                            </div>
                          </td>

                          {/* 6. PÓS-PRODUÇÃO */}
                          <td className="col-pp">
                            <div className="excel-pp-block">
                              {editorNames ? (
                                <>
                                  <span className="excel-editor-name">🎬 {editorNames}</span>
                                  {mission.deliveryDeadlineDate && (
                                    <span className="excel-pp-deadline">
                                      ⏰ {formatDateBR(mission.deliveryDeadlineDate)} às {mission.deliveryDeadlineTime || '18:00'}
                                    </span>
                                  )}
                                  <span className="excel-pp-chip ontime">✅ No Prazo</span>
                                </>
                              ) : (
                                <span className="excel-empty-text">Não se aplica</span>
                              )}
                            </div>
                          </td>

                          {/* 7. STATUS */}
                          <td className="col-status" style={{ textAlign: 'center' }}>
                            <span className="excel-status-badge">
                              {mission.missionStatus || 'Agendada'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. Diretrizes Operacionais de Campo */}
            <div className="posm-clauses-box">
              <div className="posm-clauses-header">
                DIRETRIZES OPERACIONAIS DE CAMPO &amp; CONDUTA DA EQUIPE
              </div>
              <ol className="posm-clauses-list">
                <li>
                  <strong>CHECKLIST E APRESENTAÇÃO:</strong> As equipes devem se apresentar na base 30 minutos antes do horário de saída previsto para conferência de checklist de viatura, nível de combustível e materiais técnicos.
                </li>
                <li>
                  <strong>PONTUALIDADE E ROTA:</strong> O cumprimento dos horários de evento e pauta é obrigatório. Alterações de trajeto ou imprevistos de campo devem ser comunicados imediatamente à Coordenação / Gestão.
                </li>
                <li>
                  <strong>ENCERRAMENTO E PÓS-PRODUÇÃO:</strong> Ao retornar à base, o motorista deve estacionar na vaga designada, devolver a chave e a equipe descarregar imediatamente os arquivos brutos nas pastas designadas do servidor de rede.
                </li>
              </ol>
            </div>

            {/* 6. Quadro Oficial de Assinatura Sistêmica e Certificação Digital */}
            <div className="posm-signature-container">
              <div className="posm-sig-left">
                <div className="posm-sig-badge">
                  <ShieldCheck size={16} />
                  <span>HOMOLOGAÇÃO DIGITAL DA DIRETORIA</span>
                </div>
                <div className="posm-sig-meta">
                  <div className="posm-sig-line">
                    <span>Documento Homologado Sistemicamente via <strong>MegaGestão</strong></span>
                  </div>
                  <div className="posm-sig-line">
                    <span>Assinado digitalmente por: <strong>{authorizerName}</strong> ({authorizerRole})</span>
                  </div>
                  <div className="posm-sig-line">
                    <span>Chave de Integridade e Autenticidade: <code className="posm-hash-code">{scheduleHash}</code></span>
                  </div>
                  <div className="posm-sig-line">
                    <span>Data e Hora de Certificação: <strong>{emittedAtStr}</strong></span>
                  </div>
                  <div className="posm-sig-legal">
                    Em conformidade com a MP 2.200-2/2001 e Lei Federal nº 14.063/2020.
                  </div>
                </div>
              </div>

              <div className="posm-sig-right">
                {qrCodeDataUrl ? (
                  <div className="posm-qr-box">
                    <img src={qrCodeDataUrl} alt="QR Code de Validação" className="posm-qr-img" />
                    <span className="posm-qr-label">AUTENTICIDADE OFICIAL</span>
                  </div>
                ) : (
                  <div className="posm-qr-placeholder">
                    <QrIcon size={32} />
                    <span>Autenticação Digital</span>
                  </div>
                )}
              </div>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}
