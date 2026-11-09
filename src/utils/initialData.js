// Dados iniciais e estruturas de armazenamento do GestorMF (MegaFilmes & Mega Print)

export const DEFAULT_SETTINGS = {
  companyName: 'MegaFilmes & Mega Print',
  fuelPricePerLiter: 6.45, // Preço de referência / gasolina
  gasolinePricePerLiter: 6.45, // Preço médio da Gasolina em Boa Vista - RR
  dieselPricePerLiter: 6.89, // Preço médio do Diesel em Boa Vista - RR
  defaultAutonomy: 10,
  baseLocation: {
    name: 'Sede MegaFilmes & Mega Print',
    address: 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
    lat: 2.8293822995808733,
    lon: -60.730887232802566,
  },
};

export const DEFAULT_ROLES = [
  'Diretor(a) de Cena',
  'Cinegrafista / Câmera',
  'Piloto de Drone',
  'Fotógrafo(a)',
  'Editor de Vídeo',
  'Técnico de Instalação (Mega Print)',
  'Motorista / Produção',
  'Assistente Geral',
  'Designer Gráfico (Mega Print)',
  'Operador de Áudio',
];

export const INITIAL_VEHICLES = [];

export const INITIAL_MEMBERS = [];

export const INITIAL_MISSIONS = [];
