import React from 'react';

/**
 * Ilustrações Vetoriais Premium para o Clima e Turno (Dia / Noite / Chuva / Tempestade / Nublado / Céu Limpo)
 * Totalmente responsivo, nítido em qualquer resolução e sem depender de fontes de emoji do sistema operacional.
 */
export default function WeatherIllustration({
  type = 'day-clear',
  size = 42,
  className = '',
  title = '',
}) {
  const s = size;

  // Gradients e Filtros Compartilhados
  const defs = (
    <defs>
      {/* Sol Diurno */}
      <linearGradient id="wi-sun-day" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="60%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>

      {/* Raios Solares */}
      <linearGradient id="wi-sun-ray" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* Lua Noturna Dourada / Prateada */}
      <linearGradient id="wi-moon-night" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="45%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#EAB308" />
      </linearGradient>

      {/* Nuvem Diurna */}
      <linearGradient id="wi-cloud-day" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="65%" stopColor="#E2E8F0" />
        <stop offset="100%" stopColor="#CBD5E1" />
      </linearGradient>

      {/* Nuvem Noturna Translúcida */}
      <linearGradient id="wi-cloud-night" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#334155" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#1E293B" stopOpacity="0.95" />
      </linearGradient>

      {/* Nuvem de Chuva / Tempestade */}
      <linearGradient id="wi-cloud-rain" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748B" />
        <stop offset="50%" stopColor="#475569" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* Raio Elétrico */}
      <linearGradient id="wi-lightning" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>

      {/* Filtro de Brilho Suave */}
      <filter id="wi-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      {/* Sombra de Nuvem */}
      <filter id="wi-cloud-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodOpacity="0.3" />
      </filter>
    </defs>
  );

  // 1. NOITE: CÉU LIMPO / ESTRELADO
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
        {/* Lua Crescente Dourada Reluzente */}
        <path
          d="M31 7C22.2 9 15.5 17 15.5 26.5C15.5 37.3 24.2 46 35 46C39.5 46 43.6 44.5 47 41.8C34.5 39.5 25.5 28 27.5 15C28.2 11.8 29.5 9.2 31 7Z"
          fill="url(#wi-moon-night)"
          filter="url(#wi-glow-soft)"
        />
        {/* Cratera / Sombra sutil interna */}
        <circle cx="25" cy="28" r="2" fill="#EAB308" opacity="0.35" />
        <circle cx="31" cy="36" r="1.5" fill="#EAB308" opacity="0.35" />

        {/* Estrelas Cintilantes de 4 Pontas */}
        {/* Estrela 1 (Canto Superior Esquerdo) */}
        <path d="M11 9L12 12.5L15.5 13.5L12 14.5L11 18L10 14.5L6.5 13.5L10 12.5Z" fill="#FDE047" />
        {/* Estrela 2 (Centro Esquerda) */}
        <path d="M9 28L9.8 30.5L12.3 31.3L9.8 32.1L9 34.6L8.2 32.1L5.7 31.3L8.2 30.5Z" fill="#93C5FD" opacity="0.95" />
        {/* Estrela 3 (Inferior Esquerda) */}
        <circle cx="16" cy="40" r="1.3" fill="#E0E7FF" opacity="0.85" />
        {/* Estrela 4 (Canto Superior Direito) */}
        <circle cx="43" cy="14" r="1.2" fill="#FEF08A" opacity="0.9" />
        <circle cx="40" cy="24" r="1" fill="#93C5FD" opacity="0.8" />
      </svg>
    );
  }

  // 2. NOITE: PARCIALMENTE NUBLADA (LUA COM NUVENS NOTURNAS)
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
        {/* Lua Crescente Elevada */}
        <path
          d="M26 6C18.8 7.8 13.5 14.2 13.5 22C13.5 30.8 20.7 38 29.5 38C32.8 38 35.8 37 38.3 35.2C28.5 33.5 21.5 24 23 13.2C23.6 10.5 24.8 8.2 26 6Z"
          fill="url(#wi-moon-night)"
          filter="url(#wi-glow-soft)"
        />
        {/* Estrela Cintilante no Céu */}
        <path d="M9 13L9.8 15.5L12.3 16.3L9.8 17.1L9 19.6L8.2 17.1L5.7 16.3L8.2 15.5Z" fill="#FDE047" opacity="0.9" />
        <circle cx="42" cy="12" r="1.2" fill="#93C5FD" opacity="0.8" />

        {/* Nuvem Noturna com Borda Suave */}
        <path
          d="M17 41H36C39.3 41 42 38.3 42 35C42 32 39.8 29.5 36.9 29.1C36.4 23.9 32 20 26.7 20C22.2 20 18.3 22.8 17.1 26.9C14.2 27.5 12 30 12 33C12 37.4 15.6 41 17 41Z"
          fill="url(#wi-cloud-night)"
          stroke="#64748B"
          strokeWidth="1.2"
          strokeOpacity="0.6"
          filter="url(#wi-cloud-shadow)"
        />
      </svg>
    );
  }

  // 3. NOITE: NUBLADA (LUA ESPREITANDO SOBRE NUVENS CARREGADAS NOTURNAS)
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
        <path
          d="M24 7C17.8 8.5 13.5 14 13.5 20.5C13.5 25.8 16.5 30.5 21 33C20 28 22 21 27 15C28.2 13.5 29.5 12.2 31 11C28.8 8.5 26.5 7.5 24 7Z"
          fill="url(#wi-moon-night)"
          opacity="0.85"
        />
        {/* Camada Traseira de Nuvens */}
        <path
          d="M14 34H33C35.8 34 38 31.8 38 29C38 26.5 36.2 24.4 33.7 24.1C33.3 19.8 29.6 16.5 25.2 16.5C21.4 16.5 18.2 18.8 17.2 22.2C14.7 22.7 13 24.8 13 27.3C13 31 14 34 14 34Z"
          fill="#334155"
          opacity="0.8"
        />
        {/* Camada Frontal de Nuvens */}
        <path
          d="M18 42H38C41.3 42 44 39.3 44 36C44 33 41.8 30.5 38.9 30.1C38.4 25.4 34.2 21.8 29.3 21.8C25.1 21.8 21.5 24.4 20.3 28.2C17.7 28.7 14 31 14 34C14 38.4 17.6 42 18 42Z"
          fill="url(#wi-cloud-night)"
          stroke="#475569"
          strokeWidth="1.2"
          filter="url(#wi-cloud-shadow)"
        />
      </svg>
    );
  }

  // 4. NOITE: CHUVA / CHUVISCO NOTURNO
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
        <path
          d="M26 6C20 7.5 15.5 12.8 15.5 19C15.5 22.5 17 25.8 19.5 28C20 23 23 17 28 12C29.2 10.8 30.5 9.8 32 9C29.8 7 27.8 6.2 26 6Z"
          fill="url(#wi-moon-night)"
          opacity="0.9"
        />
        {/* Nuvem de Chuva Noturna */}
        <path
          d="M16 34H36C39.3 34 42 31.3 42 28C42 25 39.8 22.5 36.9 22.1C36.4 17.4 32.2 13.8 27.3 13.8C23.1 13.8 19.5 16.4 18.3 20.2C15.7 20.7 12 23 12 26C12 30.4 15.6 34 16 34Z"
          fill="url(#wi-cloud-rain)"
          stroke="#64748B"
          strokeWidth="1"
          filter="url(#wi-cloud-shadow)"
        />
        {/* Gotas de Chuva em Ângulo */}
        <line x1="18" y1="37" x2="15" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="26" y1="37" x2="23" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="34" y1="37" x2="31" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 5. NOITE: TEMPESTADE / TROVOADA NOTURNA
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
        {/* Nuvem Escura de Tempestade */}
        <path
          d="M15 30H37C40.3 30 43 27.3 43 24C43 21 40.8 18.5 37.9 18.1C37.4 13.4 33.2 9.8 28.3 9.8C24.1 9.8 20.5 12.4 19.3 16.2C16.7 16.7 11 19 11 22C11 26.4 14.6 30 15 30Z"
          fill="#1E293B"
          stroke="#7C3AED"
          strokeWidth="1.2"
          filter="url(#wi-cloud-shadow)"
        />
        {/* Raio Elétrico Dourado Cortando a Nuvem */}
        <path
          d="M25 21L20 31H27L23 43L33 29H26L29 21H25Z"
          fill="url(#wi-lightning)"
          stroke="#FEF08A"
          strokeWidth="0.8"
          filter="url(#wi-glow-soft)"
        />
        {/* Gotas de chuva forte */}
        <line x1="14" y1="34" x2="11" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        <line x1="37" y1="34" x2="34" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      </svg>
    );
  }

  // 6. DIA: ENSOLARADO / CÉU ABERTO
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
        {/* Raios Solares Radiantes */}
        <g stroke="url(#wi-sun-ray)" strokeWidth="2.8" strokeLinecap="round">
          {/* Cardeais */}
          <line x1="24" y1="3" x2="24" y2="8" />
          <line x1="24" y1="40" x2="24" y2="45" />
          <line x1="3" y1="24" x2="8" y2="24" />
          <line x1="40" y1="24" x2="45" y2="24" />
          {/* Diagonais */}
          <line x1="9.2" y1="9.2" x2="12.8" y2="12.8" />
          <line x1="35.2" y1="35.2" x2="38.8" y2="38.8" />
          <line x1="9.2" y1="38.8" x2="12.8" y2="35.2" />
          <line x1="35.2" y1="12.8" x2="38.8" y2="9.2" />
        </g>
        {/* Disco Solar Principal Dourado */}
        <circle cx="24" cy="24" r="11" fill="url(#wi-sun-day)" filter="url(#wi-glow-soft)" />
        {/* Brilho Solar Interno */}
        <circle cx="20.5" cy="20.5" r="4" fill="#FFFBEB" opacity="0.65" />
      </svg>
    );
  }

  // 7. DIA: PARCIALMENTE NUBLADO (SOL COM NUVEM)
  if (type === 'day-partly-cloudy') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`weather-art-svg wi-day-partly-cloudy ${className}`}
        aria-label={title || 'Sol entre Nuvens'}
      >
        {defs}
        {/* Raios e Disco Solar Superior */}
        <g stroke="url(#wi-sun-ray)" strokeWidth="2.4" strokeLinecap="round">
          <line x1="19" y1="4" x2="19" y2="8" />
          <line x1="5" y1="18" x2="9" y2="18" />
          <line x1="9" y1="8" x2="12" y2="11" />
          <line x1="29" y1="8" x2="26" y2="11" />
          <line x1="33" y1="18" x2="30" y2="18" />
        </g>
        <circle cx="19" cy="18" r="9.5" fill="url(#wi-sun-day)" />

        {/* Nuvem Diurna Branca Volumosa em Primeiro Plano */}
        <path
          d="M17 41H36C39.3 41 42 38.3 42 35C42 32 39.8 29.5 36.9 29.1C36.4 23.9 32 20 26.7 20C22.2 20 18.3 22.8 17.1 26.9C14.2 27.5 12 30 12 33C12 37.4 15.6 41 17 41Z"
          fill="url(#wi-cloud-day)"
          stroke="#94A3B8"
          strokeWidth="1.2"
          filter="url(#wi-cloud-shadow)"
        />
      </svg>
    );
  }

  // 8. DIA: NUBLADO
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
        <path
          d="M14 34H33C35.8 34 38 31.8 38 29C38 26.5 36.2 24.4 33.7 24.1C33.3 19.8 29.6 16.5 25.2 16.5C21.4 16.5 18.2 18.8 17.2 22.2C14.7 22.7 13 24.8 13 27.3C13 31 14 34 14 34Z"
          fill="#94A3B8"
          opacity="0.75"
        />
        {/* Nuvem Frontal */}
        <path
          d="M18 42H38C41.3 42 44 39.3 44 36C44 33 41.8 30.5 38.9 30.1C38.4 25.4 34.2 21.8 29.3 21.8C25.1 21.8 21.5 24.4 20.3 28.2C17.7 28.7 14 31 14 34C14 38.4 17.6 42 18 42Z"
          fill="url(#wi-cloud-day)"
          stroke="#64748B"
          strokeWidth="1.2"
          filter="url(#wi-cloud-shadow)"
        />
      </svg>
    );
  }

  // 9. DIA: CHUVA / CHUVISCO
  if (type === 'day-rain' || type === 'day-drizzle') {
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
        {/* Sol tímido ao fundo em chuvisco passageiro */}
        {type === 'day-drizzle' && (
          <circle cx="18" cy="14" r="7" fill="url(#wi-sun-day)" opacity="0.85" />
        )}
        {/* Nuvem de Chuva Diurna */}
        <path
          d="M16 33H36C39.3 33 42 30.3 42 27C42 24 39.8 21.5 36.9 21.1C36.4 16.4 32.2 12.8 27.3 12.8C23.1 12.8 19.5 15.4 18.3 19.2C15.7 19.7 12 22 12 25C12 29.4 15.6 33 16 33Z"
          fill="url(#wi-cloud-rain)"
          stroke="#475569"
          strokeWidth="1.2"
          filter="url(#wi-cloud-shadow)"
        />
        {/* Gotas de Chuva */}
        <line x1="18" y1="36" x2="15" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="26" y1="36" x2="23" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="34" y1="36" x2="31" y2="44" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 10. DIA: TEMPESTADE / TROVOADA
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
        <path
          d="M15 30H37C40.3 30 43 27.3 43 24C43 21 40.8 18.5 37.9 18.1C37.4 13.4 33.2 9.8 28.3 9.8C24.1 9.8 20.5 12.4 19.3 16.2C16.7 16.7 11 19 11 22C11 26.4 14.6 30 15 30Z"
          fill="#334155"
          stroke="#F59E0B"
          strokeWidth="1"
          filter="url(#wi-cloud-shadow)"
        />
        {/* Raio Elétrico Dourado */}
        <path
          d="M25 21L20 31H27L23 43L33 29H26L29 21H25Z"
          fill="url(#wi-lightning)"
          stroke="#FEF08A"
          strokeWidth="0.8"
          filter="url(#wi-glow-soft)"
        />
        <line x1="14" y1="34" x2="11" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="34" x2="34" y2="41" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 11. NEVOEIRO / NÉVOA (PADRÃO / FOG)
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`weather-art-svg wi-fog ${className}`}
      aria-label={title || 'Nevoeiro'}
    >
      {defs}
      <line x1="10" y1="18" x2="38" y2="18" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="6" y1="25" x2="42" y2="25" stroke="#CBD5E1" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
      <line x1="12" y1="32" x2="36" y2="32" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      <line x1="16" y1="39" x2="32" y2="39" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
