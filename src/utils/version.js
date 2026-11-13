// ==============================================================================
// GestorMF - Informações de Versão e Release do Sistema (Automático via Build)
// ==============================================================================
export const SYSTEM_NAME = 'MegaGestão';
export const SYSTEM_TAGLINE = 'Gestão Integrada de Frotas, Pautas & Equipes';

// Versão do Sistema compilada automaticamente a partir do package.json a cada build
export const SYSTEM_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '7.0.0';

export const SYSTEM_RELEASE_NAME = `Edição Produção Executiva (v${SYSTEM_VERSION})`;

export function getSystemVersionString() {
  return `${SYSTEM_NAME} • Versão ${SYSTEM_VERSION}`;
}

export function getSystemBadgeString() {
  return `${SYSTEM_NAME} v${SYSTEM_VERSION}`;
}

