import { z } from 'zod';

export const EQUIPMENT_CATEGORIES = [
  'BOMBA_CENTRIFUGA',
  'BOMBA_SUBMERSIVEL',
  'MOTOR_ELETRICO',
  'CONJUNTO_MOTOBOMBA',
  'COMPONENTE_MECANICO',
] as const;

export const WORK_AREAS = [
  'ETI', 'ETA', 'Fabricação', 'Linha 1', 'Linha 2', 'Linha 3', 'Linha 4', 'Linha 5', 'Linha 6',
] as const;

export const EQUIPMENT_STATUSES = [
  'EM_OPERACAO',
  'EM_MANUTENCAO',
  'AGUARDANDO_PECA',
  'FORA_DE_OPERACAO',
] as const;

export const DOCUMENT_TYPES = [
  'MANUAL',
  'ESPECIFICACAO',
  'PROCEDIMENTO',
  'COMPONENTE',
] as const;

export const equipmentCategory = z.enum(EQUIPMENT_CATEGORIES);
export const equipmentStatus = z.enum(EQUIPMENT_STATUSES);
export const documentType = z.enum(DOCUMENT_TYPES);
export const partDirection = z.enum(['REMOVED', 'INSTALLED']);
export const photoStage = z.enum(['BEFORE', 'AFTER']);

const text = (max: number) => z.string().trim().min(1, 'Campo obrigatório').max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || undefined);

export const specSchema = z.object({
  label: text(80),
  value: text(80),
  unit: z.string().trim().max(20).optional(),
});

export const equipmentCreateSchema = z.object({
  tag: z.string().trim().regex(/^[A-Z]{2,4}-\d{2,4}$/, 'Use o formato XX-000'),
  name: text(120),
  category: equipmentCategory,
  manufacturer: text(80),
  model: text(80),
  serialNumber: optionalText(60),
  location: text(120),
  status: equipmentStatus,
  description: z.string().trim().max(2000).default(''),
  specs: z.array(specSchema).max(40).default([]),
});

export const equipmentUpdateSchema = equipmentCreateSchema.partial().omit({ tag: true });

export const componentCreateSchema = z.object({
  name: text(120),
  category: text(40),
  partCode: optionalText(40),
  quantity: z.number().positive().default(1),
  modelNode: optionalText(80),
  inventorySku: optionalText(40),
  description: z.string().trim().max(1000).default(''),
});

export const componentUpdateSchema = componentCreateSchema.partial();

export const maintenancePartSchema = z
  .object({
    direction: partDirection,
    componentId: z.string().min(1).optional(),
    inventorySku: z.string().min(1).optional(),
    description: text(160),
    quantity: z.number().positive('Quantidade deve ser maior que zero'),
  });

const isPastOrNow = (iso: string) => new Date(iso).getTime() <= Date.now() + 60_000;

const maintenanceFields = {
  equipmentId: z.string().min(1, 'Selecione o equipamento'),
  occurredAt: z.iso
    .datetime({ offset: true, message: 'Data e hora inválidas' })
    .refine(isPastOrNow, 'A data não pode estar no futuro'),
  reportedProblem: text(2000),
  inspection: text(4000),
  identifiedCause: optionalText(2000),
  workPerformed: text(4000),
  observations: optionalText(2000),
  technicianId: z.string().min(1, 'Informe o técnico'),
  workArea: z.enum(WORK_AREAS, 'Escolha onde foi feito').optional(),
  parts: z.array(maintenancePartSchema).max(60).default([]),
  documentIds: z.array(z.string().min(1)).max(20).default([]),
  resultingStatus: equipmentStatus.optional(),
};

export const maintenanceCreateSchema = z.object(maintenanceFields);

export const maintenanceUpdateSchema = z.object({
  occurredAt: maintenanceFields.occurredAt.optional(),
  reportedProblem: maintenanceFields.reportedProblem.optional(),
  inspection: maintenanceFields.inspection.optional(),
  identifiedCause: maintenanceFields.identifiedCause,
  workPerformed: maintenanceFields.workPerformed.optional(),
  observations: maintenanceFields.observations,
  workArea: maintenanceFields.workArea,
  parts: z.array(maintenancePartSchema).max(60).optional(),
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export const reportDateSchema = z.iso.date('Data inválida');

export const photoMetaSchema = z.object({
  stage: photoStage,
  caption: optionalText(200),
});

export const documentUploadSchema = z.object({
  title: text(160),
  docType: documentType,
  summary: z.string().trim().max(2000).default(''),
  equipmentIds: z.array(z.string().min(1)).default([]),
});

export const askSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  question: text(1000),
});

export const confirmationSchema = z.object({
  equipmentId: z.string().min(1),
  ruleId: z.string().min(1),
  conclusion: text(2000),
  recordId: z.string().min(1).optional(),
});

export type EquipmentCreate = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdate = z.infer<typeof equipmentUpdateSchema>;
export type ComponentCreate = z.infer<typeof componentCreateSchema>;
export type ComponentUpdate = z.infer<typeof componentUpdateSchema>;
export type MaintenanceCreate = z.infer<typeof maintenanceCreateSchema>;
export type MaintenanceUpdate = z.infer<typeof maintenanceUpdateSchema>;
export type MaintenancePart = z.infer<typeof maintenancePartSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type Ask = z.infer<typeof askSchema>;
export type ConfirmationInput = z.infer<typeof confirmationSchema>;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];
export type Spec = z.infer<typeof specSchema>;

export type AiBlockType =
  | 'FATO_HISTORICO'
  | 'HIPOTESE_IA'
  | 'INSPECAO_RECOMENDADA'
  | 'CONCLUSAO_HUMANA';

export interface AiCitation {
  kind: 'MANUTENCAO' | 'DOCUMENTO';
  id: string;
  label: string;
  excerpt?: string;
}

export interface AiBlock {
  type: AiBlockType;
  text: string;
  why?: string;
  ruleId?: string;
  citations: AiCitation[];
}

export interface AiAnswer {
  mode: 'DEMONSTRACAO';
  notice: string;
  insufficientData: boolean;
  blocks: AiBlock[];
}
