import React from 'react';

/**
 * Ilustrações Vetoriais Premium de Clima e Turno (Google Weather & Prints Oficiais)
 * Modeladas estritamente com base nos prints fornecidos:
 * - Print 1: Sol 3D dourado/âmbar com nuvem branca fofa volumétrica em primeiro plano
 * - Print 2: Google Weather Boa Vista (Sol 3D recortado/scalloped com pétalas arredondadas + nuvem fofa)
 * - Lua 3D Noturna: Lua crescente dourada/âmbar com crateras e estrelas cintilantes
 * - Todas as variações climáticas: Ensolarado, Parcialmente Nublado, Nublado, Chuva, Chuvisco, Tempestade, Neve, Neblina, Vento.
 */
export default function WeatherIllustration({
  type = 'day-clear',
  size = 42,
  className = '',
  title = '',
}) {
  const s = size;

  // Gradientes, Filtros e Shading Volumétrico 3D Compartilhados
  const defs = (
    <defs>
      {/* 1. Sol Dourado Volumétrico 3D (Google Weather) */}
      <linearGradient id="wi-sun-3d" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF176" />
        <stop offset="25%" stopColor="#FDD835" />
        <stop offset="60%" stopColor="#FB8C00" />
        <stop offset="100%" stopColor="#E65100" />
      </linearGradient>

      <radialGradient id="wi-sun-core" cx="35%" cy="32%" r="65%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="35%" stopColor="#FDD835" />
        <stop offset="80%" stopColor="#FB8C00" />
        <stop offset="100%" stopColor="#E65100" />
      </radialGradient>

      {/* 2. Lua Crescente Dourada/Âmbar 3D com Crateras Realistas */}
      <radialGradient id="wi-moon-amber" cx="35%" cy="32%" r="68%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="30%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="90%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>

      <radialGradient id="wi-moon-crater" cx="40%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#B45309" stopOpacity="0.6" />
        <stop offset="70%" stopColor="#D97706" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
      </radialGradient>

      {/* 3. Nuvem Branca Fofa e Volumétrica 3D (Google Weather & Print 1) */}
      <linearGradient id="wi-cloud-front" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="45%" stopColor="#F8FAFC" />
        <stop offset="80%" stopColor="#E2E8F0" />
        <stop offset="100%" stopColor="#CBD5E1" />
      </linearGradient>

      <linearGradient id="wi-cloud-back" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E2E8F0" />
        <stop offset="60%" stopColor="#CBD5E1" />
        <stop offset="100%" stopColor="#94A3B8" />
      </linearGradient>

      {/* 4. Nuvem Noturna Suave */}
      <linearGradient id="wi-cloud-night" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748B" />
        <stop offset="50%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>

      {/* 5. Nuvem de Chuva e Tempestade */}
      <linearGradient id="wi-cloud-rain" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748B" />
        <stop offset="45%" stopColor="#475569" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      <linearGradient id="wi-cloud-storm" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="50%" stopColor="#1E293B" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>

      {/* 6. Raio Elétrico Dourado */}
      <linearGradient id="wi-lightning" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="35%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* 7. Filtros de Sombra e Brilho Suave */}
      <filter id="wi-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id="wi-drop-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2.2" stdDeviation="2" floodColor="#000000" floodOpacity="0.28" />
      </filter>
    </defs>
  );

  // ============================================================================
  // A. HORÁRIO DIURNO (DIA)
  // ============================================================================

  // 1. DIA: ENSOLARADO / CÉU LIMPO (Sol 3D Scalloped de 8 Pétalas Arredondadas do Google Weather)
  if (type === 'day-clear') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-clear ${className}`}
        aria-label={title || 'Ensolarado'}
      >
        {defs}
        {/* Halo de Brilho Quente e Radiante */}
        <circle cx="24" cy="24" r="19" fill="#FBBF24" opacity="0.16" filter="url(#wi-soft-glow)" />
        {/* Sol Scalloped 3D com Animação de Pulso Vivo */}
        <g className="wi-anim-sun" filter="url(#wi-drop-shadow)">
          {/* Corpo com 8 Pétalas Arredondadas (2 quadrados de 31px com cantos suaves a 0° e 45°) */}
          <rect x="8.5" y="8.5" width="31" height="31" rx="8" fill="url(#wi-sun-3d)" />
          <rect x="8.5" y="8.5" width="31" height="31" rx="8" transform="rotate(45 24 24)" fill="url(#wi-sun-3d)" />
          {/* Núcleo Central Volumétrico Esférico */}
          <circle cx="24" cy="24" r="11.5" fill="url(#wi-sun-core)" />
          {/* Arco de Brilho Especular 3D Superior (Efeito Google) */}
          <path
            d="M 17 21 A 8 8 0 0 1 25 15"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>
      </svg>
    );
  }

  // 2. DIA: PREDOMÍNIO DE SOL / PARCIALMENTE NUBLADO (IDÊNTICO AO GOOGLE WEATHER & PRINT 2 - Sol Scalloped + Nuvem Fofa 3D)
  if (type === 'day-partly-cloudy') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-partly-cloudy ${className}`}
        aria-label={title || 'Sol com Nuvens'}
      >
        {defs}
        {/* Sol Scalloped 3D no Canto Superior Esquerdo com Halo */}
        <g className="wi-anim-sun-corner" filter="url(#wi-drop-shadow)">
          <rect x="6.5" y="6.5" width="25" height="25" rx="6.5" fill="url(#wi-sun-3d)" />
          <rect x="6.5" y="6.5" width="25" height="25" rx="6.5" transform="rotate(45 19 19)" fill="url(#wi-sun-3d)" />
          <circle cx="19" cy="19" r="9.5" fill="url(#wi-sun-core)" />
          {/* Brilho Superior Curvado */}
          <path
            d="M 13.5 16.5 A 6.5 6.5 0 0 1 20 12.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>

        {/* Nuvem Branca Fofa e Volumétrica 3D em Primeiro Plano (Google Weather & Print 1) */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 16 38 H 38 C 41.86 38 45 34.86 45 31 C 45 27.4  42.2 24.4  38.6 24.1 C 38 19 33.7 15 28.5 15 C 24.1 15 20.3 17.8 18.9 21.8 C 15.5 22.3 13 25.2 13 28.7 C 13 33.8  17.2 38  16 38 Z"
            fill="url(#wi-cloud-front)"
          />
          {/* Destaques Volumétricos de Brilho 3D na Nuvem */}
          <ellipse cx="28.5" cy="19.5" rx="5" ry="2.6" fill="#FFFFFF" opacity="0.92" />
          <ellipse cx="20.5" cy="25" rx="3.5" ry="1.8" fill="#FFFFFF" opacity="0.8" />
        </g>
      </svg>
    );
  }

  // 3. DIA: NUBLADO / CÉU ENCOBERTO (Nuvens 3D em Dupla Camada)
  if (type === 'day-cloudy') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-cloudy ${className}`}
        aria-label={title || 'Nublado'}
      >
        {defs}
        {/* Nuvem Traseira */}
        <g className="wi-anim-cloud-rear" opacity="0.75" transform="translate(-4, -4)">
          <path
            d="M 16 38 H 38 C 41.86 38 45 34.86 45 31 C 45 27.4 42.2 24.4 38.6 24.1 C 38 19 33.7 15 28.5 15 C 24.1 15 20.3 17.8 18.9 21.8 C 15.5 22.3 13 25.2 13 28.7 C 13 33.8 17.2 38 16 38 Z"
            fill="url(#wi-cloud-back)"
          />
        </g>
        {/* Nuvem Frontal */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 16 41 H 38 C 41.86 41 45 37.86 45 34 C 45 30.4 42.2 27.4 38.6 27.1 C 38 22 33.7 18 28.5 18 C 24.1 18 20.3 20.8 18.9 24.8 C 15.5 25.3 13 28.2 13 31.7 C 13 36.8 17.2 41 16 41 Z"
            fill="url(#wi-cloud-front)"
          />
          <ellipse cx="28.5" cy="22.5" rx="5" ry="2.6" fill="#FFFFFF" opacity="0.9" />
          <ellipse cx="20.5" cy="28" rx="3.5" ry="1.8" fill="#FFFFFF" opacity="0.8" />
        </g>
      </svg>
    );
  }

  // 4. DIA: CHUVOSO / CHUVA / PANCADAS DE CHUVA (Nuvem 3D + Gotas Animadas em Ângulo)
  if (type === 'day-rain') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-rain ${className}`}
        aria-label={title || 'Chuva'}
      >
        {defs}
        {/* Nuvem de Chuva Volumétrica */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 34 H 37 C 40.5 34 43.5 31 43.5 27.5 C 43.5 24.2 41 21.5 37.7 21.2 C 37.1 16.5 33 13 28 13 C 23.8 13 20.2 15.5 18.8 19.3 C 15.5 19.8 13 22.5 13 25.8 C 13 30.2 17 34 15 34 Z"
            fill="url(#wi-cloud-rain)"
          />
          <ellipse cx="28" cy="17" rx="4.5" ry="2" fill="#94A3B8" opacity="0.65" />
        </g>
        {/* Gotas de Chuva Ciano com Animação Fluida Escalonada */}
        <g className="wi-anim-rain-1">
          <line x1="19" y1="36" x2="16" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-2">
          <line x1="27" y1="36" x2="24" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-3">
          <line x1="35" y1="36" x2="32" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 5. DIA: CHUVISCO PASSAGEIRO (Sol Scalloped + Nuvem + Gotículas Delicadas)
  if (type === 'day-drizzle') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-drizzle ${className}`}
        aria-label={title || 'Chuvisco Passageiro'}
      >
        {defs}
        {/* Sol Diurno Scalloped no Fundo */}
        <g className="wi-anim-sun-corner" filter="url(#wi-drop-shadow)">
          <rect x="7" y="7" width="22" height="22" rx="5.5" fill="url(#wi-sun-3d)" />
          <rect x="7" y="7" width="22" height="22" rx="5.5" transform="rotate(45 18 18)" fill="url(#wi-sun-3d)" />
          <circle cx="18" cy="18" r="8" fill="url(#wi-sun-core)" />
        </g>
        {/* Nuvem */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 35 H 36 C 39.5 35 42.5 32 42.5 28.5 C 42.5 25.2 40 22.5 36.7 22.2 C 36.1 17.5 32 14 27 14 C 22.8 14 19.2 16.5 17.8 20.3 C 14.5 20.8 12 23.5 12 26.8 C 12 31.2 16 35 15 35 Z"
            fill="url(#wi-cloud-front)"
          />
          <ellipse cx="27" cy="18.5" rx="4.5" ry="2" fill="#FFFFFF" opacity="0.85" />
        </g>
        {/* Chuviscos Leves */}
        <g className="wi-anim-rain-1">
          <line x1="22" y1="38" x2="20" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-2">
          <line x1="30" y1="38" x2="28" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 6. DIA: TEMPESTADE / TROVOADA (Nuvem Escura + Raio Elétrico Dourado 3D + Chuva)
  if (type === 'day-storm') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-storm ${className}`}
        aria-label={title || 'Tempestade'}
      >
        {defs}
        {/* Nuvem Escura de Tempestade */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 31 H 37 C 40.5 31 43.5 28 43.5 24.5 C 43.5 21.2 41 18.5 37.7 18.2 C 37.1 13.5 33 10 28 10 C 23.8 10 20.2 12.5 18.8 16.3 C 15.5 16.8 13 19.5 13 22.8 C 13 27.2 17 31 15 31 Z"
            fill="url(#wi-cloud-storm)"
            stroke="#475569"
            strokeWidth="0.8"
          />
        </g>
        {/* Raio Elétrico Dourado 3D com Pulso Intenso */}
        <g className="wi-anim-lightning">
          <path
            d="M 26 19 L 19 29 H 26 L 22 43 L 34 27 H 27 L 30 19 Z"
            fill="url(#wi-lightning)"
            stroke="#FEF08A"
            strokeWidth="0.8"
            filter="url(#wi-soft-glow)"
          />
        </g>
        <g className="wi-anim-rain-1">
          <line x1="14" y1="34" x2="11" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-3">
          <line x1="38" y1="34" x2="35" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 7. DIA: NEVE / NEVANDO (Nuvem Gélida + Flocos Cristalinos 3D Animados)
  if (type === 'day-snow') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-snow ${className}`}
        aria-label={title || 'Nevando'}
      >
        {defs}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 33 H 37 C 40.5 33 43.5 30 43.5 26.5 C 43.5 23.2 41 20.5 37.7 20.2 C 37.1 15.5 33 12 28 12 C 23.8 12 20.2 14.5 18.8 18.3 C 15.5 18.8 13 21.5 13 24.8 C 13 29.2 17 33 15 33 Z"
            fill="url(#wi-cloud-front)"
          />
          <ellipse cx="28" cy="16.5" rx="4.5" ry="2" fill="#FFFFFF" opacity="0.9" />
        </g>
        {/* 3 Flocos de Neve Cristalinos Delicados com Rotação e Descida Suave */}
        <g className="wi-anim-snow-1" transform="translate(18, 39)">
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-3" y1="0" x2="3" y2="0" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-2" y1="-2" x2="2" y2="2" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="-2" y1="2" x2="2" y2="-2" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-snow-2" transform="translate(27, 38)">
          <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#7DD3FC" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#7DD3FC" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5" stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-snow-3" transform="translate(36, 39)">
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-3" y1="0" x2="3" y2="0" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-2" y1="-2" x2="2" y2="2" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="-2" y1="2" x2="2" y2="-2" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 8. DIA: NEVOEIRO / NÉVOA / NEBLINA (Nuvem + Vapores Horizontais Fluídos)
  if (type === 'day-fog') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-fog ${className}`}
        aria-label={title || 'Nevoeiro'}
      >
        {defs}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)" opacity="0.85">
          <path
            d="M 16 28 H 36 C 39 28 42 25.5 42 22.5 C 42 19.5 39.5 17 36.5 16.8 C 36 12.5 32 9.5 27 9.5 C 23 9.5 19.5 11.5 18 15 C 15 15.5 13 18 13 21 C 13 25 16 28 16 28 Z"
            fill="url(#wi-cloud-front)"
          />
        </g>
        <g className="wi-anim-mist">
          <line x1="9" y1="29" x2="39" y2="29" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <line x1="6" y1="35" x2="42" y2="35" stroke="#94A3B8" strokeWidth="3.2" strokeLinecap="round" opacity="0.8" />
          <line x1="12" y1="41" x2="36" y2="41" stroke="#64748B" strokeWidth="2.8" strokeLinecap="round" opacity="0.7" />
        </g>
      </svg>
    );
  }

  // ============================================================================
  // B. HORÁRIO NOTURNO (NOITE)
  // ============================================================================

  // 9. NOITE: CÉU LIMPO / ESTRELADO (Lua Crescente Âmbar 3D com Crateras do Print 2 + Estrelas)
  if (type === 'night-clear') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-clear ${className}`}
        aria-label={title || 'Noite Estrelada'}
      >
        {defs}
        {/* Brilho Noturno Quente no Fundo */}
        <circle cx="28" cy="24" r="17" fill="#F59E0B" opacity="0.14" filter="url(#wi-soft-glow)" />

        {/* Lua Crescente Dourada 3D com Curvatura Idêntica ao Print 2 */}
        <g className="wi-anim-moon" filter="url(#wi-drop-shadow)">
          <path
            d="M 34 6 C 24.5 8 16.5 16.5 16.5 27 C 16.5 38 25 46.5 36 46.5 C 39.5 46.5 42.8 45.4 45.5 43.5 C 32.8 41.5 24 29.5 26.2 15.5 C 27 11.5 29 8.2 34 6 Z"
            fill="url(#wi-moon-amber)"
          />
          {/* Crateras Realistas Texturizadas */}
          <circle cx="23.5" cy="27" r="2.2" fill="url(#wi-moon-crater)" />
          <circle cx="29" cy="36" r="1.8" fill="url(#wi-moon-crater)" />
          <circle cx="24" cy="18" r="1.5" fill="url(#wi-moon-crater)" />
          <circle cx="34" cy="41" r="1.4" fill="url(#wi-moon-crater)" />
          <circle cx="27" cy="12" r="1.2" fill="url(#wi-moon-crater)" />

          {/* Destaque de Brilho Suave na Borda Curva da Lua */}
          <path
            d="M 17.5 27 C 17.5 18 24 10.5 32 7.5 C 25 10 18.5 17.5 18.5 27 C 18.5 36.5 25 44 34 45.5 C 26 44 17.5 36.5 17.5 27 Z"
            fill="#FEF08A"
            opacity="0.5"
          />
        </g>

        {/* Estrelas Cintilantes com Animação Deslocada */}
        <g className="wi-anim-star">
          <path d="M 10 11 L 11 13.5 L 13.5 14.5 L 11 15.5 L 10 18 L 9 15.5 L 6.5 14.5 L 9 13.5 Z" fill="#FDE047" opacity="0.95" />
        </g>
        <g className="wi-anim-star-delayed">
          <path d="M 8 29 L 8.7 31 L 10.7 31.7 L 8.7 32.3 L 8 34.3 L 7.3 32.3 L 5.3 31.7 L 7.3 31 Z" fill="#93C5FD" opacity="0.85" />
          <circle cx="15" cy="40" r="1.2" fill="#E0E7FF" opacity="0.8" />
          <circle cx="43" cy="14" r="1.2" fill="#FEF08A" opacity="0.9" />
        </g>
      </svg>
    );
  }

  // 10. NOITE: PARCIALMENTE NUBLADA / NOITE COM NUVENS (Lua Dourada + Nuvem Noturna 3D)
  if (type === 'night-partly-cloudy') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-partly-cloudy ${className}`}
        aria-label={title || 'Noite com Nuvens'}
      >
        {defs}
        {/* Lua Crescente Dourada Elevada */}
        <g className="wi-anim-moon" transform="translate(-2, -3)">
          <path
            d="M 30 6 C 22.5 8 16 15 16 23.5 C 16 32.5 23 39.5 32 39.5 C 34.8 39.5 37.5 38.6 39.8 37 C 29.2 35.5 22 25.5 23.8 14 C 24.4 10.5 26 7.8 30 6 Z"
            fill="url(#wi-moon-amber)"
          />
          <circle cx="22" cy="24" r="1.8" fill="url(#wi-moon-crater)" />
          <circle cx="27" cy="32" r="1.4" fill="url(#wi-moon-crater)" />
          <circle cx="23" cy="16" r="1.2" fill="url(#wi-moon-crater)" />
        </g>

        {/* Nuvem Noturna Translúcida em Primeiro Plano */}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 17 41 H 36 C 39.31 41 42 38.31 42 35 C 42 31.88 39.61 29.31 36.56 29.03 C 36.03 24.62 32.32 21.28 27.85 21.28 C 24.07 21.28 20.84 23.69 19.62 27.1 C 16.75 27.56 14.57 30.05 14.57 33.04 C 14.57 37.43 18.13 41 17 41 Z"
            fill="url(#wi-cloud-night)"
            stroke="#64748B"
            strokeWidth="0.8"
          />
        </g>
      </svg>
    );
  }

  // 11. NOITE: NUBLADA (Nuvens Noturnas com Brilho Lunar Atrás)
  if (type === 'night-cloudy') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-cloudy ${className}`}
        aria-label={title || 'Noite Nublada'}
      >
        {defs}
        {/* Lua sutil atrás das nuvens */}
        <g className="wi-anim-moon" transform="translate(-4, -2)" opacity="0.85">
          <path
            d="M 28 8 C 21 10 16 16 16 23 C 16 30 21 36 28 37 C 22 34 19 26 21 17 C 22 13 24 10 28 8 Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        {/* Dupla camada de nuvens noturnas */}
        <g className="wi-anim-cloud-rear" opacity="0.7" transform="translate(-3, -3)">
          <path
            d="M 16 38 H 38 C 41.86 38 45 34.86 45 31 C 45 27.4 42.2 24.4 38.6 24.1 C 38 19 33.7 15 28.5 15 C 24.1 15 20.3 17.8 18.9 21.8 C 15.5 22.3 13 25.2 13 28.7 C 13 33.8 17.2 38 16 38 Z"
            fill="url(#wi-cloud-storm)"
          />
        </g>
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 16 41 H 38 C 41.86 41 45 37.86 45 34 C 45 30.4 42.2 27.4 38.6 27.1 C 38 22 33.7 18 28.5 18 C 24.1 18 20.3 20.8 18.9 24.8 C 15.5 25.3 13 28.2 13 31.7 C 13 36.8 17.2 41 16 41 Z"
            fill="url(#wi-cloud-night)"
          />
        </g>
      </svg>
    );
  }

  // 12. NOITE: CHUVA NOTURNA
  if (type === 'night-rain') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-rain ${className}`}
        aria-label={title || 'Chuva Noturna'}
      >
        {defs}
        {/* Lua sutil atrás da nuvem */}
        <g className="wi-anim-moon" transform="translate(-5, -4)" opacity="0.6">
          <path
            d="M 28 8 C 21 10 16 16 16 23 C 16 30 21 36 28 37 C 22 34 19 26 21 17 C 22 13 24 10 28 8 Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 34 H 37 C 40.5 34 43.5 31 43.5 27.5 C 43.5 24.2 41 21.5 37.7 21.2 C 37.1 16.5 33 13 28 13 C 23.8 13 20.2 15.5 18.8 19.3 C 15.5 19.8 13 22.5 13 25.8 C 13 30.2 17 34 15 34 Z"
            fill="url(#wi-cloud-rain)"
          />
        </g>
        <g className="wi-anim-rain-1">
          <line x1="19" y1="36" x2="16" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-2">
          <line x1="27" y1="36" x2="24" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-3">
          <line x1="35" y1="36" x2="32" y2="43" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 13. NOITE: CHUVISCO NOTURNO
  if (type === 'night-drizzle') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-drizzle ${className}`}
        aria-label={title || 'Chuvisco Noturno'}
      >
        {defs}
        <g className="wi-anim-moon" transform="translate(-4, -4)">
          <path
            d="M 28 8 C 21 10 16 16 16 23 C 16 30 21 36 28 37 C 22 34 19 26 21 17 C 22 13 24 10 28 8 Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 35 H 36 C 39.5 35 42.5 32 42.5 28.5 C 42.5 25.2 40 22.5 36.7 22.2 C 36.1 17.5 32 14 27 14 C 22.8 14 19.2 16.5 17.8 20.3 C 14.5 20.8 12 23.5 12 26.8 C 12 31.2 16 35 15 35 Z"
            fill="url(#wi-cloud-night)"
          />
        </g>
        <g className="wi-anim-rain-1">
          <line x1="22" y1="38" x2="20" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-2">
          <line x1="30" y1="38" x2="28" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 14. NOITE: TEMPESTADE NOTURNA
  if (type === 'night-storm') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-storm ${className}`}
        aria-label={title || 'Tempestade Noturna'}
      >
        {defs}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 31 H 37 C 40.5 31 43.5 28 43.5 24.5 C 43.5 21.2 41 18.5 37.7 18.2 C 37.1 13.5 33 10 28 10 C 23.8 10 20.2 12.5 18.8 16.3 C 15.5 16.8 13 19.5 13 22.8 C 13 27.2 17 31 15 31 Z"
            fill="url(#wi-cloud-storm)"
            stroke="#475569"
            strokeWidth="0.8"
          />
        </g>
        <g className="wi-anim-lightning">
          <path
            d="M 26 19 L 19 29 H 26 L 22 43 L 34 27 H 27 L 30 19 Z"
            fill="url(#wi-lightning)"
            stroke="#FEF08A"
            strokeWidth="0.8"
            filter="url(#wi-soft-glow)"
          />
        </g>
        <g className="wi-anim-rain-1">
          <line x1="14" y1="34" x2="11" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="wi-anim-rain-3">
          <line x1="38" y1="34" x2="35" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 15. NOITE: NEVE NOTURNA
  if (type === 'night-snow') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-snow ${className}`}
        aria-label={title || 'Neve Noturna'}
      >
        {defs}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)">
          <path
            d="M 15 33 H 37 C 40.5 33 43.5 30 43.5 26.5 C 43.5 23.2 41 20.5 37.7 20.2 C 37.1 15.5 33 12 28 12 C 23.8 12 20.2 14.5 18.8 18.3 C 15.5 18.8 13 21.5 13 24.8 C 13 29.2 17 33 15 33 Z"
            fill="url(#wi-cloud-night)"
          />
        </g>
        <g className="wi-anim-snow-1" transform="translate(18, 39)">
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-3" y1="0" x2="3" y2="0" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g className="wi-anim-snow-2" transform="translate(27, 38)">
          <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g className="wi-anim-snow-3" transform="translate(36, 39)">
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-3" y1="0" x2="3" y2="0" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 16. NOITE: NEBLINA / NEVOEIRO NOTURNO
  if (type === 'night-fog') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-fog ${className}`}
        aria-label={title || 'Neblina Noturna'}
      >
        {defs}
        <g className="wi-anim-cloud" filter="url(#wi-drop-shadow)" opacity="0.8">
          <path
            d="M 16 28 H 36 C 39 28 42 25.5 42 22.5 C 42 19.5 39.5 17 36.5 16.8 C 36 12.5 32 9.5 27 9.5 C 23 9.5 19.5 11.5 18 15 C 15 15.5 13 18 13 21 C 13 25 16 28 16 28 Z"
            fill="url(#wi-cloud-night)"
          />
        </g>
        <g className="wi-anim-mist">
          <line x1="9" y1="29" x2="39" y2="29" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
          <line x1="6" y1="35" x2="42" y2="35" stroke="#64748B" strokeWidth="3.2" strokeLinecap="round" opacity="0.75" />
          <line x1="12" y1="41" x2="36" y2="41" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" opacity="0.65" />
        </g>
      </svg>
    );
  }

  // Fallback padrão: Ensolarado
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`weather-art-svg wi-day-clear ${className}`}
      aria-label={title || 'Clima'}
    >
      {defs}
      <g className="wi-anim-sun" filter="url(#wi-drop-shadow)">
        <rect x="8.5" y="8.5" width="31" height="31" rx="8" fill="url(#wi-sun-3d)" />
        <rect x="8.5" y="8.5" width="31" height="31" rx="8" transform="rotate(45 24 24)" fill="url(#wi-sun-3d)" />
        <circle cx="24" cy="24" r="11.5" fill="url(#wi-sun-core)" />
      </g>
    </svg>
  );
}
