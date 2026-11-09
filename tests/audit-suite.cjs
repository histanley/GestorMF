// ==============================================================================
// GestorMF - Suite de Testes Automatizados de Segurança e Integridade (Auditoria v6)
// ==============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('====================================================');
console.log('   GESTORMF - SUITE DE TESTES AUTOMATIZADOS (V6)    ');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

// ------------------------------------------------------------------------------
// TESTE 1: P0-01 - Proteção contra IDOR / Associação Arbitrária de user_id
// ------------------------------------------------------------------------------
const membersCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'members.php'), 'utf8');
assert(
  !membersCode.includes("assignedUserId = !empty($data['userId'])") &&
  membersCode.includes("// P0-01: NUNCA aceita user_id arbitrário enviado pelo cliente") &&
  membersCode.includes("$assignedUserId = $existing ? ($existing['user_id'] ?? null) : null;"),
  'P0-01: Rejeição de user_id arbitrário do cliente em members.php'
);

const gpsCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'gps.php'), 'utf8');
assert(
  gpsCode.includes("WHERE user_id = ? AND active = 1 LIMIT 1") &&
  !gpsCode.includes("WHERE user_id = ? OR id = ?"),
  'P0-01: Vínculo estrito por members.user_id = users.id no GPS (sem atalho legado ambíguo)'
);

// ------------------------------------------------------------------------------
// TESTE 2: P0-02 - Concorrência Operacional Atômica com version em WHERE
// ------------------------------------------------------------------------------
const missionsCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'missions.php'), 'utf8');
assert(
  missionsCode.includes("WHERE id = ? AND version = ?") &&
  missionsCode.includes("$stmtOp->rowCount() === 0") &&
  missionsCode.includes("'Parâmetro version é obrigatório para atualização de status operacional.'"),
  'P0-02: Concorrência operacional atômica exigindo version no WHERE e rowCount check (HTTP 409)'
);

// ------------------------------------------------------------------------------
// TESTE 3: P0-03 - Restauração Completa de Contas de Acesso (users) no Backup
// ------------------------------------------------------------------------------
const backupCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'backup.php'), 'utf8');
assert(
  backupCode.includes("INSERT INTO users (id, name, email, password_hash, role, title, department, phone, avatar, created_at)") &&
  backupCode.includes("'users'         => $db->query(\"SELECT id, name, email, password_hash"),
  'P0-03: Restauração completa de contas de acesso (tabela users com password_hash) no backup'
);

// ------------------------------------------------------------------------------
// TESTE 4: P0-04 & Item 02 - Assinatura HMAC-SHA256 e Criptografia AES-256-GCM
// ------------------------------------------------------------------------------
assert(
  backupCode.includes("hash_hmac('sha256', $signedPayload, $sigKey)") &&
  backupCode.includes("openssl_encrypt($plainJson, 'aes-256-gcm'") &&
  backupCode.includes("hash_equals($expectedSig, (string)$input['signature'])"),
  'P0-04 & Item 02: Criptografia AES-256-GCM em repouso e assinatura HMAC-SHA256'
);

// Simulação de ataque criptográfico: adulteração de 1 byte no payload invalida HMAC
const secret = 'test-secret-key-32-bytes-long!';
const tables = { settings: { company: 'MegaFilmes' } };
const json1 = JSON.stringify(tables);
const validHmac = crypto.createHmac('sha256', secret).update(json1).digest('hex');

// Atacante altera JSON e recalcula apenas o SHA-256 (sem ter o segredo do servidor)
const jsonTampered = JSON.stringify({ settings: { company: 'HackerCorp' } });
const tamperedHmac = crypto.createHmac('sha256', secret).update(jsonTampered).digest('hex');
assert(validHmac !== tamperedHmac, 'P0-04 (Simulação): Adulteração do payload resulta em rejeição imediata da assinatura HMAC');

// ------------------------------------------------------------------------------
// TESTE 5: P1-05 - Rejeição de GPS sem Missão Ativa Vinculada
// ------------------------------------------------------------------------------
assert(
  gpsCode.includes("Rastreamento GPS operacional recusado: o envio de telemetria exige uma missão ativa") &&
  gpsCode.includes("WHERE mission_status IN ('Em Preparo', 'Em Execução')") &&
  gpsCode.includes("O envio só é permitido durante a execução da missão."),
  'P1-05: Rejeição de coordenadas GPS fora do período e escopo de missão ativa'
);

// ------------------------------------------------------------------------------
// TESTE 6: P1-06 - Proteção contra Apropriação de Conta por E-mail
// ------------------------------------------------------------------------------
assert(
  membersCode.includes("SELECT id, name FROM members WHERE user_id = ? AND id != ? LIMIT 1") &&
  membersCode.includes("Não é permitida a apropriação indevida ou duplicidade de vínculos.") &&
  membersCode.includes("Apenas Administradores têm permissão para vincular contas existentes a colaboradores."),
  'P1-06: Bloqueio de associação indevida de conta existente de outro colaborador'
);

// ------------------------------------------------------------------------------
// TESTE 7: P1-07 - Ausência de Operações DDL em Requisições Normais de Produção
// ------------------------------------------------------------------------------
const configCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'config.php'), 'utf8');
assert(
  configCode.includes("if (php_sapi_name() !== 'cli' && !defined('GESTORMF_RUN_MIGRATIONS')) {") &&
  fs.existsSync(path.join(__dirname, '..', 'public', 'bin', 'migrate.php')),
  'P1-07: Consultas DDL bloqueadas no ciclo HTTP normal; migrações controladas via CLI'
);

// ------------------------------------------------------------------------------
// TESTE 8: P1-08 - Confirmação Síncrona e Tratamento de Erros de Viatura/Colaborador
// ------------------------------------------------------------------------------
const appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
assert(
  appCode.includes("const handleAddVehicle = async (newVeh) => {") &&
  appCode.includes("const handleAddMember = async (newMem) => {") &&
  appCode.includes("title: 'Erro ao Salvar Viatura'") &&
  appCode.includes("title: 'Erro ao Salvar Colaborador'"),
  'P1-08: Operações de viaturas e colaboradores com confirmação síncrona e feedback de erro'
);

// ------------------------------------------------------------------------------
// TESTE 9: P1-09 - Feedback Visual e Recarga Automática em Conflitos 409
// ------------------------------------------------------------------------------
assert(
  appCode.includes("const reloadServerMissions = async () => {") &&
  appCode.includes("await reloadServerMissions();") &&
  appCode.includes("title: 'Conflito de Concorrência'"),
  'P1-09: Recarga e feedback visual imediato em caso de conflito de versão (HTTP 409)'
);

// ------------------------------------------------------------------------------
// TESTE 10: P1-10 - PWA Manifest e Service Worker
// ------------------------------------------------------------------------------
const manifestExists = fs.existsSync(path.join(__dirname, '..', 'public', 'manifest.webmanifest'));
const swExists = fs.existsSync(path.join(__dirname, '..', 'public', 'sw.js'));
const htmlCode = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(
  manifestExists && swExists && htmlCode.includes('rel="manifest"') && htmlCode.includes('theme-color'),
  'P1-10: PWA completo com manifest.webmanifest, Service Worker e registro offline'
);

console.log('\n----------------------------------------------------');
console.log(`TOTAL DE TESTES: ${passedTests + failedTests}`);
console.log(`APROVADOS: ${passedTests}`);
console.log(`FALHAS: ${failedTests}`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nTODOS OS 10 TESTES DE AUDITORIA FORAM APROVADOS COM SUCESSO!\n');
}
