// ==============================================================================
// GestorMF - Motor Inteligente de Pós-Produção & Múltiplos Editores
// Permite que editores concluam individualmente suas etapas na mesma missão.
// A missão só é enviada para Aprovação do Administrador quando TODOS concluírem.
// ==============================================================================

import { hasMissionPostProduction } from './geo';

/**
 * Normaliza string removendo acentos e espaços extras para comparações seguras.
 */
function cleanStr(val) {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Resolve todos os editores designados para uma missão, tratando IDs, nomes e múltiplos membros.
 * Inclui auto-cura para missões conhecidas (ex: #202611131 ENSAIO FOTOGRAFICO EXTERNO ABC SESI).
 */
export function resolveMissionEditors(mission, members = []) {
  if (!mission) return [];
  if (!hasMissionPostProduction(mission)) return [];

  const foundMap = new Map();

  // Helper para adicionar membro
  const addMember = (mem) => {
    if (!mem) return;
    const idStr = String(mem.id);
    if (!foundMap.has(idStr)) {
      foundMap.set(idStr, {
        id: idStr,
        name: mem.name || `Editor #${idStr}`,
        role: mem.role || 'Editor de Vídeo',
        avatar: mem.avatar || mem.photoUrl || null,
      });
    }
  };

  // 1. Processa editorIds (array de IDs)
  if (Array.isArray(mission.editorIds) && mission.editorIds.length > 0) {
    mission.editorIds.forEach((id) => {
      const idStr = String(id);
      const mem = members.find((m) => String(m.id) === idStr);
      if (mem) {
        addMember(mem);
      } else {
        foundMap.set(idStr, {
          id: idStr,
          name: `Editor #${idStr}`,
          role: 'Editor de Vídeo',
          avatar: null,
        });
      }
    });
  }

  // 2. Processa editorId legado único caso não esteja no mapa
  if (mission.editorId && !foundMap.has(String(mission.editorId))) {
    const idStr = String(mission.editorId);
    const mem = members.find((m) => String(m.id) === idStr);
    if (mem) {
      addMember(mem);
    } else {
      foundMap.set(idStr, {
        id: idStr,
        name: mission.editorName || `Editor #${idStr}`,
        role: 'Editor de Vídeo',
        avatar: null,
      });
    }
  }

  // 3. Processa nomes em editorNamesDisplay ou editorName
  const rawNames = [mission.editorNamesDisplay, mission.editorName].filter(Boolean).join(', ');
  if (rawNames) {
    const splitNames = rawNames.split(/[,e&/]/).map((n) => n.trim()).filter((n) => n.length >= 2);
    splitNames.forEach((n) => {
      const cleanN = cleanStr(n);
      const mem = members.find((m) => {
        const mClean = cleanStr(m.name);
        return mClean === cleanN || mClean.includes(cleanN) || cleanN.includes(mClean);
      });
      if (mem) {
        addMember(mem);
      } else {
        const fakeId = `editor-${cleanN.replace(/\s+/g, '-')}`;
        if (!foundMap.has(fakeId)) {
          foundMap.set(fakeId, {
            id: fakeId,
            name: n,
            role: 'Editor de Vídeo',
            avatar: null,
          });
        }
      }
    });
  }

  // 4. AUTO-CURA ESPECÍFICA SOLICITADA PELO DIRETOR:
  // Missão #202611131 (ENSAIO FOTOGRAFICO EXTERNO ABC SESI em 13/11/2026):
  // São 2 editores designados para pós-produção: Mateus e Pedro.
  const isSesi202611131 =
    String(mission.code || '').includes('202611131') ||
    (String(mission.date || '').includes('2026-11-13') &&
      cleanStr(mission.description || '').includes('sesi'));

  if (isSesi202611131) {
    const mateusMem = members.find((m) => cleanStr(m.name).includes('mateus'));
    const pedroMem = members.find((m) => cleanStr(m.name).includes('pedro'));

    if (mateusMem) addMember(mateusMem);
    else if (!Array.from(foundMap.values()).some((e) => cleanStr(e.name).includes('mateus'))) {
      foundMap.set('mateus-auto', { id: 'mateus-auto', name: 'Mateus Henrique', role: 'Editor de Vídeo', avatar: null });
    }

    if (pedroMem) addMember(pedroMem);
    else if (!Array.from(foundMap.values()).some((e) => cleanStr(e.name).includes('pedro'))) {
      foundMap.set('pedro-auto', { id: 'pedro-auto', name: 'Pedro', role: 'Editor de Vídeo', avatar: null });
    }
  }

  return Array.from(foundMap.values());
}

/**
 * Retorna o mapa de entregas individuais por editor.
 * Se a missão ainda não possuir o campo estruturado editorsDelivery,
 * inicializa com base no histórico existente ou valores padrão.
 */
export function getMissionEditorsDeliveryMap(mission, members = []) {
  if (!mission) return {};

  const assigned = resolveMissionEditors(mission, members);
  const rawMap = mission.editorsDelivery && typeof mission.editorsDelivery === 'object' && !Array.isArray(mission.editorsDelivery)
    ? { ...mission.editorsDelivery }
    : {};

  const resultMap = {};

  const isSesi202611131 =
    String(mission.code || '').includes('202611131') ||
    (String(mission.date || '').includes('2026-11-13') &&
      cleanStr(mission.description || '').includes('sesi'));

  assigned.forEach((editor) => {
    const eKey = String(editor.id);
    const existing = rawMap[eKey] || rawMap[editor.name] || rawMap[cleanStr(editor.name)];

    if (existing && existing.status) {
      resultMap[eKey] = {
        ...existing,
        editorId: eKey,
        editorName: editor.name,
      };
      return;
    }

    // Caso especial #202611131: Mateus concluiu e Pedro está pendente
    if (isSesi202611131) {
      if (cleanStr(editor.name).includes('mateus')) {
        resultMap[eKey] = {
          editorId: eKey,
          editorName: editor.name,
          status: 'delivered',
          deliveredAt: mission.editionCompletedAt || '2026-11-14T12:00:00',
          serverFilePath: mission.serverFilePath || 'S:\\MEGA FILMES\\ABC 2026\\EXTERNA SESI 13-11\\CARD 01\\LR_01_',
          notes: 'MINHA PASTA OK, SO FALTA SUBIR PARA A RAW FX',
          isLate: false,
        };
        return;
      }
      if (cleanStr(editor.name).includes('pedro')) {
        resultMap[eKey] = {
          editorId: eKey,
          editorName: editor.name,
          status: 'pending',
          deliveredAt: null,
          serverFilePath: null,
          notes: null,
          isLate: false,
        };
        return;
      }
    }

    // Caso genérico: se a missão tiver somente 1 editor e já estiver com status Edição Concluída
    if (assigned.length === 1 && (mission.editionStatus === 'Edição Concluída' || mission.editionStatus === 'Entregue')) {
      resultMap[eKey] = {
        editorId: eKey,
        editorName: editor.name,
        status: 'delivered',
        deliveredAt: mission.editionCompletedAt || new Date().toISOString(),
        serverFilePath: mission.serverFilePath || null,
        notes: mission.notes || null,
        isLate: Boolean(mission.isOverdue),
      };
      return;
    }

    // Default: pendente
    resultMap[eKey] = {
      editorId: eKey,
      editorName: editor.name,
      status: 'pending',
      deliveredAt: null,
      serverFilePath: null,
      notes: null,
      isLate: false,
    };
  });

  return resultMap;
}

/**
 * Retorna o resumo completo de entregas de pós-produção da missão.
 */
export function getMissionEditionDeliverySummary(mission, members = []) {
  if (!mission || !hasMissionPostProduction(mission)) {
    return {
      hasPostProduction: false,
      total: 0,
      assignedEditors: [],
      deliveryMap: {},
      deliveredEditors: [],
      pendingEditors: [],
      isFullyDelivered: true,
      progressPercent: 100,
      summaryBadgeText: 'Sem Pós-Produção',
      hasMultipleEditors: false,
    };
  }

  const assignedEditors = resolveMissionEditors(mission, members);
  const deliveryMap = getMissionEditorsDeliveryMap(mission, members);

  if (assignedEditors.length === 0) {
    const isDone = mission.editionStatus === 'Edição Concluída' || mission.editionStatus === 'Entregue';
    return {
      hasPostProduction: true,
      total: 0,
      assignedEditors: [],
      deliveryMap,
      deliveredEditors: [],
      pendingEditors: [],
      isFullyDelivered: isDone,
      progressPercent: isDone ? 100 : 0,
      summaryBadgeText: isDone ? 'Edição Concluída' : 'Pendente',
      hasMultipleEditors: false,
    };
  }

  const deliveredEditors = [];
  const pendingEditors = [];

  assignedEditors.forEach((editor) => {
    const delivery = deliveryMap[String(editor.id)];
    if (delivery && delivery.status === 'delivered') {
      deliveredEditors.push({ ...editor, ...delivery });
    } else {
      pendingEditors.push({ ...editor, ...(delivery || {}) });
    }
  });

  const total = assignedEditors.length;
  const deliveredCount = deliveredEditors.length;
  const isFullyDelivered = total > 0 && deliveredCount === total;
  const progressPercent = total > 0 ? Math.round((deliveredCount / total) * 100) : 0;

  let summaryBadgeText = '';
  if (total === 1) {
    summaryBadgeText = isFullyDelivered ? 'Edição Concluída' : 'Edição Pendente';
  } else if (isFullyDelivered) {
    summaryBadgeText = `Edição Concluída (${total}/${total} Editores)`;
  } else if (deliveredCount === 0) {
    summaryBadgeText = `Pendente (${total} Editores escalados)`;
  } else {
    const pendingNames = pendingEditors.map((e) => e.name.split(' ')[0]).join(', ');
    summaryBadgeText = `${deliveredCount}/${total} Concluídos (Aguardando ${pendingNames})`;
  }

  return {
    hasPostProduction: true,
    total,
    assignedEditors,
    deliveryMap,
    deliveredEditors,
    pendingEditors,
    isFullyDelivered,
    progressPercent,
    summaryBadgeText,
    hasMultipleEditors: total > 1,
  };
}

/**
 * Valida se um usuário logado tem permissão para registrar entrega em nome de um editor.
 */
export function canUserDeliverForEditor(editorId, currentUser, members = []) {
  if (!currentUser) return false;
  const role = String(currentUser.role || '').toLowerCase();
  const isAdmin = role.includes('admin') || role.includes('diretor') || role.includes('gestor');
  if (isAdmin) return true;

  const curId = String(currentUser.id);
  const curName = cleanStr(currentUser.name);

  // Procura o membro do usuário logado
  const userMember = members.find((m) => String(m.id) === curId || String(m.userId) === curId || cleanStr(m.name) === curName);
  const memberIdStr = userMember ? String(userMember.id) : null;

  const targetIdStr = String(editorId);

  if (targetIdStr === curId || (memberIdStr && targetIdStr === memberIdStr)) {
    return true;
  }

  // Verifica por nome do editor alvo
  const targetMember = members.find((m) => String(m.id) === targetIdStr);
  if (targetMember && cleanStr(targetMember.name) === curName) {
    return true;
  }

  return false;
}

/**
 * Normaliza e sincroniza missões com múltiplos editores.
 * Executa a auto-cura para a missão #202611131 (ENSAIO FOTOGRAFICO EXTERNO ABC SESI em 13/11/2026),
 * garantindo que Mateus Henrique e Pedro estejam atribuídos, e mantendo a pauta fora
 * da fila de aprovação da diretoria enquanto Pedro não concluir.
 */
export function normalizeMissionMultiEditors(mission, members = []) {
  if (!mission) return mission;
  if (!hasMissionPostProduction(mission)) return mission;

  const isSesi202611131 =
    String(mission.code || '').includes('202611131') ||
    (String(mission.date || '').includes('2026-11-13') &&
      cleanStr(mission.description || '').includes('sesi'));

  if (!isSesi202611131) {
    // Para missões comuns, se possuir editorsDelivery estruturado, verifica se todos concluíram
    if (mission.editorsDelivery && typeof mission.editorsDelivery === 'object') {
      const summary = getMissionEditionDeliverySummary(mission, members);
      if (summary.hasMultipleEditors) {
        if (!summary.isFullyDelivered && (mission.editionStatus === 'Edição Concluída' || mission.editionStatus === 'Entregue')) {
          return {
            ...mission,
            editionStatus: 'Em Edição',
            missionStatus: 'Pendente',
          };
        }
      }
    }
    return mission;
  }

  // Tratamento específico #202611131
  const assigned = resolveMissionEditors(mission, members);
  const deliveryMap = getMissionEditorsDeliveryMap(mission, members);
  const summary = getMissionEditionDeliverySummary(mission, members);

  const editorIds = assigned.map((e) => e.id);
  const editorNamesDisplay = assigned.map((e) => e.name).join(', ');

  const shouldBeInEdition = !summary.isFullyDelivered;

  return {
    ...mission,
    editorIds,
    editorNamesDisplay,
    editorsDelivery: deliveryMap,
    editionStatus: shouldBeInEdition ? 'Em Edição' : (mission.editionStatus || 'Edição Concluída'),
    missionStatus: 'Pendente',
  };
}
