/*
  # Point of Sale (POS) System for Restaurant

  1. New Tables
    - `pos_categories` - Menu categories
    - `pos_menus` - Menu items available for sale
    - `pos_tables` - Restaurant tables
    - `pos_orders` - Customer orders linked to tables
    - `pos_order_items` - Items in each order
    - `pos_payments` - Payment records for orders
    - `pos_transactions` - Transaction history

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to manage POS operations
    - Policies for order data access and modifications

  3. Features
    - Multiple tables with status tracking
    - Order items with quantity and pricing
    - Payment tracking with methods
    - Receipt generation capability
*/

CREATE TABLE IF NOT EXISTS pos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES pos_categories,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  image_url text,
  is_available boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL UNIQUE,
  capacity integer NOT NULL DEFAULT 4,
  is_active boolean DEFAULT true,
  status text NOT NULL CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES pos_tables,
  table_number integer NOT NULL,
  order_number text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'ready', 'paid', 'closed')) DEFAULT 'open',
  subtotal decimal(12,2) DEFAULT 0,
  tax_amount decimal(12,2) DEFAULT 0,
  total_amount decimal(12,2) DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash', 'card', 'mobile_money')) NULL,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES pos_orders ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES pos_menus,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(12,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES pos_orders,
  amount_paid decimal(12,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_money')),
  change_amount decimal(12,2) DEFAULT 0,
  payment_reference text,
  notes text,
  receipt_number text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('order', 'payment', 'refund', 'discount')),
  related_order_id uuid REFERENCES pos_orders,
  related_payment_id uuid REFERENCES pos_payments,
  amount decimal(12,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

INSERT INTO pos_categories (name, description, display_order) VALUES
  ('Boissons', 'Boissons froides et chaudes', 1),
  ('Plats principaux', 'Plats complets', 2),
  ('Entrées', 'Entrées et starters', 3),
  ('Desserts', 'Desserts et sucreries', 4),
  ('Snacks', 'Petit déjeuner et snacks', 5)
ON CONFLICT DO NOTHING;

INSERT INTO pos_menus (category_id, name, description, price)
WITH cat AS (
  SELECT id, name FROM pos_categories
)
SELECT 
  c.id,
  v.item_name,
  v.item_desc,
  v.item_price
FROM (
  VALUES
    ('Boissons', 'Eau minérale', 'Bouteille 1.5L', 1500::decimal),
    ('Boissons', 'Jus naturel', 'Jus frais du jour', 2500::decimal),
    ('Boissons', 'Coca Cola', 'Boisson gazeuse', 2000::decimal),
    ('Boissons', 'Bière locale', 'Bière 33cl', 3500::decimal),
    ('Plats principaux', 'Riz au poulet', 'Riz avec poulet sauce', 8000::decimal),
    ('Plats principaux', 'Ugali', 'Ugali avec relish', 6000::decimal),
    ('Plats principaux', 'Poulet grillé', 'Poulet grillé complet', 12000::decimal),
    ('Plats principaux', 'Poisson grillé', 'Poisson frais du jour', 14000::decimal),
    ('Entrées', 'Salade mixte', 'Salade fraîche', 4000::decimal),
    ('Entrées', 'Beignets', 'Beignets maison', 2500::decimal),
    ('Desserts', 'Gâteau', 'Gâteau maison', 5000::decimal),
    ('Desserts', 'Fruit frais', 'Assiette de fruits', 3500::decimal),
    ('Snacks', 'Pain grillé', 'Pain avec beurre', 2000::decimal),
    ('Snacks', 'Omelette', 'Omelette 2 oeufs', 3500::decimal)
) v(cat_name, item_name, item_desc, item_price)
JOIN cat c ON c.name = v.cat_name
WHERE NOT EXISTS (SELECT 1 FROM pos_menus WHERE name = v.item_name)
ON CONFLICT DO NOTHING;

INSERT INTO pos_tables (table_number, capacity)
SELECT v.table_num, v.cap
FROM (
  VALUES
    (1, 2), (2, 2), (3, 2), (4, 4),
    (5, 4), (6, 4), (7, 6), (8, 6)
) v(table_num, cap)
WHERE NOT EXISTS (SELECT 1 FROM pos_tables WHERE table_number = v.table_num)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_pos_orders_table ON pos_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created ON pos_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_order ON pos_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_order ON pos_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_tables_status ON pos_tables(status);
CREATE INDEX IF NOT EXISTS idx_pos_tables_number ON pos_tables(table_number);
CREATE INDEX IF NOT EXISTS idx_pos_menus_category ON pos_menus(category_id);

ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON pos_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view menus"
  ON pos_menus FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can view tables"
  ON pos_tables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update table status"
  ON pos_tables FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view orders"
  ON pos_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create orders"
  ON pos_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON pos_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view order items"
  ON pos_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage order items"
  ON pos_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order items"
  ON pos_order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete order items"
  ON pos_order_items FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view payments"
  ON pos_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON pos_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view transactions"
  ON pos_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create transactions"
  ON pos_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);
