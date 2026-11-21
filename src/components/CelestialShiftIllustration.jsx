import React from 'react';

/**
 * CelestialShiftIllustration
 * 
 * Ilustrações Vetoriais Exclusivas e Evidentes para o Turno do Dia na Barra de Boas-Vindas:
 * - sunrise: Nascer do Sol com raios dourados e horizonte da manhã
 * - day-bright: Sol Forte pleno com coroa radiante e brilho volumétrico 3D
 * - sunset: Pôr do Sol no horizonte com cores quentes de entardecer e golden hour
 * - night: Lua Crescente 3D noturna com estrelas celestiais cintilantes
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

  // Definições de gradientes e filtros luminosos
  const defs = (
    <defs>
      {/* 1. Sol Forte Pleno 3D */}
      <radialGradient id="csi-sun-core" cx="35%" cy="32%" r="65%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="30%" stopColor="#FDE047" />
        <stop offset="70%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </radialGradient>

      <linearGradient id="csi-sun-ray" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* 2. Nascer do Sol (Sunrise) */}
      <linearGradient id="csi-sunrise-sun" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#EA580C" />
        <stop offset="45%" stopColor="#F59E0B" />
        <stop offset="85%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#FEF9C3" />
      </linearGradient>

      <linearGradient id="csi-sunrise-ray" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
        <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.95" />
      </linearGradient>

      <linearGradient id="csi-sunrise-horizon" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FB923C" />
        <stop offset="50%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#FB923C" />
      </linearGradient>

      {/* 3. Pôr do Sol (Sunset / Golden Hour) */}
      <linearGradient id="csi-sunset-sun" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#F97316" />
        <stop offset="80%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>

      <linearGradient id="csi-sunset-horizon" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="35%" stopColor="#F97316" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#C026D3" />
      </linearGradient>

      <linearGradient id="csi-sunset-ray" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#F97316" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#DC2626" stopOpacity="0.2" />
      </linearGradient>

      {/* 4. Lua Noturna 3D */}
      <radialGradient id="csi-moon-amber" cx="35%" cy="32%" r="68%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="30%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="90%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>

      <radialGradient id="csi-moon-crater" cx="40%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#B45309" stopOpacity="0.55" />
        <stop offset="70%" stopColor="#D97706" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
      </radialGradient>

      {/* Brilho Quente e Sombra 3D */}
      <filter id="csi-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id="csi-drop-shadow" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.35" />
      </filter>
    </defs>
  );

  // 1. NASCER DO SOL (Sunrise - Alvorada / Início da Manhã)
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
        {/* Brilho de Alvorada */}
        <circle cx="24" cy="27" r="18" fill="#F59E0B" opacity="0.22" filter="url(#csi-soft-glow)" />

        {/* Raios Ascendentes de Sol Matinal */}
        <g opacity="0.95" filter="url(#csi-drop-shadow)">
          <path d="M 24 5 L 26 15 L 22 15 Z" fill="url(#csi-sunrise-ray)" />
          <path d="M 11 11 L 18 19 L 15 21 Z" fill="url(#csi-sunrise-ray)" />
          <path d="M 37 11 L 33 21 L 30 19 Z" fill="url(#csi-sunrise-ray)" />
          <path d="M 3 24 L 14 26 L 14 23 Z" fill="url(#csi-sunrise-ray)" />
          <path d="M 45 24 L 34 23 L 34 26 Z" fill="url(#csi-sunrise-ray)" />
        </g>

        {/* Sol Nascendo (Semi-Círculo Ascendente Superior) */}
        <g filter="url(#csi-drop-shadow)">
          <path
            d="M 12 32 A 12 12 0 0 1 36 32 Z"
            fill="url(#csi-sunrise-sun)"
          />
          {/* Brilho Curvado de Alvorada */}
          <path
            d="M 16 26 A 9 9 0 0 1 32 26"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>

        {/* Linha do Horizonte Dourada com Reflexo da Manhã */}
        <rect x="5" y="32" width="38" height="3" rx="1.5" fill="url(#csi-sunrise-horizon)" filter="url(#csi-drop-shadow)" />
        <rect x="11" y="38" width="26" height="2" rx="1" fill="url(#csi-sunrise-horizon)" opacity="0.75" />
        <rect x="18" y="42" width="12" height="1.5" rx="0.75" fill="url(#csi-sunrise-horizon)" opacity="0.5" />
      </svg>
    );
  }

  // 2. PÔR DO SOL (Sunset - Golden Hour / Fim de Tarde)
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
        {/* Aura Quente de Crepúsculo */}
        <circle cx="24" cy="27" r="19" fill="#EA580C" opacity="0.25" filter="url(#csi-soft-glow)" />

        {/* Raios Descendentes do Entardecer */}
        <g opacity="0.9" filter="url(#csi-drop-shadow)">
          <path d="M 24 7 L 26.5 16 L 21.5 16 Z" fill="url(#csi-sunset-ray)" />
          <path d="M 12 12 L 19 19.5 L 16 21.5 Z" fill="url(#csi-sunset-ray)" />
          <path d="M 36 12 L 32 21.5 L 29 19.5 Z" fill="url(#csi-sunset-ray)" />
          <path d="M 4 23 L 14 25.5 L 14 23 Z" fill="url(#csi-sunset-ray)" />
          <path d="M 44 23 L 34 23 L 34 25.5 Z" fill="url(#csi-sunset-ray)" />
        </g>

        {/* Disco Solar Descendente Avermelhado/Dourado */}
        <g filter="url(#csi-drop-shadow)">
          <path
            d="M 12 31 A 12 12 0 0 1 36 31 Z"
            fill="url(#csi-sunset-sun)"
          />
          {/* Brilho Suave de Despedida do Dia */}
          <path
            d="M 16 25 A 9 9 0 0 1 32 25"
            stroke="#FEF08A"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Linha do Horizonte do Crepúsculo (Degradê Laranja/Magenta) */}
        <rect x="4" y="31" width="40" height="3" rx="1.5" fill="url(#csi-sunset-horizon)" filter="url(#csi-drop-shadow)" />
        <rect x="9" y="37" width="30" height="2" rx="1" fill="url(#csi-sunset-horizon)" opacity="0.8" />
        <rect x="16" y="42" width="16" height="1.5" rx="0.75" fill="url(#csi-sunset-horizon)" opacity="0.55" />
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
        {/* Aura Noturna Suave */}
        <circle cx="26" cy="24" r="18" fill="#F59E0B" opacity="0.18" filter="url(#csi-soft-glow)" />

        {/* Lua Crescente Dourada 3D com Curvatura Imponente */}
        <g filter="url(#csi-drop-shadow)">
          <path
            d="M 33 6 C 23.5 8 16 16.5 16 27 C 16 38 24.5 46.5 35 46.5 C 38.5 46.5 41.8 45.4 44.5 43.5 C 31.8 41.5 23.5 29.5 25.5 15.5 C 26.2 11.5 28.5 8.2 33 6 Z"
            fill="url(#csi-moon-amber)"
          />
          {/* Crateras com Relevo e Sombra 3D */}
          <circle cx="24.5" cy="28.5" r="3.2" fill="url(#csi-moon-crater)" />
          <circle cx="28.5" cy="37.5" r="2.2" fill="url(#csi-moon-crater)" />
          <circle cx="28.5" cy="18.5" r="1.8" fill="url(#csi-moon-crater)" />
          <circle cx="23" cy="22" r="1.3" fill="url(#csi-moon-crater)" opacity="0.7" />

          {/* Destaque Especular Curvo na Borda Externa */}
          <path
            d="M 18 21 C 18 13.5 23 8.5 28.5 6.5"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Estrelas Brilhantes de 4 Pontas (Twinkling Stars) */}
        <g filter="url(#csi-drop-shadow)">
          {/* Estrela Principal Superior Esquerda */}
          <path
            d="M 9 12 C 9 14.5 7 16 4.5 16 C 7 16 9 17.5 9 20 C 9 17.5 11 16 13.5 16 C 11 16 9 14.5 9 12 Z"
            fill="#FEF08A"
          />
          <circle cx="9" cy="16" r="1" fill="#FFFFFF" />

          {/* Estrela Pequena */}
          <path
            d="M 14 34 C 14 35.8 12.5 37 10.5 37 C 12.5 37 14 38.2 14 40 C 14 38.2 15.5 37 17.5 37 C 15.5 37 14 35.8 14 34 Z"
            fill="#FDE047"
            opacity="0.9"
          />

          {/* Ponto de Luz Cintilante */}
          <circle cx="7" cy="28" r="1.2" fill="#67E8F9" opacity="0.9" />
          <circle cx="39" cy="14" r="1" fill="#FFFFFF" opacity="0.85" />
        </g>
      </svg>
    );
  }

  // 4. SOL FORTE PLENO (Day Bright - Pleno Dia / Manhã Avançada e Tarde)
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`celestial-art-svg csi-day-bright ${className}`}
      aria-label={title || 'Sol Forte'}
    >
      {defs}
      {/* Halo de Brilho Quente e Radiante */}
      <circle cx="24" cy="24" r="21" fill="#F59E0B" opacity="0.22" filter="url(#csi-soft-glow)" />

      {/* Raios Solares Radiantes em Rotação Dourada (8 Raios Volumétricos) */}
      <g filter="url(#csi-drop-shadow)">
        {/* Raio Superior e Inferior */}
        <line x1="24" y1="3" x2="24" y2="9" stroke="url(#csi-sun-ray)" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="24" y1="39" x2="24" y2="45" stroke="url(#csi-sun-ray)" strokeWidth="3.2" strokeLinecap="round" />
        {/* Raio Esquerdo e Direito */}
        <line x1="3" y1="24" x2="9" y2="24" stroke="url(#csi-sun-ray)" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="39" y1="24" x2="45" y2="24" stroke="url(#csi-sun-ray)" strokeWidth="3.2" strokeLinecap="round" />
        {/* Raios Diagonais */}
        <line x1="9" y1="9" x2="13.5" y2="13.5" stroke="url(#csi-sun-ray)" strokeWidth="3" strokeLinecap="round" />
        <line x1="34.5" y1="34.5" x2="39" y2="39" stroke="url(#csi-sun-ray)" strokeWidth="3" strokeLinecap="round" />
        <line x1="9" y1="39" x2="13.5" y2="34.5" stroke="url(#csi-sun-ray)" strokeWidth="3" strokeLinecap="round" />
        <line x1="34.5" y1="13.5" x2="39" y2="9" stroke="url(#csi-sun-ray)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Corpo Central do Sol 3D com Pétalas Suaves e Esfera */}
      <g filter="url(#csi-drop-shadow)">
        <rect x="10" y="10" width="28" height="28" rx="8" fill="url(#csi-sun-core)" />
        <rect x="10" y="10" width="28" height="28" rx="8" transform="rotate(45 24 24)" fill="url(#csi-sun-core)" />

        {/* Núcleo Central Volumétrico */}
        <circle cx="24" cy="24" r="11" fill="url(#csi-sun-core)" />

        {/* Arco de Brilho Especular Intenso */}
        <path
          d="M 17.5 21 A 7.5 7.5 0 0 1 25 15"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="18" cy="18" r="1.5" fill="#FFFFFF" opacity="0.95" />
      </g>
    </svg>
  );
}
