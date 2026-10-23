//src/components/menus/DailyMenusView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ChefHat, Plus, Edit, Trash2, RefreshCw,
  DollarSign, AlertTriangle, Save, Utensils, GlassWater,
  Wine, Beer, Coffee, CupSoda
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  is_available: boolean;
  preparation_time?: number;
  cost_price?: number;
  ingredients?: MenuIngredient[];
  is_active?: boolean;
  category?: {
    id: string;
    name: string;
  };
  sub_category?: string;
  sale_type?: 'bottle' | 'consumption';
  servings_per_bottle?: number;
  current_servings?: number;
}

interface MenuIngredient {
  inventory_item_id: string;
  inventory_item_name: string;
  quantity_required: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

interface InventoryItem {
  id: string;
  name: string;
  current_quantity: number;
  unit: string;
  unit_cost: number;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

type MenuType = 'kitchen' | 'bar';

// Sous-catégories pour le bar avec icônes disponibles
const barSubCategories = {
  'all': { name: 'Toutes', icon: GlassWater },
  'biere': { name: 'Bières', icon: Beer },
  'vin': { name: 'Vins', icon: Wine },
  'whisky': { name: 'Whiskys', icon: GlassWater },
  'cocktail': { name: 'Cocktails', icon: Coffee },
  'champagne': { name: 'Champagnes', icon: Wine },
  'jus': { name: 'Jus et Boissons', icon: CupSoda },
  'sucrerie': { name: 'Sucreries', icon: Coffee },
  'autre': { name: 'Autres', icon: GlassWater }
};

export default function DailyMenusView() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState<MenuType>('kitchen');
  const [activeBarSubCategory, setActiveBarSubCategory] = useState<string>('biere');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    preparation_time: 30,
    is_available: true,
    menu_type: 'kitchen' as MenuType,
    sub_category: 'biere',
    sale_type: 'consumption' as 'bottle' | 'consumption',
    servings_per_bottle: 1,
    current_servings: 0
  });

  const [currentIngredient, setCurrentIngredient] = useState({
    inventory_item_id: '',
    quantity_required: 1
  });

  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);

  // Définir les catégories pour cuisine et bar
  const kitchenCategories = ['Plats principaux', 'Plats', 'Entrées', 'Desserts', 'Spécialités'];
  const barCategories = ['Boissons', 'Cocktails', 'Vins', 'Bières', 'Sans alcool'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [menuRes, inventoryRes, categoriesRes] = await Promise.all([
        supabase
          .from('pos_menus')
          .select(`
            *,
            category:pos_categories(*),
            menu_ingredients(
              inventory_item_id,
              quantity_required,
              unit,
              inventory_items(
                name,
                unit_cost
              )
            )
          `)
          .eq('is_active', true),
        supabase.from('inventory_items').select('*').eq('is_active', true),
        supabase.from('pos_categories').select('*').eq('is_active', true)
      ]);

      if (menuRes.error) throw menuRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      // Transformer les données pour garder la compatibilité
      const menusWithIngredients = (menuRes.data || []).map(menu => ({
        ...menu,
        // S'assurer que tous les champs sont bien inclus avec des valeurs par défaut
        sub_category: menu.sub_category || 'biere',
        sale_type: menu.sale_type || 'bottle',
        servings_per_bottle: menu.servings_per_bottle || 1,
        current_servings: menu.current_servings || 0,
        ingredients: (menu.menu_ingredients || []).map((mi: any) => ({
          inventory_item_id: mi.inventory_item_id,
          inventory_item_name: mi.inventory_items?.name || 'Inconnu',
          quantity_required: mi.quantity_required || 0,
          unit: mi.unit || 'unité',
          unit_cost: mi.inventory_items?.unit_cost || 0,
          total_cost: (mi.quantity_required || 0) * (mi.inventory_items?.unit_cost || 0)
        }))
      }));

      setMenuItems(menusWithIngredients);
      setInventoryItems(inventoryRes.data || []);
      setCategories(categoriesRes.data || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };
// AJOUTEZ cette fonction
const refreshMenus = async () => {
  try {
    console.log('🔄 Rechargement des menus...');
    
    const { data, error } = await supabase
      .from('pos_menus')
      .select(`
        *,
        category:pos_categories(*),
        menu_ingredients(
          inventory_item_id,
          quantity_required,
          unit,
          inventory_items(
            name,
            unit_cost
          )
        )
      `)
      .eq('is_active', true) // SEULEMENT les menus actifs
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transformer les données
    const menusWithIngredients = (data || []).map(menu => ({
      ...menu,
      sub_category: menu.sub_category || 'biere',
      sale_type: menu.sale_type || 'bottle',
      servings_per_bottle: menu.servings_per_bottle || 1,
      current_servings: menu.current_servings || 0,
      ingredients: (menu.menu_ingredients || []).map((mi: any) => ({
        inventory_item_id: mi.inventory_item_id,
        inventory_item_name: mi.inventory_items?.name || 'Inconnu',
        quantity_required: mi.quantity_required || 0,
        unit: mi.unit || 'unité',
        unit_cost: mi.inventory_items?.unit_cost || 0,
        total_cost: (mi.quantity_required || 0) * (mi.inventory_items?.unit_cost || 0)
      }))
    }));

    setMenuItems(menusWithIngredients);
    console.log('✅ Menus rechargés:', menusWithIngredients.length);
    
  } catch (error) {
    console.error('Error refreshing menus:', error);
    alert('Erreur lors du rechargement des menus');
  }
};

// Fonction pour supprimer un menu (soft delete)
const handleDelete = async (menuId: string) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce menu ? Les articles d\'inventaire ne seront pas affectés.')) return;
  
  try {
    console.log('🗑️ Début suppression menu ID:', menuId);
    
    // 1. SOFT DELETE: Mettre à jour seulement les champs du menu
    const { error: updateError } = await supabase
      .from('pos_menus')
      .update({
        is_active: false,        // Marquer comme inactif
        is_available: false,     // Rendre indisponible
        updated_at: new Date().toISOString()
      })
      .eq('id', menuId);

    if (updateError) {
      console.error('❌ Erreur SQL:', updateError);
      throw updateError;
    }

    console.log('✅ Menu marqué comme inactif (soft delete)');

    // 2. Mettre à jour l'état local IMMÉDIATEMENT (optimiste)
    setMenuItems(prev => prev.filter(menu => menu.id !== menuId));
    
    // 3. Rafraîchir depuis la base (optionnel, pour vérification)
    await refreshMenus();
    
    alert('✅ Menu supprimé avec succès ! Les articles d\'inventaire restent intacts.');
    
  } catch (error: any) {
    console.error('❌ Erreur suppression:', error);
    
    // Recharger pour synchroniser avec la base en cas d'erreur
    await refreshMenus();
    
    if (error.code === 'PGRST116') {
      alert('Erreur: Le menu n\'existe pas ou a déjà été supprimé');
    } else if (error.message.includes('row-level security')) {
      alert('Erreur de permissions. Contactez l\'administrateur.');
    } else {
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
    }
  }
};
  
  // Fonction à exécuter une seule fois pour migrer les données
  const migrateExistingMenus = async () => {
    if (!user) return;

    try {
      console.log('🚀 Starting migration of existing menus...');

      // Récupérer tous les menus avec leurs ingrédients dans le champ JSON
      const { data: menus, error } = await supabase
        .from('pos_menus')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      let migratedCount = 0;

      for (const menu of menus || []) {
        // Vérifier si le menu a des ingrédients dans le champ JSON
        if (menu.ingredients && Array.isArray(menu.ingredients) && menu.ingredients.length > 0) {
          
          // Vérifier si des ingrédients existent déjà dans menu_ingredients
          const { data: existingIngredients } = await supabase
            .from('menu_ingredients')
            .select('id')
            .eq('menu_id', menu.id)
            .limit(1);

          // Si aucun ingrédient n'existe dans menu_ingredients, migrer
          if (!existingIngredients || existingIngredients.length === 0) {
            const menuIngredientsData = menu.ingredients.map((ingredient: any) => ({
              menu_id: menu.id,
              inventory_item_id: ingredient.inventory_item_id,
              quantity_required: ingredient.quantity_required,
              unit: ingredient.unit
            }));

            const { error: insertError } = await supabase
              .from('menu_ingredients')
              .insert(menuIngredientsData);

            if (insertError) {
              console.error(`Error migrating menu ${menu.name}:`, insertError);
            } else {
              migratedCount++;
              console.log(`✅ Migrated menu: ${menu.name}`);
            }
          }
        }
      }

      console.log(`🎉 Migration completed! ${migratedCount} menus migrated.`);
      alert(`Migration terminée ! ${migratedCount} menus migrés vers la nouvelle structure.`);

    } catch (error) {
      console.error('Error during migration:', error);
      alert('Erreur lors de la migration des données.');
    }
  };

  // Fonction pour réinitialiser les consommations d'une bouteille
  const resetBottleServings = async (menuId: string) => {
    if (!confirm('Voulez-vous réinitialiser cette bouteille ? Cela remettra les consommations au maximum.')) return;
    
    try {
      const { data: menu, error: fetchError } = await supabase
        .from('pos_menus')
        .select('servings_per_bottle')
        .eq('id', menuId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('pos_menus')
        .update({
          current_servings: menu.servings_per_bottle,
          updated_at: new Date().toISOString()
        })
        .eq('id', menuId);

      if (error) throw error;

      alert('Bouteille réinitialisée avec succès !');
      loadData();
    } catch (error) {
      console.error('Error resetting bottle:', error);
      alert('Erreur lors de la réinitialisation de la bouteille');
    }
  };

  // Filtrer les menus par type (cuisine/bar), sous-catégorie ET recherche
const getFilteredMenus = () => {
  return menuItems.filter(item => {
    // EXCLURE EXPLICITEMENT les menus inactifs
    if (!item.is_active) {
      console.log('Filtré menu inactif:', item.name);
      return false;
    }

    const category = categories.find(cat => cat.id === item.category_id);
    if (!category) {
      console.log('Filtré catégorie non trouvée:', item.category_id);
      return false;
    }

    // Filtre par type (cuisine/bar)
let typeMatches = false;
if (activeTab === 'kitchen') {
  // Pour cuisine, inclure seulement les catégories de cuisine
  typeMatches = kitchenCategories.includes(category.name);
} else {
  // Pour bar, inclure seulement les catégories de bar ET vérifier la sous-catégorie
  typeMatches = barCategories.includes(category.name);

  // Si on est dans une sous-catégorie spécifique, vérifier aussi celle-ci
  if (activeBarSubCategory !== 'all') {
    typeMatches = typeMatches && item.sub_category === activeBarSubCategory;
  }
}

    // Filtre par terme de recherche (si défini)
    let searchMatches = true;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      searchMatches = item.name.toLowerCase().includes(searchLower) ||
                     (item.description && item.description.toLowerCase().includes(searchLower)) ||
                     category.name.toLowerCase().includes(searchLower);
    }

    const shouldShow = typeMatches && searchMatches;

    if (!shouldShow && process.env.NODE_ENV === 'development') {
      console.log('Filtré menu:', {
        name: item.name,
        typeMatches,
        searchMatches,
        category: category.name,
        activeTab
      });
    }

    return shouldShow;
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));;
};
// AJOUTEZ cette fonction temporaire pour déboguer
const debugMenuState = () => {
  console.log('🔍 État actuel des menus:');
  console.log('- Total menus dans state:', menuItems.length);
  console.log('- Menus actifs:', menuItems.filter(m => m.is_active).length);
  console.log('- Menus inactifs:', menuItems.filter(m => !m.is_active).length);
  
  const filtered = getFilteredMenus();
  console.log('- Menus filtrés:', filtered.length);
  console.log('- Détails filtrés:', filtered.map(m => ({
    id: m.id,
    name: m.name,
    is_active: m.is_active,
    is_available: m.is_available
  })));
};
  // Filtrer les catégories selon l'onglet actif
  const getFilteredCategories = () => {
    if (activeTab === 'kitchen') {
      return categories.filter(cat => kitchenCategories.includes(cat.name));
    } else {
      return categories.filter(cat => barCategories.includes(cat.name));
    }
  };

  // Filtrer les articles d'inventaire selon l'onglet actif
  const getFilteredInventoryItems = () => {
    if (activeTab === 'kitchen') {
      return inventoryItems.filter(item => 
        !item.name.toLowerCase().includes('boisson') &&
        !item.name.toLowerCase().includes('vin') &&
        !item.name.toLowerCase().includes('bière') &&
        !item.name.toLowerCase().includes('cocktail')
      );
    } else {
      return inventoryItems.filter(item => 
        item.name.toLowerCase().includes('boisson') ||
        item.name.toLowerCase().includes('vin') ||
        item.name.toLowerCase().includes('bière') ||
        item.name.toLowerCase().includes('cocktail') ||
        item.name.toLowerCase().includes('soda') ||
        item.name.toLowerCase().includes('jus') ||
        item.name.toLowerCase().includes('eau') ||
        item.unit === 'bouteille' ||
        item.unit === 'L' ||
        item.unit === 'cL' ||
        item.unit === 'pièce'
      );
    }
  };

  const addIngredient = () => {
    if (!currentIngredient.inventory_item_id || currentIngredient.quantity_required <= 0) {
      alert('Veuillez sélectionner un ingrédient et saisir une quantité valide');
      return;
    }

    const inventoryItem = inventoryItems.find(item => item.id === currentIngredient.inventory_item_id);
    if (!inventoryItem) return;

    const existingIndex = ingredients.findIndex(ing => ing.inventory_item_id === currentIngredient.inventory_item_id);

    if (existingIndex !== -1) {
      const updatedIngredients = [...ingredients];
      updatedIngredients[existingIndex].quantity_required += currentIngredient.quantity_required;
      updatedIngredients[existingIndex].total_cost = updatedIngredients[existingIndex].quantity_required * inventoryItem.unit_cost;
      setIngredients(updatedIngredients);
    } else {
      const newIngredient: MenuIngredient = {
        inventory_item_id: currentIngredient.inventory_item_id,
        inventory_item_name: inventoryItem.name,
        quantity_required: currentIngredient.quantity_required,
        unit: inventoryItem.unit,
        unit_cost: inventoryItem.unit_cost,
        total_cost: currentIngredient.quantity_required * inventoryItem.unit_cost
      };
      setIngredients([...ingredients, newIngredient]);
    }

    setCurrentIngredient({
      inventory_item_id: '',
      quantity_required: 1
    });
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const checkStockAvailability = () => {
    const warnings: string[] = [];
    
    ingredients.forEach(ingredient => {
      const inventoryItem = inventoryItems.find(item => item.id === ingredient.inventory_item_id);
      if (inventoryItem && ingredient.quantity_required > inventoryItem.current_quantity) {
        warnings.push(`${ingredient.inventory_item_name}: Stock insuffisant (${inventoryItem.current_quantity} ${inventoryItem.unit} disponible, ${ingredient.quantity_required} ${ingredient.unit} requis)`);
      }
    });

    return warnings;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validation des données
    const validationErrors = validateFormData();
    if (validationErrors.length > 0) {
      alert(`Erreurs de validation:\n${validationErrors.join('\n')}`);
      return;
    }
    
    if (ingredients.length === 0 && activeTab === 'kitchen') {
      alert('Veuillez ajouter au moins un ingrédient');
      return;
    }

    const stockWarnings = checkStockAvailability();
    if (stockWarnings.length > 0 && !confirm(
      `Avertissements de stock:\n${stockWarnings.join('\n')}\n\nVoulez-vous continuer ?`
    )) {
      return;
    }

    try {
      // Préparer les données de base
      const menuData: any = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        category_id: formData.category_id,
        is_available: formData.is_available,
        is_active: true,
        preparation_time: formData.preparation_time,
        updated_at: new Date().toISOString()
      };

      // Ajouter les champs spécifiques au bar
      if (activeTab === 'bar') {
        menuData.sub_category = formData.sub_category;
        menuData.sale_type = formData.sale_type;
        menuData.servings_per_bottle = formData.servings_per_bottle;
        menuData.current_servings = formData.current_servings;
        
        // Pour les nouvelles bouteilles à la consommation, initialiser les servings
        if (!editingItem && formData.sale_type === 'consumption') {
          menuData.current_servings = formData.servings_per_bottle;
        }
      }

      let menuId;

      if (editingItem) {
        // Mettre à jour le menu
        const { error } = await supabase
          .from('pos_menus')
          .update(menuData)
          .eq('id', editingItem.id);

        if (error) throw error;
        menuId = editingItem.id;

        // Supprimer les anciens ingrédients
        await supabase
          .from('menu_ingredients')
          .delete()
          .eq('menu_id', editingItem.id);

      } else {
        // Créer un nouveau menu
        menuData.created_by = user.id;
        menuData.created_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('pos_menus')
          .insert([menuData])
          .select();

        if (error) throw error;
        
        // Récupérer l'ID du menu créé
        if (data && data.length > 0) {
          menuId = data[0].id;
        } else {
          throw new Error('Aucun ID retourné après création du menu');
        }
      }

      // Enregistrer les ingrédients dans la table menu_ingredients
      if (ingredients.length > 0 && menuId) {
        const menuIngredientsData = ingredients.map(ingredient => ({
          menu_id: menuId,
          inventory_item_id: ingredient.inventory_item_id,
          quantity_required: ingredient.quantity_required,
          unit: ingredient.unit
        }));

        const { error: ingredientsError } = await supabase
          .from('menu_ingredients')
          .insert(menuIngredientsData);

        if (ingredientsError) throw ingredientsError;
      }

      // Consommer le stock si confirmé
      if (stockWarnings.length === 0 || confirm('Consommer le stock maintenant ?')) {
        await consumeStock();
      }

      resetForm();
      await loadData();
      alert(editingItem ? 'Menu modifié avec succès !' : 'Menu créé avec succès !');
      
    } catch (error: any) {
      console.error('Error saving menu:', error);
      
      // Messages d'erreur plus spécifiques
      if (error.code === 'PGRST116') {
        alert('Erreur: Aucune donnée retournée par la base de données. Vérifiez que le menu existe.');
      } else if (error.message.includes('row-level security')) {
        alert('Erreur de sécurité : Contactez l\'administrateur pour configurer les permissions de la table pos_menus.');
      } else {
        alert(`Erreur: ${error.message || 'Erreur inconnue lors de la sauvegarde'}`);
      }
    }
  };

  const validateFormData = () => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Le nom du menu est requis');
    }

    if (!formData.category_id) {
      errors.push('La catégorie est requise');
    }

    if (formData.price === null || formData.price === undefined || formData.price < 0) {
      errors.push('Le prix doit être un nombre positif');
    }

    if (activeTab === 'bar' && formData.sale_type === 'consumption') {
      if (!formData.servings_per_bottle || formData.servings_per_bottle < 1) {
        errors.push('Le nombre de consommations par bouteille doit être au moins 1');
      }
    }

    return errors;
  };

  const consumeStock = async () => {
    if (!user) return;

    for (const ingredient of ingredients) {
      try {
        // Récupérer la quantité actuelle
        const { data: currentItem, error: fetchError } = await supabase
          .from('inventory_items')
          .select('current_quantity')
          .eq('id', ingredient.inventory_item_id)
          .single();

        if (fetchError) {
          console.error('Error fetching current quantity:', fetchError);
          continue;
        }

        const newQuantity = (currentItem.current_quantity || 0) - ingredient.quantity_required;

        // Mettre à jour le stock
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            current_quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', ingredient.inventory_item_id);

        if (updateError) {
          console.error('Error updating stock:', updateError);
          continue;
        }

        // Enregistrer la transaction
        const { error: transactionError } = await supabase
          .from('inventory_transactions')
          .insert({
            inventory_item_id: ingredient.inventory_item_id,
            transaction_type: 'sale',
            quantity: -ingredient.quantity_required,
            reference_type: 'menu_creation',
            notes: `Consommation pour menu ${activeTab}: ${formData.name}`,
            created_by: user.id
          });

        if (transactionError) {
          console.error('Error creating transaction:', transactionError);
        }
      } catch (error) {
        console.error('Error in consumeStock:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: '',
      preparation_time: 30,
      is_available: true,
      menu_type: activeTab,
      sub_category: activeBarSubCategory,
      sale_type: 'consumption',
      servings_per_bottle: 1,
      current_servings: 0
    });
    setIngredients([]);
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price, 
      category_id: item.category_id,
      preparation_time: item.preparation_time || 30,
      is_available: item.is_available,
      menu_type: activeTab,
      sub_category: item.sub_category || activeBarSubCategory,
      sale_type: item.sale_type || 'bottle',
      servings_per_bottle: item.servings_per_bottle || 1,
      current_servings: item.current_servings || 0
    });
    setIngredients(item.ingredients || []);
    setShowForm(true);
  };

  const handleNewMenu = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: '',
      preparation_time: 30,
      is_available: true,
      menu_type: activeTab,
      sub_category: activeBarSubCategory,
      sale_type: 'bottle',
      servings_per_bottle: 1,
      current_servings: 0
    });
    setIngredients([]);
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const filteredMenus = getFilteredMenus();
  const filteredCategories = getFilteredCategories();
  const filteredInventoryItems = getFilteredInventoryItems();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Menus du Jour</h2>
          <p className="text-slate-600 mt-1">Création et gestion des menus</p>
        </div>
        <div className="flex space-x-3">
          {/* Bouton temporaire pour migration */}
          <button
            onClick={migrateExistingMenus}
            className="bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition"
          >
            Migrer les menus
          </button>
          {/* AJOUTEZ CE BOUTON TEMPORAIRE POUR DÉBOGUER */}
