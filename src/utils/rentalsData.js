// ==============================================================================
// GestorMF - Catálogo Inicial e Utilitários de Locação de Equipamentos
// ==============================================================================

export const CATEGORY_LABELS = {
  all: 'Todos os Equipamentos',
  cameras: 'Câmeras',
  lenses: 'Lentes',
  lighting: 'Iluminação',
  audio: 'Áudio',
  drones: 'Estabilizadores & Drones',
  video: 'Vídeo',
  accessories: 'Acessórios',
};

export const INITIAL_EQUIPMENT_CATALOG = [
  // Câmeras (14 itens)
  { id: 'eq-001', name: 'Sony a7III', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 8, availableQty: 8, serialNumber: '', description: 'Câmera Full-Frame híbrida 4K' },
  { id: 'eq-002', name: 'Sony Fx30', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 6, availableQty: 6, serialNumber: '', description: 'Câmera Cinema Line Super 35 4K' },
  { id: 'eq-003', name: 'Sony a7IV', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Câmera Full-Frame híbrida 33MP 4K60p' },
  { id: 'eq-004', name: 'Sony 6600', category: 'cameras', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera APS-C compacta com IBIS' },
  { id: 'eq-005', name: 'Canon eos RP', category: 'cameras', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera Mirrorless Full-Frame' },
  { id: 'eq-006', name: 'Canon eos 5D mark III', category: 'cameras', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'DSLR Full-Frame profissional' },
  { id: 'eq-007', name: 'Sony HXR- NX5', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Camcorder Profissional AVCHD' },
  { id: 'eq-008', name: 'Sony NX5 R', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Camcorder Profissional com LED embutido' },
  { id: 'eq-009', name: 'Sony PMW- EX3', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera XDCAM EX semi-ombro' },
  { id: 'eq-010', name: 'Sony HXR- NX3', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Camcorder Full HD 3x 1/2.8 Exmor' },
  { id: 'eq-011', name: 'Sony PMW- EX1', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera XDCAM EX compacta' },
  { id: 'eq-012', name: 'GoPro 11 Black', category: 'cameras', dailyRate: 180, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera de ação 5.3K HyperSmooth' },
  { id: 'eq-013', name: 'GoPro 360', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera 360 graus imersiva' },
  { id: 'eq-014', name: 'GoPro 8 Black', category: 'cameras', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera de ação 4K60' },

  // Lentes (10 itens)
  { id: 'eq-015', name: 'Sony 24/70 f4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Lente Zeiss Vario-Tessar T* FE' },
  { id: 'eq-016', name: 'Sony 50mm 1.8', category: 'lenses', dailyRate: 180, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Lente fixa prime compacta FE' },
  { id: 'eq-017', name: 'Sony 35mm 1.8', category: 'lenses', dailyRate: 250, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Lente grande-angular rápida FE' },
  { id: 'eq-018', name: 'Sony 70/200 2.8', category: 'lenses', dailyRate: 350, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Teleobjetiva G Master profissional' },
  { id: 'eq-019', name: 'Sony 18/105 f4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Zoom motorizado G OSS APS-C' },
  { id: 'eq-020', name: 'Sony 85mm 1.8', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Lente para retratos e eventos' },
  { id: 'eq-021', name: 'Sigma 16mm 1.4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Lente grande angular luminosa DC DN' },
  { id: 'eq-022', name: 'Sony 24/70 2.8', category: 'lenses', dailyRate: 350, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente zoom padrão G Master' },
  { id: 'eq-023', name: 'Canon 24/70 2.8', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente EF série L profissional' },
  { id: 'eq-024', name: 'Canon 35mm 1.4', category: 'lenses', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente fixa EF série L de alto contraste' },

  // Vídeo (13 itens)
  { id: 'eq-025', name: 'Monitor Feelworld 5.5 POL', category: 'video', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Monitor de campo HDMI 4K IPS' },
  { id: 'eq-026', name: 'Monitor Feelworld 7.0 POL', category: 'video', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Monitor diretor 7 polegadas alto brilho' },
  { id: 'eq-027', name: 'Transmissor cosmo c1 Hollyland', category: 'video', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Sistema de transmissão sem fio HDMI/SDI' },
  { id: 'eq-028', name: 'Transmissor mars 300 pro Hollyland', category: 'video', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Transmissor de vídeo HDMI até 100m' },
  { id: 'eq-029', name: 'Mesa de corte switcher estudio 6+', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher multicâmera de estúdio' },
  { id: 'eq-030', name: 'Mesa de corte Blackmagic mini extreme live', category: 'video', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher 8 entradas HDMI com streaming direto' },
  { id: 'eq-031', name: 'Mesa de corte Blackmagic Atem mini Pro', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher 4 entradas HDMI com gravação USB' },
  { id: 'eq-032', name: 'Mesa de corte Neo iD Estudio 4+', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher portátil para transmissões ao vivo' },
  { id: 'eq-033', name: 'Mesa de corte Atem 2 Blackmagic', category: 'video', dailyRate: 1200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher profissional ATEM 2 M/E' },
  { id: 'eq-034', name: 'Placa de captura de videos HDMI', category: 'video', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Capturador USB 3.0 Full HD/4K' },
  { id: 'eq-035', name: 'NEO id tally', category: 'video', dailyRate: 250, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Sistema Tally sem fio multicâmera' },
  { id: 'eq-036', name: 'Teleprompter profissional', category: 'video', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Teleprompter com vidro divisor de feixe 70/30' },
  { id: 'eq-037', name: 'Teleprompter camera vídeo', category: 'video', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Teleprompter compacto para lente de câmera' },

  // Áudio (15 itens)
  { id: 'eq-038', name: 'Microfone Takstar para camera', category: 'audio', dailyRate: 50, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Shotgun direcional on-camera' },
  { id: 'eq-039', name: 'Microfone YOGA AT81', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone direcional profissional' },
  { id: 'eq-040', name: 'Microfone Sennheiser Mike 600', category: 'audio', dailyRate: 500, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone Shotgun MKE 600 Broadcast' },
  { id: 'eq-041', name: 'Microfone Boya', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone direcional condensador' },
  { id: 'eq-042', name: 'Pricila + capsula BOOM', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Vara Boom telescópica com suporte shockmount' },
  { id: 'eq-043', name: 'Zoom H5', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Gravador digital de 4 pistas portátil' },
  { id: 'eq-044', name: 'Mix de Áudio Rode Caster pro', category: 'audio', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Estúdio de produção de áudio e podcast' },
  { id: 'eq-045', name: 'Lapela Hollyland lark m2 duo', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone sem fio ultra compacto duplo' },
  { id: 'eq-046', name: 'Lapela Hollayland Lark M2s', category: 'audio', dailyRate: 250, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit de lapela sem fio Lark M2s' },
  { id: 'eq-047', name: 'Microfone Hollayland Lark 150 Duplo', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit lapela duplo com estojo carregador' },
  { id: 'eq-048', name: 'Mesa de som Digital Soundcraft Ui24R', category: 'audio', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Mixer digital 24 canais com controle Wi-Fi' },
  { id: 'eq-049', name: 'Caixa de som JBL EON615', category: 'audio', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Caixa ativa 15 polegadas 1000W Bluetooth' },
  { id: 'eq-050', name: 'Interface de Áudio Usb Behringer 4 canais', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface USB 4x4 Midas Preamps' },
  { id: 'eq-051', name: 'Interface de áudio Behringer UMC204HD 2 canais', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface USB 2x4 192kHz' },
  { id: 'eq-052', name: 'Interface de audio Behriger UM2 USB 1 CANAL', category: 'audio', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface compacta 1 canal XLR/P10' },

  // Luz / Iluminação (22 itens)
  { id: 'eq-053', name: 'LED Soleste 1700 de camera', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Iluminador LED compacto para sapata' },
  { id: 'eq-054', name: 'LED Yongnuo YN600L II', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Painel LED 600 lâmpadas bicolor com controle' },
  { id: 'eq-055', name: 'LED VL 49', category: 'lighting', dailyRate: 40, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Mini iluminador RGB recarregável' },
  { id: 'eq-056', name: 'Yongnuo YN300- II', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Painel LED 300 lâmpadas com abas' },
  { id: 'eq-057', name: 'Flash Godox V860 IIIC Bateria para sony', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Flash TTL com bateria de lítio de alta autonomia' },
  { id: 'eq-058', name: 'Flash Godox V350s Bateria para sony', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Mini flash TTL com bateria de lítio' },
  { id: 'eq-059', name: 'Flash Godox TT350s pilha para Sony', category: 'lighting', dailyRate: 50, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Flash compacto a pilhas para Sony' },
  { id: 'eq-060', name: 'Flash Godox TT600s pilha para Sony', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Flash manual sem fio 2.4G' },
  { id: 'eq-061', name: 'Flash Canon 580EXII', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Flash Speedlite Canon' },
  { id: 'eq-062', name: 'Rádio Flash Godox Xpro S', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Transmissor TTL sem fio 2.4G para Sony' },
  { id: 'eq-063', name: 'Rádio Flash Godox X3 S', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Transmissor touch moderno ultra compacto' },
  { id: 'eq-064', name: 'Led Rgb Sokani X25', category: 'lighting', dailyRate: 50, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Bastão / tubo de luz RGB versátil' },
  { id: 'eq-065', name: 'Softbox QR- P120', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Softbox parabólico desmontagem rápida 120cm' },
  { id: 'eq-066', name: 'Rebatedor', category: 'lighting', dailyRate: 80, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Rebatedor 5 em 1 fotográfico' },
  { id: 'eq-067', name: 'Softbox Triopo 90cm', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Octabox portátil para flash speedlite' },
  { id: 'eq-068', name: 'Softbox Godox 90cm', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Octabox com grid colmeia Bowens' },
  { id: 'eq-069', name: 'Softbox Godox 120cm', category: 'lighting', dailyRate: 120, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Octabox grande 120cm montagem Bowens' },
  { id: 'eq-070', name: 'Softbox Globo Balão Chines', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Luz difusa 360 graus estilo lanterna balão' },
  { id: 'eq-071', name: 'Tocha Sz200 Bi', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tocha LED contínua 200W bicolor com zoom' },
  { id: 'eq-072', name: 'Tocha Godox Fv200', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Tocha híbrida Flash HSS e LED contínuo' },
  { id: 'eq-073', name: 'Tocha AD600 pro II', category: 'lighting', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tocha externa a bateria 600Ws TTL HSS' },
  { id: 'eq-074', name: 'Tocha SL 200 III Bi', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Luz contínua de cinema 200W bicolor silenciosa' },

  // Acessórios (12 itens)
  { id: 'eq-075', name: 'Grua 8m', category: 'accessories', dailyRate: 1200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Grua pantográfica 8 metros com cabeça móvel' },
  { id: 'eq-076', name: 'Grua 3,50m', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Grua portátil 3,5 metros com tripé de carga' },
  { id: 'eq-077', name: 'Tripe de camera Tr 688v', category: 'accessories', dailyRate: 100, rateUnit: 'diária', totalQty: 10, availableQty: 10, serialNumber: '', description: 'Tripé com cabeça fluida para vídeo' },
  { id: 'eq-078', name: 'tripe de camera nt777', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tripé de vídeo resistente com espalhador' },
  { id: 'eq-079', name: 'Tripe de camera Benro Kh26p', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Tripé profissional Benro com cabeça fluida' },
  { id: 'eq-080', name: 'Estabilizador Weebill 3s', category: 'drones', dailyRate: 350, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Gimbal 3 eixos com luz de preenchimento' },
  { id: 'eq-081', name: 'Estabilizador Weebill S', category: 'drones', dailyRate: 150, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Gimbal compacto para câmeras mirrorless' },
  { id: 'eq-082', name: 'Impressora termica de fotos', category: 'accessories', dailyRate: 900, rateUnit: 'evento/hora', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Impressora fotográfica sublimação instantânea' },
  { id: 'eq-083', name: 'Comunicadores Hollyland 6s', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit 6 fones sem fio intercomunicação' },
  { id: 'eq-084', name: 'Tripe de Luz', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 9, availableQty: 9, serialNumber: '', description: 'Tripé de iluminação com amortecimento' },
  { id: 'eq-085', name: 'Cabos de Hdmi 50m', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 8, availableQty: 8, serialNumber: '', description: 'Cabo HDMI fibra ótica 50 metros 4K' },
  { id: 'eq-086', name: 'Comunicadores Hollyland Solidcom C1', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Sistema Intercom Full-Duplex profissional' },
];

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

