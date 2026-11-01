import type { EquipmentCreate } from '../../../shared/schemas.ts';

// Toda esta planta é fictícia: fabricantes, modelos, séries, TAGs e valores foram criados para a demo.
export const USERS = [
  { id: 'u-mecanico-1', name: 'Rafael Moura', role: 'MECANICO' },
  { id: 'u-mecanico-2', name: 'Camila Duarte', role: 'MECANICO' },
  { id: 'u-mecanico-3', name: 'Tiago Prado', role: 'MECANICO' },
  { id: 'u-supervisor-1', name: 'Helena Vasconcelos', role: 'SUPERVISOR' },
] as const;

export const INVENTORY = [
  ['RL-6310', 'Rolamento rígido de esferas 6310-2Z', 'un', 6, 'A-02-03'],
  ['RL-6208', 'Rolamento rígido de esferas 6208-2Z', 'un', 4, 'A-02-04'],
  ['RL-6312', 'Rolamento rígido de esferas 6312-2RS', 'un', 2, 'A-02-05'],
  ['SM-040', 'Selo mecânico tipo cartucho Ø40', 'un', 2, 'B-01-01'],
  ['SM-030', 'Selo mecânico duplo Ø30', 'un', 1, 'B-01-02'],
  ['RT-045', 'Retentor de lábio Ø45', 'un', 8, 'B-01-05'],
  ['AO-180', 'Anel O da tampa de inspeção', 'un', 10, 'B-02-01'],
  ['JT-220', 'Junta plana da caixa de selagem', 'un', 5, 'B-02-02'],
  ['PD-260', 'Placa de desgaste Ø260', 'un', 1, 'C-03-01'],
  ['RO-250', 'Rotor semiaberto Ø250', 'un', 1, 'C-03-02'],
  ['RO-180', 'Rotor vortex Ø180', 'un', 1, 'C-03-03'],
  ['FL-150', 'Válvula flap elastomérica Ø150', 'un', 2, 'C-03-04'],
  ['CV-B68', 'Correia em V perfil B68', 'un', 9, 'D-01-01'],
  ['PL-B250', 'Polia de 2 canais perfil B Ø250', 'un', 1, 'D-01-04'],
  ['AC-E90', 'Elemento elástico do acoplamento', 'un', 3, 'D-02-01'],
  ['OL-68', 'Óleo mineral ISO VG 68', 'L', 40, 'E-01-01'],
  ['GX-EP2', 'Graxa de lítio EP2', 'kg', 12, 'E-01-02'],
  ['VT-132', 'Ventilador do motor carcaça 132', 'un', 1, 'F-01-01'],
] as const;

const PLANTA = 'Planta Demonstração';
export const DEFAULT_PHOTOS_NOTE = 'Imagem ilustrativa';

type SeedComponent = {
  name: string;
  category: string;
  partCode?: string;
  inventorySku?: string;
  modelNode?: string;
  quantity?: number;
  description: string;
};

type Seed = Omit<EquipmentCreate, 'serialNumber'> & {
  serialNumber: string;
  modelFile?: string;
  components: SeedComponent[];
};

const PUMP_COMPONENTS: Seed['components'] = [
  { name: 'Carcaça', category: 'ESTRUTURA', modelNode: 'BC_CASING', description: 'Corpo da bomba com a voluta.' },
  { name: 'Tampa de inspeção', category: 'ESTRUTURA', modelNode: 'BC_INSPECTION_COVER', description: 'Dá acesso ao interior sem soltar a tubulação.' },
  { name: 'Placa de desgaste', category: 'DESGASTE', partCode: 'PD-260', inventorySku: 'PD-260', modelNode: 'BC_WEAR_PLATE', description: 'Peça substituível à frente do rotor.' },
  { name: 'Válvula flap', category: 'VEDAÇÃO', partCode: 'FL-150', inventorySku: 'FL-150', modelNode: 'BC_FLAP_VALVE', description: 'Retém o líquido na sucção.' },
  { name: 'Rotor', category: 'ROTATIVO', partCode: 'RO-250', inventorySku: 'RO-250', modelNode: 'BC_IMPELLER', description: 'Rotor semiaberto.' },
  { name: 'Selo mecânico', category: 'VEDAÇÃO', partCode: 'SM-040', inventorySku: 'SM-040', modelNode: 'BC_MECH_SEAL_ROTATING', description: 'Veda o eixo na caixa de selagem.' },
  { name: 'Caixa de selagem', category: 'VEDAÇÃO', modelNode: 'BC_SEAL_HOUSING', description: 'Câmara de óleo que aloja o selo.' },
  { name: 'Mancal', category: 'ROTATIVO', modelNode: 'BC_BEARING_HOUSING', description: 'Corpo que aloja os rolamentos em banho de óleo.' },
  { name: 'Rolamento dianteiro', category: 'ROTATIVO', partCode: '6310-2Z', inventorySku: 'RL-6310', modelNode: 'BC_BEARING_INBOARD', description: 'Rolamento do lado do rotor.' },
  { name: 'Rolamento traseiro', category: 'ROTATIVO', partCode: '6310-2Z', inventorySku: 'RL-6310', modelNode: 'BC_BEARING_OUTBOARD', description: 'Rolamento do lado do acionamento.' },
  { name: 'Eixo', category: 'ROTATIVO', modelNode: 'BC_SHAFT', description: 'Eixo principal da bomba.' },
];

