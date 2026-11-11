const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('   TESTE DE EXCLUSÃO DE GPS PARA ADMINISTRADORES    ');
console.log('====================================================');

// 1. Verifica regra no backend (public/api/gps.php)
const gpsPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'gps.php'), 'utf8');

assert(
  gpsPhp.includes("$roleUpper = strtoupper(trim($user['role'] ?? 'USER'));") &&
  gpsPhp.includes("$isAdmin = ($roleUpper === 'ADMIN' || $roleUpper === 'ADMINISTRADOR');"),
  'Falha: gps.php deve verificar papel de administrador dinamicamente'
);

assert(
  gpsPhp.includes("DELETE FROM gps_locations WHERE member_id = ? OR member_name = ?"),
  'Falha: gps.php deve limpar preventivamente registros residuais de administradores no POST'
);

assert(
  gpsPhp.includes("DELETE g FROM gps_locations g") &&
  gpsPhp.includes("WHERE UPPER(TRIM(u.role)) IN ('ADMIN', 'ADMINISTRADOR')"),
  'Falha: gps.php deve realizar limpeza de administradores no GET'
);

assert(
  gpsPhp.includes("NOT IN ('ADMIN', 'ADMINISTRADOR')"),
  'Falha: gps.php deve excluir administradores da consulta SQL de posições ativas'
);

console.log('[PASS] Backend (public/api/gps.php): Bloqueio dinâmico e limpeza de administradores verificado.');

// 2. Verifica regra no frontend (src/App.jsx)
const appJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

assert(
  appJsx.includes("const isAdminUser = normalizeRole(currentUser?.role) === ROLES.ADMIN;") &&
  appJsx.includes("if (!currentUser || isAdminUser) {"),
  'Falha: App.jsx deve impedir monitoramento e transmissão de GPS para administradores'
);

assert(
  appJsx.includes("normalizeRole(currentUser.role) !== ROLES.ADMIN"),
  'Falha: App.jsx pill flutuante de GPS não deve ser exibido para administradores'
);

console.log('[PASS] Frontend (src/App.jsx): Transmissão e pill flutuante desativados para qualquer administrador.');

// 3. Verifica regra no mapa (src/components/MapView.jsx)
const mapViewJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MapView.jsx'), 'utf8');

assert(
  mapViewJsx.includes("if (uRole === 'admin' || uRole === 'administrador') return false;") &&
  mapViewJsx.includes("if (mRole === 'admin' || mRole === 'administrador') return false;"),
  'Falha: MapView.jsx deve filtrar administradores da lista de pins e radar'
);

assert(
  mapViewJsx.includes("if (userRole === 'admin') {") &&
  mapViewJsx.includes("Administradores não são localizados via GPS"),
  'Falha: MapView.jsx deve bloquear ativação manual de GPS para administradores'
);

console.log('[PASS] Frontend (src/components/MapView.jsx): Filtro de radar/pins e bloqueio de toggle verificados.');

console.log('\nTODOS OS TESTES DE EXCLUSÃO DE GPS PARA ADMINISTRADORES PASSARAM COM SUCESSO!\n');
