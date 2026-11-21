import React from 'react';

/**
 * CelestialShiftIllustration
 * 
 * Ilustrações Vetoriais Premium e Tridimensionais para o Turno do Dia na Barra de Boas-Vindas:
 * - sunrise: Nascer do Sol dourado com horizonte matinal e raios ascendentes
 * - day-bright: Sol Pleno 3D esférico com 8 raios solares elegantes esculpidos e brilho volumétrico
 * - sunset: Pôr do Sol crepuscular com horizonte em degradê âmbar/magenta e raios dourados
 * - night: Lua Crescente 3D dourada/perolada com relevo suave e constelação de estrelas cintilantes
 * 
 * Totalmente independente do widget meteorológico de clima.
 */
export default function CelestialShiftIllustration({
  phase = 'day-bright',
  size = 42,
  className = '',
  title = '',
}) {
  const s = size;

  // Definições de gradientes, auras e filtros luminosos 3D
  const defs = (
    <defs>
      {/* 1. Sol Forte Pleno 3D: Gradiente Esférico Volumétrico */}
      <radialGradient id="csi-sun-sphere" cx="32%" cy="30%" r="68%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="18%" stopColor="#FFFBEB" />
        <stop offset="42%" stopColor="#FDE047" />
        <stop offset="72%" stopColor="#F59E0B" />
        <stop offset="92%" stopColor="#EA580C" />
        <stop offset="100%" stopColor="#C2410C" />
      </radialGradient>

      {/* Raios Solares Primários */}
      <linearGradient id="csi-sun-ray-prim" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity="1" />
        <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.7" />
      </linearGradient>

      {/* 2. Nascer do Sol (Sunrise) */}
      <radialGradient id="csi-sunrise-sphere" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="35%" stopColor="#FDE047" />
        <stop offset="70%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#DC2626" />
      </radialGradient>

      <linearGradient id="csi-sunrise-horizon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F97316" stopOpacity="0.8" />
        <stop offset="50%" stopColor="#FDE047" stopOpacity="1" />
        <stop offset="100%" stopColor="#F97316" stopOpacity="0.8" />
      </linearGradient>

      {/* 3. Pôr do Sol (Sunset / Golden Hour) */}
      <radialGradient id="csi-sunset-sphere" cx="38%" cy="32%" r="65%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="30%" stopColor="#FB923C" />
        <stop offset="65%" stopColor="#EA580C" />
        <stop offset="90%" stopColor="#BE123C" />
        <stop offset="100%" stopColor="#881337" />
      </radialGradient>

      <linearGradient id="csi-sunset-horizon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#C026D3" />
        <stop offset="35%" stopColor="#EA580C" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#9333EA" />
      </linearGradient>

      {/* 4. Lua Noturna 3D (Crescent Moon) */}
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

      {/* Filtro de Brilho Quente e Sombra Suave 3D */}
      <filter id="csi-glow-warm" x="-35%" y="-35%" width="170%" height="170%">
        <feGaussianBlur stdDeviation="3.2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id="csi-shadow-3d" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#000000" floodOpacity="0.4" />
      </filter>
    </defs>
  );

  // 1. NASCER DO SOL (Sunrise - Alvorada)
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
        {/* Aura Difusa de Alvorada */}
        <circle cx="24" cy="27" r="19" fill="#F59E0B" opacity="0.25" filter="url(#csi-glow-warm)" />

        {/* Raios Matinais Ascendentes */}
        <g opacity="0.95" filter="url(#csi-shadow-3d)">
          <path d="M 24 6 L 25.8 15 L 22.2 15 Z" fill="#FDE047" />
          <path d="M 12 11 L 18.5 18 L 16 20 Z" fill="#FBBF24" />
          <path d="M 36 11 L 32 20 L 29.5 18 Z" fill="#FBBF24" />
          <path d="M 4 23 L 13.5 25.5 L 13.5 23 Z" fill="#F97316" />
          <path d="M 44 23 L 34.5 23 L 34.5 25.5 Z" fill="#F97316" />
        </g>

        {/* Semi-Sol 3D Nascendo */}
        <g filter="url(#csi-shadow-3d)">
          <path
            d="M 11 31 A 13 13 0 0 1 37 31 Z"
            fill="url(#csi-sunrise-sphere)"
          />
          {/* Arco Especular de Brilho Matinal */}
          <path
            d="M 16 24 A 9.5 9.5 0 0 1 32 24"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Linhas de Horizonte com Reflexos Dourados */}
        <rect x="4" y="31" width="40" height="3" rx="1.5" fill="url(#csi-sunrise-horizon-grad)" filter="url(#csi-shadow-3d)" />
        <rect x="10" y="37" width="28" height="2" rx="1" fill="url(#csi-sunrise-horizon-grad)" opacity="0.75" />
        <rect x="17" y="42" width="14" height="1.5" rx="0.75" fill="url(#csi-sunrise-horizon-grad)" opacity="0.5" />
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
        <circle cx="24" cy="27" r="19" fill="#EA580C" opacity="0.28" filter="url(#csi-glow-warm)" />

        {/* Raios Descendentes do Entardecer */}
        <g opacity="0.9" filter="url(#csi-shadow-3d)">
          <path d="M 24 7 L 26 16 L 22 16 Z" fill="#FDE047" />
          <path d="M 12 12 L 18.5 19 L 16 21 Z" fill="#FB923C" />
          <path d="M 36 12 L 32 21 L 29.5 19 Z" fill="#FB923C" />
          <path d="M 5 23 L 14 25.5 L 14 23 Z" fill="#F97316" />
          <path d="M 43 23 L 34 23 L 34 25.5 Z" fill="#F97316" />
        </g>

        {/* Disco Solar Avermelhado Descendente */}
        <g filter="url(#csi-shadow-3d)">
          <path
            d="M 11 31 A 13 13 0 0 1 37 31 Z"
            fill="url(#csi-sunset-sphere)"
          />
          {/* Brilho Suave */}
          <path
            d="M 16 24 A 9.5 9.5 0 0 1 32 24"
            stroke="#FEF08A"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>

        {/* Horizonte do Crepúsculo */}
        <rect x="4" y="31" width="40" height="3" rx="1.5" fill="url(#csi-sunset-horizon-grad)" filter="url(#csi-shadow-3d)" />
        <rect x="9" y="37" width="30" height="2" rx="1" fill="url(#csi-sunset-horizon-grad)" opacity="0.8" />
        <rect x="16" y="42" width="16" height="1.5" rx="0.75" fill="url(#csi-sunset-horizon-grad)" opacity="0.55" />
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
        <circle cx="25" cy="24" r="18" fill="#FBBF24" opacity="0.18" filter="url(#csi-glow-warm)" />

        {/* Lua Crescente Dourada com Curvatura Elegante */}
        <g filter="url(#csi-shadow-3d)">
          <path
            d="M 31.5 5.5 C 22.5 7.5 15.5 15.5 15.5 25.5 C 15.5 35.8 23.5 44 33.5 44 C 36.8 44 40 43 42.5 41 C 29.5 39 21.5 28 24 15 C 25 11 27.5 7.8 31.5 5.5 Z"
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
            opacity="0.9"
          />
        </g>

        {/* Estrelas Cintilantes de 4 Pontas */}
        <g filter="url(#csi-shadow-3d)">
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

  // 4. SOL FORTE PLENO (Day Bright - Pleno Dia / Manhã Avançada e Tarde)
  // Design Limpo, Redondo, 3D e Altamente Estético (sem blocos ou pontas quadradas)
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
      <circle cx="24" cy="24" r="22" fill="#F59E0B" opacity="0.24" filter="url(#csi-glow-warm)" />

      {/* 8 Raios Principais Elegantes (Gotas/Tapered Capsulares Esculpidas) */}
      <g filter="url(#csi-shadow-3d)">
        {/* Norte (0°) */}
        <path d="M 24 2.5 C 25.2 2.5 26 3.6 25.8 5.2 L 25.2 9 C 24.8 10 23.2 10 22.8 9 L 22.2 5.2 C 22 3.6 22.8 2.5 24 2.5 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Sul (180°) */}
        <path d="M 24 45.5 C 25.2 45.5 26 44.4 25.8 42.8 L 25.2 39 C 24.8 38 23.2 38 22.8 39 L 22.2 42.8 C 22 44.4 22.8 45.5 24 45.5 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Leste (90°) */}
        <path d="M 45.5 24 C 45.5 25.2 44.4 26 42.8 25.8 L 39 25.2 C 38 24.8 38 23.2 39 22.8 L 42.8 22.2 C 44.4 22 45.5 22.8 45.5 24 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Oeste (270°) */}
        <path d="M 2.5 24 C 2.5 25.2 3.6 26 5.2 25.8 L 9 25.2 C 10 24.8 10 23.2 9 22.8 L 5.2 22.2 C 3.6 22 2.5 22.8 2.5 24 Z" fill="url(#csi-sun-ray-prim)" />

        {/* Diagonais (45°, 135°, 225°, 315°) */}
        {/* Nordeste (45°) */}
        <path d="M 39.2 8.8 C 40 9.6 40 10.8 38.6 11.8 L 34.8 14.5 C 34 15 33 14 33.5 13.2 L 36.2 9.4 C 37.2 8 38.4 8 39.2 8.8 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Sudeste (135°) */}
        <path d="M 39.2 39.2 C 38.4 40 37.2 40 36.2 38.6 L 33.5 34.8 C 33 34 34 33 34.8 33.5 L 38.6 36.2 C 40 37.2 40 38.4 39.2 39.2 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Sudoeste (225°) */}
        <path d="M 8.8 39.2 C 8 38.4 8 37.2 9.4 36.2 L 13.2 33.5 C 14 33 15 34 14.5 34.8 L 11.8 38.6 C 10.8 40 9.6 40 8.8 39.2 Z" fill="url(#csi-sun-ray-prim)" />
        {/* Noroeste (315°) */}
        <path d="M 8.8 8.8 C 9.6 8 10.8 8 11.8 9.4 L 14.5 13.2 C 15 14 14 15 13.2 14.5 L 9.4 11.8 C 8 10.8 8 9.6 8.8 8.8 Z" fill="url(#csi-sun-ray-prim)" />
      </g>

      {/* 4 Raios Secundários Delicados (Micro-Flares) */}
      <g opacity="0.85">
        <circle cx="24" cy="11.5" r="1.3" fill="#FEF08A" />
        <circle cx="24" cy="36.5" r="1.3" fill="#FEF08A" />
        <circle cx="11.5" cy="24" r="1.3" fill="#FEF08A" />
        <circle cx="36.5" cy="24" r="1.3" fill="#FEF08A" />
      </g>

      {/* Esfera Central 3D do Sol — Perfeitamente Redonda e Volumétrica */}
      <g filter="url(#csi-shadow-3d)">
        {/* Borda Externa Dourada/Âmbar Suave */}
        <circle cx="24" cy="24" r="13" fill="#D97706" opacity="0.3" />
        {/* Corpo Esférico Principal */}
        <circle cx="24" cy="24" r="12.2" fill="url(#csi-sun-sphere)" />

        {/* Brilho Especular Superior Curvo (Volume 3D Vidrado) */}
        <path
          d="M 16.5 20 C 17.5 16 21 14.5 25 15"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Ponto Focal de Brilho */}
        <circle cx="18" cy="18" r="1.8" fill="#FFFFFF" opacity="0.95" />
      </g>
    </svg>
  );
}
