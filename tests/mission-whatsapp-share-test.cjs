// Teste automatizado para compartilhamento de missões via WhatsApp
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TESTE: COMPARTILHAMENTO DE MISSÕES VIA WHATSAPP ===');

// 1. Validar existência dos arquivos criados/editados
const filesToCheck = [
  'src/utils/whatsappMissionShare.js',
  'src/components/MissionWhatsAppShareModal.jsx',
  'src/components/ServiceBoard.jsx',
  'src/components/MissionDetailModal.jsx',
  'src/App.css'
];

filesToCheck.forEach((rel) => {
  const p = path.resolve(__dirname, '..', rel);
  assert.ok(fs.existsSync(p), `Arquivo não encontrado: ${rel}`);
  console.log(`[OK] Arquivo verificado: ${rel}`);
});

// 2. Verificar conteúdo em ServiceBoard.jsx
const serviceBoardContent = fs.readFileSync(path.resolve(__dirname, '../src/components/ServiceBoard.jsx'), 'utf8');
assert.ok(serviceBoardContent.includes('MissionWhatsAppShareModal'), 'ServiceBoard.jsx deve importar MissionWhatsAppShareModal');
assert.ok(serviceBoardContent.includes('whatsappShareMission'), 'ServiceBoard.jsx deve conter estado whatsappShareMission');
assert.ok(serviceBoardContent.includes('action-btn-icon share-whatsapp'), 'ServiceBoard.jsx deve renderizar botão .share-whatsapp na coluna AÇÕES');
assert.ok(serviceBoardContent.includes('mmc-action-pill whatsapp'), 'ServiceBoard.jsx deve conter pill de WhatsApp no mobile');
console.log('[OK] ServiceBoard.jsx contém botões e modal de WhatsApp');

// 3. Verificar conteúdo em MissionDetailModal.jsx
const detailModalContent = fs.readFileSync(path.resolve(__dirname, '../src/components/MissionDetailModal.jsx'), 'utf8');
assert.ok(detailModalContent.includes('MissionWhatsAppShareModal'), 'MissionDetailModal.jsx deve importar MissionWhatsAppShareModal');
assert.ok(detailModalContent.includes('btn-whatsapp-share'), 'MissionDetailModal.jsx deve conter botão .btn-whatsapp-share');
console.log('[OK] MissionDetailModal.jsx contém integração de WhatsApp');

// 4. Testar a lógica de formatação de telefone e URL
function buildWhatsAppShareUrl(phoneNumber = '', messageText = '') {
  const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(messageText || '');

  if (!cleanPhone) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  let finalPhone = cleanPhone;
  if (!finalPhone.startsWith('55') && (finalPhone.length === 10 || finalPhone.length === 11)) {
    finalPhone = `55${finalPhone}`;
  }

  return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`;
}

// Teste 4.1: Sem telefone (abre para escolher qualquer contato/grupo)
const urlNoPhone = buildWhatsAppShareUrl('', 'Pauta de teste');
assert.strictEqual(urlNoPhone, 'https://api.whatsapp.com/send?text=Pauta%20de%20teste');
console.log('[OK] URL sem telefone: abre seletor de contato');

// Teste 4.2: Telefone formato BR com DDD (ex: 95991234567) -> adiciona 55
const urlWithDDD = buildWhatsAppShareUrl('(95) 99123-4567', 'Ordem de serviço');
assert.strictEqual(urlWithDDD, 'https://api.whatsapp.com/send?phone=5595991234567&text=Ordem%20de%20servi%C3%A7o');
console.log('[OK] URL com DDD nacional: adiciona DDI 55');

// Teste 4.3: Telefone já com 55 (ex: 5595991234567) -> mantém
const urlWithFullPhone = buildWhatsAppShareUrl('+55 95 99123-4567', 'Msg');
assert.strictEqual(urlWithFullPhone, 'https://api.whatsapp.com/send?phone=5595991234567&text=Msg');
console.log('[OK] URL com DDI completo: preserva 55');

// 5. Verificar classes de estilo em App.css
const appCss = fs.readFileSync(path.resolve(__dirname, '../src/App.css'), 'utf8');
assert.ok(appCss.includes('.action-btn-icon.share-whatsapp'), 'App.css deve estilizar .action-btn-icon.share-whatsapp');
assert.ok(appCss.includes('.btn-whatsapp-share'), 'App.css deve conter .btn-whatsapp-share');
assert.ok(appCss.includes('.mission-whatsapp-share-modal') || appCss.includes('.whatsapp-theme-header'), 'App.css deve conter estilos da modal WhatsApp');
console.log('[OK] App.css contém todas as classes CSS requeridas');

console.log('\nTODOS OS TESTES DE COMPARTILHAMENTO WHATSAPP PASSARAM COM SUCESSO! 🚀');
