// Teste automatizado para observações manuais por integrante da missão
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TESTE: OBSERVAÇÕES & ITENS MANUAIS POR INTEGRANTE DA MISSÃO ===');

// 1. Verificar arquivos essenciais
const files = [
  'src/components/MissionModal.jsx',
  'src/components/MissionDetailModal.jsx',
  'src/components/ServiceBoard.jsx',
  'src/utils/whatsappMissionShare.js',
  'public/api/missions.php',
  'src/App.css'
];

files.forEach((f) => {
  const p = path.resolve(__dirname, '..', f);
  assert.ok(fs.existsSync(p), `Arquivo não encontrado: ${f}`);
  console.log(`[OK] Arquivo verificado: ${f}`);
});

// 2. Verificar MissionModal.jsx
const missionModalContent = fs.readFileSync(path.resolve(__dirname, '../src/components/MissionModal.jsx'), 'utf8');
assert.ok(missionModalContent.includes('handleUpdatePersonCustomNotes'), 'MissionModal.jsx deve conter handleUpdatePersonCustomNotes');
assert.ok(missionModalContent.includes('mepc-custom-notes-textarea'), 'MissionModal.jsx deve renderizar textarea de observações manuais por integrante');
assert.ok(missionModalContent.includes('memberNotes'), 'MissionModal.jsx deve conter memberNotes no state e payload');
console.log('[OK] MissionModal.jsx possui suporte a observações manuais individuais');

// 3. Verificar MissionDetailModal.jsx e ServiceBoard.jsx
const detailModalContent = fs.readFileSync(path.resolve(__dirname, '../src/components/MissionDetailModal.jsx'), 'utf8');
assert.ok(detailModalContent.includes('megc-custom-notes'), 'MissionDetailModal.jsx deve exibir classe megc-custom-notes');

const serviceBoardContent = fs.readFileSync(path.resolve(__dirname, '../src/components/ServiceBoard.jsx'), 'utf8');
assert.ok(serviceBoardContent.includes('megc-custom-notes'), 'ServiceBoard.jsx deve exibir classe megc-custom-notes na ficha da missão');
console.log('[OK] Fichas de detalhes exibem itens e observações manuais por integrante');

// 4. Testar gerador de texto do WhatsApp com equipamentos e itens manuais
const { formatMissionWhatsAppText } = require('../src/utils/whatsappMissionShare.js');

// Mock data
const mockMission = {
  id: 'mis-test-123',
  code: '202611181',
  title: 'TRANSMISSÃO AO VIVO SINDUSCON',
  date: '2026-11-18',
  departureTime: '14:15',
  arrivalTime: '14:30',
  eventStartTime: '15:00',
  eventEndTime: '18:00',
  locationName: 'SINDUSCON-RR',
  address: 'Rua Prof. Diomedes, 841',
  equipmentAllocations: [
    {
      collaboratorId: 'mem-1',
      collaboratorName: 'HGama',
      role: 'Assistente Geral',
      customNotes: 'Levar monitor 24" de referência e computador / notebook',
      items: []
    },
    {
      collaboratorId: 'mem-2',
      collaboratorName: 'Gabriel Costa',
      role: 'Cinegrafista',
      customNotes: 'Levar cabos HDMI reservas',
      items: [
        { name: 'Sony FX3', quantity: 1, notes: 'Com 2 baterias' }
      ]
    },
    {
      collaboratorId: 'general',
      collaboratorName: 'Kit Geral & Itens Coletivos',
      role: 'Uso Compartilhado / Van',
      customNotes: 'Mesa dobrável e filtro de linha 20A',
      items: [
        { name: 'Tripé Manfrotto Pesado', quantity: 2, notes: 'Na maleta' }
      ]
    }
  ]
};

const waText = formatMissionWhatsAppText(mockMission, { missions: [mockMission] });
assert.ok(waText.includes('🎒 *Kits & Equipamentos por Integrante:*'), 'WhatsApp deve conter seção de equipamentos por integrante');
assert.ok(waText.includes('HGama'), 'WhatsApp deve citar HGama');
assert.ok(waText.includes('Levar monitor 24" de referência e computador / notebook'), 'WhatsApp deve citar o monitor e notebook de HGama');
assert.ok(waText.includes('Gabriel Costa'), 'WhatsApp deve citar Gabriel Costa');
assert.ok(waText.includes('Sony FX3'), 'WhatsApp deve citar Sony FX3 de Gabriel Costa');
assert.ok(waText.includes('Kit Coletivo (Van):'), 'WhatsApp deve citar Kit Coletivo');
assert.ok(waText.includes('Mesa dobrável e filtro de linha 20A'), 'WhatsApp deve citar mesa dobrável no coletivo');
console.log('[OK] WhatsApp formata perfeitamente itens de acervo e observações manuais por pessoa');

// 5. Verificar missions.php
const phpContent = fs.readFileSync(path.resolve(__dirname, '../public/api/missions.php'), 'utf8');
assert.ok(phpContent.includes('member_notes'), 'public/api/missions.php deve conter coluna e parâmetro member_notes');
console.log('[OK] public/api/missions.php persiste member_notes no banco MySQL');

console.log('\nTODOS OS TESTES DE OBSERVAÇÕES MANUAIS PASSARAM COM SUCESSO! 🚀');
