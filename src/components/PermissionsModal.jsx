import React from 'react';
import {
  Shield,
  Briefcase,
  User,
  Check,
  X,
  Lock,
  Sparkles,
  Info,
  Sliders,
  Car,
  Users,
  CalendarCheck,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { ROLES, ROLE_CONFIG, normalizeRole } from '../utils/auth';

export default function PermissionsModal({ isOpen, onClose, currentRole }) {
  if (!isOpen) return null;

  const activeRole = normalizeRole(currentRole);

  const permissionsMatrix = [
    {
      category: 'Configurações Mestres & Sistema',
      icon: Sliders,
      badgeColor: '#8b5cf6',
      items: [
        {
          label: 'Configurar Coordenadas e Endereço da Base Sede',
          admin: true,
          manager: false,
          user: false,
          desc: 'Alteração do ponto zero para cálculos de rotas e quilometragem',
        },
        {
          label: 'Preço Base do Combustível por Litro (Gasolina/Diesel)',
          admin: true,
          manager: false,
          user: false,
          desc: 'Tarifação global aplicada em todas as estimativas automáticas',
        },
        {
          label: 'Backup, Restauração de Dados e Logs de Auditoria',
          admin: true,
          manager: false,
          user: false,
          desc: 'Exportação e reinicialização completa do banco de dados',
        },
      ],
    },
    {
      category: 'Gestão de Frotas, Abastecimento & Combustível',
      icon: Car,
      badgeColor: '#0ea5e9',
      items: [
        {
          label: 'Visualizar Aba e Módulo "Viaturas & Combustível"',
          admin: true,
          manager: true,
          user: false,
          desc: 'Exibição da aba no menu principal e acesso ao painel de frotas',
        },
        {
          label: 'Lançar Novos Abastecimentos e Registros',
          admin: true,
          manager: true,
          user: false,
          desc: 'Registro de cupom fiscal, litros abastecidos e valor em R$',
        },
        {
          label: 'Calibragem de Tanque & Correção de Odômetro (KM)',
          admin: true,
          manager: true,
          user: false,
          desc: 'Ajuste fino de telemetria após conferência física da viatura',
        },
        {
          label: 'Cadastrar e Editar Viaturas da Frota',
          admin: true,
          manager: true,
          user: false,
          desc: 'Adicionar novos veículos, alterar consumo e capacidade de tanque',
        },
        {
          label: 'Excluir Viaturas do Sistema',
          admin: true,
          manager: false,
          user: false,
          desc: 'Remoção definitiva de veículo do inventário corporativo',
        },
      ],
    },
    {
      category: 'Gestão de Equipes & Colaboradores',
      icon: Users,
      badgeColor: '#f59e0b',
      items: [
        {
          label: 'Visualizar Aba e Módulo "Equipes"',
          admin: true,
          manager: true,
          user: false,
          desc: 'Exibição da aba no menu principal e consulta aos colaboradores',
        },
        {
          label: 'Cadastrar Novos Membros e Editar Dados',
          admin: true,
          manager: true,
          user: false,
          desc: 'Adicionar fotógrafos, cinegrafistas, motoristas e assistentes',
        },
        {
          label: 'Alterar Cargos, Funções e Permissão para Conduzir',
          admin: true,
          manager: true,
          user: false,
          desc: 'Habilitar motorista e definir especialidades técnicas',
        },
        {
          label: 'Excluir Membros da Equipe',
          admin: true,
          manager: false,
          user: false,
          desc: 'Remover cadastro de colaborador do sistema',
        },
      ],
    },
    {
      category: 'Agendamento & Gestão de Missões',
      icon: CalendarCheck,
      badgeColor: '#10b981',
      items: [
        {
          label: 'Criar Novas Missões e Definir Rotas no Mapa',
          admin: true,
          manager: true,
          user: false,
          desc: 'Seleção de cliente, viatura, motorista e escala de equipe',
        },
        {
          label: 'Editar Dados de Missão em Aberto',
          admin: true,
          manager: true,
          user: false,
          desc: 'Alteração de horário, localização ou remanejamento de frota',
        },
        {
          label: 'Atualizar Status em Andamento (Saiu / Em Execução / Concluída)',
          admin: true,
          manager: true,
          user: true,
          desc: 'Operadores podem marcar a missão como iniciada ou finalizada',
        },
        {
          label: 'Aprovar ou Rejeitar Pós-Produção (Confirmar Finalização / Reabrir)',
          admin: true,
          manager: false,
          user: false,
          desc: 'Apenas Administradores podem aceitar o material concluído ou devolver para ajustes',
        },
        {
          label: 'Excluir Missões Agendadas ou Histórico',
          admin: true,
          manager: false,
          user: false,
          desc: 'Exclusão permanente de registro de missão',
        },
      ],
    },
  ];

  const allItems = permissionsMatrix.flatMap((s) => s.items);
  const totalCount = allItems.length;
  const allowedCount = allItems.filter((item) => {
    if (activeRole === ROLES.ADMIN) return item.admin;
    if (activeRole === ROLES.MANAGER) return item.manager;
    return item.user;
  }).length;

  const roleLabel = ROLE_CONFIG[activeRole]?.label || 'Usuário';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container permissions-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Premium do Modal */}
        <div className="modal-header perm-modal-header">
          <div className="modal-title-group">
            <div className="perm-header-icon-box">
              <Shield size={24} />
            </div>
            <div>
              <div className="perm-header-top-row">
                <h2>Matriz de Permissões e Níveis de Acesso</h2>
                <span className="perm-version-chip">RBAC v5.0</span>
              </div>
              <p>Compare os privilégios operacionais entre Administrador, Gestor e Usuário</p>
            </div>
          </div>
          <button className="btn-close-modal perm-btn-close" onClick={onClose} title="Fechar Janela">
            ✕
          </button>
        </div>

        <div className="modal-body permissions-modal-body">
          {/* Banner Executivo de Nível Atual */}
          <div className={`current-role-banner banner-role-${activeRole}`}>
            <div className="crb-left">
              <div className="crb-indicator-pulse"></div>
              <div className="crb-text">
                <span className="crb-eyebrow">SEU NÍVEL ATUAL NO SISTEMA</span>
                <strong className="crb-role-title">
                  {roleLabel}
                  <span className="crb-score-badge">
                    {allowedCount} de {totalCount} recursos liberados
                  </span>
                </strong>
              </div>
            </div>
            <div className="crb-right-hint">
              <Sparkles size={14} />
              <span>Sua coluna está destacada em tempo real na tabela</span>
            </div>
          </div>

          {/* Tabela de Níveis e Permissões */}
          <div className="perm-table-container">
            <table className="perm-table">
              <thead>
                <tr>
                  <th className="th-feature">
                    <span className="th-feature-title">Funcionalidade / Ação do Sistema</span>
                    <span className="th-feature-sub">Recursos divididos por áreas operacionais</span>
                  </th>

                  <th className={`th-role col-admin ${activeRole === ROLES.ADMIN ? 'is-active-col' : ''}`}>
                    <div className="th-role-card">
                      <div className="th-role-icon-box icon-admin">
                        <Shield size={16} />
                      </div>
                      <div className="th-role-text">
                        <span className="th-role-name">Administrador</span>
                        <span className="th-role-desc">Acesso Root Total</span>
                      </div>
                      {activeRole === ROLES.ADMIN && (
                        <span className="role-active-badge">SEU NÍVEL</span>
                      )}
                    </div>
                  </th>

                  <th className={`th-role col-manager ${activeRole === ROLES.MANAGER ? 'is-active-col' : ''}`}>
                    <div className="th-role-card">
                      <div className="th-role-icon-box icon-manager">
                        <Briefcase size={16} />
                      </div>
                      <div className="th-role-text">
                        <span className="th-role-name">Gestor</span>
                        <span className="th-role-desc">Frotas &amp; Pautas</span>
                      </div>
                      {activeRole === ROLES.MANAGER && (
                        <span className="role-active-badge">SEU NÍVEL</span>
                      )}
                    </div>
                  </th>

                  <th className={`th-role col-user ${activeRole === ROLES.USER ? 'is-active-col' : ''}`}>
                    <div className="th-role-card">
                      <div className="th-role-icon-box icon-user">
                        <User size={16} />
                      </div>
                      <div className="th-role-text">
                        <span className="th-role-name">Usuário</span>
                        <span className="th-role-desc">Operador de Campo</span>
                      </div>
                      {activeRole === ROLES.USER && (
                        <span className="role-active-badge">SEU NÍVEL</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {permissionsMatrix.map((section, sIdx) => {
                  const SectionIcon = section.icon;
                  return (
                    <React.Fragment key={sIdx}>
                      <tr className="tr-category">
                        <td colSpan={4}>
                          <div className="category-header-wrap">
                            <span className="cat-icon-chip" style={{ color: section.badgeColor }}>
                              <SectionIcon size={14} />
                            </span>
                            <span className="cat-title-text">{section.category}</span>
                            <span className="cat-count-pill">{section.items.length} itens</span>
                          </div>
                        </td>
                      </tr>
                      {section.items.map((item, iIdx) => (
                        <tr key={iIdx} className="tr-item">
                          <td className="td-feature">
                            <div className="td-feature-content">
                              <strong className="feature-label">{item.label}</strong>
                              <span className="feature-desc">{item.desc}</span>
                            </div>
                          </td>

                          <td className={`td-status col-admin ${activeRole === ROLES.ADMIN ? 'is-active-col' : ''}`}>
                            {item.admin ? (
                              <span className="badge-perm-yes">
                                <Check size={13} strokeWidth={2.8} /> Permitido
                              </span>
                            ) : (
                              <span className="badge-perm-no">
                                <X size={13} strokeWidth={2.5} /> Bloqueado
                              </span>
                            )}
                          </td>

                          <td className={`td-status col-manager ${activeRole === ROLES.MANAGER ? 'is-active-col' : ''}`}>
                            {item.manager ? (
                              <span className="badge-perm-yes">
                                <Check size={13} strokeWidth={2.8} /> Permitido
                              </span>
                            ) : (
                              <span className="badge-perm-no">
                                <X size={13} strokeWidth={2.5} /> Bloqueado
                              </span>
                            )}
                          </td>

                          <td className={`td-status col-user ${activeRole === ROLES.USER ? 'is-active-col' : ''}`}>
                            {item.user ? (
                              <span className="badge-perm-yes">
                                <Check size={13} strokeWidth={2.8} /> Permitido
                              </span>
                            ) : (
                              <span className="badge-perm-no">
                                <X size={13} strokeWidth={2.5} /> Bloqueado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé Executivo */}
        <div className="modal-footer perm-modal-footer">
          <div className="perm-footer-info">
            <Lock size={15} className="lock-icon" />
            <span>
              Políticas de governança baseadas em controle de acesso por função (RBAC).
            </span>
          </div>
          <button type="button" className="btn-primary perm-btn-done" onClick={onClose}>
            Entendido e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
