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
  { id: 'eq-001', photoUrl: '/images/equipment/eq-001.jpg', name: 'Sony a7III', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 8, availableQty: 8, serialNumber: '', description: 'Câmera Full-Frame híbrida 4K' },
  { id: 'eq-002', photoUrl: '/images/equipment/eq-002.jpg', name: 'Sony Fx30', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 6, availableQty: 6, serialNumber: '', description: 'Câmera Cinema Line Super 35 4K' },
  { id: 'eq-003', photoUrl: '/images/equipment/eq-003.jpg', name: 'Sony a7IV', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Câmera Full-Frame híbrida 33MP 4K60p' },
  { id: 'eq-004', photoUrl: '/images/equipment/eq-004.jpg', name: 'Sony 6600', category: 'cameras', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera APS-C compacta com IBIS' },
  { id: 'eq-005', photoUrl: '/images/equipment/eq-005.jpg', name: 'Canon eos RP', category: 'cameras', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera Mirrorless Full-Frame' },
  { id: 'eq-006', photoUrl: '/images/equipment/eq-006.jpg', name: 'Canon eos 5D mark III', category: 'cameras', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'DSLR Full-Frame profissional' },
  { id: 'eq-007', photoUrl: '/images/equipment/eq-007.jpg', name: 'Sony HXR- NX5', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Camcorder Profissional AVCHD' },
  { id: 'eq-008', photoUrl: '/images/equipment/eq-008.jpg', name: 'Sony NX5 R', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Camcorder Profissional com LED embutido' },
  { id: 'eq-009', photoUrl: '/images/equipment/eq-009.jpg', name: 'Sony PMW- EX3', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera XDCAM EX semi-ombro' },
  { id: 'eq-010', photoUrl: '/images/equipment/eq-010.jpg', name: 'Sony HXR- NX3', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Camcorder Full HD 3x 1/2.8 Exmor' },
  { id: 'eq-011', photoUrl: '/images/equipment/eq-011.jpg', name: 'Sony PMW- EX1', category: 'cameras', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera XDCAM EX compacta' },
  { id: 'eq-012', photoUrl: '/images/equipment/eq-012.jpg', name: 'GoPro 11 Black', category: 'cameras', dailyRate: 180, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera de ação 5.3K HyperSmooth' },
  { id: 'eq-013', photoUrl: '/images/equipment/eq-013.jpg', name: 'GoPro 360', category: 'cameras', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera 360 graus imersiva' },
  { id: 'eq-014', photoUrl: '/images/equipment/eq-014.jpg', name: 'GoPro 8 Black', category: 'cameras', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Câmera de ação 4K60' },

  // Lentes (10 itens)
  { id: 'eq-015', photoUrl: '/images/equipment/eq-015.jpg', name: 'Sony 24/70 f4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Lente Zeiss Vario-Tessar T* FE' },
  { id: 'eq-016', photoUrl: '/images/equipment/eq-016.jpg', name: 'Sony 50mm 1.8', category: 'lenses', dailyRate: 180, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Lente fixa prime compacta FE' },
  { id: 'eq-017', photoUrl: '/images/equipment/eq-017.jpg', name: 'Sony 35mm 1.8', category: 'lenses', dailyRate: 250, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Lente grande-angular rápida FE' },
  { id: 'eq-018', photoUrl: '/images/equipment/eq-018.jpg', name: 'Sony 70/200 2.8', category: 'lenses', dailyRate: 350, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Teleobjetiva G Master profissional' },
  { id: 'eq-019', photoUrl: '/images/equipment/eq-019.jpg', name: 'Sony 18/105 f4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Zoom motorizado G OSS APS-C' },
  { id: 'eq-020', photoUrl: '/images/equipment/eq-020.jpg', name: 'Sony 85mm 1.8', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Lente para retratos e eventos' },
  { id: 'eq-021', photoUrl: '/images/equipment/eq-021.jpg', name: 'Sigma 16mm 1.4', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Lente grande angular luminosa DC DN' },
  { id: 'eq-022', photoUrl: '/images/equipment/eq-022.jpg', name: 'Sony 24/70 2.8', category: 'lenses', dailyRate: 350, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente zoom padrão G Master' },
  { id: 'eq-023', photoUrl: '/images/equipment/eq-023.jpg', name: 'Canon 24/70 2.8', category: 'lenses', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente EF série L profissional' },
  { id: 'eq-024', photoUrl: '/images/equipment/eq-024.jpg', name: 'Canon 35mm 1.4', category: 'lenses', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Lente fixa EF série L de alto contraste' },

  // Vídeo (13 itens)
  { id: 'eq-025', photoUrl: '/images/equipment/eq-025.jpg', name: 'Monitor Feelworld 5.5 POL', category: 'video', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Monitor de campo HDMI 4K IPS' },
  { id: 'eq-026', photoUrl: '/images/equipment/eq-026.jpg', name: 'Monitor Feelworld 7.0 POL', category: 'video', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Monitor diretor 7 polegadas alto brilho' },
  { id: 'eq-027', photoUrl: '/images/equipment/eq-027.jpg', name: 'Transmissor cosmo c1 Hollyland', category: 'video', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Sistema de transmissão sem fio HDMI/SDI' },
  { id: 'eq-028', photoUrl: '/images/equipment/eq-028.jpg', name: 'Transmissor mars 300 pro Hollyland', category: 'video', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Transmissor de vídeo HDMI até 100m' },
  { id: 'eq-029', photoUrl: '/images/equipment/eq-029.jpg', name: 'Mesa de corte switcher estudio 6+', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher multicâmera de estúdio' },
  { id: 'eq-030', photoUrl: '/images/equipment/eq-030.jpg', name: 'Mesa de corte Blackmagic mini extreme live', category: 'video', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher 8 entradas HDMI com streaming direto' },
  { id: 'eq-031', photoUrl: '/images/equipment/eq-031.jpg', name: 'Mesa de corte Blackmagic Atem mini Pro', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher 4 entradas HDMI com gravação USB' },
  { id: 'eq-032', photoUrl: '/images/equipment/eq-032.jpg', name: 'Mesa de corte Neo iD Estudio 4+', category: 'video', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher portátil para transmissões ao vivo' },
  { id: 'eq-033', photoUrl: '/images/equipment/eq-033.jpg', name: 'Mesa de corte Atem 2 Blackmagic', category: 'video', dailyRate: 1200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Switcher profissional ATEM 2 M/E' },
  { id: 'eq-034', photoUrl: '/images/equipment/eq-034.jpg', name: 'Placa de captura de videos HDMI', category: 'video', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Capturador USB 3.0 Full HD/4K' },
  { id: 'eq-035', photoUrl: '/images/equipment/eq-035.jpg', name: 'NEO id tally', category: 'video', dailyRate: 250, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Sistema Tally sem fio multicâmera' },
  { id: 'eq-036', photoUrl: '/images/equipment/eq-036.jpg', name: 'Teleprompter profissional', category: 'video', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Teleprompter com vidro divisor de feixe 70/30' },
  { id: 'eq-037', photoUrl: '/images/equipment/eq-037.jpg', name: 'Teleprompter camera vídeo', category: 'video', dailyRate: 300, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Teleprompter compacto para lente de câmera' },

  // Áudio (15 itens)
  { id: 'eq-038', photoUrl: '/images/equipment/eq-038.jpg', name: 'Microfone Takstar para camera', category: 'audio', dailyRate: 50, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Shotgun direcional on-camera' },
  { id: 'eq-039', photoUrl: '/images/equipment/eq-039.jpg', name: 'Microfone YOGA AT81', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone direcional profissional' },
  { id: 'eq-040', photoUrl: '/images/equipment/eq-040.jpg', name: 'Microfone Sennheiser Mike 600', category: 'audio', dailyRate: 500, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone Shotgun MKE 600 Broadcast' },
  { id: 'eq-041', photoUrl: '/images/equipment/eq-041.jpg', name: 'Microfone Boya', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone direcional condensador' },
  { id: 'eq-042', photoUrl: '/images/equipment/eq-042.jpg', name: 'Pricila + capsula BOOM', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Vara Boom telescópica com suporte shockmount' },
  { id: 'eq-043', photoUrl: '/images/equipment/eq-043.jpg', name: 'Zoom H5', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Gravador digital de 4 pistas portátil' },
  { id: 'eq-044', photoUrl: '/images/equipment/eq-044.jpg', name: 'Mix de Áudio Rode Caster pro', category: 'audio', dailyRate: 400, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Estúdio de produção de áudio e podcast' },
  { id: 'eq-045', photoUrl: '/images/equipment/eq-045.jpg', name: 'Lapela Hollyland lark m2 duo', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Microfone sem fio ultra compacto duplo' },
  { id: 'eq-046', photoUrl: '/images/equipment/eq-046.jpg', name: 'Lapela Hollayland Lark M2s', category: 'audio', dailyRate: 250, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit de lapela sem fio Lark M2s' },
  { id: 'eq-047', photoUrl: '/images/equipment/eq-047.jpg', name: 'Microfone Hollayland Lark 150 Duplo', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit lapela duplo com estojo carregador' },
  { id: 'eq-048', photoUrl: '/images/equipment/eq-048.jpg', name: 'Mesa de som Digital Soundcraft Ui24R', category: 'audio', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Mixer digital 24 canais com controle Wi-Fi' },
  { id: 'eq-049', photoUrl: '/images/equipment/eq-049.jpg', name: 'Caixa de som JBL EON615', category: 'audio', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Caixa ativa 15 polegadas 1000W Bluetooth' },
  { id: 'eq-050', photoUrl: '/images/equipment/eq-050.jpg', name: 'Interface de Áudio Usb Behringer 4 canais', category: 'audio', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface USB 4x4 Midas Preamps' },
  { id: 'eq-051', photoUrl: '/images/equipment/eq-051.jpg', name: 'Interface de áudio Behringer UMC204HD 2 canais', category: 'audio', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface USB 2x4 192kHz' },
  { id: 'eq-052', photoUrl: '/images/equipment/eq-052.jpg', name: 'Interface de audio Behriger UM2 USB 1 CANAL', category: 'audio', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Interface compacta 1 canal XLR/P10' },

  // Luz / Iluminação (22 itens)
  { id: 'eq-053', photoUrl: '/images/equipment/eq-053.jpg', name: 'LED Soleste 1700 de camera', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Iluminador LED compacto para sapata' },
  { id: 'eq-054', photoUrl: '/images/equipment/eq-054.jpg', name: 'LED Yongnuo YN600L II', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Painel LED 600 lâmpadas bicolor com controle' },
  { id: 'eq-055', photoUrl: '/images/equipment/eq-055.jpg', name: 'LED VL 49', category: 'lighting', dailyRate: 40, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Mini iluminador RGB recarregável' },
  { id: 'eq-056', photoUrl: '/images/equipment/eq-056.jpg', name: 'Yongnuo YN300- II', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Painel LED 300 lâmpadas com abas' },
  { id: 'eq-057', photoUrl: '/images/equipment/eq-057.jpg', name: 'Flash Godox V860 IIIC Bateria para sony', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Flash TTL com bateria de lítio de alta autonomia' },
  { id: 'eq-058', photoUrl: '/images/equipment/eq-058.jpg', name: 'Flash Godox V350s Bateria para sony', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Mini flash TTL com bateria de lítio' },
  { id: 'eq-059', photoUrl: '/images/equipment/eq-059.jpg', name: 'Flash Godox TT350s pilha para Sony', category: 'lighting', dailyRate: 50, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Flash compacto a pilhas para Sony' },
  { id: 'eq-060', photoUrl: '/images/equipment/eq-060.jpg', name: 'Flash Godox TT600s pilha para Sony', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Flash manual sem fio 2.4G' },
  { id: 'eq-061', photoUrl: '/images/equipment/eq-061.jpg', name: 'Flash Canon 580EXII', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Flash Speedlite Canon' },
  { id: 'eq-062', photoUrl: '/images/equipment/eq-062.jpg', name: 'Rádio Flash Godox Xpro S', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Transmissor TTL sem fio 2.4G para Sony' },
  { id: 'eq-063', photoUrl: '/images/equipment/eq-063.jpg', name: 'Rádio Flash Godox X3 S', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Transmissor touch moderno ultra compacto' },
  { id: 'eq-064', photoUrl: '/images/equipment/eq-064.jpg', name: 'Led Rgb Sokani X25', category: 'lighting', dailyRate: 50, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Bastão / tubo de luz RGB versátil' },
  { id: 'eq-065', photoUrl: '/images/equipment/eq-065.jpg', name: 'Softbox QR- P120', category: 'lighting', dailyRate: 200, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Softbox parabólico desmontagem rápida 120cm' },
  { id: 'eq-066', photoUrl: '/images/equipment/eq-066.jpg', name: 'Rebatedor', category: 'lighting', dailyRate: 80, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Rebatedor 5 em 1 fotográfico' },
  { id: 'eq-067', photoUrl: '/images/equipment/eq-067.jpg', name: 'Softbox Triopo 90cm', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Octabox portátil para flash speedlite' },
  { id: 'eq-068', photoUrl: '/images/equipment/eq-068.jpg', name: 'Softbox Godox 90cm', category: 'lighting', dailyRate: 100, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Octabox com grid colmeia Bowens' },
  { id: 'eq-069', photoUrl: '/images/equipment/eq-069.jpg', name: 'Softbox Godox 120cm', category: 'lighting', dailyRate: 120, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Octabox grande 120cm montagem Bowens' },
  { id: 'eq-070', photoUrl: '/images/equipment/eq-070.jpg', name: 'Softbox Globo Balão Chines', category: 'lighting', dailyRate: 150, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Luz difusa 360 graus estilo lanterna balão' },
  { id: 'eq-071', photoUrl: '/images/equipment/eq-071.jpg', name: 'Tocha Sz200 Bi', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tocha LED contínua 200W bicolor com zoom' },
  { id: 'eq-072', photoUrl: '/images/equipment/eq-072.jpg', name: 'Tocha Godox Fv200', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Tocha híbrida Flash HSS e LED contínuo' },
  { id: 'eq-073', photoUrl: '/images/equipment/eq-073.jpg', name: 'Tocha AD600 pro II', category: 'lighting', dailyRate: 600, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tocha externa a bateria 600Ws TTL HSS' },
  { id: 'eq-074', photoUrl: '/images/equipment/eq-074.jpg', name: 'Tocha SL 200 III Bi', category: 'lighting', dailyRate: 300, rateUnit: 'diária', totalQty: 4, availableQty: 4, serialNumber: '', description: 'Luz contínua de cinema 200W bicolor silenciosa' },

  // Acessórios (12 itens)
  { id: 'eq-075', photoUrl: '/images/equipment/eq-075.jpg', name: 'Grua 8m', category: 'accessories', dailyRate: 1200, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Grua pantográfica 8 metros com cabeça móvel' },
  { id: 'eq-076', photoUrl: '/images/equipment/eq-076.jpg', name: 'Grua 3,50m', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Grua portátil 3,5 metros com tripé de carga' },
  { id: 'eq-077', photoUrl: '/images/equipment/eq-077.jpg', name: 'Tripe de camera Tr 688v', category: 'accessories', dailyRate: 100, rateUnit: 'diária', totalQty: 10, availableQty: 10, serialNumber: '', description: 'Tripé com cabeça fluida para vídeo' },
  { id: 'eq-078', photoUrl: '/images/equipment/eq-078.jpg', name: 'tripe de camera nt777', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Tripé de vídeo resistente com espalhador' },
  { id: 'eq-079', photoUrl: '/images/equipment/eq-079.jpg', name: 'Tripe de camera Benro Kh26p', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 5, availableQty: 5, serialNumber: '', description: 'Tripé profissional Benro com cabeça fluida' },
  { id: 'eq-080', photoUrl: '/images/equipment/eq-080.jpg', name: 'Estabilizador Weebill 3s', category: 'drones', dailyRate: 350, rateUnit: 'diária', totalQty: 2, availableQty: 2, serialNumber: '', description: 'Gimbal 3 eixos com luz de preenchimento' },
  { id: 'eq-081', photoUrl: '/images/equipment/eq-081.jpg', name: 'Estabilizador Weebill S', category: 'drones', dailyRate: 150, rateUnit: 'diária', totalQty: 3, availableQty: 3, serialNumber: '', description: 'Gimbal compacto para câmeras mirrorless' },
  { id: 'eq-082', photoUrl: '/images/equipment/eq-082.jpg', name: 'Impressora termica de fotos', category: 'accessories', dailyRate: 900, rateUnit: 'evento/hora', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Impressora fotográfica sublimação instantânea' },
  { id: 'eq-083', photoUrl: '/images/equipment/eq-083.jpg', name: 'Comunicadores Hollyland 6s', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Kit 6 fones sem fio intercomunicação' },
  { id: 'eq-084', photoUrl: '/images/equipment/eq-084.jpg', name: 'Tripe de Luz', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 9, availableQty: 9, serialNumber: '', description: 'Tripé de iluminação com amortecimento' },
  { id: 'eq-085', photoUrl: '/images/equipment/eq-085.jpg', name: 'Cabos de Hdmi 50m', category: 'accessories', dailyRate: 150, rateUnit: 'diária', totalQty: 8, availableQty: 8, serialNumber: '', description: 'Cabo HDMI fibra ótica 50 metros 4K' },
  { id: 'eq-086', photoUrl: '/images/equipment/eq-086.jpg', name: 'Comunicadores Hollyland Solidcom C1', category: 'accessories', dailyRate: 600, rateUnit: 'diária', totalQty: 1, availableQty: 1, serialNumber: '', description: 'Sistema Intercom Full-Duplex profissional' },
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

/**
 * Formata automaticamente CPF (11 dígitos: xxx.xxx.xxx-xx)
 * ou CNPJ (14 dígitos: xx.xxx.xxx/xxxx-xx) conforme a digitação.
 */
export function formatCpfCnpj(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 14);

  // CPF: até 11 dígitos -> xxx.xxx.xxx-xx
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  // CNPJ: 12 a 14 dígitos -> xx.xxx.xxx/xxxx-xx
  if (d.length <= 12) {
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  }
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

/**
 * Formata telefone brasileiro: (xx) xxxxx-xxxx ou (xx) xxxx-xxxx
 */
export function formatPhoneBR(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

