const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Aplicativos Nativos - GPS Contínuo, Notificações e Versionamento v7.5.0 ---');

const mapViewPath = path.resolve(__dirname, '../src/components/MapView.jsx');
const notifPath = path.resolve(__dirname, '../src/utils/notifications.js');
const settingsPath = path.resolve(__dirname, '../src/components/SettingsModal.jsx');
const mapPickerPath = path.resolve(__dirname, '../src/components/MissionMapPickerModal.jsx');
const androidGradlePath = path.resolve(__dirname, '../android/app/build.gradle');
const iosPbxprojPath = path.resolve(__dirname, '../ios/App/App.xcodeproj/project.pbxproj');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const versionJsPath = path.resolve(__dirname, '../src/utils/version.js');

assert(fs.existsSync(mapViewPath), 'MapView.jsx deve existir');
assert(fs.existsSync(notifPath), 'notifications.js deve existir');
assert(fs.existsSync(settingsPath), 'SettingsModal.jsx deve existir');
assert(fs.existsSync(mapPickerPath), 'MissionMapPickerModal.jsx deve existir');
assert(fs.existsSync(androidGradlePath), 'android/app/build.gradle deve existir');
assert(fs.existsSync(iosPbxprojPath), 'project.pbxproj deve existir');

const mapViewContent = fs.readFileSync(mapViewPath, 'utf8');
const notifContent = fs.readFileSync(notifPath, 'utf8');
const settingsContent = fs.readFileSync(settingsPath, 'utf8');
const mapPickerContent = fs.readFileSync(mapPickerPath, 'utf8');
const androidGradleContent = fs.readFileSync(androidGradlePath, 'utf8');
const iosPbxprojContent = fs.readFileSync(iosPbxprojPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const versionJsContent = fs.readFileSync(versionJsPath, 'utf8');

// 1. Validar que MapView utiliza a ponte nativa de GPS
assert(
  mapViewContent.includes('watchNativePosition') &&
  mapViewContent.includes('requestLocationPermissions') &&
  mapViewContent.includes('../utils/nativeBridge'),
  'MapView.jsx deve importar e utilizar watchNativePosition e requestLocationPermissions de nativeBridge'
);
assert(
  mapViewContent.includes('const watchHandle = await watchNativePosition('),
  'MapView.jsx deve acionar watchNativePosition para rastreamento de satélite nativo'
);
console.log('✅ 1. MapView.jsx conectado à ponte nativa de GPS de alta precisão (Capacitor).');

// 2. Validar que Notificações solicitam permissão nativa no Android e iOS
assert(
  notifContent.includes('LocalNotifications.requestPermissions()') &&
  notifContent.includes('isNativeApp()'),
  'notifications.js deve solicitar permissão nativa com LocalNotifications.requestPermissions()'
);
assert(
  notifContent.includes('checkNotificationPermission'),
  'notifications.js deve exportar checkNotificationPermission'
);
console.log('✅ 2. notifications.js atualizado com prompt nativo de permissão para Android 13+ e iOS.');

// 3. Validar unificação de GPS em SettingsModal e MissionMapPickerModal
assert(
  settingsContent.includes('getNativePosition') && settingsContent.includes('../utils/nativeBridge'),
  'SettingsModal.jsx deve utilizar getNativePosition'
);
assert(
  mapPickerContent.includes('getNativePosition') && mapPickerContent.includes('../utils/nativeBridge'),
  'MissionMapPickerModal.jsx deve utilizar getNativePosition'
);
console.log('✅ 3. Detecção de localização unificada via GPS nativo em modais de configuração e mapa.');

// 4. Validar sincronização de versão Android (v7.5.0, code 750)
assert(
  androidGradleContent.includes('versionCode 750') &&
  androidGradleContent.includes('versionName "7.5.0"'),
  'android/app/build.gradle deve estar configurado com versionCode 750 e versionName 7.5.0'
);
console.log('✅ 4. Android build.gradle sincronizado com versão 7.5.0 (versionCode 750).');

// 5. Validar sincronização de versão iOS (MARKETING_VERSION 7.5.0, CURRENT_PROJECT_VERSION 750)
assert(
  iosPbxprojContent.includes('CURRENT_PROJECT_VERSION = 750;') &&
  iosPbxprojContent.includes('MARKETING_VERSION = 7.5.0;'),
  'project.pbxproj deve estar configurado com CURRENT_PROJECT_VERSION = 750 e MARKETING_VERSION = 7.5.0'
);
console.log('✅ 5. iOS project.pbxproj sincronizado com versão 7.5.0 (build 750).');

// 6. Validar alinhamento com package.json e version.js
assert.strictEqual(packageJson.version, '7.5.0', 'package.json deve ser 7.5.0');
assert(versionJsContent.includes("'7.5.0'"), 'version.js deve apontar para 7.5.0');
console.log('✅ 6. Versão web, pacote e apps nativos 100% alinhados em v7.5.0.');

console.log('\n🎉 TODOS OS TESTES DE GPS, NOTIFICAÇÕES E VERSIONAMENTO PASSARAM COM SUCESSO!\n');
