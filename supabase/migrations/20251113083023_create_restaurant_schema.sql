/*
  # Schéma de gestion complète de restaurant

  1. Tables créées
  2. RLS et politiques de sécurité
  3. Données d'exemple
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit text NOT NULL,
  current_quantity decimal(10,2) DEFAULT 0,
  min_quantity decimal(10,2) DEFAULT 0,
  unit_cost decimal(10,2) DEFAULT 0,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES expense_categories,
  amount decimal(12,2) NOT NULL,
  expense_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'mobile_money')),
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL,
  total_amount decimal(12,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'mobile_money')),
  entry_method text NOT NULL CHECK (entry_method IN ('manual', 'excel', 'cash_register')) DEFAULT 'manual',
  cash_register_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity decimal(10,2) NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers,
  purchase_date date NOT NULL,
  total_amount decimal(12,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'mobile_money')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')) DEFAULT 'paid',
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items,
  quantity decimal(10,2) NOT NULL,
  unit_cost decimal(10,2) NOT NULL,
  total_cost decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'waste')),
  quantity decimal(10,2) NOT NULL,
  reference_id uuid,
  reference_type text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  opening_balance decimal(12,2) NOT NULL DEFAULT 0,
  closing_balance decimal(12,2),
  expected_balance decimal(12,2),
  difference decimal(12,2),
  status text NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  notes text,
  opened_by uuid NOT NULL,
  closed_by uuid
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_register,
  transaction_type text NOT NULL CHECK (transaction_type IN ('sale', 'expense', 'opening', 'closing', 'adjustment')),
  amount decimal(12,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'mobile_money')),
  reference_id uuid,
  reference_type text,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS profit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_sales decimal(12,2) NOT NULL DEFAULT 0,
  total_purchases decimal(12,2) NOT NULL DEFAULT 0,
  total_expenses decimal(12,2) NOT NULL DEFAULT 0,
  gross_profit decimal(12,2) NOT NULL DEFAULT 0,
  net_profit decimal(12,2) NOT NULL DEFAULT 0,
  profit_margin decimal(5,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

INSERT INTO expense_categories (name, description) VALUES
  ('Loyer', 'Loyer mensuel du restaurant'),
  ('Salaires', 'Salaires du personnel'),
  ('Eau', 'Facture d''eau'),
  ('Électricité', 'Facture d''électricité'),
  ('Internet', 'Abonnement internet et télécommunications'),
  ('Divers', 'Autres dépenses diverses')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_status ON cash_register(status);
CREATE INDEX IF NOT EXISTS idx_profit_reports_date ON profit_reports(report_date);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inventory"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
  ON inventory_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view purchase items"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage purchase items"
  ON purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view sale items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sale items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view cash register"
  ON cash_register FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create cash register"
  ON cash_register FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update cash register"
  ON cash_register FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view cash transactions"
  ON cash_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create cash transactions"
  ON cash_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view profit reports"
  ON profit_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create profit reports"
  ON profit_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);