import React from 'react';
import { Smartphone, Mail, FileText, Key, Building2, HelpCircle } from 'lucide-react';

/**
 * Ícone Vetorial Oficial da Marca PIX (Banco Central do Brasil)
 */
export const PixLogo = ({ size = 18, className = '', glow = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={`pix-logo-svg ${className}`}
    style={{
      color: '#00BDAE',
      flexShrink: 0,
      filter: glow ? 'drop-shadow(0 0 8px rgba(0, 189, 174, 0.55))' : 'none',
      transition: 'filter 0.2s ease',
    }}
  >
    <path d="M112.5 124.7l69.8-69.8c23.4-23.4 61.4-23.4 84.9 0l38.2 38.2c6.2 6.2 16.4 6.2 22.6 0l38.2-38.2c23.4-23.4 61.4-23.4 84.9 0l69.8 69.8c23.4 23.4 23.4 61.4 0 84.9l-69.8 69.8c-23.4 23.4-61.4 23.4-84.9 0l-38.2-38.2c-6.2-6.2-16.4-6.2-22.6 0l-38.2 38.2c-23.4 23.4-61.4 23.4-84.9 0l-69.8-69.8c-23.5-23.4-23.5-61.5 0-84.8zm28.3 28.3c-7.8 7.8-7.8 20.5 0 28.3l69.8 69.8c7.8 7.8 20.5 7.8 28.3 0l38.2-38.2c18.7-18.7 49.1-18.7 67.9 0l38.2 38.2c7.8 7.8 20.5 7.8 28.3 0l69.8-69.8c7.8-7.8 7.8-20.5 0-28.3l-69.8-69.8c-7.8-7.8-20.5-7.8-28.3 0l-38.2 38.2c-18.7 18.7-49.1 18.7-67.9 0l-38.2-38.2c-7.8-7.8-20.5-7.8-28.3 0l-69.8 69.8zm-28.3 174.1l69.8-69.8c23.4-23.4 61.4-23.4 84.9 0l38.2 38.2c6.2 6.2 16.4 6.2 22.6 0l38.2-38.2c23.4-23.4 61.4-23.4 84.9 0l69.8 69.8c23.4 23.4 23.4 61.4 0 84.9l-69.8 69.8c-23.4 23.4-61.4 23.4-84.9 0l-38.2-38.2c-6.2-6.2-16.4-6.2-22.6 0l-38.2 38.2c-23.4 23.4-61.4 23.4-84.9 0l-69.8-69.8c-23.5-23.4-23.5-61.5 0-84.9zm28.3 28.3c-7.8 7.8-7.8 20.5 0 28.3l69.8 69.8c7.8 7.8 20.5 7.8 28.3 0l38.2-38.2c18.7-18.7 49.1-18.7 67.9 0l38.2 38.2c7.8 7.8 20.5 7.8 28.3 0l69.8-69.8c7.8-7.8 7.8-20.5 0-28.3l-69.8-69.8c-7.8-7.8-20.5-7.8-28.3 0l-38.2 38.2c-18.7 18.7-49.1 18.7-67.9 0l-38.2-38.2c-7.8-7.8-20.5-7.8-28.3 0l-69.8 69.8z"/>
  </svg>
);

/**
 * Detecta e Formata Chaves PIX nos Padrões Oficiais:
 * - Telefone (Celular / Fixo)
 * - CPF
 * - E-mail
 * - Chave Aleatória (EVP / UUID)
 * - CNPJ
 */
export function detectAndFormatPix(rawKey) {
  if (!rawKey || !String(rawKey).trim()) {
    return {
      type: 'empty',
      label: 'Não cadastrada',
      tag: 'PIX',
      icon: HelpCircle,
      formatted: 'Nenhuma chave cadastrada',
      clean: '',
      color: '#94a3b8',
    };
  }

  const trimmed = String(rawKey).trim();

  // 1. E-mail: contém @ e ponto
  if (trimmed.includes('@') && trimmed.includes('.')) {
    return {
      type: 'email',
      label: 'E-mail',
      tag: 'E-MAIL',
      icon: Mail,
      formatted: trimmed.toLowerCase(),
      clean: trimmed.toLowerCase(),
      color: '#38bdf8',
    };
  }

  // 2. Chave Aleatória (EVP): padrão UUID com ou sem hífens
  const uuidWithHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidPlain = /^[0-9a-f]{32}$/i;

  if (uuidWithHyphens.test(trimmed)) {
    return {
      type: 'random',
      label: 'Chave Aleatória',
      tag: 'ALEATÓRIA',
      icon: Key,
      formatted: trimmed.toLowerCase(),
      clean: trimmed.toLowerCase(),
      color: '#a855f7',
    };
  }

  if (uuidPlain.test(trimmed)) {
    const formatted = `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(12, 16)}-${trimmed.slice(16, 20)}-${trimmed.slice(20)}`.toLowerCase();
    return {
      type: 'random',
      label: 'Chave Aleatória',
      tag: 'ALEATÓRIA',
      icon: Key,
      formatted,
      clean: trimmed.toLowerCase(),
      color: '#a855f7',
    };
  }

  // Apenas dígitos numéricos
  const digits = trimmed.replace(/\D/g, '');

  // 3. CNPJ (14 dígitos)
  if (digits.length === 14) {
    const formatted = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    return {
      type: 'cnpj',
      label: 'CNPJ',
      tag: 'CNPJ',
      icon: Building2,
      formatted,
      clean: digits,
      color: '#f59e0b',
    };
  }

  // 4. Telefone com DDI internacional (+55...)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    const withoutDDI = digits.slice(2);
    if (withoutDDI.length === 11) {
      const formatted = `+55 (${withoutDDI.slice(0, 2)}) ${withoutDDI.slice(2, 7)}-${withoutDDI.slice(7)}`;
      return {
        type: 'phone',
        label: 'Celular',
        tag: 'CELULAR',
        icon: Smartphone,
        formatted,
        clean: `+55${withoutDDI}`,
        color: '#10b981',
      };
    }
  }

  // 5. Telefone Celular Nacional (11 dígitos, terceiro dígito é 9 -> DDD + 9 dígitos)
  // Ex: 95991409987 -> DDD 95, Celular 99140-9987
  if (digits.length === 11 && digits[2] === '9') {
    const formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return {
      type: 'phone',
      label: 'Celular',
      tag: 'CELULAR',
      icon: Smartphone,
      formatted,
      clean: digits,
      color: '#10b981',
    };
  }

  // 6. Telefone Fixo (10 dígitos -> DDD + 8 dígitos)
  if (digits.length === 10) {
    const formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return {
      type: 'phone',
      label: 'Telefone Fixo',
      tag: 'TELEFONE',
      icon: Smartphone,
      formatted,
      clean: digits,
      color: '#10b981',
    };
  }

  // 7. CPF (11 dígitos que não são celular)
  if (digits.length === 11) {
    const formatted = digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return {
      type: 'cpf',
      label: 'CPF',
      tag: 'CPF',
      icon: FileText,
      formatted,
      clean: digits,
      color: '#06b6d4',
    };
  }

  // Fallback para outros tipos de chave
  return {
    type: 'other',
    label: 'Chave PIX',
    tag: 'CHAVE PIX',
    icon: Key,
    formatted: trimmed,
    clean: trimmed,
    color: '#00BDAE',
  };
}
