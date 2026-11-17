const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TESTE: BLOQUEIO DE EDIÇÃO E REENVIO DE ENTREGA APÓS CONCLUSÃO ===\n');

// 1. Validar CollaboratorSpace.jsx
const colabSpacePath = path.resolve(__dirname, '../src/components/CollaboratorSpace.jsx');
const colabSpace = fs.readFileSync(colabSpacePath, 'utf8');

// Não pode existir o botão ou texto "Editar / Reenviar Entrega"
assert(!colabSpace.includes('Editar / Reenviar Entrega'), 'CollaboratorSpace.jsx não deve conter o botão "Editar / Reenviar Entrega"');
console.log('✔ CollaboratorSpace.jsx: Botão "Editar / Reenviar Entrega" removido com sucesso.');

// Deve conter a trava de isMyPartDone e isMissionApprovedOrDone
assert(colabSpace.includes('isMyPartDone ? ('), 'Deve verificar se a parte do colaborador já foi entregue');
assert(colabSpace.includes('isMissionApprovedOrDone'), 'Deve checar se a missão foi aprovada ou finalizada');
assert(colabSpace.includes('🏆 Pós-produção finalizada e aprovada pela Diretoria.'), 'Deve exibir status de missão finalizada quando aplicável');
assert(colabSpace.includes('🎉 Todos os editores entregaram! A pauta está na fila de aprovação da Diretoria.'), 'Deve exibir aviso de entrega completa da equipe');
console.log('✔ CollaboratorSpace.jsx: Mensagens de status informativas e bloqueio de novos envios validados.');

// 2. Validar ConcludePostProductionModal.jsx
const modalPath = path.resolve(__dirname, '../src/components/ConcludePostProductionModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

assert(modalCode.includes('isBlocked = isMissionFinalized || isAlreadyDelivered'), 'Modal deve calcular isBlocked para missão finalizada ou já entregue');
assert(modalCode.includes('if (isBlocked) return'), 'handleSubmit deve bloquear submissão se isBlocked');
assert(modalCode.includes('Entrega Já Realizada'), 'Botão deve exibir "Entrega Já Realizada" quando o editor já entregou');
assert(modalCode.includes('readOnly={isBlocked}'), 'Campos de entrada devem ser readOnly quando isBlocked');
console.log('✔ ConcludePostProductionModal.jsx: Bloqueio estrito de reenvio e campos em modo somente leitura validados.');

console.log('\nTODOS OS TESTES DE BLOQUEIO DE REENVIO PASSARAM COM SUCESSO! 🎯\n');
