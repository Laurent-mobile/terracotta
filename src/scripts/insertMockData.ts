//src/scripts/insertMockData.ts
import { supabase } from '../lib/supabase';

export async function insertMockData() {
  console.log('Insertion des données mockées...');

  try {
    // Récupérer l'admin user
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (!users || users.length === 0) {
      console.error('Aucun admin trouvé');
      return;
    }

    const adminId = users[0].id;

    // 1. Catégories de dépenses
    const { data: expenseCategories } = await supabase
      .from('expense_categories')
      .insert([
        { name: 'Loyer', description: 'Loyer du local' },
        { name: 'Salaires', description: 'Salaires du personnel' },
        { name: 'Eau et Électricité', description: 'Factures utilities' },
        { name: 'Achats Alimentaires', description: 'Ingrédients et produits' },
        { name: 'Équipement', description: 'Achat et maintenance équipement' },
        { name: 'Divers', description: 'Autres dépenses' },
      ])
      .select();

    console.log('✅ Catégories de dépenses créées');

    // 2. Fournisseurs
    const { data: suppliers } = await supabase
      .from('suppliers')
      .insert([
        {
          name: 'Market Fresh',
          contact_person: 'Jean Kabasele',
          phone: '+243 81 234 5678',
          email: 'contact@marketfresh.cd',
          address: 'Kinshasa, Gombe',
          notes: 'Fournisseur fruits et légumes',
          created_by: adminId,
        },
        {
          name: 'Meat & Co',
          contact_person: 'Sarah Mbayo',
          phone: '+243 82 345 6789',
          email: 'info@meatco.cd',
          address: 'Kinshasa, Lingwala',
          notes: 'Fournisseur viandes et volailles',
          created_by: adminId,
        },
      ])
      .select();

    console.log('✅ Fournisseurs créés');

    // 3. Articles d'inventaire
    const { data: inventoryItems } = await supabase
      .from('inventory_items')
      .insert([
        {
          name: 'Riz Basmati',
          description: 'Riz long grain premium',
          unit: 'kg',
          current_quantity: 100,
          min_quantity: 20,
          unit_cost: 3500,
          category: 'Céréales',
          created_by: adminId,
        },
        {
          name: 'Poulet Fermier',
          description: 'Poulet fermier frais',
          unit: 'kg',
          current_quantity: 25,
          min_quantity: 5,
          unit_cost: 12000,
          category: 'Viandes',
          created_by: adminId,
        },
        {
          name: 'Tomates',
          description: 'Tomates rouges mûres',
          unit: 'kg',
          current_quantity: 30,
          min_quantity: 5,
          unit_cost: 2500,
          category: 'Légumes',
          created_by: adminId,
        },
        {
          name: 'Huile de Palme',
          description: 'Huile rouge traditionnelle',
          unit: 'L',
          current_quantity: 40,
          min_quantity: 10,
          unit_cost: 6000,
          category: 'Condiments',
          created_by: adminId,
        },
      ])
      .select();

    console.log('✅ Articles d\'inventaire créés');

    // 4. Dépenses exemple
    if (expenseCategories && expenseCategories.length > 0) {
      await supabase
        .from('expenses')
        .insert([
          {
            category_id: expenseCategories[0].id, // Loyer
            amount: 500000,
            expense_date: new Date().toISOString().split('T')[0],
            payment_method: 'cash',
            description: 'Loyer mensuel décembre',
            created_by: adminId,
          },
          {
            category_id: expenseCategories[3].id, // Achats
            amount: 350000,
            expense_date: new Date().toISOString().split('T')[0],
            payment_method: 'mobile_money',
            description: 'Achat ingrédients semaine',
            created_by: adminId,
          },
        ]);

      console.log('✅ Dépenses créées');
    }

    // 5. Ventes exemple
    const { data: sales } = await supabase
      .from('sales')
      .insert([
        {
          sale_date: new Date().toISOString().split('T')[0],
          total_amount: 75000,
          payment_method: 'cash',
          entry_method: 'manual',
          notes: 'Vente déjeuner',
          created_by: adminId,
        },
        {
          sale_date: new Date().toISOString().split('T')[0],
          total_amount: 120000,
          payment_method: 'mobile_money',
          entry_method: 'manual',
          notes: 'Vente dîner groupe',
          created_by: adminId,
        },
      ])
      .select();

    console.log('✅ Ventes créées');

    console.log('🎉 Données mockées insérées avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion:', error);
  }
}

// Exécuter le script
insertMockData();
