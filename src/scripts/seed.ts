//src/scripts/seed.ts
import { supabase } from '../lib/supabase';

async function seedDatabase() {
  console.log('Démarrage du remplissage de la base de données...');

  try {
    // Create admin user
    console.log('Création de l\'utilisateur admin...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'admin@restaurant.com',
      password: 'Admin123456!',
    });

    if (authError) {
      console.log('Utilisateur admin déjà existant ou erreur:', authError.message);
    } else if (authData.user) {
      console.log('Utilisateur admin créé:', authData.user.id);

      // Create profile
      await supabase.from('profiles').insert({
        id: authData.user.id,
        email: 'admin@restaurant.com',
        full_name: 'Administrateur',
        role: 'admin',
      });

      console.log('Profil admin créé');
    }

    // Get admin user ID for seeding data
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@restaurant.com')
      .single();

    const adminId = userData?.id || '00000000-0000-0000-0000-000000000000';

    // Seed suppliers
    console.log('Ajout des fournisseurs...');
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .insert([
        {
          name: 'Fournisseur Premium Foods',
          contact_person: 'Jean Dupont',
          phone: '+243 123 456 789',
          email: 'contact@premiumfoods.cd',
          address: 'Kinshasa, République Démocratique du Congo',
          notes: 'Fournisseur principal de produits alimentaires',
          created_by: adminId,
        },
        {
          name: 'Distributeur Boissons Congo',
          contact_person: 'Marie Mbuyi',
          phone: '+243 987 654 321',
          email: 'info@boissons-congo.cd',
          address: 'Kinshasa, République Démocratique du Congo',
          notes: 'Spécialisé en boissons et alcools',
          created_by: adminId,
        },
        {
          name: 'Fruits et Légumes Frais',
          contact_person: 'Pierre Kabuyi',
          phone: '+243 555 111 222',
          email: 'fresh@fruitslegumes.cd',
          address: 'Kinshasa, République Démocratique du Congo',
          notes: 'Produits frais quotidiens',
          created_by: adminId,
        },
      ])
      .select();

    if (suppliersError) {
      console.log('Erreur fournisseurs:', suppliersError.message);
    } else {
      console.log(`${suppliers?.length || 0} fournisseurs ajoutés`);
    }

    // Seed inventory items
    console.log('Ajout des articles d\'inventaire...');
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .insert([
        {
          name: 'Farine de blé',
          description: 'Farine premium pour pâtisserie',
          unit: 'kg',
          current_quantity: 50,
          min_quantity: 10,
          unit_cost: 2500,
          category: 'Produits secs',
          created_by: adminId,
        },
        {
          name: 'Huile de cuisine',
          description: 'Huile de palme raffinée',
          unit: 'L',
          current_quantity: 30,
          min_quantity: 5,
          unit_cost: 8000,
          category: 'Huiles',
          created_by: adminId,
        },
        {
          name: 'Tomate fraîche',
          description: 'Tomates rouges mûres',
          unit: 'kg',
          current_quantity: 25,
          min_quantity: 5,
          unit_cost: 3000,
          category: 'Légumes',
          created_by: adminId,
        },
        {
          name: 'Oignon blanc',
          description: 'Oignons de qualité',
          unit: 'kg',
          current_quantity: 20,
          min_quantity: 3,
          unit_cost: 2000,
          category: 'Légumes',
          created_by: adminId,
        },
        {
          name: 'Riz blanc',
          description: 'Riz long grain',
          unit: 'kg',
          current_quantity: 100,
          min_quantity: 20,
          unit_cost: 5000,
          category: 'Produits secs',
          created_by: adminId,
        },
        {
          name: 'Sel iodé',
          description: 'Sel de table iodé',
          unit: 'kg',
          current_quantity: 15,
          min_quantity: 2,
          unit_cost: 1500,
          category: 'Produits secs',
          created_by: adminId,
        },
        {
          name: 'Sucre cristallisé',
          description: 'Sucre blanc cristallisé',
          unit: 'kg',
          current_quantity: 40,
          min_quantity: 10,
          unit_cost: 4000,
          category: 'Produits secs',
          created_by: adminId,
        },
        {
          name: 'Eau minérale',
          description: 'Bouteille 1.5L',
          unit: 'bouteille',
          current_quantity: 200,
          min_quantity: 30,
          unit_cost: 1200,
          category: 'Boissons',
          created_by: adminId,
        },
      ])
      .select();

    if (itemsError) {
      console.log('Erreur inventaire:', itemsError.message);
    } else {
      console.log(`${items?.length || 0} articles ajoutés`);
    }

    // Seed expenses
    console.log('Ajout des dépenses...');
    const { data: categories } = await supabase
      .from('expense_categories')
      .select('id')
      .limit(6);

    if (categories && categories.length > 0) {
      const expenseData = [
        {
          category_id: categories[0].id,
          amount: 500000,
          expense_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_method: 'cash',
          description: 'Loyer mensuel novembre',
          created_by: adminId,
        },
        {
          category_id: categories[1].id,
          amount: 300000,
          expense_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_method: 'mobile_money',
          description: 'Salaires du personnel',
          created_by: adminId,
        },
        {
          category_id: categories[2].id,
          amount: 50000,
          expense_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_method: 'cash',
          description: 'Facture d\'eau',
          created_by: adminId,
        },
        {
          category_id: categories[3].id,
          amount: 80000,
          expense_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_method: 'cash',
          description: 'Facture d\'électricité',
          created_by: adminId,
        },
        {
          category_id: categories[4].id,
          amount: 30000,
          expense_date: new Date().toISOString().split('T')[0],
          payment_method: 'mobile_money',
          description: 'Abonnement internet',
          created_by: adminId,
        },
      ];

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select();

      if (expensesError) {
        console.log('Erreur dépenses:', expensesError.message);
      } else {
        console.log(`${expenses?.length || 0} dépenses ajoutées`);
      }
    }

    // Seed sales
    console.log('Ajout des ventes...');
    const salesData = [
      {
        sale_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_amount: 150000,
        payment_method: 'cash',
        entry_method: 'manual',
        created_by: adminId,
      },
      {
        sale_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_amount: 200000,
        payment_method: 'mobile_money',
        entry_method: 'manual',
        created_by: adminId,
      },
      {
        sale_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_amount: 175000,
        payment_method: 'cash',
        entry_method: 'manual',
        created_by: adminId,
      },
      {
        sale_date: new Date().toISOString().split('T')[0],
        total_amount: 220000,
        payment_method: 'mobile_money',
        entry_method: 'manual',
        created_by: adminId,
      },
    ];

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .insert(salesData)
      .select();

    if (salesError) {
      console.log('Erreur ventes:', salesError.message);
    } else {
      console.log(`${sales?.length || 0} ventes ajoutées`);

      // Seed sale items
      if (sales && sales.length > 0) {
        const saleItems = [
          {
            sale_id: sales[0].id,
            item_name: 'Riz au poulet',
            quantity: 20,
            unit_price: 5000,
            total_price: 100000,
          },
          {
            sale_id: sales[0].id,
            item_name: 'Eau minérale',
            quantity: 20,
            unit_price: 2500,
            total_price: 50000,
          },
          {
            sale_id: sales[1].id,
            item_name: 'Pizza Margherita',
            quantity: 15,
            unit_price: 10000,
            total_price: 150000,
          },
          {
            sale_id: sales[1].id,
            item_name: 'Jus naturel',
            quantity: 10,
            unit_price: 5000,
            total_price: 50000,
          },
          {
            sale_id: sales[2].id,
            item_name: 'Ugali',
            quantity: 25,
            unit_price: 5000,
            total_price: 125000,
          },
          {
            sale_id: sales[2].id,
            item_name: 'Relish',
            quantity: 10,
            unit_price: 5000,
            total_price: 50000,
          },
          {
            sale_id: sales[3].id,
            item_name: 'Poulet grillé',
            quantity: 15,
            unit_price: 12000,
            total_price: 180000,
          },
          {
            sale_id: sales[3].id,
            item_name: 'Salade',
            quantity: 8,
            unit_price: 5000,
            total_price: 40000,
          },
        ];

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) {
          console.log('Erreur articles de vente:', itemsError.message);
        } else {
          console.log(`${saleItems.length} articles de vente ajoutés`);
        }
      }
    }

    console.log('Base de données remplie avec succès!');
  } catch (error) {
    console.error('Erreur:', error);
  }
}

seedDatabase();
