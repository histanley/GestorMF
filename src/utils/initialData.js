// Dados iniciais e estruturas de armazenamento do GestorMF (MegaFilmes & Mega Print)

export const DEFAULT_SETTINGS = {
  companyName: 'MegaFilmes & Mega Print',
  companyName2: 'Mega Print',
  tagline: 'Sistema de Agendas, Equipes e Viaturas',
  phone: '(95) 99999-9999',
  email: 'contato@megafilmes.com.br',
  website: 'https://megafilmes.com.br',
  cnpj: '00.000.000/0001-00',
  fuelPricePerLiter: 6.45, // Preço de referência / gasolina
  gasolinePricePerLiter: 6.45, // Preço médio da Gasolina em Boa Vista - RR
  dieselPricePerLiter: 6.89, // Preço médio do Diesel em Boa Vista - RR
  electricPricePerKwh: 0.95, // Tarifa de energia Roraima
  defaultAutonomy: 10,
  baseLocation: {
    name: 'Sede MegaFilmes & Mega Print',
    address: 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
    lat: 2.8293822995808733,
    lon: -60.730887232802566,
  },
  companies: ['MegaFilmes', 'Mega Print'],
};

export const DEFAULT_ROLES = [
  'Diretor(a) de Cena',
  'Cinegrafista',
  'Piloto de Drone',
  'Fotógrafo(a)',
  'Editor de Vídeo',
  'Operador de Totem',
  'Motorista / Produção',
  'Assistente Geral',
  'Designer Gráfico',
  'Operador de Áudio',
  'Social Mídia',
  'Transmissão (Streamer)',
];

export const INITIAL_VEHICLES = [];

export const INITIAL_MEMBERS = [];

export const INITIAL_MISSIONS = [];
