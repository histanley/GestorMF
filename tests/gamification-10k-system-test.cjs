const assert = require('assert');

async function run() {
  console.log('🧪 Iniciando Bateria de Testes do Sistema de Gamificação 10.000 XP...');

  const {
    CAREER_TIERS,
    MAX_CAREER_XP,
    getCareerProgression,
    calculateMemberPerformanceProfile,
    ROLE_XP_POINTS,
    OFFICIAL_COMPANY_ROLES,
  } = await import('../src/utils/companyRoles.js');

  // 1. Teto de carreira
  assert.strictEqual(MAX_CAREER_XP, 10000, 'MAX_CAREER_XP deve ser 10.000');
  console.log('✅ 1. MAX_CAREER_XP = 10.000 XP confirmado.');

  // 2. 10 Patentes Operacionais
  assert.strictEqual(CAREER_TIERS.length, 10, 'Devem existir exatamente 10 patentes operacionais');
  assert.strictEqual(CAREER_TIERS[0].level, 1);
  assert.strictEqual(CAREER_TIERS[0].min, 0);
  assert.strictEqual(CAREER_TIERS[0].max, 250);
  assert.strictEqual(CAREER_TIERS[0].title, 'Recruta Operacional');

  assert.strictEqual(CAREER_TIERS[1].level, 2);
  assert.strictEqual(CAREER_TIERS[1].min, 250);
  assert.strictEqual(CAREER_TIERS[1].max, 600);
  assert.strictEqual(CAREER_TIERS[1].title, 'Operador Bronze');

  assert.strictEqual(CAREER_TIERS[2].level, 3);
  assert.strictEqual(CAREER_TIERS[2].min, 600);
  assert.strictEqual(CAREER_TIERS[2].max, 1200);
  assert.strictEqual(CAREER_TIERS[2].title, 'Operador Prata');

  assert.strictEqual(CAREER_TIERS[3].level, 4);
  assert.strictEqual(CAREER_TIERS[3].min, 1200);
  assert.strictEqual(CAREER_TIERS[3].max, 2000);
  assert.strictEqual(CAREER_TIERS[3].title, 'Especialista Ouro');

  assert.strictEqual(CAREER_TIERS[9].level, 10);
  assert.strictEqual(CAREER_TIERS[9].min, 9500);
  assert(CAREER_TIERS[9].max >= 10000);
  assert.strictEqual(CAREER_TIERS[9].title, 'Lenda Viva MegaFilmes');
  console.log('✅ 2. Todas as 10 Patentes Operacionais de Nível 1 a Nível 10 calibradas com perfeição.');

  // 3. Simulação fiel do Mateus (4 missões)
  const mockMateus = {
    id: 'mateus_1',
    name: 'Mateus Henrique',
    role: 'Cinegrafista',
    secondaryRoles: ['Editor de Vídeo', 'Fotógrafo(a)', 'Motorista / Produção'],
  };

  const mockMissions = [
    {
      id: 'm1',
      missionStatus: 'Finalizada',
      date: '2026-11-10',
      teamMembers: [{ id: 'mateus_1', name: 'Mateus Henrique' }],
      memberRoles: { mateus_1: 'Cinegrafista' },
      driverId: 'mateus_1',
      distanceKm: 8,
    },
    {
      id: 'm2',
      missionStatus: 'Finalizada',
      date: '2026-11-12',
      editorIds: ['mateus_1'],
      driverId: 'mateus_1',
      distanceKm: 8,
    },
    {
      id: 'm3',
      missionStatus: 'Finalizada',
      date: '2026-11-14',
      teamMembers: [{ id: 'mateus_1', name: 'Mateus Henrique' }],
      memberRoles: { mateus_1: 'Cinegrafista' },
      editorIds: ['mateus_1'],
    },
    {
      id: 'm4',
      missionStatus: 'Finalizada',
      date: '2026-11-15',
      teamMembers: [{ id: 'mateus_1', name: 'Mateus Henrique' }],
      memberRoles: { mateus_1: 'Fotógrafo(a)' },
    },
  ];

  const profile = calculateMemberPerformanceProfile(mockMateus, mockMissions, []);
  console.log('📊 Perfil de Mateus calculado:', {
    score: profile.score,
    totalMissions: profile.totalMissions,
    completedCount: profile.completedCount,
    drivingCount: profile.drivingCount,
    estimatedDistanceKm: profile.estimatedDistanceKm,
    unlockedCount: profile.unlockedCount,
    totalAchievementsCount: profile.totalAchievementsCount,
  });

  const mateusTier = getCareerProgression(profile.score);
  console.log(`🎖️ Patente de Mateus: Nível ${mateusTier.level} • ${mateusTier.title} (${mateusTier.score} XP)`);
  assert(mateusTier.level <= 2, `Com 4 missões, Mateus deve estar no Nível 1 ou 2, mas estava no Nível ${mateusTier.level}`);
  assert.notStrictEqual(mateusTier.title, 'Especialista Ouro', 'Mateus NÃO PODE ser Especialista Ouro com apenas 4 missões');
  console.log('✅ 3. Calibragem comprovada: 4 missões mantêm o colaborador no Nível 1 ou 2, com ampla jornada pela frente.');

  // 4. Catálogo de Conquistas & Insígnias
  assert.strictEqual(profile.allAchievements.length, 16, 'Devem existir 16 conquistas oficiais');
  const editorAch = profile.allAchievements.find(a => a.id === 'editor-gold');
  assert(editorAch && editorAch.isUnlocked, 'Mestre da Ilha (Editor de Vídeo) deve estar desbloqueada');

  const vetAch = profile.allAchievements.find(a => a.id === 'vet-gold');
  assert(vetAch && !vetAch.isUnlocked, 'Veterano de Campo (10 missões) deve estar bloqueada para 4 missões');
  assert.strictEqual(vetAch.current, 4, 'Progresso atual de Veterano deve ser 4');
  assert.strictEqual(vetAch.target, 5, 'Meta de Veterano deve ser 5');
  console.log('✅ 4. Conquistas & Insígnias funcionando com rastreamento dinâmico e status corretos.');

  // 5. Testes da progressão getCareerProgression em patamares-chave
  const progZero = getCareerProgression(0);
  assert.strictEqual(progZero.level, 1);
  assert.strictEqual(progZero.progressPercent, 0);
  assert.strictEqual(progZero.overallPercent, 0);

  const progMid = getCareerProgression(5000);
  assert.strictEqual(progMid.level, 7); // 4600 a 6200 = Comandante de Set
  assert.strictEqual(progMid.title, 'Comandante de Set');
  assert.strictEqual(progMid.overallPercent, 50);

  const progMax = getCareerProgression(10500);
  assert.strictEqual(progMax.level, 10);
  assert.strictEqual(progMax.title, 'Lenda Viva MegaFilmes');
  assert.strictEqual(progMax.overallPercent, 100);
  assert.strictEqual(progMax.remainingForNext, 0);
  console.log('✅ 5. getCareerProgression validado em múltiplos patamares (0 XP, 5.000 XP, 10.000+ XP).');

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO ABSOLUTO!');
}

run().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