const SUBMERSIBLE_COMPONENTS: Seed['components'] = [
  { name: 'Carcaça do motor', category: 'ESTRUTURA', description: 'Invólucro estanque do motor.' },
  { name: 'Voluta', category: 'ESTRUTURA', description: 'Corpo hidráulico da bomba.' },
  { name: 'Rotor vortex', category: 'ROTATIVO', partCode: 'RO-180', inventorySku: 'RO-180', description: 'Permite a passagem de sólidos.' },
  { name: 'Selo mecânico duplo', category: 'VEDAÇÃO', partCode: 'SM-030', inventorySku: 'SM-030', description: 'Protege o motor contra a entrada de líquido.' },
  { name: 'Rolamento inferior', category: 'ROTATIVO', partCode: '6312-2RS', inventorySku: 'RL-6312', description: 'Rolamento do lado do rotor.' },
  { name: 'Cabo de alimentação', category: 'ELÉTRICO', description: 'Cabo com entrada vedada.' },
];

const MOTOR_COMPONENTS: Seed['components'] = [
  { name: 'Carcaça aletada', category: 'ESTRUTURA', description: 'Dissipa o calor do motor.' },
  { name: 'Estator', category: 'ELÉTRICO', description: 'Enrolamento trifásico.' },
  { name: 'Rotor de gaiola', category: 'ROTATIVO', description: 'Rotor do motor de indução.' },
  { name: 'Rolamento dianteiro', category: 'ROTATIVO', partCode: '6310-2Z', inventorySku: 'RL-6310', description: 'Lado do acionamento.' },
  { name: 'Rolamento traseiro', category: 'ROTATIVO', partCode: '6208-2Z', inventorySku: 'RL-6208', description: 'Lado do ventilador.' },
  { name: 'Ventilador', category: 'REFRIGERAÇÃO', partCode: 'VT-132', inventorySku: 'VT-132', description: 'Refrigeração externa.' },
];

const spec = (label: string, value: string, unit?: string) => ({ label, value, unit });

