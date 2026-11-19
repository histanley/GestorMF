import React from 'react';

/**
 * Ilustrações Vetoriais Premium de Clima e Turno (Dia / Noite)
 * Modeladas estritamente com base nos prints fornecidos:
 * - Print 1: Sol dourado 3D com nuvem branca fofa em primeiro plano
 * - Print 2: Lua crescente dourada/âmbar 3D com crateras e textura lunar realista
 * - Print 3 & Google Weather Boa Vista: Figuras detalhadas, ricas e volumétricas
 */
export default function WeatherIllustration({
  type = 'day-clear',
  size = 42,
  className = '',
  title = '',
}) {
  const s = size;

  // Gradientes, Texturas e Filtros Compartilhados
  const defs = (
    <defs>
      {/* 1. Sol Dourado Volumétrico 3D (Google Weather & Print 1) */}
      <linearGradient id="wi-sun-3d" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="35%" stopColor="#FBBF24" />
        <stop offset="70%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>

      <radialGradient id="wi-sun-core" cx="38%" cy="36%" r="62%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#FBBF24" />
        <stop offset="85%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </radialGradient>

      <radialGradient id="wi-sun-highlight" cx="30%" cy="28%" r="45%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="60%" stopColor="#FEF08A" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
      </radialGradient>

      {/* 2. Lua Crescente Dourada com Textura Lunar (Print 2) */}
      <radialGradient id="wi-moon-amber" cx="35%" cy="32%" r="68%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="30%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="90%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>

      <radialGradient id="wi-moon-crater" cx="40%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#B45309" stopOpacity="0.55" />
        <stop offset="70%" stopColor="#D97706" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
      </radialGradient>

      {/* 3. Nuvem Branca Fofa e Volumétrica (Print 1) */}
      <linearGradient id="wi-cloud-front" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="55%" stopColor="#F8FAFC" />
        <stop offset="85%" stopColor="#E2E8F0" />
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

      <linearGradient id="wi-lightning" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* 6. Filtros de Sombra e Brilho Suave */}
      <filter id="wi-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id="wi-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
      </filter>
    </defs>
  );

  // ============================================================================
  // A. HORÁRIO DIURNO (DIA)
  // ============================================================================

  // 1. DIA: ENSOLARADO / CÉU LIMPO (Sol 3D Scalloped de Google Weather)
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
        {/* Halo de Brilho Quente */}
        <circle cx="24" cy="24" r="18" fill="#FBBF24" opacity="0.12" filter="url(#wi-soft-glow)" />
        {/* Corpo Solar 3D Scalloped (3 retângulos arredondados a 0°, 30° e 60°) */}
        <g filter="url(#wi-drop-shadow)">
          <rect x="9" y="9" width="30" height="30" rx="9" fill="url(#wi-sun-3d)" />
          <rect x="9" y="9" width="30" height="30" rx="9" transform="rotate(30 24 24)" fill="url(#wi-sun-3d)" />
          <rect x="9" y="9" width="30" height="30" rx="9" transform="rotate(60 24 24)" fill="url(#wi-sun-3d)" />
          {/* Núcleo Central Esférico com Gradiente Radial */}
          <circle cx="24" cy="24" r="14.5" fill="url(#wi-sun-core)" />
          {/* Ponto de Brilho Especular Superior */}
          <circle cx="20" cy="19" r="6" fill="url(#wi-sun-highlight)" />
        </g>
      </svg>
    );
  }

  // 2. DIA: PARCIALMENTE NUBLADO (IDÊNTICO AO PRIMEIRO PRINT - Sol Dourado com Nuvem Branca Fofa)
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
        {/* Sol 3D no Canto Superior Esquerdo */}
        <g transform="translate(-2, -3)">
          <rect x="9" y="9" width="23" height="23" rx="7" fill="url(#wi-sun-3d)" />
          <rect x="9" y="9" width="23" height="23" rx="7" transform="rotate(30 20.5 20.5)" fill="url(#wi-sun-3d)" />
          <rect x="9" y="9" width="23" height="23" rx="7" transform="rotate(60 20.5 20.5)" fill="url(#wi-sun-3d)" />
          <circle cx="20.5" cy="20.5" r="11" fill="url(#wi-sun-core)" />
          <circle cx="17.5" cy="17" r="4.5" fill="url(#wi-sun-highlight)" />
        </g>

        {/* Nuvem Branca Fofa Volumétrica em Primeiro Plano (Print 1) */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M20 40H38C41.866 40 45 36.866 45 33C45 29.356 42.215 26.363 38.653 26.035C38.038 20.897 33.714 17 28.5 17C24.084 17 20.323 19.805 18.895 23.785C15.541 24.321 13 27.228 13 30.714C13 35.843 17.157 40 20 40Z"
            fill="url(#wi-cloud-front)"
          />
          {/* Brilho Superior da Nuvem */}
          <ellipse cx="28.5" cy="21.5" rx="5.5" ry="3" fill="#FFFFFF" opacity="0.85" />
          <ellipse cx="20" cy="27" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.75" />
        </g>
      </svg>
    );
  }

  // 3. DIA: NUBLADO (Nuvens 3D em Camadas)
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
        <g opacity="0.75" transform="translate(-4, -4)">
          <path
            d="M19 36H36C39.314 36 42 33.314 42 30C42 26.88 39.613 24.318 36.56 24.03C36.033 19.626 32.327 16.286 27.857 16.286C24.072 16.286 20.849 18.69 19.624 22.099C16.749 22.558 14.571 25.049 14.571 28.036C14.571 32.434 18.137 36 19 36Z"
            fill="url(#wi-cloud-back)"
          />
        </g>
        {/* Nuvem Frontal */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M17 41H37C40.866 41 44 37.866 44 34C44 30.356 41.215 27.363 37.653 27.035C37.038 21.897 32.714 18 27.5 18C23.084 18 19.323 20.805 17.895 24.785C14.541 25.321 12 28.228 12 31.714C12 36.843 16.157 41 17 41Z"
            fill="url(#wi-cloud-front)"
          />
        </g>
      </svg>
    );
  }

  // 4. DIA: CHUVA / PANCADAS DE CHUVA
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
        {/* Nuvem de Chuva */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M16 33H36C39.314 33 42 30.314 42 27C42 23.88 39.613 21.318 36.56 21.03C36.033 16.626 32.327 13.286 27.857 13.286C24.072 13.286 20.849 15.69 19.624 19.099C16.749 19.558 14.571 22.049 14.571 25.036C14.571 29.434 18.137 33 16 33Z"
            fill="url(#wi-cloud-rain)"
          />
        </g>
        {/* Gotas de Chuva em Ângulo com Gradiente Ciano */}
        <line x1="18" y1="36" x2="15" y2="44" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="26" y1="36" x2="23" y2="44" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="34" y1="36" x2="31" y2="44" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 5. DIA: CHUVISCO PASSAGEIRO (Sol com Nuvem e Gotículas)
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
        {/* Sol Diurno no Fundo */}
        <g transform="translate(-3, -4)">
          <rect x="9" y="9" width="22" height="22" rx="7" fill="url(#wi-sun-3d)" />
          <circle cx="20" cy="20" r="10" fill="url(#wi-sun-core)" />
        </g>
        {/* Nuvem */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M17 34H36C39.314 34 42 31.314 42 28C42 24.88 39.613 22.318 36.56 22.03C36.033 17.626 32.327 14.286 27.857 14.286C24.072 14.286 20.849 16.69 19.624 20.099C16.749 20.558 14.571 23.049 14.571 26.036C14.571 30.434 18.137 34 17 34Z"
            fill="url(#wi-cloud-front)"
          />
        </g>
        {/* Chuviscos Leves */}
        <line x1="21" y1="37" x2="19" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="29" y1="37" x2="27" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="37" x2="34" y2="43" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 6. DIA: TEMPESTADE / TROVOADA (Raio Dourado)
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
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M15 30H37C40.314 30 43 27.314 43 24C43 20.88 40.613 18.318 37.56 18.03C37.033 13.626 33.327 10.286 28.857 10.286C25.072 10.286 21.849 12.69 20.624 16.099C17.749 16.558 12.571 18.049 12.571 22.036C12.571 26.434 16.137 30 15 30Z"
            fill="#334155"
          />
        </g>
        {/* Raio Elétrico Dourado */}
        <path
          d="M25 21L20 31H27L23 44L34 29H26L29 21H25Z"
          fill="url(#wi-lightning)"
          stroke="#FEF08A"
          strokeWidth="0.8"
          filter="url(#wi-soft-glow)"
        />
        <line x1="14" y1="35" x2="11" y2="42" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="38" y1="35" x2="35" y2="42" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 7. DIA: NEVE / NEVANDO
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
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M16 33H36C39.314 33 42 30.314 42 27C42 23.88 39.613 21.318 36.56 21.03C36.033 16.626 32.327 13.286 27.857 13.286C24.072 13.286 20.849 15.69 19.624 19.099C16.749 19.558 14.571 22.049 14.571 25.036C14.571 29.434 18.137 33 16 33Z"
            fill="url(#wi-cloud-front)"
          />
        </g>
        {/* Cristais de Neve */}
        <g stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round">
          <line x1="17" y1="37" x2="17" y2="43" /><line x1="14" y1="40" x2="20" y2="40" />
          <line x1="26" y1="36" x2="26" y2="42" /><line x1="23" y1="39" x2="29" y2="39" />
          <line x1="35" y1="37" x2="35" y2="43" /><line x1="32" y1="40" x2="38" y2="40" />
        </g>
      </svg>
    );
  }

  // 8. DIA: NEVOEIRO / NÉVOA
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
        <line x1="9" y1="18" x2="39" y2="18" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <line x1="6" y1="25" x2="42" y2="25" stroke="#CBD5E1" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
        <line x1="11" y1="32" x2="37" y2="32" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
        <line x1="15" y1="39" x2="33" y2="39" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </svg>
    );
  }

  // ============================================================================
  // B. HORÁRIO NOTURNO (NOITE)
  // ============================================================================

  // 9. NOITE: CÉU LIMPO / ESTRELADO (IDÊNTICO AO SEGUNDO PRINT - Lua Crescente Âmbar 3D com Crateras)
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
        <circle cx="28" cy="24" r="17" fill="#F59E0B" opacity="0.1" filter="url(#wi-soft-glow)" />

        {/* Lua Crescente Dourada 3D com Curvatura Idêntica ao Print 2 */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M34 6C24.5 8 16.5 16.5 16.5 27C16.5 38 25 46.5 36 46.5C39.5 46.5 42.8 45.4 45.5 43.5C32.8 41.5 24 29.5 26.2 15.5C27 11.5 29 8.2 34 6Z"
            fill="url(#wi-moon-amber)"
          />
          {/* Crateras Realistas Texturizadas (Print 2) */}
          <circle cx="23.5" cy="27" r="2.2" fill="url(#wi-moon-crater)" />
          <circle cx="29" cy="36" r="1.8" fill="url(#wi-moon-crater)" />
          <circle cx="24" cy="18" r="1.5" fill="url(#wi-moon-crater)" />
          <circle cx="34" cy="41" r="1.4" fill="url(#wi-moon-crater)" />
          <circle cx="27" cy="12" r="1.2" fill="url(#wi-moon-crater)" />

          {/* Destaque de Brilho Suave na Borda Curva da Lua */}
          <path
            d="M17.5 27C17.5 18 24 10.5 32 7.5C25 10 18.5 17.5 18.5 27C18.5 36.5 25 44 34 45.5C26 44 17.5 36.5 17.5 27Z"
            fill="#FEF08A"
            opacity="0.45"
          />
        </g>

        {/* Estrelas Cintilantes Sutis */}
        <path d="M10 11L11 13.5L13.5 14.5L11 15.5L10 18L9 15.5L6.5 14.5L9 13.5Z" fill="#FDE047" opacity="0.9" />
        <path d="M8 29L8.7 31L10.7 31.7L8.7 32.3L8 34.3L7.3 32.3L5.3 31.7L7.3 31Z" fill="#93C5FD" opacity="0.85" />
        <circle cx="15" cy="40" r="1.2" fill="#E0E7FF" opacity="0.8" />
        <circle cx="43" cy="14" r="1.2" fill="#FEF08A" opacity="0.9" />
      </svg>
    );
  }

  // 10. NOITE: PARCIALMENTE NUBLADA (Lua Dourada do Print 2 com Nuvem Noturna Suave)
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
        <g transform="translate(-2, -3)">
          <path
            d="M30 6C22.5 8 16 15 16 23.5C16 32.5 23 39.5 32 39.5C34.8 39.5 37.5 38.6 39.8 37C29.2 35.5 22 25.5 23.8 14C24.4 10.5 26 7.8 30 6Z"
            fill="url(#wi-moon-amber)"
          />
          {/* Crateras */}
          <circle cx="22" cy="24" r="1.8" fill="url(#wi-moon-crater)" />
          <circle cx="27" cy="32" r="1.4" fill="url(#wi-moon-crater)" />
          <circle cx="23" cy="16" r="1.2" fill="url(#wi-moon-crater)" />
        </g>

        {/* Nuvem Noturna Translúcida em Primeiro Plano */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M17 41H36C39.314 41 42 38.314 42 35C42 31.88 39.613 29.318 36.56 29.03C36.033 24.626 32.327 21.286 27.857 21.286C24.072 21.286 20.849 23.69 19.624 27.099C16.749 27.558 14.571 30.049 14.571 33.036C14.571 37.434 18.137 41 17 41Z"
            fill="url(#wi-cloud-night)"
            stroke="#64748B"
            strokeWidth="1"
          />
        </g>
      </svg>
    );
  }

  // 11. NOITE: NUBLADA
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
        <g transform="translate(-4, -2)" opacity="0.85">
          <path
            d="M28 6C21 7.5 16 13.5 16 20.5C16 27.5 21.5 33 28.5 33C30.8 33 33 32.3 34.8 31C26.5 29.8 20.5 22 22 13C22.5 10 24 7.8 28 6Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        {/* Camadas Noturnas de Nuvem */}
        <path
          d="M14 34H33C35.8 34 38 31.8 38 29C38 26.5 36.2 24.4 33.7 24.1C33.3 19.8 29.6 16.5 25.2 16.5C21.4 16.5 18.2 18.8 17.2 22.2C14.7 22.7 13 24.8 13 27.3C13 31 14 34 14 34Z"
          fill="#334155"
          opacity="0.8"
        />
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M18 42H38C41.314 42 44 39.314 44 36C44 32.88 41.613 30.318 38.56 30.03C38.033 25.626 34.327 22.286 29.857 22.286C26.072 22.286 22.849 24.69 21.624 28.099C18.749 28.558 16.571 31.049 16.571 34.036C16.571 38.434 20.137 42 18 42Z"
            fill="url(#wi-cloud-night)"
            stroke="#475569"
            strokeWidth="1"
          />
        </g>
      </svg>
    );
  }

  // 12. NOITE: CHUVA NOTURNA
  if (type === 'night-rain' || type === 'night-drizzle') {
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
        {/* Lua espreitando na chuva */}
        <g transform="translate(-2, -3)">
          <path
            d="M28 6C22 7.5 17.5 12.8 17.5 19C17.5 22.5 19 25.8 21.5 28C22 23 25 17 30 12C31.2 10.8 32.5 9.8 34 9C31.8 7 29.8 6.2 28 6Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        {/* Nuvem de Chuva */}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M16 34H36C39.314 34 42 31.314 42 28C42 24.88 39.613 22.318 36.56 22.03C36.033 17.626 32.327 14.286 27.857 14.286C24.072 14.286 20.849 16.69 19.624 20.099C16.749 20.558 14.571 23.049 14.571 26.036C14.571 30.434 18.137 34 16 34Z"
            fill="url(#wi-cloud-rain)"
          />
        </g>
        {/* Gotas de Chuva */}
        <line x1="18" y1="37" x2="15" y2="44" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="26" y1="37" x2="23" y2="44" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="34" y1="37" x2="31" y2="44" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  // 13. NOITE: TEMPESTADE NOTURNA
  if (type === 'night-storm') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-night-storm ${className}`}
        aria-label={title || 'Trovoada Noturna'}
      >
        {defs}
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M15 30H37C40.314 30 43 27.314 43 24C43 20.88 40.613 18.318 37.56 18.03C37.033 13.626 33.327 10.286 28.857 10.286C25.072 10.286 21.849 12.69 20.624 16.099C17.749 16.558 12.571 18.049 12.571 22.036C12.571 26.434 16.137 30 15 30Z"
            fill="#1E293B"
            stroke="#7C3AED"
            strokeWidth="1.2"
          />
        </g>
        <path
          d="M25 21L20 31H27L23 44L34 29H26L29 21H25Z"
          fill="url(#wi-lightning)"
          stroke="#FEF08A"
          strokeWidth="0.8"
          filter="url(#wi-soft-glow)"
        />
        <line x1="14" y1="34" x2="11" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="34" x2="34" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 14. NOITE: NEVE NOTURNA
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
        <g transform="translate(-2, -3)">
          <path
            d="M28 6C22 7.5 17.5 12.8 17.5 19C17.5 22.5 19 25.8 21.5 28C22 23 25 17 30 12C31.2 10.8 32.5 9.8 34 9C31.8 7 29.8 6.2 28 6Z"
            fill="url(#wi-moon-amber)"
          />
        </g>
        <g filter="url(#wi-drop-shadow)">
          <path
            d="M16 34H36C39.314 34 42 31.314 42 28C42 24.88 39.613 22.318 36.56 22.03C36.033 17.626 32.327 14.286 27.857 14.286C24.072 14.286 20.849 16.69 19.624 20.099C16.749 20.558 14.571 23.049 14.571 26.036C14.571 30.434 18.137 34 16 34Z"
            fill="url(#wi-cloud-night)"
          />
        </g>
        <g stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round">
          <line x1="16" y1="37" x2="16" y2="43" /><line x1="13" y1="40" x2="19" y2="40" />
          <line x1="26" y1="36" x2="26" y2="42" /><line x1="23" y1="39" x2="29" y2="39" />
          <line x1="35" y1="37" x2="35" y2="43" /><line x1="32" y1="40" x2="38" y2="40" />
        </g>
      </svg>
    );
  }

  // 15. NOITE: NÉVOA NOTURNA (PADRÃO FALLBACK)
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`weather-art-svg wi-night-fog ${className}`}
      aria-label={title || 'Névoa Noturna'}
    >
      {defs}
      <g transform="translate(-2, -3)" opacity="0.65">
        <path
          d="M28 6C22 7.5 17.5 12.8 17.5 19C17.5 22.5 19 25.8 21.5 28C22 23 25 17 30 12C31.2 10.8 32.5 9.8 34 9C31.8 7 29.8 6.2 28 6Z"
          fill="url(#wi-moon-amber)"
        />
      </g>
      <line x1="8" y1="20" x2="40" y2="20" stroke="#64748B" strokeWidth="2.8" strokeLinecap="round" opacity="0.8" />
      <line x1="5" y1="27" x2="43" y2="27" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <line x1="10" y1="34" x2="38" y2="34" stroke="#64748B" strokeWidth="2.8" strokeLinecap="round" opacity="0.75" />
      <line x1="14" y1="41" x2="34" y2="41" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
