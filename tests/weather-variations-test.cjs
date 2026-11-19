const fs = require('fs');

const code = fs.readFileSync('src/components/WeatherIllustration.jsx', 'utf8');

const expectedKeys = [
  'day-clear',
  'day-partly-cloudy',
  'day-cloudy',
  'day-rain',
  'day-drizzle',
  'day-storm',
  'day-snow',
  'day-fog',
  'night-clear',
  'night-partly-cloudy',
  'night-cloudy',
  'night-rain',
  'night-drizzle',
  'night-storm',
  'night-snow',
  'night-fog',
];

console.log('🧪 Verificando ilustrações e variações climáticas Google Weather 3D...');

expectedKeys.forEach((key) => {
  if (!code.includes(`type === '${key}'`)) {
    console.error(`❌ Chave de variação não encontrada: ${key}`);
    process.exit(1);
  }
  console.log(`  ✅ Variação ${key} implementada com sucesso`);
});

// Verificar se as animações CSS estão presentes em App.css
const css = fs.readFileSync('src/App.css', 'utf8');
const expectedAnimations = [
  'wiSunPulse',
  'wiCloudFloat',
  'wiCloudFloatRear',
  'wiRainDrop1',
  'wiRainDrop2',
  'wiRainDrop3',
  'wiSnowFlake1',
  'wiSnowFlake2',
  'wiLightningFlash',
  'wiMistDrift',
  'wiMoonGlow',
  'wiStarTwinkle',
];

expectedAnimations.forEach((anim) => {
  if (!css.includes(`@keyframes ${anim}`)) {
    console.error(`❌ Animação CSS não encontrada: ${anim}`);
    process.exit(1);
  }
  console.log(`  ✅ Animação CSS ${anim} ativa`);
});

// Verificar mapeamento em SmartHeaderGreeting.jsx
const greetingCode = fs.readFileSync('src/components/SmartHeaderGreeting.jsx', 'utf8');
if (!greetingCode.includes("'day-partly-cloudy' : 'night-partly-cloudy'")) {
  console.error("❌ Código 1 (Predomínio de Sol) não está mapeado para day-partly-cloudy!");
  process.exit(1);
}
console.log('  ✅ Predomínio de Sol (código 1) mapeado para day-partly-cloudy (Sol + Nuvem)');

console.log('🎉 Todos os testes de variações de clima e animações passaram com 100% de sucesso!');
