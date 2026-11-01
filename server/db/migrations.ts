// Migrações em ordem. PRAGMA user_version guarda quantas já foram aplicadas.
export const migrations: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('MECANICO', 'SUPERVISOR'))
  );

  CREATE TABLE equipment (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT,
    location TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    specs_json TEXT NOT NULL DEFAULT '[]',
    image_path TEXT,
    model_path TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_equipment_category ON equipment(category);
  CREATE INDEX idx_equipment_status ON equipment(status);

  CREATE TABLE inventory_items (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity_on_hand REAL NOT NULL,
    storage_location TEXT NOT NULL
  );

  CREATE TABLE components (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    part_code TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    model_node TEXT,
    inventory_sku TEXT REFERENCES inventory_items(sku),
    description TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_components_equipment ON components(equipment_id);

  CREATE TABLE maintenance_records (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES equipment(id),
    occurred_at TEXT NOT NULL,
    reported_problem TEXT NOT NULL,
    inspection TEXT NOT NULL,
    identified_cause TEXT,
    work_performed TEXT NOT NULL,
    observations TEXT,
    technician_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_records_equipment ON maintenance_records(equipment_id, occurred_at DESC);

  CREATE TABLE maintenance_parts (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('REMOVED', 'INSTALLED')),
    component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
    inventory_sku TEXT REFERENCES inventory_items(sku),
    description TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0)
  );
  CREATE INDEX idx_parts_record ON maintenance_parts(record_id);

  CREATE TABLE maintenance_photos (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('BEFORE', 'AFTER')),
    path TEXT NOT NULL,
    caption TEXT,
    is_illustrative INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_photos_record ON maintenance_photos(record_id);

  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    file_path TEXT,
    is_illustrative INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE document_equipment (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, equipment_id)
  );

  CREATE TABLE document_sections (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    heading TEXT NOT NULL,
    body TEXT NOT NULL
  );
  CREATE INDEX idx_sections_document ON document_sections(document_id, position);

  CREATE TABLE maintenance_documents (
    record_id TEXT NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, document_id)
  );

  CREATE TABLE ai_confirmations (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    conclusion TEXT NOT NULL,
    record_id TEXT REFERENCES maintenance_records(id) ON DELETE SET NULL,
    confirmed_by TEXT NOT NULL REFERENCES users(id),
    confirmed_at TEXT NOT NULL
  );
  CREATE INDEX idx_confirmations_equipment ON ai_confirmations(equipment_id);

  CREATE VIRTUAL TABLE search_index USING fts5(
    entity_type UNINDEXED,
    entity_id UNINDEXED,
    parent_id UNINDEXED,
    title,
    body,
    tokenize = "unicode61 remove_diacritics 2"
  );
  `,
  `
  ALTER TABLE maintenance_records ADD COLUMN work_area TEXT;
  ALTER TABLE maintenance_records ADD COLUMN resulting_status TEXT;
  `,
];
