import React from 'react';

/**
 * CelestialShiftIllustration
 * 
 * Ilustrações Vetoriais Artísticas de Alta Fidelidade (Premium 3D & Radiant Sunburst)
 * Turno Celeste na Barra de Boas-Vindas:
 * - sunrise: Nascer do Sol matinal com horizonte dourado e raios ascendentes
 * - day-bright: Sol Pleno Majestoso com 16 raios solares diamantados radiantes e esfera 3D volumétrica (sem aspecto de timão de navio)
 * - sunset: Pôr do Sol / Golden Hour com gradiente crepuscular
 * - night: Lua Crescente 3D dourada/perolada com relevo e estrelas cintilantes
 * 
 * Totalmente independente do widget de clima meteorológico.
 */
export default function CelestialShiftIllustration({
  phase = 'day-bright',
  size = 42,
  className = '',
  title = '',
}) {
  const s = size;

  // Definições de gradientes, auras e filtros luminosos 3D suaves
  const defs = (
    <defs>
      {/* 1. Halo Suave e Difuso do Sol (Sem bordas duras ou anéis escuros) */}
      <radialGradient id="csi-sun-aura" cx="50%" cy="50%" r="50%">
        <stop offset="30%" stopColor="#FEF08A" stopOpacity="0.45" />
        <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
      </radialGradient>

      {/* 2. Núcleo Esférico Volumétrico 3D do Sol */}
      <radialGradient id="csi-sun-body-3d" cx="30%" cy="28%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="14%" stopColor="#FFFBEB" />
        <stop offset="38%" stopColor="#FDE047" />
        <stop offset="68%" stopColor="#F59E0B" />
        <stop offset="90%" stopColor="#EA580C" />
        <stop offset="100%" stopColor="#D97706" />
      </radialGradient>

      {/* 3. Raios Solares Principais (Feixes Diamantados Radiantes) */}
      <linearGradient id="csi-ray-prim-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="35%" stopColor="#FEF08A" />
        <stop offset="75%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* 4. Raios Solares Secundários (Flares Intermediários) */}
      <linearGradient id="csi-ray-sec-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.9" />
        <stop offset="65%" stopColor="#FDE047" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.35" />
      </linearGradient>

      {/* 5. Nascer do Sol (Sunrise - Alvorada Dourada 3D Radiante) */}
      <radialGradient id="csi-sunrise-aura" cx="50%" cy="58%" r="52%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.65" />
        <stop offset="35%" stopColor="#FDE047" stopOpacity="0.4" />
        <stop offset="68%" stopColor="#FB923C" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="csi-sunrise-sphere" cx="35%" cy="30%" r="68%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="15%" stopColor="#FFFBEB" />
        <stop offset="35%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#FB923C" />
        <stop offset="88%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#EA580C" />
      </radialGradient>

      <linearGradient id="csi-sunrise-ray-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="35%" stopColor="#FEF08A" />
        <stop offset="75%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
      </linearGradient>

      <linearGradient id="csi-sunrise-ray-sec" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#FDE047" stopOpacity="0.65" />
        <stop offset="100%" stopColor="#FB923C" stopOpacity="0.2" />
      </linearGradient>

      <linearGradient id="csi-sunrise-horizon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
        <stop offset="25%" stopColor="#FB923C" stopOpacity="0.85" />
        <stop offset="50%" stopColor="#FFFDE7" stopOpacity="1" />
        <stop offset="75%" stopColor="#FB923C" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#F97316" stopOpacity="0.2" />
      </linearGradient>

      {/* 6. Pôr do Sol (Sunset / Golden Hour - Crepúsculo 3D) */}
      <radialGradient id="csi-sunset-aura" cx="50%" cy="58%" r="52%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.6" />
        <stop offset="40%" stopColor="#FB923C" stopOpacity="0.35" />
        <stop offset="75%" stopColor="#BE123C" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#881337" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="csi-sunset-sphere" cx="35%" cy="30%" r="68%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="20%" stopColor="#FEF08A" />
        <stop offset="45%" stopColor="#FB923C" />
        <stop offset="75%" stopColor="#EA580C" />
        <stop offset="92%" stopColor="#BE123C" />
        <stop offset="100%" stopColor="#881337" />
      </radialGradient>

      <linearGradient id="csi-sunset-ray-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="35%" stopColor="#FDE047" />
        <stop offset="70%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#EA580C" stopOpacity="0.35" />
      </linearGradient>

      <linearGradient id="csi-sunset-ray-sec" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.9" />
        <stop offset="55%" stopColor="#FB923C" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#BE123C" stopOpacity="0.2" />
      </linearGradient>

      <linearGradient id="csi-sunset-horizon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#C026D3" stopOpacity="0.25" />
        <stop offset="28%" stopColor="#EA580C" stopOpacity="0.85" />
        <stop offset="50%" stopColor="#FEF08A" stopOpacity="1" />
        <stop offset="72%" stopColor="#EA580C" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#9333EA" stopOpacity="0.25" />
      </linearGradient>

      {/* 7. Lua Noturna 3D */}
      <radialGradient id="csi-moon-aura" cx="50%" cy="50%" r="50%">
        <stop offset="30%" stopColor="#FDE047" stopOpacity="0.3" />
        <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#0B1120" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="csi-moon-body" cx="30%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="25%" stopColor="#FEF08A" />
        <stop offset="55%" stopColor="#FBBF24" />
        <stop offset="82%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#92400E" />
      </radialGradient>

      <radialGradient id="csi-moon-crater-soft" cx="35%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#92400E" stopOpacity="0.5" />
        <stop offset="70%" stopColor="#B45309" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#D97706" stopOpacity="0.05" />
      </radialGradient>

      {/* Sombra Quente sem Anéis Escuros */}
      <filter id="csi-warm-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" floodColor="#B45309" floodOpacity="0.45" />
      </filter>
    </defs>
  );

  // 1. NASCER DO SOL (Sunrise - Alvorada Radiante 3D)
  if (phase === 'sunrise') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`celestial-art-svg csi-sunrise ${className}`}
        aria-label={title || 'Nascer do Sol'}
      >
        {defs}
        {/* Halo Suave e Difuso de Alvorada Dourada */}
        <circle cx="24" cy="27" r="23.5" fill="url(#csi-sunrise-aura)" />

        {/* Leque Majestoso de Raios Diamantados Radiantes Ascendentes */}
        <g filter="url(#csi-warm-shadow)">
          {/* Raios Primários Diamantados em Arco Ascendente (Alvorada) */}
          {[-68, -45, -22.5, 0, 22.5, 45, 68].map((angle) => (
            <path
              key={`sr-prim-${angle}`}
              d="M 24 3.5 L 25.8 15 C 24.6 15.6 23.4 15.6 22.2 15 Z"
              fill="url(#csi-sunrise-ray-grad)"
              transform={`rotate(${angle} 24 28)`}
            />
          ))}

          {/* Raios Secundários Delicados (Micro-Flares de Alvorada) */}
          {[-56.5, -33.75, -11.25, 11.25, 33.75, 56.5].map((angle) => (
            <path
              key={`sr-sec-${angle}`}
              d="M 24 8.5 L 25 15.2 C 24.4 15.6 23.6 15.6 23 15.2 Z"
              fill="url(#csi-sunrise-ray-sec)"
              transform={`rotate(${angle} 24 28)`}
            />
          ))}
        </g>

        {/* Cúpula do Sol Nascente 3D Volumétrica */}
        <g filter="url(#csi-warm-shadow)">
          {/* Anel de Transição Suave */}
          <path
            d="M 11 28.5 A 13 13 0 0 1 37 28.5 Z"
            fill="#FB923C"
            opacity="0.35"
          />

          {/* Corpo do Disco Solar com Gradiente 3D Luminoso */}
          <path
            d="M 11.5 28.5 A 12.5 12.5 0 0 1 36.5 28.5 Z"
            fill="url(#csi-sunrise-sphere)"
          />

          {/* Arco Especular de Brilho Vítreo Matinal */}
          <path
            d="M 16.5 22.5 C 18 18.5 22.5 17 28 18"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* Ponto Focal de Brilho Solar */}
          <circle cx="18.5" cy="20" r="1.5" fill="#FFFFFF" opacity="0.95" />
        </g>

        {/* Linhas de Horizonte e Ondas de Reflexo Dourado da Alvorada */}
        <g filter="url(#csi-warm-shadow)">
          {/* Linha Principal do Horizonte com Brilho Central */}
          <rect
            x="3.5"
            y="28"
            width="41"
            height="3"
            rx="1.5"
            fill="url(#csi-sunrise-horizon-grad)"
          />

          {/* Reflexo Secundário Elegante */}
          <rect
            x="10.5"
            y="34"
            width="27"
            height="2.2"
            rx="1.1"
            fill="url(#csi-sunrise-horizon-grad)"
            opacity="0.8"
          />

          {/* Reflexo Terciário Suave */}
          <rect
            x="17"
            y="39.2"
            width="14"
            height="1.6"
            rx="0.8"
            fill="url(#csi-sunrise-horizon-grad)"
            opacity="0.55"
          />
        </g>

        {/* Estrelas/Partículas Matinais Cintilantes de 4 Pontas */}
        <g opacity="0.95">
          <path
            d="M 7 11 C 7 12.2 6 13 4.5 13 C 6 13 7 13.8 7 15 C 7 13.8 8 13 9.5 13 C 8 13 7 12.2 7 11 Z"
            fill="#FEF08A"
          />
          <path
            d="M 40 12 C 40 13.2 39 14 37.5 14 C 39 14 40 14.8 40 16 C 40 14.8 41 14 42.5 14 C 41 14 40 13.2 40 12 Z"
            fill="#FEF08A"
          />
        </g>
      </svg>
    );
  }

  // 2. PÔR DO SOL (Sunset - Golden Hour / Fim de Tarde Radiante)
  if (phase === 'sunset') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`celestial-art-svg csi-sunset ${className}`}
        aria-label={title || 'Pôr do Sol'}
      >
        {defs}
        {/* Halo Quente Crepuscular */}
        <circle cx="24" cy="27" r="23.5" fill="url(#csi-sunset-aura)" />

        {/* Leque de Raios Diamantados do Pôr do Sol */}
        <g filter="url(#csi-warm-shadow)">
          {/* Raios Primários Diamantados Crepusculares */}
          {[-68, -45, -22.5, 0, 22.5, 45, 68].map((angle) => (
            <path
              key={`ss-prim-${angle}`}
              d="M 24 3.5 L 25.8 15 C 24.6 15.6 23.4 15.6 22.2 15 Z"
              fill="url(#csi-sunset-ray-grad)"
              transform={`rotate(${angle} 24 28)`}
            />
          ))}

          {/* Raios Secundários Delicados */}
          {[-56.5, -33.75, -11.25, 11.25, 33.75, 56.5].map((angle) => (
            <path
              key={`ss-sec-${angle}`}
              d="M 24 8.5 L 25 15.2 C 24.4 15.6 23.6 15.6 23 15.2 Z"
              fill="url(#csi-sunset-ray-sec)"
              transform={`rotate(${angle} 24 28)`}
            />
          ))}
        </g>

        {/* Disco Solar Avermelhado Descendente 3D */}
        <g filter="url(#csi-warm-shadow)">
          {/* Transição Crepuscular */}
          <path
            d="M 11 28.5 A 13 13 0 0 1 37 28.5 Z"
            fill="#EA580C"
            opacity="0.35"
          />

          {/* Corpo do Disco Solar */}
          <path
            d="M 11.5 28.5 A 12.5 12.5 0 0 1 36.5 28.5 Z"
            fill="url(#csi-sunset-sphere)"
          />

          {/* Brilho Especular Suave */}
          <path
            d="M 16.5 22.5 C 18 18.5 22.5 17 28 18"
            stroke="#FEF08A"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Ponto de Brilho */}
          <circle cx="18.5" cy="20" r="1.4" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Horizonte do Crepúsculo com Tons Púrpura e Dourado */}
        <g filter="url(#csi-warm-shadow)">
          <rect
            x="3.5"
            y="28"
            width="41"
            height="3"
            rx="1.5"
            fill="url(#csi-sunset-horizon-grad)"
          />
          <rect
            x="10.5"
            y="34"
            width="27"
            height="2.2"
            rx="1.1"
            fill="url(#csi-sunset-horizon-grad)"
            opacity="0.8"
          />
          <rect
            x="17"
            y="39.2"
            width="14"
            height="1.6"
            rx="0.8"
            fill="url(#csi-sunset-horizon-grad)"
            opacity="0.55"
          />
        </g>
      </svg>
    );
  }

  // 3. LUA NOTURNA (Night - Noite / Madrugada)
  if (phase === 'night') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`celestial-art-svg csi-night ${className}`}
        aria-label={title || 'Noite Estrelada'}
      >
        {defs}
        {/* Halo Noturno Suave */}
        <circle cx="25" cy="24" r="22" fill="url(#csi-moon-aura)" />

        {/* Lua Crescente Dourada com Curvatura Elegante */}
        <g filter="url(#csi-warm-shadow)">
          <path
            d="M 32 5.5 C 22.5 7.5 15.5 15.5 15.5 25.5 C 15.5 35.8 23.5 44 33.5 44 C 36.8 44 40 43 42.5 41 C 29.5 39 21.5 28 24 15 C 25 11 27.5 7.8 32 5.5 Z"
            fill="url(#csi-moon-body)"
          />

          {/* Crateras com Sombra Suave e Relevo */}
          <circle cx="23.5" cy="26.5" r="2.8" fill="url(#csi-moon-crater-soft)" />
          <circle cx="27.5" cy="35" r="2" fill="url(#csi-moon-crater-soft)" />
          <circle cx="26.5" cy="18" r="1.6" fill="url(#csi-moon-crater-soft)" />
          <circle cx="21.5" cy="21" r="1.1" fill="url(#csi-moon-crater-soft)" opacity="0.7" />

          {/* Destaque Especular Curvo na Borda Externa */}
          <path
            d="M 17 21 C 17 14 21.5 8.5 27 6.5"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.95"
          />
        </g>

        {/* Estrelas Cintilantes de 4 Pontas */}
        <g filter="url(#csi-warm-shadow)">
          {/* Estrela Principal */}
          <path
            d="M 9 10 C 9 12.5 7.2 14 4.5 14 C 7.2 14 9 15.5 9 18 C 9 15.5 10.8 14 13.5 14 C 10.8 14 9 12.5 9 10 Z"
            fill="#FEF08A"
          />
          <circle cx="9" cy="14" r="1" fill="#FFFFFF" />

          {/* Estrela Secundária */}
          <path
            d="M 13.5 31 C 13.5 32.8 12 34 10 34 C 12 34 13.5 35.2 13.5 37 C 13.5 35.2 15 34 17 34 C 15 34 13.5 32.8 13.5 31 Z"
            fill="#FDE047"
            opacity="0.9"
          />

          {/* Pontos de Luz */}
          <circle cx="6" cy="24" r="1" fill="#67E8F9" opacity="0.95" />
          <circle cx="37" cy="12" r="1" fill="#FFFFFF" opacity="0.9" />
        </g>
      </svg>
    );
  }

  // 4. SOL FORTE PLENO (Day Bright - Pleno Dia / Tarde)
  // Design Radiant Sunburst Majestoso: 8 Raios Diamantados Principais + 8 Flares Intermediários + Esfera 3D Volumétrica
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`celestial-art-svg csi-day-bright ${className}`}
      aria-label={title || 'Sol Radiante'}
    >
      {defs}
      {/* Halo de Brilho Suave Radiante (Gradiente 100% contínuo sem corte duro) */}
      <circle cx="24" cy="24" r="23.5" fill="url(#csi-sun-aura)" />

      {/* 8 Raios Solares Principais (Feixes Diamantados em 360°) */}
      <g filter="url(#csi-warm-shadow)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <path
            key={`prim-${angle}`}
            d="M 24 1.5 L 26.2 12.8 C 24.8 13.5 23.2 13.5 21.8 12.8 Z"
            fill="url(#csi-ray-prim-grad)"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}

        {/* 8 Raios Solares Secundários Delicados (Micro-Flares Alternados) */}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle) => (
          <path
            key={`sec-${angle}`}
            d="M 24 6.2 L 25.2 13 C 24.4 13.4 23.6 13.4 22.8 13 Z"
            fill="url(#csi-ray-sec-grad)"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
      </g>

      {/* Esfera Central 3D do Sol — Perfeitamente Redonda, Volumétrica e Vidrada */}
      <g filter="url(#csi-warm-shadow)">
        {/* Anel de Transição Suave */}
        <circle cx="24" cy="24" r="12" fill="#F59E0B" opacity="0.3" />

        {/* Corpo Esférico Principal */}
        <circle cx="24" cy="24" r="11.4" fill="url(#csi-sun-body-3d)" />

        {/* Brilho Especular Superior Curvo (Volume 3D Vidrado) */}
        <path
          d="M 16.5 19.5 C 17.5 15.5 21 14 25 14.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* Ponto Focal de Brilho */}
        <circle cx="18" cy="18" r="1.6" fill="#FFFFFF" opacity="0.95" />
      </g>
    </svg>
  );
}
