import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  Check,
  Shield,
  Sparkles,
  Save,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import { ROLE_CONFIG, ROLES, setCurrentUser, normalizeRole } from '../utils/auth';
import { apiUpdateProfile, apiChangePassword } from '../utils/api';

// Utilitário para recortar e comprimir a foto de perfil (256x256 JPEG)
const processProfilePhoto = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Recorte centralizado quadrado
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => reject(new Error('Erro ao processar imagem.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
};

export default function UserProfileModal({ isOpen, onClose, currentUser, onUserUpdated }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });
  const fileInputRef = useRef(null);

  // Recarrega os campos sempre que a janela é aberta
  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setDepartment(currentUser.department || '');
      setAvatar(currentUser.avatar || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setFeedback({ type: '', msg: '' });
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen || !currentUser) return null;

  const userRole = normalizeRole(currentUser?.role);
  const roleInfo = ROLE_CONFIG[userRole] || ROLE_CONFIG[ROLES.USER];

  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processProfilePhoto(file);
      setAvatar(dataUrl);
      setFeedback({ type: 'success', msg: 'Foto carregada! Clique em "Salvar Alterações" para confirmar.' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Erro ao carregar foto.' });
    }
    e.target.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', msg: '' });

    if (!name.trim()) {
      setFeedback({ type: 'error', msg: 'O nome completo não pode ficar em branco.' });
      return;
    }

    // Se estiver tentando alterar a senha
    let updatedPassword = currentUser.password;
    if (newPassword || currentPassword) {
      if (currentPassword !== currentUser.password) {
        setFeedback({ type: 'error', msg: 'A senha atual digitada está incorreta.' });
        return;
      }
      if (newPassword.length < 6) {
        setFeedback({ type: 'error', msg: 'A nova senha deve possuir pelo menos 6 caracteres.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback({ type: 'error', msg: 'A nova senha e a confirmação não coincidem.' });
        return;
      }

      // Altera na API segura da HostGator (Bcrypt)
      try {
        const passRes = await apiChangePassword(currentPassword, newPassword);
        if (!passRes.success && !passRes.networkError) {
          setFeedback({ type: 'error', msg: passRes.error || 'Erro ao alterar senha na API.' });
          return;
        }
      } catch (err) {
        // segue se offline
      }

      updatedPassword = newPassword;
    }

    const updatedUser = {
      ...currentUser,
      name: name.trim(),
      phone: phone.trim(),
      department: department.trim(),
      avatar: avatar,
      password: updatedPassword,
    };

    // Atualiza na API
    try {
      await apiUpdateProfile({
        name: updatedUser.name,
        phone: updatedUser.phone,
        department: updatedUser.department,
        avatar: updatedUser.avatar
      });
    } catch (err) {
      // segue se offline
    }

    setCurrentUser(updatedUser);
    onUserUpdated(updatedUser);

    setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' });
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container user-profile-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ background: roleInfo.accentBg, color: roleInfo.color }}>
              <User size={20} />
            </div>
            <div>
              <h2>Meu Perfil & Credenciais</h2>
              <p>Gerencie seus dados de identificação e preferências de segurança</p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Fechar Janela">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body profile-modal-body">
          {/* Cartão de Destaque do Usuário com Avatar Interativo */}
          <div className="profile-identity-card">
            <div
              className="profile-avatar-wrap"
              style={{ borderColor: roleInfo.color }}
              onClick={() => fileInputRef.current?.click()}
              title="Clique para alterar a foto de perfil"
            >
              {avatar ? (
                <img src={avatar} alt={name || currentUser.name} className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-initials" style={{ background: roleInfo.color }}>
                  {(name || currentUser.name || 'US').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="profile-avatar-overlay">
                <Camera size={18} />
              </div>
              <button
                type="button"
                className="profile-avatar-badge-btn"
                title="Escolher foto"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Camera size={12} />
              </button>
            </div>

            <div className="profile-identity-details">
              <div className="profile-name-row">
                <h3 className="profile-user-name">{name || currentUser.name}</h3>
                <span className={`role-pill ${roleInfo.badgeClass}`}>
                  {roleInfo.label}
                </span>
              </div>
              <p className="profile-user-email">{currentUser.email}</p>
              <p className="profile-user-title">{currentUser.title || roleInfo.description}</p>

              <div className="profile-photo-buttons-row">
                <button
                  type="button"
                  className="btn-profile-photo-action"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={12} /> {avatar ? 'Trocar Foto' : 'Adicionar Foto'}
                </button>
                {avatar && (
                  <button
                    type="button"
                    className="btn-profile-photo-action text-danger"
                    onClick={() => {
                      setAvatar('');
                      setFeedback({ type: 'success', msg: 'Foto removida! Clique em "Salvar Alterações" para confirmar.' });
                    }}
                    title="Remover foto atual"
                  >
                    <Trash2 size={12} /> Remover Foto
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoFileChange}
            />
          </div>

          {/* Mensagens de Feedback */}
          {feedback.msg && (
            <div className={`profile-feedback-box feedback-${feedback.type}`}>
              {feedback.type === 'success' ? <Check size={16} /> : null}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Dados Pessoais */}
          <div className="profile-section-block">
            <h4 className="profile-section-title">
              <User size={15} /> Informações Pessoais
            </h4>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <div className="input-with-icon">
                  <User size={15} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">E-mail Corporativo</label>
                <div className="input-with-icon">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    className="form-input input-disabled"
                    value={currentUser.email}
                    disabled
                    title="O e-mail corporativo é gerenciado pelo Administrador"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <div className="input-with-icon">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(95) 99000-0000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Departamento / Setor</label>
                <div className="input-with-icon">
                  <Briefcase size={15} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ex: Operações, Logística..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alteração de Senha */}
          <div className="profile-section-block">
            <div className="profile-section-header">
              <h4 className="profile-section-title">
                <Lock size={15} /> Segurança & Alteração de Senha
              </h4>
              <button
                type="button"
                className="btn-toggle-pwd-view"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPassword ? 'Ocultar Senhas' : 'Exibir Senhas'}</span>
              </button>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Senha Atual</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Senha atual..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Mínimo 6 caracteres..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar Nova Senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Repita a nova senha..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Save size={15} />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