export const EQUIPMENT: Seed[] = [
  {
    tag: 'BC-101', name: 'Bomba centrífuga principal', category: 'BOMBA_CENTRIFUGA',
    manufacturer: 'HidroDemo', model: 'HD-C100', serialNumber: 'DEMO-0101',
    location: `${PLANTA} — Linha 1`, status: 'EM_OPERACAO', modelFile: 'bc-101.glb',
    description: 'Bomba principal da elevatória. Equipamento fictício com modelo 3D conceitual.',
    specs: [spec('Vazão de referência', '120', 'm³/h'), spec('Altura manométrica', '28', 'm'),
      spec('Rotação', '1750', 'rpm'), spec('Sucção / recalque', '4"')],
    components: PUMP_COMPONENTS,
  },
  {
    tag: 'BC-102', name: 'Bomba centrífuga reserva', category: 'BOMBA_CENTRIFUGA',
    manufacturer: 'HidroDemo', model: 'HD-C100', serialNumber: 'DEMO-0102',
    location: `${PLANTA} — Linha 2`, status: 'AGUARDANDO_PECA', modelFile: 'bc-101.glb',
    description: 'Reserva da BC-101. Aguarda placa de desgaste (situação fictícia).',
    specs: [spec('Vazão de referência', '120', 'm³/h'), spec('Altura manométrica', '28', 'm'), spec('Rotação', '1750', 'rpm')],
    components: PUMP_COMPONENTS,
  },
  {
    tag: 'BS-201', name: 'Bomba submersível do poço 1', category: 'BOMBA_SUBMERSIVEL',
    manufacturer: 'AquaDemo', model: 'AD-S75', serialNumber: 'DEMO-0201',
    location: `${PLANTA} — ETA`, status: 'EM_OPERACAO',
    description: 'Bomba submersível de esgoto com rotor vortex.',
    specs: [spec('Vazão de referência', '75', 'm³/h'), spec('Potência', '7,5', 'cv'), spec('Passagem de sólidos', '60', 'mm')],
    components: SUBMERSIBLE_COMPONENTS,
  },
  {
    tag: 'BS-202', name: 'Bomba submersível de drenagem', category: 'BOMBA_SUBMERSIVEL',
    manufacturer: 'AquaDemo', model: 'AD-S40', serialNumber: 'DEMO-0202',
    location: `${PLANTA} — ETI`, status: 'EM_MANUTENCAO',
    description: 'Drenagem da galeria técnica.',
    specs: [spec('Vazão de referência', '40', 'm³/h'), spec('Potência', '3', 'cv')],
    components: SUBMERSIBLE_COMPONENTS,
  },
  {
    tag: 'MT-301', name: 'Motor elétrico 30 cv', category: 'MOTOR_ELETRICO',
    manufacturer: 'MotorDemo', model: 'MD-200L', serialNumber: 'DEMO-0301',
    location: `${PLANTA} — Linha 3`, status: 'EM_OPERACAO',
    description: 'Motor de indução trifásico que aciona a BC-101.',
    specs: [spec('Potência', '30', 'cv'), spec('Polos', '4'), spec('Tensão', '380', 'V'), spec('Carcaça', '200L')],
    components: MOTOR_COMPONENTS,
  },
  {
    tag: 'MT-302', name: 'Motor elétrico 7,5 cv', category: 'MOTOR_ELETRICO',
    manufacturer: 'MotorDemo', model: 'MD-132M', serialNumber: 'DEMO-0302',
    location: `${PLANTA} — Fabricação`, status: 'FORA_DE_OPERACAO',
    description: 'Motor retirado para avaliação de isolamento (situação fictícia).',
    specs: [spec('Potência', '7,5', 'cv'), spec('Polos', '4'), spec('Tensão', '380', 'V'), spec('Carcaça', '132M')],
    components: MOTOR_COMPONENTS,
  },
  {
    tag: 'CM-401', name: 'Conjunto motobomba de recalque', category: 'CONJUNTO_MOTOBOMBA',
    manufacturer: 'HidroDemo', model: 'HD-M50', serialNumber: 'DEMO-0401',
    location: `${PLANTA} — Linha 4`, status: 'EM_OPERACAO',
    description: 'Bomba e motor em base única com acoplamento elástico.',
    specs: [spec('Vazão de referência', '50', 'm³/h'), spec('Potência', '15', 'cv'), spec('Acoplamento', 'Elástico')],
    components: [
      { name: 'Corpo da bomba', category: 'ESTRUTURA', description: 'Carcaça com voluta.' },
      { name: 'Motor de acionamento', category: 'ELÉTRICO', description: 'Motor de indução trifásico.' },
      { name: 'Acoplamento elástico', category: 'TRANSMISSÃO', partCode: 'AC-E90', inventorySku: 'AC-E90', description: 'Liga motor e bomba.' },
      { name: 'Selo mecânico', category: 'VEDAÇÃO', partCode: 'SM-040', inventorySku: 'SM-040', description: 'Veda o eixo.' },
      { name: 'Rolamento do mancal', category: 'ROTATIVO', partCode: '6208-2Z', inventorySku: 'RL-6208', quantity: 2, description: 'Par de rolamentos.' },
      { name: 'Base metálica', category: 'ESTRUTURA', description: 'Base comum do conjunto.' },
    ],
  },
  {
    tag: 'TR-501', name: 'Transmissão por correias', category: 'COMPONENTE_MECANICO',
    manufacturer: 'TransDemo', model: 'TD-B2', serialNumber: 'DEMO-0501',
    location: `${PLANTA} — Linha 5`, status: 'EM_OPERACAO',
    description: 'Transmissão em V com duas correias e proteção.',
    specs: [spec('Perfil da correia', 'B68'), spec('Correias', '2', 'un'), spec('Polia motora', '250', 'mm')],
    components: [
      { name: 'Polia motora', category: 'TRANSMISSÃO', partCode: 'PL-B250', inventorySku: 'PL-B250', description: 'Polia do lado do motor.' },
      { name: 'Polia movida', category: 'TRANSMISSÃO', description: 'Polia do lado da bomba.' },
      { name: 'Correia em V', category: 'TRANSMISSÃO', partCode: 'CV-B68', inventorySku: 'CV-B68', quantity: 2, description: 'Par de correias.' },
      { name: 'Proteção da transmissão', category: 'SEGURANÇA', description: 'Grade de proteção das partes móveis.' },
    ],
  },
];
