const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de alinhamento do botão Raio-X e XP no Ranking...');

const rankingJsxPath = path.resolve(__dirname, '../src/components/TeamPerformanceRanking.jsx');
const appCssPath = path.resolve(__dirname, '../src/App.css');

const rankingJsx = fs.readFileSync(rankingJsxPath, 'utf8');
const appCss = fs.readFileSync(appCssPath, 'utf8');

// 1. Verificar JSX
assert.strictEqual(
  rankingJsx.includes('className="rmc-score-col"'),
  true,
  'Deve conter a coluna de score rmc-score-col'
);

assert.strictEqual(
  rankingJsx.includes('className="rmc-score-val"'),
  true,
  'Deve conter o elemento com o valor do XP rmc-score-val'
);

assert.strictEqual(
  rankingJsx.includes('className="rmc-score-lbl">XP</span>'),
  true,
  'Deve conter o rótulo XP conciso e limpo'
);

assert.strictEqual(
  rankingJsx.includes('className="btn-view-member-ray"'),
  true,
  'Deve conter o botão btn-view-member-ray'
);

assert.strictEqual(
  rankingJsx.includes('<span>Raio-X</span>'),
  true,
  'Deve conter o texto Raio-X dentro do botão'
);

// 2. Verificar CSS
// Verificar se .rmc-score-col agora é empilhado verticalmente
const rmcScoreColMatch = appCss.match(/\.rmc-score-col\s*\{([^}]+)\}/);
assert.strictEqual(
  !!rmcScoreColMatch,
  true,
  'Deve existir a regra CSS .rmc-score-col'
);

const rmcScoreColCss = rmcScoreColMatch[1];
assert.strictEqual(
  rmcScoreColCss.includes('flex-direction: column'),
  true,
  '.rmc-score-col deve ter flex-direction: column para colocar XP em cima e botão embaixo'
);

assert.strictEqual(
  rmcScoreColCss.includes('align-items: center'),
  true,
  '.rmc-score-col deve ter align-items: center para alinhamento central perfeito'
);

// Verificar se .btn-view-member-ray possui white-space: nowrap para nunca quebrar "Raio-" e "X"
const btnRayMatch = appCss.match(/\.btn-view-member-ray\s*\{([^}]+)\}/);
assert.strictEqual(
  !!btnRayMatch,
  true,
  'Deve existir a regra CSS .btn-view-member-ray'
);

const btnRayCss = btnRayMatch[1];
assert.strictEqual(
  btnRayCss.includes('white-space: nowrap'),
  true,
  '.btn-view-member-ray deve ter white-space: nowrap'
);

assert.strictEqual(
  btnRayCss.includes('justify-content: center'),
  true,
  '.btn-view-member-ray deve centralizar conteúdo com justify-content: center'
);

// Verificar largura do grid em .ranking-member-card
assert.strictEqual(
  appCss.includes('grid-template-columns: 50px 50px 1fr auto 100px;'),
  true,
  '.ranking-member-card deve ter coluna otimizada para o layout vertical'
);

console.log('✅ Todos os testes de alinhamento do botão Raio-X e XP passaram com 100% de sucesso!');