<button
  onClick={debugMenuState}
  className="bg-yellow-500 text-white px-4 py-2 rounded font-medium hover:bg-yellow-600 transition"
  style={{ marginLeft: '10px' }}
>
  Debug Menus
</button>
          <button
            onClick={handleNewMenu}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau Menu</span>
          </button>
        </div>
      </div>

      {/* Onglets Cuisine/Bar */}
      <div className="mb-6">
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'kitchen'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Cuisine</span>
            </button>
            <button
              onClick={() => setActiveTab('bar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'bar'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <GlassWater className="w-4 h-4" />
              <span>Bar</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Champ de recherche */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder={`Rechercher un menu ${activeTab === 'kitchen' ? 'de cuisine' : 'du bar'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Optionnel : Afficher le nombre de résultats */}
          {searchTerm && (
            <div className="ml-4 text-sm text-slate-600">
              {filteredMenus.length} résultat{filteredMenus.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
      
      {/* Sous-catégories pour le bar */}
      {activeTab === 'bar' && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(barSubCategories).map(([key, subCat]) => {
              const IconComponent = subCat.icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveBarSubCategory(key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
                    activeBarSubCategory === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{subCat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des menus */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMenus.map(item => {
          const category = categories.find(cat => cat.id === item.category_id);
          const subCategoryInfo = barSubCategories[item.sub_category as keyof typeof barSubCategories];
          
          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {category && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        {category.name}
                      </span>
                    )}
                    {activeTab === 'bar' && subCategoryInfo && (
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center space-x-1">
                        <subCategoryInfo.icon className="w-3 h-3" />
                        <span>{subCategoryInfo.name}</span>
                      </span>
                    )}
                    {activeTab === 'bar' && item.sale_type && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        {item.sale_type === 'bottle' ? 'À la bouteille' : 'À la consommation'}
                      </span>
                    )}
                    {/* AJOUTER UN BADGE POUR LE PRIX PAR CONSOMMATION */}
                    {activeTab === 'bar' && item.sale_type === 'consumption' && (
                      <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                        {item.price.toLocaleString()} f CFA/consommation
                      </span>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {item.is_available ? 'Disponible' : 'Indisponible'}
                </span>
              </div>

              {item.description && (
                <p className="text-sm text-slate-600 mb-4">{item.description}</p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Prix de vente:</span>
                  <span className="font-semibold">{item.price.toLocaleString()} f CFA</span>
                </div>
                
                {activeTab === 'bar' && item.sale_type === 'consumption' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Consommations/bouteille:</span>
                      <span>{item.servings_per_bottle}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Consommations restantes:</span>
                      <span className={
                        item.current_servings === 0 
                          ? 'text-red-600 font-semibold' 
                          : item.current_servings && item.current_servings <= (item.servings_per_bottle || 0) * 0.2 
                          ? 'text-orange-600 font-semibold' 
                          : ''
                      }>
                        {item.current_servings || 0} / {item.servings_per_bottle}
                        {item.current_servings === 0 && ' (VIDE)'}
                      </span>
                    </div>
                    
                    {/* Bouton pour réinitialiser la bouteille */}
                    {item.current_servings === 0 && (
                      <button
                        onClick={() => resetBottleServings(item.id)}
                        className="w-full text-xs text-blue-600 hover:text-blue-800 bg-blue-100 px-2 py-1 rounded-full flex items-center justify-center space-x-1 mt-1"
                        title="Réinitialiser la bouteille"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Réinitialiser la bouteille</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-blue-600 hover:text-blue-900 transition flex items-center space-x-1"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Modifier</span>
                  </button>
                  
                  {/* BOUTON SUPPRIMER */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-900 transition flex items-center space-x-1"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Supprimer</span>
                  </button>
                </div>
                
                <span className="text-lg font-bold text-slate-900">
                  {item.price.toLocaleString()} f CFA
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message quand aucun menu n'est trouvé */}
      {filteredMenus.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          {activeTab === 'kitchen' ? (
            <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          ) : (
            <GlassWater className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          )}
          <p className="text-slate-600 mb-4">
            {searchTerm 
              ? `Aucun menu ne correspond à "${searchTerm}"`
              : activeTab === 'kitchen' 
                ? 'Aucun menu de cuisine créé' 
                : `Aucun menu dans ${barSubCategories[activeBarSubCategory as keyof typeof barSubCategories]?.name}`
            }
          </p>
          {!searchTerm && (
            <button
              onClick={handleNewMenu}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Créer le premier menu
            </button>
          )}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-300 transition"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      )}

      {/* Modal de création/édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingItem ? 'Modifier le menu' : `Nouveau menu ${activeTab === 'kitchen' ? 'de cuisine' : 'du bar'}`}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom du menu *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Catégorie *
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {filteredCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sous-catégorie pour le bar */}
                {activeTab === 'bar' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Sous-catégorie *
                    </label>
                    <select
                      value={formData.sub_category}
                      onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      {Object.entries(barSubCategories).map(([key, subCat]) => (
                        <option key={key} value={key}>
                          {subCat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Prix de vente (f CFA) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                  {/* AJOUTER UNE EXPLICATION POUR LES MENUS BAR */}
                  {activeTab === 'bar' && formData.sale_type === 'consumption' && (
                    <p className="text-xs text-slate-500 mt-1">
                      💡 Ce prix correspond au prix d'<strong>une consommation</strong>
                    </p>
                  )}
                  {activeTab === 'bar' && formData.sale_type === 'bottle' && (
                    <p className="text-xs text-slate-500 mt-1">
                      💡 Ce prix correspond au prix de <strong>la bouteille entière</strong>
                    </p>
                  )}
                </div>

                {/* Type de vente pour le bar */}
                {activeTab === 'bar' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Type de vente
                      </label>
                      <select
                        value={formData.sale_type}
                        onChange={(e) => setFormData({ ...formData, sale_type: e.target.value as 'bottle' | 'consumption' })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      >
                        <option value="bottle">À la bouteille</option>
                        <option value="consumption">À la consommation</option>
                      </select>
                    </div>

                    {/* Afficher le champ nombre de consommations seulement pour "À la consommation" */}
                    {formData.sale_type === 'consumption' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Nombre de consommations par bouteille *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.servings_per_bottle}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            servings_per_bottle: parseInt(e.target.value) || 1,
                            // Initialiser les consommations restantes au nombre total
                            current_servings: parseInt(e.target.value) || 1
                          })}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          💡 Nombre de portions que contient une bouteille. Le prix défini ci-dessus sera appliqué <strong>par consommation</strong>.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'kitchen' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Temps de préparation (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.preparation_time}
                      onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) || 30 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Gestion des ingrédients - Pour cuisine ET bar */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-4">
                  {activeTab === 'kitchen' ? 'Ingrédients' : 'Composition'}
                </h4>
                
                <div className="grid grid-cols-12 gap-3 mb-4">
                  <div className="col-span-6">
                    <select
                      value={currentIngredient.inventory_item_id}
                      onChange={(e) => setCurrentIngredient({ ...currentIngredient, inventory_item_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner un ingrédient</option>
                      {filteredInventoryItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} (Stock: {item.current_quantity} {item.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={currentIngredient.quantity_required}
                      onChange={(e) => setCurrentIngredient({ ...currentIngredient, quantity_required: parseFloat(e.target.value) || 0 })}
                      placeholder="Quantité requise"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={addIngredient}
                      className="w-full bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-700 transition"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Liste des ingrédients */}
                {ingredients.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="bg-slate-50 px-4 py-2 border-b">
                      <div className="grid grid-cols-12 gap-3 text-sm font-medium text-slate-700">
                        <div className="col-span-5">Ingrédient</div>
                        <div className="col-span-2">Quantité</div>
                        <div className="col-span-3">Unité</div>
                        <div className="col-span-2">Actions</div>
                      </div>
                    </div>
                    <div className="divide-y">
                      {ingredients.map((ingredient, index) => {
                        const inventoryItem = inventoryItems.find(item => item.id === ingredient.inventory_item_id);
                        const isLowStock = inventoryItem && ingredient.quantity_required > inventoryItem.current_quantity;
                        
                        return (
                          <div key={index} className={`px-4 py-3 grid grid-cols-12 gap-3 items-center ${
                            isLowStock ? 'bg-red-50' : ''
                          }`}>
                            <div className="col-span-5 text-sm">
                              <div className="flex items-center space-x-2">
                                {ingredient.inventory_item_name}
                                {isLowStock && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              </div>
                              {isLowStock && (
                                <div className="text-xs text-red-600 mt-1">
                                  Stock insuffisant
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 text-sm">
                              {ingredient.quantity_required}
                            </div>
                            <div className="col-span-3 text-sm">
                              {ingredient.unit}
                            </div>
                            <div className="col-span-2">
                              <button
                                type="button"
                                onClick={() => removeIngredient(index)}
                                className="text-red-600 hover:text-red-900 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_available" className="text-sm font-medium text-slate-700">
                  Menu disponible à la vente
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                {/* Bouton Annuler */}
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                {editingItem && (
  <button
    type="button"
    onClick={() => {
      if (confirm('Voulez-vous vraiment supprimer ce menu ?\n\n⚠️ Note: Les articles d\'inventaire ne seront PAS supprimés et leurs quantités ne seront PAS modifiées.')) {
        handleDelete(editingItem.id);
        resetForm();
      }
    }}
    className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center space-x-2"
  >
    <Trash2 className="w-5 h-5" />
    <span>Supprimer le menu</span>
  </button>
)}
                {/* Bouton Supprimer (seulement en mode édition) */}
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Voulez-vous vraiment supprimer ce menu ?')) {
                        handleDelete(editingItem.id);
                        resetForm();
                      }
                    }}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Supprimer</span>
                  </button>
                )}
                
                {/* Bouton Sauvegarder/Modifier */}
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{editingItem ? 'Modifier' : 'Créer le menu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
