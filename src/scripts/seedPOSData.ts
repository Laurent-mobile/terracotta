// src/scripts/seedPOSData.ts
import { supabase } from '../lib/supabase';

export async function seedPOSData() {
  console.log('Seeding POS data...');

  try {
    // Nettoyer les données existantes
    await supabase.from('pos_tables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('pos_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('pos_menus').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Créer des catégories
    const { data: categories } = await supabase
      .from('pos_categories')
      .insert([
        { name: 'Entrées', display_order: 1 },
        { name: 'Plats Principaux', display_order: 2 },
        { name: 'Desserts', display_order: 3 },
        { name: 'Boissons', display_order: 4 },
      ])
      .select();

    if (!categories) throw new Error('Failed to create categories');

    // Créer des éléments de menu
    await supabase
      .from('pos_menus')
      .insert([
        // Entrées
        { 
          category_id: categories[0].id, 
          name: 'Salade César', 
          description: 'Laitue romaine, croûtons, parmesan, sauce césar',
          price: 12000, 
          preparation_time: 10 
        },
        { 
          category_id: categories[0].id, 
          name: 'Soupe du Jour', 
          description: 'Soupe fraîche préparée quotidiennement',
          price: 8000, 
          preparation_time: 5 
        },
        
        // Plats principaux
        { 
          category_id: categories[1].id, 
          name: 'Poulet Braisé', 
          description: 'Poulet mariné aux épices, servi avec frites',
          price: 25000, 
          preparation_time: 20 
        },
        { 
          category_id: categories[1].id, 
          name: 'Poisson Grillé', 
          description: 'Filet de capitaine grillé, riz et légumes',
          price: 22000, 
          preparation_time: 15 
        },
        { 
          category_id: categories[1].id, 
          name: 'Riz Cantonais', 
          description: 'Riz sauté aux légumes et œuf',
          price: 15000, 
          preparation_time: 12 
        },
        
        // Desserts
        { 
          category_id: categories[2].id, 
          name: 'Fruit de Saison', 
          description: 'Assortiment de fruits frais de saison',
          price: 6000, 
          preparation_time: 5 
        },
        { 
          category_id: categories[2].id, 
          name: 'Glace Vanille', 
          description: 'Boule de glace vanille maison',
          price: 8000, 
          preparation_time: 2 
        },
        
        // Boissons
        { 
          category_id: categories[3].id, 
          name: 'Eau Minérale', 
          description: 'Bouteille 50cl',
          price: 2000, 
          preparation_time: 1 
        },
        { 
          category_id: categories[3].id, 
          name: 'Jus d\'Orange', 
          description: 'Jus pressé frais',
          price: 5000, 
          preparation_time: 3 
        },
        { 
          category_id: categories[3].id, 
          name: 'Coca-Cola', 
          description: 'Canette 33cl',
          price: 3000, 
          preparation_time: 1 
        },
      ]);

    // Créer des tables
    await supabase
      .from('pos_tables')
      .insert([
        { table_number: 1, capacity: 4, status: 'available' },
        { table_number: 2, capacity: 4, status: 'available' },
        { table_number: 3, capacity: 6, status: 'available' },
        { table_number: 4, capacity: 2, status: 'available' },
        { table_number: 5, capacity: 8, status: 'available' },
        { table_number: 6, capacity: 4, status: 'available' },
        { table_number: 7, capacity: 4, status: 'occupied' },
        { table_number: 8, capacity: 6, status: 'reserved' },
      ]);

    console.log('POS data seeded successfully!');
  } catch (error) {
    console.error('Error seeding POS data:', error);
  }
}
