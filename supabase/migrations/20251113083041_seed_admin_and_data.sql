/*
  # Seed admin user and test data
  
  1. Create admin profile
  2. Insert suppliers
  3. Insert inventory items
  4. Insert expenses
  5. Insert sales and items
*/

DO $$
DECLARE
  admin_id uuid := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (admin_id, 'admin@restaurant.com', 'Administrateur', 'admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO suppliers (name, contact_person, phone, email, address, notes, created_by)
  VALUES
    ('Fournisseur Premium Foods', 'Jean Dupont', '+243 123 456 789', 'contact@premiumfoods.cd', 'Kinshasa, RDC', 'Fournisseur principal', admin_id),
    ('Distributeur Boissons Congo', 'Marie Mbuyi', '+243 987 654 321', 'info@boissons-congo.cd', 'Kinshasa, RDC', 'Spécialisé en boissons', admin_id),
    ('Fruits et Légumes Frais', 'Pierre Kabuyi', '+243 555 111 222', 'fresh@fruitslegumes.cd', 'Kinshasa, RDC', 'Produits frais', admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO inventory_items (name, description, unit, current_quantity, min_quantity, unit_cost, category, created_by)
  VALUES
    ('Farine de blé', 'Farine premium pour pâtisserie', 'kg', 50, 10, 2500, 'Produits secs', admin_id),
    ('Huile de cuisine', 'Huile de palme raffinée', 'L', 30, 5, 8000, 'Huiles', admin_id),
    ('Tomate fraîche', 'Tomates rouges mûres', 'kg', 25, 5, 3000, 'Légumes', admin_id),
    ('Oignon blanc', 'Oignons de qualité', 'kg', 20, 3, 2000, 'Légumes', admin_id),
    ('Riz blanc', 'Riz long grain', 'kg', 100, 20, 5000, 'Produits secs', admin_id),
    ('Sel iodé', 'Sel de table iodé', 'kg', 15, 2, 1500, 'Produits secs', admin_id),
    ('Sucre cristallisé', 'Sucre blanc cristallisé', 'kg', 40, 10, 4000, 'Produits secs', admin_id),
    ('Eau minérale', 'Bouteille 1.5L', 'bouteille', 200, 30, 1200, 'Boissons', admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO expenses (category_id, amount, expense_date, payment_method, description, created_by)
  SELECT 
    (SELECT id FROM expense_categories WHERE name = ec_name),
    amount,
    expense_date,
    payment_method,
    description,
    admin_id
  FROM (
    VALUES
      ('Loyer', 500000, CURRENT_DATE - INTERVAL '10 days', 'cash'::text, 'Loyer mensuel novembre'::text),
      ('Salaires', 300000, CURRENT_DATE - INTERVAL '5 days', 'mobile_money'::text, 'Salaires du personnel'::text),
      ('Eau', 50000, CURRENT_DATE - INTERVAL '3 days', 'cash'::text, 'Facture d''eau'::text),
      ('Électricité', 80000, CURRENT_DATE - INTERVAL '2 days', 'cash'::text, 'Facture d''électricité'::text),
      ('Internet', 30000, CURRENT_DATE, 'mobile_money'::text, 'Abonnement internet'::text)
  ) v(ec_name, amount, expense_date, payment_method, description)
  WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE description = 'Loyer mensuel novembre')
  ON CONFLICT DO NOTHING;

  INSERT INTO sales (sale_date, total_amount, payment_method, entry_method, created_by)
  VALUES
    (CURRENT_DATE - INTERVAL '5 days', 150000, 'cash', 'manual', admin_id),
    (CURRENT_DATE - INTERVAL '3 days', 200000, 'mobile_money', 'manual', admin_id),
    (CURRENT_DATE - INTERVAL '1 days', 175000, 'cash', 'manual', admin_id),
    (CURRENT_DATE, 220000, 'mobile_money', 'manual', admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO sale_items (sale_id, item_name, quantity, unit_price, total_price)
  SELECT 
    s.id,
    item_name,
    quantity,
    unit_price,
    total_price
  FROM (
    SELECT * FROM sales WHERE created_by = admin_id ORDER BY sale_date LIMIT 4
  ) s
  CROSS JOIN LATERAL (
    VALUES
      ('Riz au poulet', 20::decimal, 5000::decimal, 100000::decimal),
      ('Eau minérale', 20::decimal, 2500::decimal, 50000::decimal)
  ) items(item_name, quantity, unit_price, total_price)
  WHERE NOT EXISTS (SELECT 1 FROM sale_items WHERE item_name = 'Riz au poulet')
  ON CONFLICT DO NOTHING;

END $$;