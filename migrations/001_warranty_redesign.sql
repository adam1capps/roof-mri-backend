-- Warranty Management Workflow Migration
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ── Owners table (property owners / customers) ──────────────────
CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Properties table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES owners(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Roofs table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roofs (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  roof_type TEXT,
  size_sqft NUMERIC,
  year_installed INTEGER,
  condition TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Roof warranties table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS roof_warranties (
  id SERIAL PRIMARY KEY,
  roof_id INTEGER REFERENCES roofs(id) ON DELETE CASCADE,
  manufacturer TEXT,
  warranty_type TEXT,
  start_date DATE,
  end_date DATE,
  covered_amount NUMERIC,
  maintenance_plan TEXT,
  repair_spend_last_year NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Claims table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  warranty_id INTEGER REFERENCES roof_warranties(id) ON DELETE CASCADE,
  claim_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  amount NUMERIC,
  status TEXT DEFAULT 'pending',
  invoice_id TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  invoice_number TEXT,
  amount NUMERIC,
  description TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inspections table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  roof_id INTEGER REFERENCES roofs(id) ON DELETE CASCADE,
  inspection_date DATE DEFAULT CURRENT_DATE,
  inspector TEXT,
  findings TEXT,
  moisture_readings JSONB,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Photos table (base64 storage) ──────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  filename TEXT,
  mime_type TEXT,
  data TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_roofs_property ON roofs(property_id);
CREATE INDEX IF NOT EXISTS idx_warranties_roof ON roof_warranties(roof_id);
CREATE INDEX IF NOT EXISTS idx_claims_warranty ON claims(warranty_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property ON invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_inspections_roof ON inspections(roof_id);
CREATE INDEX IF NOT EXISTS idx_photos_entity ON photos(entity_type, entity_id);
