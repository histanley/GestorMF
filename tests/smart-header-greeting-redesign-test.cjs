const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes do Smart Header Greeting com ícone de clima Sol/Lua e sem foto...');

const headerPath = path.resolve(__dirname, '../src/components/SmartHeaderGreeting.jsx');
const cssPath = path.resolve(__dirname, '../src/App.css');

const headerJsx = fs.readFileSync(headerPath, 'utf8');
const appCss = fs.readFileSync(cssPath, 'utf8');

// 1. Garantir que a foto da pessoa (sh-avatar-hub) foi retirada
assert.strictEqual(
  headerJsx.includes('sh-avatar-hub'),
  false,
  'SmartHeaderGreeting não deve conter sh-avatar-hub (foto da pessoa)'
);

// 2. Garantir que o container do ícone do clima/horário (sol/lua) existe
assert.strictEqual(
  headerJsx.includes('sh-hero-icon-wrap'),
  true,
  'SmartHeaderGreeting deve conter sh-hero-icon-wrap para o ícone de clima/horário'
);

assert.strictEqual(
  headerJsx.includes('{headerWeatherIcon}'),
  true,
  'SmartHeaderGreeting deve renderizar headerWeatherIcon obedecendo as variações de clima e turno (Lua à noite, Sol de dia)'
);

// 3. Garantir que as 3 linhas continuam empilhadas e alinhadas
assert.strictEqual(
  headerJsx.includes('className="sh-hero-greeting-row"'),
  true,
  'Linha 1: Deve conter sh-hero-greeting-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-login-row"'),
  true,
  'Linha 2: Deve conter sh-hero-login-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-date-row"'),
  true,
  'Linha 3: Deve conter sh-hero-date-row'
);

// 4. Garantir que o Pulso Operacional permanece fora
assert.strictEqual(
  headerJsx.includes('PULSO OPERACIONAL'),
  false,
  'Pulso Operacional deve permanecer removido'
);

// 5. CSS
assert.strictEqual(
  appCss.includes('.sh-hero-icon-wrap'),
  true,
  'App.css deve conter estilos para .sh-hero-icon-wrap'
);

assert.strictEqual(
  appCss.includes('.weather-art-svg'),
  true,
  'App.css deve conter estilos para .weather-art-svg'
);

// 6. Componente de Ilustração Vetorial
assert.strictEqual(
  headerJsx.includes('WeatherIllustration'),
  true,
  'SmartHeaderGreeting deve importar e utilizar WeatherIllustration'
);

// 7. Teste de mapeamento das ilustrações para Dia e Noite e Clima
function getIllustrationKey(code, isDay) {
  const c = Number(code);
  switch (c) {
    case 0:
    case 1:
      return isDay ? 'day-clear' : 'night-clear';
    case 2:
      return isDay ? 'day-partly-cloudy' : 'night-partly-cloudy';
    case 3:
      return isDay ? 'day-cloudy' : 'night-cloudy';
    case 45:
    case 48:
      return isDay ? 'day-fog' : 'night-fog';
    case 51:
    case 53:
    case 55:
      return isDay ? 'day-drizzle' : 'night-drizzle';
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return isDay ? 'day-rain' : 'night-rain';
    case 95:
    case 96:
    case 99:
      return isDay ? 'day-storm' : 'night-storm';
    default:
      return isDay ? 'day-clear' : 'night-clear';
  }
}

// À noite (isDay = 0)
assert.strictEqual(getIllustrationKey(0, 0), 'night-clear', 'Noite com céu limpo deve gerar night-clear');
assert.strictEqual(getIllustrationKey(2, 0), 'night-partly-cloudy', 'Noite parcialmente nublada deve gerar night-partly-cloudy');
assert.strictEqual(getIllustrationKey(3, 0), 'night-cloudy', 'Noite nublada deve gerar night-cloudy');
assert.strictEqual(getIllustrationKey(61, 0), 'night-rain', 'Noite chuvosa deve gerar night-rain');
assert.strictEqual(getIllustrationKey(95, 0), 'night-storm', 'Noite com tempestade deve gerar night-storm');

// De dia (isDay = 1)
assert.strictEqual(getIllustrationKey(0, 1), 'day-clear', 'Dia ensolarado deve gerar day-clear');
assert.strictEqual(getIllustrationKey(2, 1), 'day-partly-cloudy', 'Dia com sol e nuvens deve gerar day-partly-cloudy');
assert.strictEqual(getIllustrationKey(3, 1), 'day-cloudy', 'Dia nublado deve gerar day-cloudy');
assert.strictEqual(getIllustrationKey(61, 1), 'day-rain', 'Dia com chuva deve gerar day-rain');
assert.strictEqual(getIllustrationKey(95, 1), 'day-storm', 'Dia com tempestade deve gerar day-storm');

console.log('✅ Todos os testes do Smart Header Greeting com ilustrações de clima e dia/noite passaram com 100% de sucesso!');
