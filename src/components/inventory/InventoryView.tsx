// src/components/inventory/InventoryView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { InventoryItem } from '../../types/database';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Search, 
  Printer, 
  ClipboardList, 
  Info,
  X 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import InventoryCategoriesView from './InventoryCategoriesView';

interface InventoryCategory {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export default function InventoryView() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'gestion' | 'inventaire'>('gestion');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: '',
    current_quantity: 0,
    min_quantity: 0,
    unit_cost: 0,
    category_id: '',
  });
  const [inventoryCounts, setInventoryCounts] = useState<{ [key: string]: number }>({});
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string>('');

  useEffect(() => {
    loadInventory();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const calculateMenuStockUsage = async (inventoryItemId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('menu_ingredients')
        .select(`
          quantity_required,
          pos_menus:menu_id (
            id,
            name,
            is_available
          )
        `)
        .eq('inventory_item_id', inventoryItemId)
        .eq('pos_menus.is_available', true);

      if (error) {
        console.error('Error in menu ingredients query:', error);
        return 0;
      }

      if (!data || data.length === 0) {
        return 0;
      }

      const totalUsage = data.reduce((total, ingredient) => {
        return total + (ingredient.quantity_required || 0);
      }, 0);

      return totalUsage;
    } catch (error) {
      console.error('Error calculating menu stock usage:', error);
      return 0;
    }
  };

  const checkItemDependencies = async (itemId: string): Promise<{
    menu_ingredients: any[];
    inventory_transactions: any[];
    has_dependencies: boolean;
  }> => {
    try {
      // Vérifier menu_ingredients
      const { data: menuData, error: menuError } = await supabase
        .from('menu_ingredients')
        .select(`
          id,
          quantity_required,
          pos_menus:menu_id (
            id,
            name,
            is_available
          )
        `)
        .eq('inventory_item_id', itemId);

      if (menuError) {
        console.error('Error checking menu ingredients:', menuError);
        return {
          menu_ingredients: [],
          inventory_transactions: [],
          has_dependencies: false
        };
      }

      // Vérifier inventory_transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('inventory_transactions')
        .select('id, transaction_type, quantity, created_at')
        .eq('inventory_item_id', itemId);

      if (transactionsError) {
        console.error('Error checking transactions:', transactionsError);
        return {
          menu_ingredients: menuData || [],
          inventory_transactions: [],
          has_dependencies: (menuData && menuData.length > 0)
        };
      }

      return {
        menu_ingredients: menuData || [],
        inventory_transactions: transactionsData || [],
        has_dependencies: (menuData && menuData.length > 0) || (transactionsData && transactionsData.length > 0)
      };
    } catch (error) {
      console.error('Error checking dependencies:', error);
      return {
        menu_ingredients: [],
        inventory_transactions: [],
        has_dependencies: false
      };
    }
  };

  const initiateDelete = async (itemId: string, itemName: string) => {
  try {
    setDeletingItem(itemId);
    console.log('🔍 Vérification des dépendances pour:', itemName);
    
    // Vérifier les dépendances
    const dependencies = await checkItemDependencies(itemId);
    
    // Préparer le message de confirmation
    let message = `Êtes-vous sûr de vouloir marquer l'article "${itemName}" comme supprimé ?\n\n`;
    message += `Cette action est réversible. L'article sera conservé dans la base de données mais n'apparaîtra plus dans les listes.\n\n`;
    
    if (dependencies.menu_ingredients && dependencies.menu_ingredients.length > 0) {
      const menuNames = dependencies.menu_ingredients
        .map((ingredient: any) => ingredient.pos_menus?.name || 'Menu inconnu')
        .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
        .join(', ');
      
      message += `⚠️ Information : Cet article est utilisé dans ${dependencies.menu_ingredients.length} menu(s) : ${menuNames}\n`;
      message += `Les liens avec les menus seront conservés.\n\n`;
    }
    
    if (dependencies.inventory_transactions && dependencies.inventory_transactions.length > 0) {
      message += `ℹ️ Cet article a ${dependencies.inventory_transactions.length} transaction(s) d'inventaire qui seront conservées.\n\n`;
    }
    
    message += `L'article sera renommé avec "[SUPPRIMÉ]" pour identification.`;
    
    setDeleteMessage(message);
    setItemToDelete({ id: itemId, name: itemName });
    setShowDeleteConfirm(true);
    
  } catch (error) {
    console.error('Error initiating delete:', error);
    alert('Erreur lors de la vérification des dépendances');
  } finally {
    // ← CRUCIAL: Réinitialiser l'état de chargement dans tous les cas
    setDeletingItem(null);
  }
};

 const executeDelete = async () => {
  if (!itemToDelete || !user) return;

  try {
    setDeletingItem(itemToDelete.id);
    
    // Appeler la fonction PostgreSQL
    const { data, error } = await supabase.rpc(
      'soft_delete_inventory_item',
      {
        item_id: itemToDelete.id,
        user_id: user.id
      }
    );

    if (error) {
      console.error('RPC Error:', error);
      throw error;
    }
    
    if (data) {
      alert(`Article "${itemToDelete.name}" supprimé avec succès !`);
      await loadInventory();
    } else {
      throw new Error('La fonction de suppression a échoué');
    }

  } catch (error) {
    console.error('Error:', error);
    alert('Erreur: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
  } finally {
    // ← CRUCIAL: Nettoyer tous les états
    setShowDeleteConfirm(false);
    setItemToDelete(null);
    setDeleteMessage('');
    setDeletingItem(null);
  }
};

  const loadInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          inventory_categories (
            name,
            color
          )
        `)
        .is('deleted_at', null)  // Filtrer les articles non supprimés
        .order('name');

      if (error) throw error;

      // Charger l'usage dans les menus pour chaque article
      const itemsWithMenuUsage = await Promise.all(
        (data || []).map(async (item) => {
          const menuUsage = await calculateMenuStockUsage(item.id);
          const availableForMenus = Math.max(0, item.current_quantity - menuUsage);
          
          return {
            ...item,
            menu_usage: menuUsage,
            available_for_menus: availableForMenus
          };
        })
      );

      setItems(itemsWithMenuUsage);
      
      const initialCounts: { [key: string]: number } = {};
      itemsWithMenuUsage.forEach(item => {
        initialCounts[item.id] = item.current_quantity;
      });
      setInventoryCounts(initialCounts);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const itemData: any = {
        name: formData.name,
        description: formData.description,
        unit: formData.unit,
        current_quantity: formData.current_quantity,
        min_quantity: formData.min_quantity,
        unit_cost: formData.unit_cost,
        is_active: true,
      };

      if (formData.category_id) {
        itemData.category_id = formData.category_id;
      }

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            ...itemData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert({
            ...itemData,
            created_by: user.id,
          });

        if (error) throw error;
      }

      resetForm();
      loadInventory();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      unit: item.unit,
      current_quantity: item.current_quantity,
      min_quantity: item.min_quantity,
      unit_cost: item.unit_cost,
      category_id: item.category_id || '',
    });
    setShowForm(true);
  };

  const handleInventoryCountChange = (itemId: string, count: number) => {
    const intCount = isNaN(count) ? 0 : Math.max(0, Math.floor(count));
    setInventoryCounts(prev => ({
      ...prev,
      [itemId]: intCount
    }));
  };

  const saveInventoryCounts = async () => {
    if (!user) return;

    try {
      const updates = Object.entries(inventoryCounts).map(([itemId, count]) => ({
        id: itemId,
        current_quantity: count,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            current_quantity: update.current_quantity,
            updated_at: update.updated_at,
          })
          .eq('id', update.id);

        if (error) throw error;

        await supabase
          .from('inventory_transactions')
          .insert({
            inventory_item_id: update.id,
            transaction_type: 'adjustment',
            quantity: update.current_quantity - (items.find(item => item.id === update.id)?.current_quantity || 0),
            notes: 'Ajustement via inventaire physique',
            created_by: user.id,
          });
      }

      alert('Inventaire sauvegardé avec succès !');
      loadInventory();
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Erreur lors de la sauvegarde de l\'inventaire');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit: '',
      current_quantity: 0,
      min_quantity: 0,
      unit_cost: 0,
      category_id: '',
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const printStockReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filteredItems = filteredInventoryItems;
    const totalValue = filteredItems.reduce((sum, item) => sum + (item.current_quantity * item.unit_cost), 0);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>État du Stock - ${new Date().toLocaleDateString('fr-FR')}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; color: #333; }
          .header .date { color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .total-row { background-color: #f8f9fa; font-weight: bold; }
          .low-stock { background-color: #fff3cd; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>État du Stock</h1>
          <div class="date">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Catégorie</th>
              <th>Stock Actuel</th>
              <th>Stock Minimum</th>
              <th>Coût Unitaire</th>
              <th>Valeur Stock</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => {
              const isLowStock = item.current_quantity <= item.min_quantity;
              const itemValue = item.current_quantity * item.unit_cost;
              const categoryName = item.inventory_categories ? item.inventory_categories.name : '-';
              return `
                <tr class="${isLowStock ? 'low-stock' : ''}">
                  <td>${item.name}</td>
                  <td>${categoryName}</td>
                  <td>${item.current_quantity} ${item.unit}</td>
                  <td>${item.min_quantity} ${item.unit}</td>
                  <td>${item.unit_cost.toLocaleString()} f CFA</td>
                  <td>${itemValue.toLocaleString()} f CFA</td>
                  <td>${isLowStock ? '⚠️ Stock faible' : '✅ OK'}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="5"><strong>Total valeur du stock</strong></td>
              <td colspan="2"><strong>${totalValue.toLocaleString()} f CFA</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>Nombre d'articles: ${filteredItems.length} | Articles en stock faible: ${lowStockItems.length}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredInventoryItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.inventory_categories?.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockItems = items.filter(item => item.current_quantity <= item.min_quantity);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="p-8">
      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Confirmer la suppression logique
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                  setDeleteMessage('');
                }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900">
                      Attention : Suppression logique
                    </h4>
                    <p className="text-amber-800 mt-1">
                      Vous allez marquer l'article <strong>"{itemToDelete.name}"</strong> comme supprimé
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {deleteMessage}
                </p>
              </div>

              <div className="text-sm text-slate-600 mb-6">
                <p>L'article sera conservé dans la base de données et pourra être restauré si nécessaire.</p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setItemToDelete(null);
                    setDeleteMessage('');
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
  onClick={executeDelete}
  disabled={deletingItem !== null}  // CORRECTION : vérifier si deletingItem n'est pas null
  className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {deletingItem !== null ? (  // CORRECTION : vérifier si deletingItem n'est pas null
    <>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
      <span>Suppression...</span>
    </>
  ) : (
    <>
      <Trash2 className="w-5 h-5" />
      <span>Marquer comme supprimé</span>
    </>
  )}
</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Le reste de votre JSX reste inchangé */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Inventaire</h2>
          <p className="text-slate-600 mt-1">Gestion des stocks et articles</p>
        </div>
        <div className="flex space-x-3">
          {activeTab === 'gestion' && (
            <button
              onClick={printStockReport}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <Printer className="w-5 h-5" />
              <span>Imprimer l'état</span>
            </button>
          )}
          {activeTab === 'gestion' && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nouvel article</span>
            </button>
          )}
          {activeTab === 'inventaire' && (
            <button
              onClick={saveInventoryCounts}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center space-x-2"
            >
              <ClipboardList className="w-5 h-5" />
              <span>Sauvegarder l'inventaire</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('gestion')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'gestion'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Gestion du Stock
          </button>
          <button
            onClick={() => setActiveTab('inventaire')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inventaire'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ClipboardList className="w-4 h-4 inline mr-2" />
            Inventaire du Stock
          </button>
        </nav>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      </div>

      {lowStockItems.length > 0 && activeTab === 'gestion' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900">
                {lowStockItems.length} article(s) en stock faible
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Les articles suivants sont en dessous du seuil minimum: {lowStockItems.map(item => item.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gestion' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Stock actuel
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Utilisé menus
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Disponible menus
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Stock min
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Coût unitaire
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Valeur stock
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInventoryItems.map((item) => {
                const hasMenuUsage = item.menu_usage && item.menu_usage > 0;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-slate-500">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.inventory_categories ? (
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.inventory_categories.color || '#3B82F6' }}
                          ></div>
                          <span>{item.inventory_categories.name}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span className={`text-sm font-medium ${
                          item.current_quantity <= item.min_quantity ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {item.current_quantity} {item.unit}
                        </span>
                        {item.current_quantity <= item.min_quantity && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      <span className={hasMenuUsage ? 'text-orange-600 font-medium' : 'text-slate-500'}>
                        {item.menu_usage || 0} {item.unit}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      <span className={
                        item.available_for_menus !== undefined && item.available_for_menus < (item.menu_usage || 0) ? 'text-red-600 font-bold' :
                        item.available_for_menus !== undefined && item.available_for_menus <= item.min_quantity ? 'text-yellow-600 font-medium' :
                        'text-green-600 font-medium'
                      }>
                        {item.available_for_menus !== undefined ? item.available_for_menus : item.current_quantity} {item.unit}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {item.min_quantity} {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                      {item.unit_cost.toLocaleString()} f CFA
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                      {(item.current_quantity * item.unit_cost).toLocaleString()} f CFA
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {hasMenuUsage && (
                          <Info 
                            className="w-4 h-4 text-blue-500" 
                            title="Cet article est utilisé dans des menus"
                          />
                        )}
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-900 transition"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => initiateDelete(item.id, item.name)}
                          disabled={deletingItem === item.id}
                          className={`transition ${deletingItem === item.id ? 'text-slate-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                          title={hasMenuUsage ? "Marquer comme supprimé (utilisé dans des menus)" : "Marquer comme supprimé"}
                        >
                          {deletingItem === item.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInventoryItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {searchTerm ? 'Aucun article ne correspond à votre recherche' : 'Aucun article en inventaire'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  Ajouter le premier article
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventaire' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Inventaire physique du stock</h3>
            <p className="text-sm text-slate-600 mt-1">
              Comptez physiquement chaque article et saisissez les quantités réelles ci-dessous
            </p>
          </div>
          
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Unité
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Stock système
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Quantité physique
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Écart
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInventoryItems.map((item) => {
                const physicalCount = inventoryCounts[item.id] || item.current_quantity;
                const difference = physicalCount - item.current_quantity;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        {item.inventory_categories && (
                          <p className="text-sm text-slate-500">{item.inventory_categories.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                      {item.current_quantity} {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={inventoryCounts[item.id] || 0}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = parseInt(value);
                          const newValue = isNaN(numValue) ? 0 : Math.max(0, numValue);
                          setInventoryCounts(prev => ({
                            ...prev,
                            [item.id]: newValue
                          }));
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-right"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        difference === 0 
                          ? 'text-slate-900' 
                          : difference > 0 
                            ? 'text-emerald-600' 
                            : 'text-red-600'
                      }`}>
                        {difference > 0 ? '+' : ''}{difference} {item.unit}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInventoryItems.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {searchTerm ? 'Aucun article ne correspond à votre recherche' : 'Aucun article à inventorier'}
              </p>
            </div>
          )}

          {filteredInventoryItems.length > 0 && (
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600">
                    {Object.values(inventoryCounts).filter((count, index) => 
                      count !== items[index]?.current_quantity
                    ).length} article(s) modifié(s)
                  </p>
                </div>
                <button
                  onClick={saveInventoryCounts}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center space-x-2"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span>Sauvegarder l'inventaire</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingItem ? 'Modifier l\'article' : 'Nouvel article'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom de l'article *
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
                    Catégorie
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Unité *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner une unité</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="cL">cL</option>
                    <option value="pièce">pièce</option>
                    <option value="bouteille">bouteille</option>
                    <option value="carton">carton</option>
                    <option value="sachet">sachet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Coût unitaire (f CFA) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quantité actuelle *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.current_quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ 
                        ...formData, 
                        current_quantity: value === '' ? 0 : Math.floor(parseFloat(value))
                      });
                    }}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quantité minimum *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.min_quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ 
                        ...formData, 
                        min_quantity: value === '' ? 0 : Math.floor(parseFloat(value))
                      });
                    }}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
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

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  {editingItem ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Gérer les catégories</h3>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <InventoryCategoriesView />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
