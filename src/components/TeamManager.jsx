import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Briefcase,
  CheckCircle,
  Film,
  Building,
  Plus,
  X,
  Save,
  AlertCircle,
  Route,
  Clock,
  Tag,
  Settings2,
  Camera,
  Upload,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  KeyRound,
  ShieldCheck,
  Award,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  Car,
  Sparkles,
} from 'lucide-react';
import { getActiveMissionForMember as findActiveMissionForMember } from '../utils/geo';
import {
  ROLES,
  ROLE_CONFIG,
  normalizeRole,
  getCurrentUser,
  findUserByMemberId,
  validateAccountData,
  saveMemberAccount,
  removeMemberAccount,
} from '../utils/auth';
import {
  apiListUsers,
  apiCreateUser,
  apiDeleteUser,
  apiUpdateUserAvatar,
  apiUpdateUser,
  apiGetActiveGpsLocations,
} from '../utils/api';
import { confirmDialog, alertDialog } from '../utils/dialog';

// ====================================================
// Função utilitária: Recorta (quadrado central) e comprime
// foto de perfil para 256x256 JPEG leve para LocalStorage
// ====================================================
const processProfilePhoto = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido.'));
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

        // Recorte centralizado (center crop)
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
};

// ====================================================
// Função utilitária: Máscara automática de telefone
// Suporta celular (xx) xxxxx-xxxx e fixo (xx) xxxx-xxxx
// ====================================================
export const formatPhoneNumber = (value) => {
  if (!value) return '';
  // Remove tudo que não for dígito e limita em 11 números
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Celular com 9 dígitos: (xx) xxxxx-xxxx
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

// ====================================================
// Componente Principal: Gerenciador de Equipes
// ====================================================
export default function TeamManager({
  members = [],
  missions = [],
  roles = [],
  userRole = 'admin',
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onAddRole,
  onUpdateRole,
  onDeleteRole,
}) {
  const canAddMember = userRole === 'admin';
  const canEditMember = userRole === 'admin';
  const canDeleteMember = userRole === 'admin';
  // ---- Estados dos Modais ----
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const modalPhotoInputRef = useRef(null);
  const quickPhotoInputRef = useRef(null);
  const adminPhotoInputRef = useRef(null);
  const [quickPhotoTargetMember, setQuickPhotoTargetMember] = useState(null);
  const [targetAdminForPhoto, setTargetAdminForPhoto] = useState(null);
  const [copiedAdminEmail, setCopiedAdminEmail] = useState(null);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [adminToEdit, setAdminToEdit] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({ name: '', title: '', department: '', phone: '' });
  const [adminEditSaving, setAdminEditSaving] = useState(false);

  // Contador para forçar releitura das contas e administradores
  const [accountsVersion, setAccountsVersion] = useState(0);

  // ---- Subvisão: Equipes de Campo vs Administradores ----
  const [teamSubView, setTeamSubView] = useState('field'); // 'field' | 'admins'
  const [systemUsers, setSystemUsers] = useState([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    title: 'Diretor Geral & Produção',
    department: 'Diretoria Executiva',
    phone: '',
  });
  const [adminError, setAdminError] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  const [syncingUsers, setSyncingUsers] = useState(false);

  const handleManualSyncUsers = async (notify = true) => {
    setSyncingUsers(true);
    try {
      await loadSystemUsers();
      if (notify) {
        await alertDialog({
          title: 'Sincronização Concluída',
          message: 'Lista de usuários atualizada com sucesso a partir do banco de dados MySQL.',
          variant: 'success',
        });
      }
    } catch (err) {
      if (notify) {
        await alertDialog({
          title: 'Erro de Sincronização',
          message: 'Erro ao conectar ao servidor: ' + err.message,
          variant: 'danger',
        });
      }
    } finally {
      setSyncingUsers(false);
    }
  };

  const loadSystemUsers = async () => {
    try {
      const res = await apiListUsers();
      if (res.success && Array.isArray(res.users)) {
        setSystemUsers(res.users);
      }
    } catch (e) {
      console.warn('Erro ao carregar usuários:', e);
    }
  };

  useEffect(() => {
    loadSystemUsers();
  }, [accountsVersion]);

  // Polling em tempo real das posições GPS dos colaboradores
  const [activeGpsMap, setActiveGpsMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchGps = async () => {
      try {
        const res = await apiGetActiveGpsLocations();
        if (res.success && Array.isArray(res.locations)) {
          const map = {};
          res.locations.forEach((loc) => {
            const uRole = String(loc.userRole || '').trim().toLowerCase();
            const mRole = String(loc.memberRole || '').trim().toLowerCase();
            if (uRole === 'admin' || uRole === 'administrador') return;
            if (mRole === 'admin' || mRole === 'administrador') return;
            if (loc.memberId) map[loc.memberId] = loc;
            if (loc.memberName) map[loc.memberName.toLowerCase()] = loc;
          });
          if (isMounted) setActiveGpsMap(map);
        }
      } catch (e) {}
    };

    fetchGps();
    const interval = setInterval(fetchGps, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const [deletedAdminEmails, setDeletedAdminEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('gestormf_deleted_admins');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const adminUsers = useMemo(() => {
    const map = new Map();

    (systemUsers || []).forEach((u) => {
      if (normalizeRole(u.role) === ROLES.ADMIN) {
        const email = u.email?.toLowerCase();
        if (email) {
          map.set(email, { ...(map.get(email) || {}), ...u });
        }
      }
    });

    // Se o usuário atualmente logado for administrador, garante que esteja na lista
    const logged = getCurrentUser();
    if (logged && normalizeRole(logged.role) === ROLES.ADMIN && logged.email) {
      const loggedEmail = logged.email.toLowerCase();
      map.set(loggedEmail, { ...(map.get(loggedEmail) || {}), ...logged });
    }

    // Remove administradores que foram explicitamente excluídos
    deletedAdminEmails.forEach((delEmail) => {
      map.delete(delEmail.toLowerCase());
    });

    return Array.from(map.values());
  }, [systemUsers, deletedAdminEmails]);

  // Upload e Atualização Direta de Foto de Administrador
  const handleAdminPhotoClick = (admin) => {
    setTargetAdminForPhoto(admin);
    adminPhotoInputRef.current?.click();
  };

  const handleAdminPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetAdminForPhoto) return;
    try {
      const dataUrl = await processProfilePhoto(file);
      const res = await apiUpdateUserAvatar(targetAdminForPhoto.id, dataUrl);
      if (!res.success) {
        throw new Error(res.error || 'Falha ao salvar foto no banco MySQL.');
      }
      const updatedList = (systemUsers || []).map((u) =>
        u.id === targetAdminForPhoto.id || u.email.toLowerCase() === targetAdminForPhoto.email.toLowerCase()
          ? { ...u, avatar: dataUrl }
          : u
      );
      setSystemUsers(updatedList);

      const current = getCurrentUser();
      if (current && (current.id === targetAdminForPhoto.id || current.email.toLowerCase() === targetAdminForPhoto.email.toLowerCase())) {
        const updatedCurrent = { ...current, avatar: dataUrl };
        localStorage.setItem('gestormf_current_user', JSON.stringify(updatedCurrent));
        window.dispatchEvent(new Event('storage'));
      }

      setAccountsVersion((v) => v + 1);
    } catch (err) {
      await alertDialog({
        title: 'Erro na Foto',
        message: 'Erro ao atualizar foto: ' + err.message,
        variant: 'danger',
      });
    } finally {
      setTargetAdminForPhoto(null);
      e.target.value = '';
    }
  };

  // Exclusão de Administrador por outro Administrador
  const handleDeleteAdminClick = async (admin) => {
    const current = getCurrentUser();
    if (current && (current.id === admin.id || current.email?.toLowerCase() === admin.email?.toLowerCase())) {
      await alertDialog({
        title: 'Operação de Segurança',
        message: 'Você não pode excluir a sua própria conta de administrador.',
        variant: 'warning',
      });
      return;
    }
    if (adminUsers.length <= 1) {
      await alertDialog({
        title: 'Ação Bloqueada',
        message: 'O sistema precisa manter ao menos um Administrador mestre ativo.',
        variant: 'warning',
      });
      return;
    }
    setAdminToDelete(admin);
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    setIsDeletingAdmin(true);
    try {
      const res = await apiDeleteUser(adminToDelete.id);
      if (!res.success) {
        throw new Error(res.error || 'Erro ao excluir administrador no banco.');
      }
      const email = adminToDelete.email?.toLowerCase();
      const updatedDeleted = [...deletedAdminEmails, email];
      setDeletedAdminEmails(updatedDeleted);
      localStorage.setItem('gestormf_deleted_admins', JSON.stringify(updatedDeleted));

      const updatedList = (systemUsers || []).filter(
        (u) => u.id !== adminToDelete.id && u.email?.toLowerCase() !== email
      );
      setSystemUsers(updatedList);
      setAccountsVersion((v) => v + 1);
      setAdminToDelete(null);
    } catch (err) {
      await alertDialog({
        title: 'Erro ao Excluir',
        message: 'Erro ao excluir administrador: ' + err.message,
        variant: 'danger',
      });
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  // Edição de Dados do Administrador (Nome, Cargo, Departamento, Telefone)
  const handleOpenEditAdmin = (admin) => {
    setAdminToEdit(admin);
    setAdminEditForm({
      name: admin.name || '',
      title: admin.title || 'Diretor Geral & Produção',
      department: admin.department || 'Diretoria Executiva',
      phone: admin.phone || '',
    });
  };

  const handleSaveEditAdmin = async (e) => {
    e.preventDefault();
    if (!adminToEdit) return;
    setAdminEditSaving(true);
    try {
      const res = await apiUpdateUser(adminToEdit.id, adminEditForm);
      if (!res.success) {
        throw new Error(res.error || 'Erro ao salvar alterações no banco.');
      }
      const updatedList = (systemUsers || []).map((u) =>
        u.id === adminToEdit.id || u.email?.toLowerCase() === adminToEdit.email?.toLowerCase()
          ? { ...u, ...adminEditForm }
          : u
      );
      setSystemUsers(updatedList);

      const current = getCurrentUser();
      if (current && (current.id === adminToEdit.id || current.email?.toLowerCase() === adminToEdit.email?.toLowerCase())) {
        const updatedCurrent = { ...current, ...adminEditForm };
        localStorage.setItem('gestormf_current_user', JSON.stringify(updatedCurrent));
        window.dispatchEvent(new Event('storage'));
      }

      setAccountsVersion((v) => v + 1);
      setAdminToEdit(null);
    } catch (err) {
      await alertDialog({
        title: 'Erro ao Salvar',
        message: 'Erro ao atualizar dados: ' + err.message,
        variant: 'danger',
      });
    } finally {
      setAdminEditSaving(false);
    }
  };

  const handleCopyEmail = (email) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email);
      setCopiedAdminEmail(email);
      setTimeout(() => setCopiedAdminEmail(null), 2200);
    }
  };

  const handleAdminPhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setAdminFormData((prev) => ({ ...prev, phone: formatted }));
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminError('');

    if (!adminFormData.name.trim() || !adminFormData.email.trim() || !adminFormData.password) {
      setAdminError('Preencha nome, e-mail e senha de acesso.');
      return;
    }

    if (adminFormData.password.length < 6) {
      setAdminError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (adminFormData.password !== adminFormData.confirmPassword) {
      setAdminError('A confirmação da senha não confere.');
      return;
    }

    setAdminSaving(true);
    try {
      // 1. Tenta criar na API HostGator (MySQL com hash Bcrypt)
      const res = await apiCreateUser({
        name: adminFormData.name.trim(),
        email: adminFormData.email.trim(),
        password: adminFormData.password,
        role: 'ADMIN',
        title: adminFormData.title.trim() || 'Administrador do Sistema',
        department: adminFormData.department.trim() || 'Diretoria Executiva',
        phone: adminFormData.phone.trim(),
      });

      await loadSystemUsers();
      setAccountsVersion((v) => v + 1);
      setShowAddAdminModal(false);
      setAdminFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        title: 'Diretor Geral & Produção',
        department: 'Diretoria Executiva',
        phone: '',
      });
      await alertDialog({
        title: 'Administrador Cadastrado',
        message: `Administrador ${adminFormData.name.trim()} cadastrado com sucesso!`,
        variant: 'success',
      });
    } catch (err) {
      setAdminError(err.message || 'Erro ao cadastrar administrador.');
    } finally {
      setAdminSaving(false);
    }
  };

  // ---- Form State: Membro ----
  const EMPTY_ACCOUNT = {
    email: '',
    password: '',
    confirmPassword: '',
    accessRole: ROLES.USER,
  };
  const [formData, setFormData] = useState({
    name: '',
    role: roles[0] || 'Cinegrafista',
    company: 'MegaFilmes',
    phone: '',
    canDrive: false,
    cnhCategory: 'B',
    active: true,
    photoUrl: '',
  });
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [showPassword, setShowPassword] = useState(false);
  const [accountError, setAccountError] = useState('');
  const accountsByMember = React.useMemo(() => {
    const map = {};
    members.forEach((m) => {
      const linked = findUserByMemberId(m.id, m.name);
      if (linked) map[m.id] = linked;
    });
    return map;
  }, [accountsVersion, members]);
  const linkedAccountExists = !!(editingMember && findUserByMemberId(editingMember.id, editingMember.name));

  // ---- Estado do Gerenciador de Funções ----
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState(null); // { original, value }

  // ---- Handlers de Telefone ----
  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData((prev) => ({ ...prev, phone: formatted }));
  };

  // ---- Upload de Foto no Modal ----
  const handleModalPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processProfilePhoto(file);
      setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
    } catch (err) {
      await alertDialog({
        title: 'Formato da Foto',
        message: err.message,
        variant: 'warning',
      });
    }
    e.target.value = '';
  };

  // ---- Upload Rápido Direto no Card ----
  const handleQuickPhotoClick = (member) => {
    setQuickPhotoTargetMember(member);
    quickPhotoInputRef.current?.click();
  };

  const handleQuickPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !quickPhotoTargetMember) return;
    try {
      const dataUrl = await processProfilePhoto(file);
      onUpdateMember({ ...quickPhotoTargetMember, photoUrl: dataUrl });
    } catch (err) {
      await alertDialog({
        title: 'Formato da Foto',
        message: err.message,
        variant: 'warning',
      });
    }
    setQuickPhotoTargetMember(null);
    e.target.value = '';
  };

  // ---- Handlers de Membros ----
  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      role: roles[0] || 'Cinegrafista',
      secondaryRoles: [],
      company: 'MegaFilmes',
      phone: '',
      canDrive: false,
      cnhCategory: 'B',
      active: true,
      photoUrl: '',
      hourlyRate: 50,
      dailyRate: 200,
      rateModel: 'hourly',
      blockRate: 200,
      pixKey: '',
    });
    setAccount(EMPTY_ACCOUNT);
    setAccountError('');
    setShowPassword(false);
    setShowMemberModal(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    const parsedSec = Array.isArray(m.secondaryRoles)
      ? m.secondaryRoles
      : (m.secondary_roles ? (Array.isArray(m.secondary_roles) ? m.secondary_roles : JSON.parse(m.secondary_roles || '[]')) : []);

    setFormData({
      name: m.name,
      role: m.role || (roles[0] || 'Cinegrafista'),
      secondaryRoles: parsedSec,
      company: m.company || 'MegaFilmes',
      phone: formatPhoneNumber(m.phone || ''),
      canDrive: Boolean(m.canDrive ?? m.hasCnh),
      cnhCategory: m.cnhCategory || 'B',
      active: m.active ?? true,
      photoUrl: m.photoUrl || '',
      hourlyRate: Number(m.hourlyRate ?? m.hourly_rate ?? 50),
      dailyRate: Number(m.dailyRate ?? m.daily_rate ?? 200),
      rateModel: m.rateModel || m.rate_model || 'hourly',
      blockRate: Number(m.blockRate ?? m.block_rate ?? 200),
      pixKey: m.pixKey || m.pix_key || '',
    });
    const linked = findUserByMemberId(m.id, m.name);
    setAccount({
      email: linked ? linked.email : (m.email || ''),
      password: '',
      confirmPassword: '',
      accessRole: linked ? normalizeRole(linked.role) : ROLES.USER,
    });
    setAccountError('');
    setShowPassword(false);
    setShowMemberModal(true);
  };

  const handleSubmitMember = async (e) => {
    e.preventDefault();
    if (!formData.name) return;

    const memberId = editingMember ? editingMember.id : 'm-' + Date.now();
    const linkedUser = editingMember ? findUserByMemberId(editingMember.id, editingMember.name) : null;

    // ---- Validação obrigatória da conta de acesso ----
    const requirePassword = !linkedUser;
    const err = validateAccountData({
      email: account.email,
      password: account.password,
      requirePassword,
      ignoreUserId: linkedUser?.id,
    });
    if (err) {
      setAccountError(err);
      return;
    }
    if ((account.password || requirePassword) && account.password !== account.confirmPassword) {
      setAccountError('A confirmação da senha não confere.');
      return;
    }
    // Impede rebaixar o último administrador
    if (
      linkedUser &&
      normalizeRole(linkedUser.role) === ROLES.ADMIN &&
      normalizeRole(account.accessRole) !== ROLES.ADMIN &&
      (systemUsers || []).filter((u) => normalizeRole(u.role) === ROLES.ADMIN).length <= 1
    ) {
      setAccountError('O sistema precisa ter ao menos um Administrador.');
      return;
    }

    const memberPayload = {
      ...formData,
      hourlyRate: Number(formData.hourlyRate ?? 50),
      hourly_rate: Number(formData.hourlyRate ?? 50),
      dailyRate: Number(formData.dailyRate ?? 200),
      daily_rate: Number(formData.dailyRate ?? 200),
      rateModel: formData.rateModel || 'hourly',
      rate_model: formData.rateModel || 'hourly',
      blockRate: Number(formData.blockRate ?? 200),
      block_rate: Number(formData.blockRate ?? 200),
      pixKey: (formData.pixKey || '').trim(),
      pix_key: (formData.pixKey || '').trim(),
      id: memberId,
      email: account.email.trim(),
      account: {
        email: account.email.trim(),
        password: account.password,
        role: account.accessRole,
      }
    };

    if (editingMember) {
      onUpdateMember({ ...editingMember, ...memberPayload });
    } else {
      onAddMember(memberPayload);
    }

    saveMemberAccount(memberPayload, {
      email: account.email,
      password: account.password,
      role: account.accessRole,
    });

    // Sincroniza diretamente na tabela users do MySQL na HostGator
    try {
      if (linkedUser && linkedUser.id) {
        await apiUpdateUser(linkedUser.id, {
          name: formData.name.trim(),
          email: account.email.trim(),
          password: account.password || undefined,
          role: account.accessRole,
          title: formData.role || '',
          department: formData.company || 'MegaFilmes',
          phone: formData.phone || '',
        });
      } else {
        await apiCreateUser({
          name: formData.name.trim(),
          email: account.email.trim(),
          password: account.password,
          role: account.accessRole,
          title: formData.role || '',
          department: formData.company || 'MegaFilmes',
          phone: formData.phone || '',
        });
      }
    } catch (apiErr) {
      console.warn('Sincronização MySQL da conta do usuário executará em fallback:', apiErr);
    }

    setAccountsVersion((v) => v + 1);
    setShowMemberModal(false);
  };

  const handleDeleteMemberWithAccount = async (m) => {
    const linked = findUserByMemberId(m.id, m.name);
    if (linked) {
      if (getCurrentUser()?.id === linked.id) {
        await alertDialog({
          title: 'Operação de Segurança',
          message: 'Você não pode excluir o seu próprio cadastro.',
          variant: 'warning',
        });
        return;
      }
      const isLastAdmin =
        normalizeRole(linked.role) === ROLES.ADMIN &&
        (systemUsers || []).filter((u) => normalizeRole(u.role) === ROLES.ADMIN).length <= 1;
      if (isLastAdmin) {
        await alertDialog({
          title: 'Ação Bloqueada',
          message: 'O último Administrador mestre do sistema não pode ser excluído.',
          variant: 'warning',
        });
        return;
      }
    }

    const confirmed = await confirmDialog({
      title: 'Excluir Colaborador',
      message: `Tem certeza que deseja excluir o colaborador ${m.name}?`,
      description: linked
        ? `O membro e seu login de acesso (${linked.email}) serão removidos permanentemente.`
        : 'O perfil e histórico do colaborador serão removidos do sistema.',
      confirmText: 'Excluir Colaborador',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (confirmed) {
      onDeleteMember(m.id);
      if (linked) {
        removeMemberAccount(m.id);
        try {
          await apiDeleteUser(linked.id);
        } catch (delErr) {
          console.warn('Erro ao excluir usuário na API HostGator:', delErr);
        }
      }
      setAccountsVersion((v) => v + 1);
    }
  };

  // ---- Handlers de Funções ----
  const handleAddRole = async () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    await onAddRole(trimmed);
    setNewRoleName('');
  };

  const handleStartEditRole = (role) => {
    setEditingRole({ original: role, value: role });
  };

  const handleSaveEditRole = async () => {
    if (!editingRole) return;
    const trimmed = editingRole.value.trim();
    if (trimmed && trimmed !== editingRole.original) {
      await onUpdateRole(editingRole.original, trimmed);
    }
    setEditingRole(null);
  };

  const handleDeleteRole = async (role) => {
    const inUse = members.filter(
      (m) => m.role === role || (Array.isArray(m.secondaryRoles) && m.secondaryRoles.includes(role))
    ).length;
    if (inUse > 0) {
      await alertDialog({
        title: 'Função em Uso',
        message: `A função "${role}" está sendo usada por ${inUse} colaborador(es).`,
        description: 'Reatribua a função dos membros antes de excluí-la.',
        variant: 'warning',
      });
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Excluir Função',
      message: `Tem certeza que deseja excluir a função "${role}"?`,
      confirmText: 'Excluir Função',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (confirmed) {
      onDeleteRole(role);
    }
  };

  // ---- Utilitário: Detecta missão ativa ou em preparo (1h antes) de um membro ----
  const getActiveMissionForMember = (member) => findActiveMissionForMember(member, missions);

  // ---- Estatísticas da equipe ----
  const disponiveis = members.filter((m) => m.active && !getActiveMissionForMember(m)).length;
  const ocupados = members.filter((m) => getActiveMissionForMember(m)).length;
  const inativos = members.filter((m) => !m.active).length;

  return (
    <div className="team-manager-container">
      {/* ---- Cabeçalho ---- */}
      <div className="board-header">
        <div>
          <div className="board-badge">
            {teamSubView === 'field'
              ? 'EQUIPES & PROFISSIONAIS'
              : 'DIRETORIA & TI'}
          </div>
          <h1 className="board-main-title">
            {teamSubView === 'field'
              ? 'Membros e Equipes de Campo'
              : 'Administradores do Sistema'}
          </h1>
          <p className="board-subtitle">
            {teamSubView === 'field'
              ? 'Organização de diretores, cinegrafistas, pilotos de drone, editores e técnicos de campo'
              : 'Usuários com acesso total às configurações, gestão de frotas e controle geral da plataforma'}
          </p>
        </div>

        <div className="team-header-actions">
          {teamSubView === 'field' ? (
            <>
              <button className="btn-secondary" onClick={() => setShowRolesModal(true)}>
                <Settings2 size={15} /> Gerenciar Funções
              </button>
              {canAddMember && (
                <button className="btn-primary" onClick={handleOpenAdd}>
                  <UserPlus size={16} /> Novo Colaborador
                </button>
              )}
            </>
          ) : teamSubView === 'admins' ? (
            canAddMember && (
              <button
                className="btn-primary"
                onClick={() => {
                  setAdminError('');
                  setShowAddAdminModal(true);
                }}
              >
                <Shield size={16} /> Novo Administrador
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* ---- Seletor de Subvisão: Equipes vs Administradores vs Ranking ---- */}
      <div className="team-segmented-wrap">
        <div className="team-segmented-pill">
          <button
            type="button"
            className={`team-seg-btn ${teamSubView === 'field' ? 'is-active' : ''}`}
            onClick={() => setTeamSubView('field')}
          >
            <Users size={16} />
            <span className="seg-label">Equipes de Campo / Missões</span>
            <span className="seg-counter">{members.length}</span>
          </button>

          <button
            type="button"
            className={`team-seg-btn ${teamSubView === 'admins' ? 'is-active' : ''}`}
            onClick={() => setTeamSubView('admins')}
          >
            <Shield size={16} />
            <span className="seg-label">Administradores do Sistema</span>
            <span className="seg-counter admin-count">{adminUsers.length}</span>
          </button>
        </div>
      </div>

      {/* ---- Conteúdo da Subvisão (Equipes de Campo vs Administradores) ---- */}
      <>
        {teamSubView === 'field' ? (
        <div className="fleet-kpi-grid team-kpi-grid">
          <div className="kpi-card kpi-gold">
            <div className="kpi-icon-box bg-gold">
              <Users size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Total da Equipe</span>
              <span className="kpi-value">{members.length} Membros</span>
            </div>
          </div>

          <div className="kpi-card kpi-green">
            <div className="kpi-icon-box bg-green">
              <CheckCircle size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Disponíveis Agora</span>
              <span className="kpi-value">{disponiveis} Livres</span>
            </div>
          </div>

          <div className="kpi-card kpi-blue" style={{ borderColor: ocupados > 0 ? 'var(--accent-cyan)' : undefined }}>
            <div className="kpi-icon-box bg-blue">
              <Route size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Em Missão Agora</span>
              <span className="kpi-value" style={{ color: ocupados > 0 ? 'var(--accent-cyan)' : undefined }}>
                {ocupados} Ocupados
              </span>
            </div>
          </div>

          <div className="kpi-card kpi-purple">
            <div className="kpi-icon-box bg-purple">
              <Tag size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Funções Ativas</span>
              <span className="kpi-value">{roles.length} Funções</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="fleet-kpi-grid team-kpi-grid">
          <div className="kpi-card kpi-purple">
            <div className="kpi-icon-box bg-purple">
              <Shield size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Administradores</span>
              <span className="kpi-value">{adminUsers.length} Cadastrados</span>
            </div>
          </div>

          <div className="kpi-card kpi-gold">
            <div className="kpi-icon-box bg-gold">
              <Award size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Nível de Privilégio</span>
              <span className="kpi-value">Acesso Total (Root)</span>
            </div>
          </div>

          <div className="kpi-card kpi-green">
            <div className="kpi-icon-box bg-green">
              <CheckCircle size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Escala de Missões</span>
              <span className="kpi-value">Isento de Campo</span>
            </div>
          </div>

          <div className="kpi-card kpi-blue">
            <div className="kpi-icon-box bg-blue">
              <Lock size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Segurança do Banco</span>
              <span className="kpi-value">Hash Bcrypt</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Conteúdo da Visão Selecionada ---- */}
      {teamSubView === 'field' ? (
        members.length === 0 ? (
          <div className="team-empty-state-showcase">
            <div className="tes-icon-circle">
              <Users size={36} />
            </div>
            <h3 className="tes-title">Sua Equipe Operacional Está Pronta para Começar</h3>
            <p className="tes-desc">
              Cadastre os profissionais de campo (diretores de cena, cinegrafistas, pilotos de drone, fotógrafos e motoristas) que serão alocados nas missões e rotas.
            </p>
            <div className="tes-actions">
              {canAddMember && (
                <button className="btn-primary tes-btn-main" onClick={handleOpenAdd}>
                  <UserPlus size={16} /> Cadastrar Primeiro Colaborador
                </button>
              )}
              <button className="btn-secondary" onClick={() => setShowRolesModal(true)}>
                <Settings2 size={15} /> Gerenciar Funções ({roles.length})
              </button>
            </div>
          </div>
        ) : (
        <div className="team-cards-grid">
          {members.map((m) => {
            const activeMission = getActiveMissionForMember(m);
            const isOccupied = !!activeMission;
            const isInactive = !m.active;

            return (
              <div
                key={m.id}
                className={`team-card ${isOccupied ? 'card-occupied' : ''} ${isInactive ? 'card-inactive' : ''}`}
              >
                {/* Cabeçalho do Card */}
                <div className="team-card-header">
                  <div
                    className={`member-avatar member-avatar-clickable ${isOccupied ? 'avatar-occupied' : ''} ${isInactive ? 'avatar-inactive' : ''}`}
                    onClick={() => handleQuickPhotoClick(m)}
                    title="Clique para adicionar ou alterar foto de perfil"
                  >
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.name} className="member-avatar-img" />
                    ) : (
                      <span>{m.name.slice(0, 2).toUpperCase()}</span>
                    )}
                    <div className="avatar-camera-overlay">
                      <Camera size={15} />
                    </div>
                  </div>
                  <div className="member-meta">
                    <h3 className="member-name">{m.name}</h3>
                    <div className="member-role-stack">
                      <span className="member-role" title="Função Principal">
                        <Briefcase size={12} /> {m.role}
                      </span>
                      {Array.isArray(m.secondaryRoles) && m.secondaryRoles.length > 0 && (
                        <div className="member-secondary-roles-wrap">
                          {m.secondaryRoles.map((sr) => (
                            <span key={sr} className="member-sec-role-tag" title={`Função Adicional: ${sr}`}>
                              + {sr}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`member-company-tag ${m.company === 'Mega Print' ? 'tag-print' : 'tag-filmes'}`}>
                      {m.company}
                    </span>
                    {accountsByMember[m.id] && (() => {
                      const accRole = normalizeRole(accountsByMember[m.id].role);
                      const roleData = ROLE_CONFIG[accRole] || ROLE_CONFIG[ROLES.USER];
                      return (
                        <span
                          className="member-access-badge"
                          style={{
                            color: roleData.color,
                            background: roleData.accentBg,
                            borderColor: roleData.accentBorder,
                          }}
                          title={`Acesso ao sistema: ${accountsByMember[m.id].email}`}
                        >
                          <KeyRound size={10} /> {roleData.label}
                        </span>
                      );
                    })()}
                    {Boolean(m.canDrive ?? m.hasCnh) && (
                      <span
                        className="member-cnh-pill"
                        title={`Habilitado para conduzir viaturas da frota • CNH ${m.cnhCategory || 'B'}`}
                      >
                        <Car size={10} /> CNH {m.cnhCategory || 'B'}
                      </span>
                    )}
                    {(() => {
                      const mGps = activeGpsMap[m.id] || activeGpsMap[(m.name || '').toLowerCase()];
                      if (!mGps) return null;
                      const speedKmh = Math.round(Number(mGps.speed || 0) * 3.6);
                      const isMoving = speedKmh > 3;
                      return (
                        <span
                          className="member-live-gps-pill"
                          title={`GPS Ao Vivo: ±${Math.round(mGps.accuracy || 5)}m de precisão • ${isMoving ? `${speedKmh} km/h` : 'Parado'}`}
                        >
                          <span className={`live-gps-dot ${isMoving ? 'is-moving' : ''}`} />
                          <span>GPS Ao Vivo</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Banner de Missão Ativa / Em Preparo */}
                {isOccupied && (
                  <div
                    className={`active-mission-banner ${activeMission.missionStatus === 'Em Preparo' ? 'prep-mission-banner' : ''
                      }`}
                  >
                    <Route size={14} />
                    <div>
                      <strong>
                        {activeMission.missionStatus === 'Em Preparo'
                          ? 'Em preparo (1h antes):'
                          : 'Em execução:'}
                      </strong>{' '}
                      {activeMission.description}
                      <br />
                      <small>
                        Saída: {activeMission.departureTime} · {activeMission.locationName || activeMission.address}
                        {(activeMission.driverId === m.id ||
                          activeMission.driverName?.toLowerCase() === m.name.toLowerCase()) &&
                          ' · 🛞 Motorista da Viatura'}
                      </small>
                    </div>
                  </div>
                )}

                {/* Contato */}
                <div className="member-body">
                  {m.phone && (
                    <div className="member-contact-item">
                      <Phone size={13} />
                      <span>{m.phone}</span>
                    </div>
                  )}
                </div>

                {/* Rodapé do Card */}
                <div className="member-card-footer">
                  {isOccupied ? (
                    <span
                      className={`member-status-indicator occupied ${activeMission.missionStatus === 'Em Preparo' ? 'occupied-prep' : ''
                        }`}
                    >
                      <span className="pulse-dot"></span>
                      {activeMission.missionStatus === 'Em Preparo'
                        ? 'Ocupado — Em Preparo'
                        : 'Ocupado — Em Execução'}
                    </span>
                  ) : isInactive ? (
                    <span className="member-status-indicator inactive">
                      <span className="status-dot"></span>
                      Indisponível
                    </span>
                  ) : (
                    <span className="member-status-indicator active">
                      <span className="status-dot"></span>
                      Disponível para Missões
                    </span>
                  )}

                  <div className="card-btn-group">
                    {canEditMember && (
                      <button
                        className="btn-icon-action"
                        onClick={() => handleOpenEdit(m)}
                        title="Editar membro"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    {canDeleteMember && (
                      <button
                        className="btn-icon-action text-danger"
                        onClick={() => handleDeleteMemberWithAccount(m)}
                        title="Excluir membro"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )) : (
        /* ---- Seção de Administradores do Sistema ---- */
        <div className="admin-section-wrap">
          <div className="admin-explainer-banner">
            <div className="admin-explainer-icon">
              <Shield size={24} />
            </div>
            <div className="admin-explainer-text">
              <div className="admin-banner-title-row">
                <h4>Diretoria Executiva &amp; Administradores Mestre</h4>
                <span className="admin-banner-pill">
                  <Lock size={12} /> Isentos de Escala de Campo
                </span>
              </div>
              <p>
                Os usuários abaixo possuem credenciais de <strong>Administrador do Sistema</strong> com controle total e irrestrito sobre a plataforma.
                <strong> Por governança operacional, administradores não são vinculados a escalas de missões</strong>, mantendo as escalas e relatórios restritos aos membros operacionais de campo.
              </p>
            </div>
          </div>

          <div className="admin-cards-showcase-grid">
            {adminUsers.map((admin) => {
              const loggedUser = getCurrentUser();
              const isCurrentUser = loggedUser && (loggedUser.id === admin.id || loggedUser.email?.toLowerCase() === admin.email?.toLowerCase());
              const digitsPhone = admin.phone ? admin.phone.replace(/\D/g, '') : '';
              const whatsappUrl = digitsPhone.length >= 10 ? `https://wa.me/55${digitsPhone}?text=${encodeURIComponent('Olá ' + admin.name + ', contato pelo Mega Gestão.')}` : null;

              return (
                <div key={admin.id || admin.email} className={`executive-admin-card ${isCurrentUser ? 'is-self-admin' : ''}`}>
                  <div className="eac-top-stripe" />
                  <div className="eac-content">
                    <div className="eac-header">
                      <div
                        className="eac-avatar-wrap clickable-avatar"
                        onClick={() => handleAdminPhotoClick(admin)}
                        title="Clique para adicionar ou trocar foto de perfil"
                      >
                        {admin.avatar ? (
                          <img src={admin.avatar} alt={admin.name} className="eac-avatar-img" />
                        ) : (
                          <div className="eac-avatar-fallback">
                            {admin.name ? admin.name.slice(0, 2).toUpperCase() : 'AD'}
                          </div>
                        )}
                        <button
                          type="button"
                          className="eac-camera-trigger"
                          title="Alterar foto"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleAdminPhotoClick(admin);
                          }}
                        >
                          <Camera size={12} />
                        </button>
                        <div className="eac-shield-badge" title="Administrador Master Root">
                          <Shield size={13} />
                        </div>
                      </div>

                      <div className="eac-header-info">
                        <div className="eac-name-row">
                          <h3 className="eac-name">{admin.name}</h3>
                          <span className="eac-role-badge">ADMIN</span>
                          {isCurrentUser && (
                            <span className="eac-self-badge" title="Esta é sua conta conectada">
                              ✨ Você
                            </span>
                          )}
                        </div>
                        <span className="eac-title">
                          <Briefcase size={13} /> {admin.title || 'Diretor Geral & Produção'}
                        </span>
                        <span className="eac-dept">
                          <Building size={12} /> {admin.department || 'Diretoria Executiva'}
                        </span>
                        <div className="eac-status-row">
                          <span className="eac-live-dot" />
                          <span className="eac-live-text">Ativo no MySQL • Bcrypt Protegido</span>
                        </div>
                      </div>
                    </div>

                    <div className="eac-details">
                      <div className="eac-detail-row">
                        <div className="eac-detail-icon">
                          <Mail size={14} />
                        </div>
                        <span className="eac-detail-val">{admin.email}</span>
                        <button
                          type="button"
                          className="eac-copy-btn"
                          onClick={() => handleCopyEmail(admin.email)}
                          title="Copiar e-mail corporativo"
                        >
                          {copiedAdminEmail === admin.email ? (
                            <Check size={13} className="text-green" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>

                      {admin.phone ? (
                        <div className="eac-detail-row">
                          <div className="eac-detail-icon">
                            <Phone size={14} />
                          </div>
                          <span className="eac-detail-val">{admin.phone}</span>
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="eac-wa-btn"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle size={12} /> WhatsApp
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="eac-detail-row">
                          <div className="eac-detail-icon text-muted">
                            <Phone size={14} />
                          </div>
                          <span className="eac-detail-val text-muted">Sem telefone cadastrado</span>
                        </div>
                      )}

                      {/* Lista de Atribuições e Privilégios do Administrador */}
                      <div className="eac-privileges-box">
                        <div className="eac-priv-title">
                          <ShieldCheck size={13} />
                          <span>Privilégios &amp; Atribuições no Sistema</span>
                        </div>
                        <div className="eac-priv-tags">
                          <span className="eac-ptag">🛡️ Frotas &amp; Telemetria</span>
                          <span className="eac-ptag">📋 Pautas &amp; Missões</span>
                          <span className="eac-ptag">👥 Equipes &amp; Acessos</span>
                          <span className="eac-ptag">⚙️ Base &amp; Backups</span>
                          <span className="eac-ptag alert-exempt">🚫 Isento de Escala Operacional</span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Ações Executivas */}
                    <div className="eac-footer-actions">
                      <button
                        type="button"
                        className="eac-footer-btn btn-photo"
                        onClick={() => handleAdminPhotoClick(admin)}
                        title="Trocar a foto de perfil deste administrador"
                      >
                        <Camera size={13} /> Foto
                      </button>

                      <button
                        type="button"
                        className="eac-footer-btn btn-edit"
                        onClick={() => handleOpenEditAdmin(admin)}
                        title="Editar nome, cargo, departamento e telefone"
                      >
                        <Edit2 size={13} /> Editar
                      </button>

                      {!isCurrentUser ? (
                        <button
                          type="button"
                          className="eac-footer-btn btn-delete"
                          onClick={() => handleDeleteAdminClick(admin)}
                          title="Excluir este administrador do sistema"
                        >
                          <Trash2 size={13} /> Excluir
                        </button>
                      ) : (
                        <span className="eac-protected-tag" title="Conta ativa em uso no momento">
                          <Lock size={12} /> Conta Atual
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>

      {/* Input oculto para troca rápida de foto de membro de campo */}
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleQuickPhotoChange}
      />

      {/* Input oculto para troca de foto de administrador */}
      <input
        ref={adminPhotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAdminPhotoChange}
      />

      {/* =============================================================== */}
      {/* Modal de Confirmação de Exclusão de Administrador               */}
      {/* =============================================================== */}
      {adminToDelete && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-box danger-modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header danger-header">
              <div className="danger-header-title">
                <AlertTriangle size={22} className="danger-icon-alert" />
                <h2>Excluir Administrador</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAdminToDelete(null)}
                disabled={isDeletingAdmin}
              >
                ✕
              </button>
            </div>

            <div className="modal-body danger-modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.94rem', lineHeight: '1.5', marginBottom: '14px' }}>
                Tem certeza de que deseja remover e excluir o acesso do administrador{' '}
                <strong style={{ color: '#ef4444' }}>{adminToDelete.name}</strong> ({adminToDelete.email})?
              </p>
              <div className="danger-warning-notice">
                <AlertCircle size={16} />
                <span>
                  Esta conta perderá imediatamente as permissões de acesso ao sistema e ao banco de dados MySQL.
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setAdminToDelete(null)}
                disabled={isDeletingAdmin}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-modal-danger-confirm"
                onClick={handleConfirmDeleteAdmin}
                disabled={isDeletingAdmin}
              >
                {isDeletingAdmin ? 'Excluindo...' : 'Sim, Excluir Administrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Modal de Edição de Dados do Administrador                       */}
      {/* =============================================================== */}
      {adminToEdit && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--accent-gold, #f59e0b)' }} />
                <h2>Editar Administrador</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAdminToEdit(null)}
                disabled={adminEditSaving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditAdmin} className="modal-form" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={adminEditForm.name}
                  onChange={(e) => setAdminEditForm({ ...adminEditForm, name: e.target.value })}
                  placeholder="Nome do Administrador"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>E-mail Corporativo</label>
                <input
                  type="email"
                  disabled
                  value={adminToEdit.email}
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                />
                <small className="helper-text">O e-mail é a chave única de login e não pode ser alterado aqui.</small>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group flex-1">
                  <label>Cargo / Título</label>
                  <input
                    type="text"
                    value={adminEditForm.title}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, title: e.target.value })}
                    placeholder="Ex: Diretor Geral & Produção"
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Departamento</label>
                  <input
                    type="text"
                    value={adminEditForm.department}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, department: e.target.value })}
                    placeholder="Ex: Diretoria Executiva"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label>Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={adminEditForm.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setAdminEditForm({ ...adminEditForm, phone: formatted });
                  }}
                  placeholder="(95) 99123-4567"
                  maxLength={15}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setAdminToEdit(null)}
                  disabled={adminEditSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={adminEditSaving}
                >
                  <Save size={15} /> {adminEditSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Modal de Cadastro / Edição de Membro                            */}
      {/* =============================================================== */}
      {showMemberModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h2>{editingMember ? 'Editar Colaborador' : 'Novo Membro da Equipe'}</h2>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitMember} className="modal-form">
              {/* Seletor de Foto de Perfil */}
              <div className="member-photo-upload-row">
                <div
                  className="member-photo-preview-circle"
                  onClick={() => modalPhotoInputRef.current?.click()}
                  title="Clique para enviar uma foto"
                >
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Prévia" className="member-avatar-img" />
                  ) : formData.name ? (
                    <span>{formData.name.slice(0, 2).toUpperCase()}</span>
                  ) : (
                    <Camera size={24} />
                  )}
                  <div className="avatar-camera-overlay">
                    <Camera size={16} />
                  </div>
                </div>

                <div className="member-photo-upload-info">
                  <span className="photo-upload-title">Foto de Perfil do Colaborador</span>
                  <small className="helper-text">
                    JPG, PNG ou WebP. A imagem é ajustada automaticamente em formato circular.
                  </small>
                  <div className="member-photo-upload-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => modalPhotoInputRef.current?.click()}
                    >
                      <Upload size={13} /> {formData.photoUrl ? 'Trocar Foto' : 'Escolher Foto'}
                    </button>
                    {formData.photoUrl && (
                      <button
                        type="button"
                        className="btn-icon-action text-danger"
                        onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                        title="Remover foto"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={modalPhotoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleModalPhotoChange}
                />
              </div>

              <div className="form-group">
                <label>Nome Completo / Apelido no Quadro *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Teresa, Chame, Lucas Silva..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Função Principal *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({
                        ...formData,
                        role: newRole,
                        secondaryRoles: (formData.secondaryRoles || []).filter((r) => r !== newRole),
                      });
                    }}
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))
                    ) : (
                      <option value="Colaborador">Colaborador</option>
                    )}
                  </select>
                  <small className="helper-text">
                    Gerencie a lista de funções clicando em "Gerenciar Funções"
                  </small>
                </div>

                <div className="form-group flex-1">
                  <label>Empresa</label>
                  <select
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  >
                    <option value="MegaFilmes">MegaFilmes</option>
                    <option value="Mega Print">Mega Print</option>
                  </select>
                </div>
              </div>

              {/* ===== Funções Adicionais na Empresa (Multi-função) ===== */}
              <div className="form-group secondary-roles-group">
                <div className="secondary-roles-header">
                  <label className="secondary-roles-label">
                    <span>Funções Adicionais na Empresa</span>
                    <span className="secondary-roles-count">
                      {(formData.secondaryRoles || []).length > 0
                        ? `${(formData.secondaryRoles || []).length} selecionada(s)`
                        : 'Opcional'}
                    </span>
                  </label>
                  <small className="helper-text">
                    Marque todas as outras atividades que o colaborador também desempenha (ex: Mateus é Cinegrafista, mas também atua como Editor de Vídeo).
                  </small>
                </div>

                <div className="secondary-roles-chips-grid">
                  {roles
                    .filter((r) => r !== formData.role)
                    .map((r) => {
                      const isSelected = (formData.secondaryRoles || []).includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          className={`sec-role-chip-btn ${isSelected ? 'is-active' : ''}`}
                          onClick={() => {
                            setFormData((prev) => {
                              const curr = prev.secondaryRoles || [];
                              const next = curr.includes(r)
                                ? curr.filter((item) => item !== r)
                                : [...curr, r];
                              return { ...prev, secondaryRoles: next };
                            });
                          }}
                          title={`Clique para ${isSelected ? 'remover' : 'adicionar'} ${r}`}
                        >
                          <span className="src-chip-icon">{isSelected ? '✓' : '+'}</span>
                          <span className="src-chip-text">{r}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(95) 98765-4321"
                    maxLength={15}
                    value={formData.phone}
                    onChange={handlePhoneChange}
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Disponibilidade</label>
                  <select
                    value={formData.active ? 'sim' : 'nao'}
                    onChange={(e) => setFormData({ ...formData, active: e.target.value === 'sim' })}
                  >
                    <option value="sim">Disponível</option>
                    <option value="nao">Indisponível</option>
                  </select>
                </div>
              </div>

              {/* ===== Habilitação / Carteira de Motorista (CNH) ===== */}
              <div className="member-cnh-box">
                <div className="cnh-checkbox-row">
                  <label className="cnh-toggle-label">
                    <input
                      type="checkbox"
                      checked={formData.canDrive}
                      onChange={(e) => setFormData({ ...formData, canDrive: e.target.checked })}
                    />
                    <div className="cnh-toggle-info">
                      <div className="cnh-title-wrap">
                        <Car size={16} className="text-cyan-bright" />
                        <strong>Habilitado para Dirigir (Possui CNH)</strong>
                      </div>
                      <small className="helper-text">
                        Colaborador apto a conduzir viaturas da frota. Terá prioridade na lista de seleção de condutores ao criar missões.
                      </small>
                    </div>
                  </label>

                  {formData.canDrive && (
                    <div className="cnh-cat-wrap">
                      <label>Categoria CNH</label>
                      <select
                        value={formData.cnhCategory || 'B'}
                        onChange={(e) => setFormData({ ...formData, cnhCategory: e.target.value })}
                        className="cnh-cat-select"
                      >
                        <option value="B">Cat. B (Carro)</option>
                        <option value="AB">Cat. AB (Moto &amp; Carro)</option>
                        <option value="C">Cat. C (Caminhão Leve)</option>
                        <option value="D">Cat. D (Van / Passageiros)</option>
                        <option value="E">Cat. E (Veículo Pesado)</option>
                        <option value="A">Cat. A (Apenas Moto)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== Remuneração Individual, Diárias & Folha (Exclusivo Administrador) ===== */}
              {userRole === 'admin' && (
                <div className="member-finance-section">
                  <div className="member-access-header">
                    <strong style={{ color: '#10b981' }}>
                      <DollarSign size={15} /> Remuneração Individual &amp; Diárias (Folha)
                    </strong>
                    <small>
                      Configure as taxas praticadas para este colaborador em eventos locais e viagens longas.
                    </small>
                  </div>

                  <div className="member-finance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Modelo de Remuneração Local</label>
                      <select
                        value={formData.rateModel || 'hourly'}
                        onChange={(e) => setFormData({ ...formData, rateModel: e.target.value })}
                      >
                        <option value="hourly">Por Hora Exata (Padrão)</option>
                        <option value="block_4h">Por Bloco de 4 Horas (Pacote)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>
                        {formData.rateModel === 'block_4h' ? 'Valor do Bloco (4 Horas)' : 'Valor da Hora (R$/h)'}
                      </label>
                      <div className="finance-input-prefix-wrap" style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontWeight: 600, fontSize: '13px' }}>R$</span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          style={{ paddingLeft: '34px' }}
                          placeholder={formData.rateModel === 'block_4h' ? '200' : '50'}
                          value={formData.rateModel === 'block_4h' ? (formData.blockRate ?? 200) : (formData.hourlyRate ?? 50)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (formData.rateModel === 'block_4h') {
                              setFormData({ ...formData, blockRate: val });
                            } else {
                              setFormData({ ...formData, hourlyRate: val });
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Diária de Viagem Longa (+1 dia)</label>
                      <div className="finance-input-prefix-wrap" style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', fontWeight: 600, fontSize: '13px' }}>R$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          style={{ paddingLeft: '34px' }}
                          placeholder="200"
                          value={formData.dailyRate ?? 200}
                          onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Chave PIX (Para Pagamento)</label>
                      <div className="finance-input-prefix-wrap" style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#06b6d4', fontWeight: 600, fontSize: '11px' }}>PIX</span>
                        <input
                          type="text"
                          style={{ paddingLeft: '36px' }}
                          placeholder="CPF, celular, e-mail ou aleatória"
                          value={formData.pixKey || ''}
                          onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== Acesso ao Sistema e Credenciais (Obrigatório e Natural) ===== */}
              <div className="member-access-section">
                <div className="member-access-header">
                  <strong>
                    <KeyRound size={15} /> Acesso ao Sistema
                  </strong>
                  <small>
                    Defina o e-mail, senha e nível de acesso do colaborador para entrar no MegaGestão.
                  </small>
                </div>

                <div className="member-access-fields" style={{ paddingTop: '8px', borderTop: 'none' }}>
                  <div className="form-group">
                    <label>E-mail de Acesso *</label>
                    <div className="access-input-wrap">
                      <Mail size={15} />
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        placeholder="nome@empresa.com"
                        value={account.email}
                        onChange={(e) => {
                          setAccount({ ...account, email: e.target.value });
                          setAccountError('');
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>
                        {linkedAccountExists ? 'Nova Senha (opcional)' : 'Senha *'}
                      </label>
                      <div className="access-input-wrap">
                        <Lock size={15} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required={!linkedAccountExists}
                          placeholder={linkedAccountExists ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                          value={account.password}
                          onChange={(e) => {
                            setAccount({ ...account, password: e.target.value });
                            setAccountError('');
                          }}
                        />
                        <button
                          type="button"
                          className="access-eye-btn"
                          onClick={() => setShowPassword((s) => !s)}
                          title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group flex-1">
                      <label>Confirmar Senha {!linkedAccountExists ? '*' : ''}</label>
                      <div className="access-input-wrap">
                        <Lock size={15} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required={!linkedAccountExists || !!account.password}
                          placeholder="Repita a senha"
                          value={account.confirmPassword}
                          onChange={(e) => {
                            setAccount({ ...account, confirmPassword: e.target.value });
                            setAccountError('');
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      <Shield size={13} style={{ verticalAlign: '-2px' }} /> Nível de Acesso
                    </label>
                    <div className="access-role-options">
                      {Object.values(ROLES).map((r) => (
                        <button
                          type="button"
                          key={r}
                          className={`access-role-option ${account.accessRole === r ? 'selected' : ''}`}
                          style={
                            account.accessRole === r
                              ? {
                                  borderColor: ROLE_CONFIG[r].color,
                                  background: ROLE_CONFIG[r].accentBg,
                                }
                              : undefined
                          }
                          onClick={() => setAccount({ ...account, accessRole: r })}
                        >
                          <strong style={{ color: ROLE_CONFIG[r].color }}>{ROLE_CONFIG[r].label}</strong>
                          <small>{ROLE_CONFIG[r].description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {accountError && (
                  <div className="member-access-error" role="alert">
                    <AlertCircle size={14} /> {accountError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowMemberModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingMember ? 'Salvar Alterações' : 'Cadastrar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Modal de Gerenciamento de Funções                               */}
      {/* =============================================================== */}
      {showRolesModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h2>
                <Settings2 size={18} style={{ marginRight: 8 }} />
                Gerenciar Funções da Empresa
              </h2>
              <button className="modal-close" onClick={() => { setShowRolesModal(false); setEditingRole(null); }}>✕</button>
            </div>

            <div className="modal-form">
              <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>
                As funções cadastradas aqui ficam disponíveis ao adicionar ou editar colaboradores.
                Ao renomear uma função, todos os membros com essa função são atualizados automaticamente.
              </p>

              {/* Input de Nova Função */}
              <div className="role-add-row">
                <input
                  type="text"
                  className="role-input"
                  placeholder="Nome da nova função... (Ex: Colorista, Produtor)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole(); } }}
                />
                <button className="btn-primary" onClick={handleAddRole} disabled={!newRoleName.trim()}>
                  <Plus size={15} /> Adicionar
                </button>
              </div>

              {/* Lista de Funções */}
              <div className="roles-list">
                {roles.length === 0 ? (
                  <div className="empty-list-notice">
                    Nenhuma função cadastrada. Adicione acima.
                  </div>
                ) : (
                  roles.map((role) => {
                    const usersWithRole = members.filter((m) => m.role === role).length;
                    const isEditing = editingRole?.original === role;

                    return (
                      <div key={role} className="role-list-item">
                        {isEditing ? (
                          <>
                            <input
                              className="role-edit-input"
                              type="text"
                              value={editingRole.value}
                              autoFocus
                              onChange={(e) => setEditingRole({ ...editingRole, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleSaveEditRole(); }
                                if (e.key === 'Escape') setEditingRole(null);
                              }}
                            />
                            <div className="role-item-actions">
                              <button
                                className="btn-icon-action text-green"
                                onClick={handleSaveEditRole}
                                title="Salvar nome"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                className="btn-icon-action"
                                onClick={() => setEditingRole(null)}
                                title="Cancelar edição"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="role-item-info">
                              <span className="role-name">{role}</span>
                              <span className="role-usage-count">
                                {usersWithRole > 0
                                  ? `${usersWithRole} colaborador${usersWithRole > 1 ? 'es' : ''}`
                                  : 'Sem uso'}
                              </span>
                            </div>
                            <div className="role-item-actions">
                              <button
                                className="btn-icon-action"
                                onClick={() => handleStartEditRole(role)}
                                title="Renomear função"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn-icon-action text-danger"
                                onClick={() => handleDeleteRole(role)}
                                title="Excluir função"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-primary"
                  onClick={async () => {
                    if (newRoleName.trim()) {
                      await onAddRole(newRoleName.trim());
                      setNewRoleName('');
                    }
                    if (editingRole) {
                      await handleSaveEditRole();
                    }
                    setShowRolesModal(false);
                    setEditingRole(null);
                  }}
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* Modal de Cadastro de Novo Administrador                         */}
      {/* =============================================================== */}
      {showAddAdminModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>
                <Shield size={18} style={{ color: '#8b5cf6', marginRight: 8 }} />
                Novo Administrador do Sistema
              </h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowAddAdminModal(false);
                  setAdminError('');
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="modal-form">
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  color: '#c4b5fd',
                  marginBottom: '14px',
                }}
              >
                <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                Este usuário terá <strong>acesso total (root)</strong> às configurações, viaturas, auditoria e backups. Ele <strong>não</strong> participará de escalas de missões.
              </div>

              {adminError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    marginBottom: '14px',
                  }}
                >
                  {adminError}
                </div>
              )}

              <div className="form-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rodrigo Guedes"
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>E-mail Corporativo (Login) *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: rodrigo@megafilmes.local"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Cargo na Diretoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Diretor Geral & Produção"
                    value={adminFormData.title}
                    onChange={(e) => setAdminFormData((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Departamento</label>
                  <input
                    type="text"
                    placeholder="Ex: Diretoria Executiva"
                    value={adminFormData.department}
                    onChange={(e) => setAdminFormData((prev) => ({ ...prev, department: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Telefone / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(95) 99999-9999"
                  value={adminFormData.phone}
                  onChange={handleAdminPhoneChange}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Senha de Acesso *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 6 dígitos"
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted, #94a3b8)',
                        cursor: 'pointer',
                      }}
                    >
                      {showAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirmar Senha *</label>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    placeholder="Repita a senha"
                    value={adminFormData.confirmPassword}
                    onChange={(e) => setAdminFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddAdminModal(false)}
                  disabled={adminSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                  disabled={adminSaving}
                >
                  <Shield size={15} /> {adminSaving ? 'Salvando...' : 'Cadastrar Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
