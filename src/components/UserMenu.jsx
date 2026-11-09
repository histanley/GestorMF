import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Briefcase,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Lock,
  Bell,
  Sliders,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import {
  ROLE_CONFIG,
  ROLES,
  normalizeRole
} from '../utils/auth';

export default function UserMenu({
  currentUser,
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onOpenPermissions,
  compactMode,
  setCompactMode,
  soundAlerts,
  setSoundAlerts
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const userRole = normalizeRole(currentUser?.role);
  const roleInfo = ROLE_CONFIG[userRole] || ROLE_CONFIG[ROLES.USER];

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="user-menu-container" ref={menuRef}>
      {/* Botão de Trigger do Header com Avatar */}
      <button
        type="button"
        className={`user-menu-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={`Logado como ${currentUser?.name} (${roleInfo.label})`}
        aria-expanded={isOpen}
      >
        <div className="user-avatar-wrapper" style={{ borderColor: roleInfo.color }}>
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar-image" />
          ) : (
            <div className="user-avatar-fallback" style={{ background: roleInfo.color }}>
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
          )}
          <span className="user-online-dot" />
        </div>

        <div className="user-trigger-info">
          <span className="user-trigger-name" title={currentUser?.name}>
            {currentUser?.name ? (
              currentUser.name.trim().split(/\s+/).length > 1
                ? `${currentUser.name.trim().split(/\s+/)[0]} ${currentUser.name.trim().split(/\s+/)[1][0]}.`
                : currentUser.name
            ) : 'Usuário'}
          </span>
          <span className={`user-role-badge ${roleInfo.badgeClass}`}>
            {userRole === ROLES.ADMIN && <Shield size={10} />}
            {userRole === ROLES.MANAGER && <Briefcase size={10} />}
            {userRole === ROLES.USER && <User size={10} />}
            {roleInfo.label}
          </span>
        </div>

        <ChevronDown size={14} className={`user-trigger-arrow ${isOpen ? 'rotated' : ''}`} />
      </button>

      {/* Dropdown Menu com Configurações e Ações */}
      {isOpen && (
        <div className="user-dropdown-panel animate-scale-down">
          {/* Header do Dropdown com Perfil Completo */}
          <div className="user-dropdown-header">
            <div className="dropdown-avatar-wrap" style={{ borderColor: roleInfo.color }}>
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="dropdown-avatar-img" />
              ) : (
                <div className="dropdown-avatar-initials" style={{ background: roleInfo.color }}>
                  {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
                </div>
              )}
            </div>
            <div className="dropdown-user-meta">
              <h4 className="dropdown-user-fullname">{currentUser?.name}</h4>
              <p className="dropdown-user-email">{currentUser?.email}</p>
              <div className="dropdown-badges-row">
                <span className={`role-pill ${roleInfo.badgeClass}`}>
                  {roleInfo.label}
                </span>
                <span className="dropdown-dept-tag">
                  {currentUser?.department || 'Operações'}
                </span>
              </div>
            </div>
          </div>

          {/* Preferências & Configurações Pessoais */}
          <div className="dropdown-section">
            <div className="dropdown-section-label">
              <Sliders size={13} />
              <span>Configurações & Preferências</span>
            </div>

            <button
              type="button"
              className="dropdown-menu-item"
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
            >
              <User size={15} className="item-icon-left" />
              <div className="item-text-group">
                <span>Meu Perfil & Senha</span>
                <small>Editar dados cadastrais e credenciais</small>
              </div>
            </button>

            <button
              type="button"
              className="dropdown-menu-item"
              onClick={() => {
                setIsOpen(false);
                onOpenPermissions();
              }}
            >
              <ShieldCheck size={15} className="item-icon-left" />
              <div className="item-text-group">
                <span>Permissões do Seu Nível</span>
                <small>Consultar privilégios operacionais</small>
              </div>
            </button>

            {/* Alternância de Notificações Sonoras */}
            <div className="dropdown-toggle-item">
              <div className="toggle-item-left">
                <Bell size={15} className="item-icon-left" />
                <div className="item-text-group">
                  <span>Alertas Sonoros de Frotas</span>
                  <small>Aviso de reserva ≤ 10%</small>
                </div>
              </div>
              <label className="custom-switch">
                <input
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>

            {/* Modo Compacto de Exibição */}
            <div className="dropdown-toggle-item">
              <div className="toggle-item-left">
                <Sliders size={15} className="item-icon-left" />
                <div className="item-text-group">
                  <span>Modo Compacto</span>
                  <small>Otimizar espaço em telas menores</small>
                </div>
              </div>
              <label className="custom-switch">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>

            {/* Configurações Globais (Apenas Admin) */}
            {userRole === ROLES.ADMIN && (
              <button
                type="button"
                className="dropdown-menu-item highlight-admin"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
              >
                <Settings size={15} className="item-icon-left" />
                <div className="item-text-group">
                  <span>Configurações da Base & Sistema</span>
                  <small>Sede, combustível base e backups</small>
                </div>
              </button>
            )}
          </div>

          {/* Seção 3: Logout */}
          <div className="dropdown-footer">
            <button
              type="button"
              className="btn-dropdown-logout"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <LogOut size={15} />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

