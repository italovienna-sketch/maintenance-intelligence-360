// Base de conhecimento do modo demonstração: regras escritas à mão, sem modelo de linguagem.
// "symptomTerms" reconhece o sintoma; "evidenceTerms" busca evidências no histórico e nos documentos.
export interface DiagnosticRule {
  id: string;
  symptom: string;
  symptomTerms: string[];
  evidenceTerms: string;
  appliesTo: string[];
  hypotheses: { text: string; why: string }[];
  inspections: string[];
}

export const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  {
    id: 'vibracao-mancal',
    symptom: 'Vibração ou ruído no mancal',
    symptomTerms: ['vibra', 'trepida', 'ruido', 'barulho', 'mancal', 'rolamento'],
    evidenceTerms: 'vibracao ruido mancal rolamento desalinhamento',
    appliesTo: ['BOMBA_CENTRIFUGA', 'CONJUNTO_MOTOBOMBA', 'MOTOR_ELETRICO'],
    hypotheses: [
      {
        text: 'Desgaste ou contaminação do rolamento.',
        why: 'Rolamento gasto ou com lubrificante contaminado costuma produzir ruído e vibração crescentes.',
      },
      {
        text: 'Desalinhamento entre motor e bomba.',
        why: 'Desalinhamento carrega o mancal de forma desigual e pode fazer o problema voltar após a troca do rolamento.',
      },
    ],
    inspections: [
      'Verificar nível, cor e presença de partículas no lubrificante.',
      'Conferir folga e ruído do rolamento com o equipamento isolado e bloqueado.',
      'Verificar o alinhamento e o estado da base e dos parafusos de fixação.',
    ],
  },
  {
    id: 'vazamento-selo',
    symptom: 'Vazamento pelo selo',
    symptomTerms: ['vazamento', 'vaza', 'gotejamento', 'pingando', 'selo', 'retentor'],
    evidenceTerms: 'vazamento selo retentor',
    appliesTo: ['BOMBA_CENTRIFUGA', 'BOMBA_SUBMERSIVEL', 'CONJUNTO_MOTOBOMBA'],
    hypotheses: [
      {
        text: 'Desgaste das faces do selo mecânico.',
        why: 'Abrasivos no fluido e operação a seco aceleram o desgaste das faces de vedação.',
      },
      {
        text: 'Anel de vedação danificado na montagem.',
        why: 'Vazamento logo após uma intervenção aponta para dano ou posicionamento incorreto na montagem.',
      },
    ],
    inspections: [
      'Identificar a origem exata do vazamento com o equipamento parado e bloqueado.',
      'Verificar o nível e o aspecto do óleo da câmara de selagem.',
      'Inspecionar o eixo na região do selo quanto a riscos ou corrosão.',
    ],
  },
  {
    id: 'sobrecorrente-entupimento',
    symptom: 'Sobrecorrente, desarme ou queda de vazão',
    symptomTerms: ['corrente', 'sobrecorrente', 'desarme', 'desarmou', 'desarmando', 'entupimento', 'vazao', 'obstrucao'],
    evidenceTerms: 'sobrecorrente desarme entupimento vazao obstrucao',
    appliesTo: ['BOMBA_SUBMERSIVEL', 'BOMBA_CENTRIFUGA', 'CONJUNTO_MOTOBOMBA'],
    hypotheses: [
      {
        text: 'Obstrução do rotor por sólidos ou fibras.',
        why: 'Material preso no rotor aumenta a carga no motor e reduz a vazão.',
      },
      {
        text: 'Desgaste do rotor ou da placa de desgaste.',
        why: 'Aumento da folga interna reduz a vazão e pode mudar a carga do motor.',
      },
    ],
    inspections: [
      'Com o equipamento bloqueado, abrir o acesso e verificar se há sólidos no rotor.',
      'Medir a folga entre o rotor e a placa de desgaste.',
      'Registrar a corrente de cada fase e comparar com a placa do motor.',
    ],
  },
  {
    id: 'aquecimento-motor',
    symptom: 'Aquecimento do motor',
    symptomTerms: ['aquecimento', 'aquecendo', 'quente', 'temperatura', 'superaquecimento'],
    evidenceTerms: 'aquecimento superaquecimento temperatura ventilacao',
    appliesTo: ['MOTOR_ELETRICO', 'CONJUNTO_MOTOBOMBA'],
    hypotheses: [
      {
        text: 'Ventilação deficiente.',
        why: 'Sujeira na carcaça ou na tampa do ventilador reduz a troca de calor.',
      },
      {
        text: 'Sobrecarga ou desequilíbrio entre fases.',
        why: 'Corrente acima da nominal ou desigual entre fases aquece o enrolamento.',
      },
    ],
    inspections: [
      'Limpar e verificar a tampa do ventilador e as aletas da carcaça.',
      'Medir tensão e corrente nas três fases.',
      'Medir a resistência de isolamento com o motor bloqueado.',
    ],
  },
  {
    id: 'correia-transmissao',
    symptom: 'Problema na transmissão por correias',
    symptomTerms: ['correia', 'correias', 'polia', 'patinando', 'chiado', 'tensionamento'],
    evidenceTerms: 'correia polia tensionamento chiado transmissao',
    appliesTo: ['COMPONENTE_MECANICO', 'CONJUNTO_MOTOBOMBA'],
    hypotheses: [
      {
        text: 'Tensão incorreta das correias.',
        why: 'Correia frouxa patina e chia, e correia tensa demais sobrecarrega os mancais.',
      },
      {
        text: 'Desalinhamento ou desgaste das polias.',
        why: 'Polias desalinhadas ou com canal gasto desgastam a correia de forma irregular.',
      },
    ],
    inspections: [
      'Com a transmissão bloqueada, verificar a tensão das correias.',
      'Conferir o alinhamento entre as polias.',
      'Inspecionar os canais das polias e o perfil de desgaste das correias.',
    ],
  },
];
