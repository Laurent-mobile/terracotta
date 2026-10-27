// src/components/pos/MultiOrderManager.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { History } from 'lucide-react';
import {
  ShoppingCart,
  Users,
  Clock,
  CheckCircle,
  X,
  Plus,
  ChefHat,
  Wine,
  Trash2,
  Search,
  AlertTriangle,
  Edit,
  Utensils,
  Home,
  Truck,
  RefreshCw,
  Send
} from 'lucide-react';

// Fonction pour trier les tables dans l'ordre naturel
const sortTablesByNaturalOrder = (tables: Table[]) => {
  return [...tables].sort((a, b) => {
    const numA = a.table_number;
    const numB = b.table_number;
    if (!isNaN(Number(numA)) && !isNaN(Number(numB))) {
      return Number(numA) - Number(numB);
    }
    if (!isNaN(Number(numA)) && isNaN(Number(numB))) {
      return -1;
    }
    if (isNaN(Number(numA)) && !isNaN(Number(numB))) {
      return 1;
    }
    return numA.localeCompare(numB, 'fr', { numeric: true });
  });
};

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
  current_order_id?: string;
  is_active: boolean;
}

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'ordered' | 'preparing' | 'ready' | 'served' | 'cancelled';
  category?: string;
  kitchen_note?: string;
  bar_note?: string;
}

interface Order {
  id: string;
  table_id: string;
  table_number: string;
  order_number: string;
  order_type?: 'sur_place' | 'a_emporter' | 'livraison';
  status: 'open' | 'confirmed' | 'ready' | 'paid' | 'closed' | 'cancelled';
  customer_count: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  delivery_fee?: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
  server_name?: string;
  server_id?: string;
  tickets_generated?: boolean;
  tickets_data?: {
    kitchenItems: string[];
    barItems: string[];
    allGenerated: boolean;
  };
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  is_available: boolean;
  preparation_time?: number;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  position_name: string;
  status: string;
}

let menuCache: { categories: Category[], menuItems: MenuItem[] } | null = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export default function MultiOrderManager() {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [view, setView] = useState<'tables' | 'order' | 'overview'>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTableForm, setShowTableForm] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [servers, setServers] = useState<Employee[]>([]);
  const [menuData, setMenuData] = useState<{ categories: Category[], menuItems: MenuItem[] } | null>(null);
  const [tableError, setTableError] = useState('');

  useEffect(() => {
    loadMenuData();
    loadTablesAndOrders();
    loadServers();
  }, []);

  const loadMenuData = async () => {
    const now = Date.now();
    if (menuCache && (now - lastCacheUpdate) < CACHE_DURATION) {
      setMenuData(menuCache);
      return;
    }
    try {
      const [categoriesRes, menusRes] = await Promise.all([
        supabase.from('pos_categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('pos_menus').select('*').eq('is_available', true),
      ]);
      if (categoriesRes.error) throw categoriesRes.error;
      if (menusRes.error) throw menusRes.error;
      const menuData = {
        categories: categoriesRes.data || [],
        menuItems: menusRes.data || []
      };
      menuCache = menuData;
      lastCacheUpdate = now;
      setMenuData(menuData);
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  };

  const loadServers = async () => {
    try {
      const { data: employees, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          employee_number,
          status,
          employee_positions!inner(name)
        `)
        .eq('status', 'active')
        .eq('employee_positions.name', 'Serveur')
        .order('first_name');
      if (error) throw error;
      const formattedServers = employees?.map(emp => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        employee_number: emp.employee_number,
        position_name: emp.employee_positions.name,
        status: emp.status
      })) || [];
      setServers(formattedServers);
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadTablesAndOrders = async () => {
    try {
      setLoading(true);
      const [tablesRes, ordersRes] = await Promise.all([
        supabase.from('pos_tables').select('*'),
        supabase
          .from('pos_orders')
          .select(`
            *,
            pos_order_items(*)
          `)
          .in('status', ['open', 'confirmed', 'ready'])
          .order('created_at', { ascending: false })
      ]);
      if (tablesRes.error) throw tablesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      const sortedTables = sortTablesByNaturalOrder(tablesRes.data || []);
      setTables(sortedTables);
      const ordersWithItems = (ordersRes.data || []).map(order => ({
        ...order,
        items: order.pos_order_items || [],
        order_type: order.order_type || 'sur_place',
        delivery_fee: order.delivery_fee || 0
      }));
      setActiveOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 CORRECTION #8 : restoreStock gère à la fois 'bottle' ET 'consumption'
  const restoreStock = async (orderId: string) => {
    try {
      console.log('🔄 Restauration du stock pour la commande:', orderId);
      const { data: orderItems, error: itemsError } = await supabase
        .from('pos_order_items')
        .select(`
          *,
          pos_menus(
            id,
            name,
            sale_type,
            current_servings,
            servings_per_bottle
          )
        `)
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;
      if (!orderItems || orderItems.length === 0) {
        console.log('ℹ️ Aucun article à restaurer');
        return;
      }
      for (const orderItem of orderItems) {
        await restoreMenuStock(orderItem);
        // ✅ Gérer à la fois 'bottle' ET 'consumption'
        if (orderItem.pos_menus?.sale_type === 'bottle' || orderItem.pos_menus?.sale_type === 'consumption') {
          await restoreBottleStock(orderItem);
        }
      }
      console.log('✅ Stock restauré avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la restauration du stock:', error);
      throw error;
    }
  };

  const restoreMenuStock = async (orderItem: any) => {
    try {
      console.log(`🔄 Restauration du stock pour: ${orderItem.item_name}`);
      const { data: menuIngredients, error } = await supabase
        .from('menu_ingredients')
        .select(`
          inventory_item_id,
          quantity_required,
          unit,
          inventory_items (
            id,
            name,
            current_quantity
          )
        `)
        .eq('menu_id', orderItem.menu_item_id);
      if (error) {
        console.error('Erreur récupération ingrédients:', error);
        return;
      }
      if (!menuIngredients || menuIngredients.length === 0) {
        console.log('ℹ️ Aucun ingrédient à restaurer pour ce menu');
        return;
      }
      for (const ingredient of menuIngredients) {
        const quantityToRestore = ingredient.quantity_required * orderItem.quantity;
        const inventoryItemId = ingredient.inventory_item_id;
        const currentStock = ingredient.inventory_items?.current_quantity || 0;
        const newQuantity = currentStock + quantityToRestore;
        console.log(`➕ Restauration: ${ingredient.inventory_items?.name} + ${quantityToRestore} ${ingredient.unit}`);
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            current_quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', inventoryItemId);
        if (updateError) {
          console.error(`❌ Erreur mise à jour stock ${ingredient.inventory_items?.name}:`, updateError);
          continue;
        }
        await supabase
          .from('inventory_transactions')
          .insert({
            inventory_item_id: inventoryItemId,
            transaction_type: 'cancellation',
            quantity: quantityToRestore,
            reference_type: 'order',
            reference_id: orderItem.order_id,
            notes: `Annulation commande: ${orderItem.item_name}, quantité: ${orderItem.quantity}`,
            created_by: user?.id
          });
        console.log(`✅ Stock restauré: ${ingredient.inventory_items?.name} → ${newQuantity} ${ingredient.unit}`);
      }
    } catch (error) {
      console.error('❌ Erreur dans restoreMenuStock:', error);
    }
  };

  // 🔥 CORRECTION #9 : restoreBottleStock gère à la fois 'bottle' ET 'consumption'
  const restoreBottleStock = async (orderItem: any) => {
    try {
      const menuItem = orderItem.pos_menus;
      // ✅ Gérer à la fois 'bottle' ET 'consumption'
      if (!menuItem || (menuItem.sale_type !== 'bottle' && menuItem.sale_type !== 'consumption')) return;
      const servingsToRestore = orderItem.quantity;
      const newServings = (menuItem.current_servings || 0) + servingsToRestore;
      console.log(`🍾 Restauration bouteille: ${menuItem.name} + ${servingsToRestore} consommations`);
      const { error } = await supabase
        .from('pos_menus')
        .update({
          current_servings: newServings,
          is_available: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItem.menu_item_id);
      if (error) throw error;
      console.log(`✅ Bouteille restaurée: ${menuItem.name} → ${newServings} consommations`);
    } catch (error) {
      console.error('❌ Erreur restauration bouteille:', error);
    }
  };

  const handleCancelCompleteOrder = async (orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId);
    if (order?.status === 'ready') {
      alert('Cette commande est prête à payer. Impossible de l\'annuler.');
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ? Tous les articles seront supprimés et le stock sera restauré.')) return;
    try {
      const { data: order, error: orderError } = await supabase
        .from('pos_orders')
        .select('*, pos_order_items(*), table_id')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;
      await restoreStock(orderId);
      let itemsCancelled = false;
      try {
        const { error: itemsError } = await supabase
          .from('pos_order_items')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', orderId);
        if (!itemsError) {
          itemsCancelled = true;
        } else if (itemsError.code === '23514') {
          console.warn('Constraint check failed, deleting items instead...');
          const { error: deleteError } = await supabase
            .from('pos_order_items')
            .delete()
            .eq('order_id', orderId);
          if (deleteError) throw deleteError;
          itemsCancelled = true;
        } else {
          throw itemsError;
        }
      } catch (itemsError: any) {
        console.error('Error processing order items:', itemsError);
      }
      const updateData: any = {
        status: 'cancelled',
        notes: `Commande annulée - ${order.notes || ''} - ${new Date().toLocaleString('fr-FR')}`,
        updated_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id
      };
      try {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_by = user?.id;
      } catch (error) {
        console.log('Champs cancelled_at/cancelled_by non disponibles');
      }
      const { error: orderUpdateError } = await supabase
        .from('pos_orders')
        .update(updateData)
        .eq('id', orderId);
      if (orderUpdateError) throw orderUpdateError;
      if (order.table_id) {
        await supabase
          .from('pos_tables')
          .update({
            status: 'available',
            current_order_id: null
          })
          .eq('id', order.table_id);
      }
      alert('Commande annulée avec succès' + (itemsCancelled ? '' : ' (certains articles n\'ont pas pu être annulés)'));
      loadTablesAndOrders();
      if (currentOrder?.id === orderId) {
        closeOrderView();
      }
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      if (error.code === '23514') {
        alert(`Erreur: La contrainte de statut bloque l'annulation.
Exécutez cette commande SQL dans Supabase:
ALTER TABLE pos_order_items DROP CONSTRAINT IF EXISTS pos_order_items_status_check;
ALTER TABLE pos_order_items ADD CONSTRAINT pos_order_items_status_check CHECK (status IN ('ordered', 'preparing', 'ready', 'served', 'cancelled'));`);
      } else {
        alert(`Erreur lors de l'annulation de la commande: ${error.message}`);
      }
    }
  };

  const addNewTable = async () => {
    if (!newTableNumber.trim() || !user) {
      setTableError('Veuillez entrer un numéro de table');
      return;
    }
    try {
      setTableError('');
      const { data: existingTable, error: checkError } = await supabase
        .from('pos_tables')
        .select('id')
        .eq('table_number', newTableNumber.trim());
      if (checkError && checkError.code !== '22P02') {
        throw checkError;
      }
      if (existingTable && existingTable.length > 0) {
        setTableError('Ce numéro de table existe déjà');
        return;
      }
      const { data: newTable, error } = await supabase
        .from('pos_tables')
        .insert({
          table_number: newTableNumber.trim(),
          capacity: newTableCapacity,
          status: 'available',
          is_active: true
        })
        .select()
        .single();
      if (error) {
        if (error.code === '22P02') {
          setTableError('Erreur: La colonne table_number doit être modifiée en type TEXT dans la base de données');
          return;
        }
        throw error;
      }
      if (newTable) {
        setTables(prev => [...prev, newTable]);
        setNewTableNumber('');
        setNewTableCapacity(4);
        setShowTableForm(false);
        setTableError('');
        alert('Table ajoutée avec succès !');
      }
    } catch (error: any) {
      console.error('Error adding table:', error);
      setTableError(`Erreur lors de l'ajout de la table: ${error.message}`);
    }
  };

  const updateTable = async () => {
    if (!editingTable || !newTableNumber.trim()) return;
    try {
      setTableError('');
      const { data: existingTable, error: checkError } = await supabase
        .from('pos_tables')
        .select('id')
        .eq('table_number', newTableNumber.trim())
        .neq('id', editingTable.id);
      if (checkError && checkError.code !== '22P02') {
        throw checkError;
      }
      if (existingTable && existingTable.length > 0) {
        setTableError('Ce numéro de table existe déjà');
        return;
      }
      const { error } = await supabase
        .from('pos_tables')
        .update({
          table_number: newTableNumber.trim(),
          capacity: newTableCapacity
        })
        .eq('id', editingTable.id);
      if (error) {
        if (error.code === '22P02') {
          setTableError('Erreur: La colonne table_number doit être modifiée en type TEXT dans la base de données');
          return;
        }
        throw error;
      }
      setTables(prev => prev.map(table =>
        table.id === editingTable.id
          ? { ...table, table_number: newTableNumber.trim(), capacity: newTableCapacity }
          : table
      ));
      setEditingTable(null);
      setNewTableNumber('');
      setNewTableCapacity(4);
      setTableError('');
      alert('Table modifiée avec succès !');
    } catch (error: any) {
      console.error('Error updating table:', error);
      setTableError(`Erreur lors de la modification de la table: ${error.message}`);
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette table ?')) return;
    try {
      const table = tables.find(t => t.id === tableId);
      if (table?.status === 'occupied') {
        alert('Impossible de supprimer une table occupée');
        return;
      }
      const { error } = await supabase
        .from('pos_tables')
        .delete()
        .eq('id', tableId);
      if (error) throw error;
      setTables(prev => prev.filter(t => t.id !== tableId));
      alert('Table supprimée avec succès');
    } catch (error) {
      console.error('Error deleting table:', error);
      alert('Erreur lors de la suppression de la table');
    }
  };

  const startNewOrder = async (table: Table) => {
    if (!user) return;
    const orderNumber = `CMD-${Date.now()}`;
    const { data: newOrder, error } = await supabase
      .from('pos_orders')
      .insert({
        table_id: table.id,
        table_number: table.table_number,
        order_number: orderNumber,
        customer_count: 1,
        status: 'open',
        order_type: 'sur_place',
        created_by: user.id,
        server_name: user.user_metadata?.full_name || 'Serveur'
      })
      .select()
      .single();
    if (error) {
      console.error('Error creating order:', error);
      alert('Erreur lors de la création de la commande');
      return;
    }
    if (newOrder) {
      await supabase
        .from('pos_tables')
        .update({
          status: 'occupied',
          current_order_id: newOrder.id
        })
        .eq('id', table.id);
      setCurrentOrder({ ...newOrder, items: [], order_type: 'sur_place' });
      setSelectedTable(table);
      setView('order');
      loadTablesAndOrders();
    }
  };

  const switchToOrder = async (order: Order) => {
    const table = tables.find(t => t.id === order.table_id);
    const { data: orderWithItems, error } = await supabase
      .from('pos_orders')
      .select(`
        *,
        pos_order_items(*)
      `)
      .eq('id', order.id)
      .single();
    if (error) {
      console.error('Error loading order details:', error);
      return;
    }
    const updatedOrder = {
      ...orderWithItems,
      items: orderWithItems.pos_order_items || [],
      order_type: orderWithItems.order_type || 'sur_place',
      tickets_generated: orderWithItems.tickets_generated || false,
      tickets_data: orderWithItems.tickets_data || {
        kitchenItems: [],
        barItems: [],
        allGenerated: false
      }
    };
    setCurrentOrder(updatedOrder);
    setSelectedTable(table || null);
    setView('order');
  };

  const closeOrderView = () => {
    setCurrentOrder(null);
    setSelectedTable(null);
    setView('overview');
    loadTablesAndOrders();
  };

  const openTableForm = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setNewTableNumber(table.table_number);
      setNewTableCapacity(table.capacity);
    } else {
      setEditingTable(null);
      setNewTableNumber('');
      setNewTableCapacity(4);
    }
    setTableError('');
    setShowTableForm(true);
  };

  const handleTableFormSubmit = () => {
    if (editingTable) {
      updateTable();
    } else {
      addNewTable();
    }
  };

  const refreshOrders = () => {
    loadTablesAndOrders();
  };

  if (loading && !menuData) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-700">Chargement initial...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion Multi-Commandes</h1>
            <p className="text-gray-600">Gérez plusieurs commandes simultanément</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={refreshOrders}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Actualiser
            </button>
            <button
              onClick={() => window.location.href = '/cancelled-orders'}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center"
            >
              <History className="w-4 h-4 inline mr-2" />
              Historique Annulées
            </button>
            <button
              onClick={() => setView('tables')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Nouvelle Commande
            </button>
            <button
              onClick={() => openTableForm()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Ajouter Table
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 p-6">
        {view === 'overview' && (
          <OrderOverview
            activeOrders={activeOrders}
            tables={tables}
            onSwitchToOrder={switchToOrder}
            onStartNewOrder={startNewOrder}
            onEditTable={openTableForm}
            onDeleteTable={deleteTable}
            onCancelOrder={handleCancelCompleteOrder}
          />
        )}
        {view === 'tables' && (
          <TableView
            tables={tables}
            onTableSelect={startNewOrder}
            onBack={() => setView('overview')}
            onAddTable={() => openTableForm()}
            onEditTable={openTableForm}
            onDeleteTable={deleteTable}
          />
        )}
        {view === 'order' && currentOrder && menuData && (
          <OrderView
            order={currentOrder}
            table={selectedTable}
            onOrderUpdated={loadTablesAndOrders}
            onClose={closeOrderView}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            servers={servers}
            onCancelOrder={handleCancelCompleteOrder}
            menuData={menuData}
            refreshOrder={() => switchToOrder(currentOrder)}
            setCurrentOrder={setCurrentOrder}
            currentOrder={currentOrder}
          />
        )}
      </div>
      {showTableForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingTable ? 'Modifier la Table' : 'Ajouter une Table'}
              </h3>
              <button
                onClick={() => setShowTableForm(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {tableError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm">{tableError}</p>
                  {tableError.includes('doit être modifiée en type TEXT') && (
                    <p className="text-red-600 text-xs mt-2">
                      Exécutez cette commande SQL dans votre base de données :
                      <code className="block bg-red-100 p-2 rounded mt-1 text-xs">
                        ALTER TABLE pos_tables ALTER COLUMN table_number TYPE TEXT;
                      </code>
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de Table *
                </label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => {
                    setNewTableNumber(e.target.value);
                    setTableError('');
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 1, A1, B2, Terrasse, Jardin..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les numéros alpha-numériques sont acceptés (ex: A1, Terrasse-1, Bar-2)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacité (personnes) *
                </label>
                <input
                  type="number"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 4)}
                  required
                  min="1"
                  max="20"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowTableForm(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleTableFormSubmit}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  {editingTable ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderOverview({
  activeOrders,
  tables,
  onSwitchToOrder,
  onStartNewOrder,
  onEditTable,
  onDeleteTable,
  onCancelOrder
}: {
  activeOrders: Order[];
  tables: Table[];
  onSwitchToOrder: (order: Order) => void;
  onStartNewOrder: (table: Table) => void;
  onEditTable: (table: Table) => void;
  onDeleteTable: (tableId: string) => void;
  onCancelOrder: (orderId: string) => void;
}) {
  const availableTables = tables.filter(t => t.status === 'available' && t.is_active);
  const occupiedTables = tables.filter(t => t.status === 'occupied' && t.is_active);

  const calculateTotalFromItems = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const getOrderTypeIcon = (orderType: string) => {
    switch (orderType) {
      case 'sur_place': return <Utensils className="w-4 h-4" />;
      case 'a_emporter': return <Home className="w-4 h-4" />;
      case 'livraison': return <Truck className="w-4 h-4" />;
      default: return <Utensils className="w-4 h-4" />;
    }
  };

  const getOrderTypeColor = (orderType: string) => {
    switch (orderType) {
      case 'sur_place': return 'bg-blue-100 text-blue-800';
      case 'a_emporter': return 'bg-green-100 text-green-800';
      case 'livraison': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'open': return { color: 'bg-yellow-100 text-yellow-800', text: 'En cours' };
      case 'confirmed': return { color: 'bg-blue-100 text-blue-800', text: 'Confirmée' };
      case 'ready': return { color: 'bg-green-100 text-green-800', text: 'Prête à payer' };
      default: return { color: 'bg-gray-100 text-gray-800', text: status };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Commandes en Cours</h2>
          <div className="text-sm text-gray-600">
            {activeOrders.length} commande(s) active(s)
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeOrders.map(order => {
            const statusInfo = getStatusInfo(order.status);
            const orderItems = order.items || [];
            const displayAmount = order.total_amount || calculateTotalFromItems(orderItems);
            return (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        Table {order.table_number}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getOrderTypeColor(order.order_type || 'sur_place')}`}>
                        {getOrderTypeIcon(order.order_type || 'sur_place')}
                        <span className="ml-1 capitalize">
                          {(order.order_type || 'sur_place').replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{order.order_number}</p>
                    {order.server_name && (
                      <p className="text-xs text-blue-600 mt-1">
                        Serveur: {order.server_name}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.text}
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  {orderItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate">{item.quantity}x {item.item_name}</span>
                      <span className="whitespace-nowrap">{item.total_price.toLocaleString()} f CFA</span>
                    </div>
                  ))}
                  {orderItems.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{orderItems.length - 3} autre(s) article(s)
                    </div>
                  )}
                  {orderItems.length === 0 && (
                    <div className="text-xs text-gray-500 italic">
                      Aucun article
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <div className="text-sm font-semibold">
                    {displayAmount.toLocaleString()} f CFA
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSwitchToOrder(order)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={order.status === 'ready'}
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={() => onCancelOrder(order.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={order.status === 'ready'}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {activeOrders.filter(o => o.status === 'confirmed').length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Commandes Prêtes à Payer</h2>
                <div className="text-sm text-orange-600 font-semibold">
                  {activeOrders.filter(o => o.status === 'confirmed').length} commande(s)
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeOrders
                  .filter(order => order.status === 'confirmed')
                  .map(order => {
                    const orderItems = order.items || [];
                    const displayAmount = order.total_amount || calculateTotalFromItems(orderItems);
                    return (
                      <div key={order.id} className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Table {order.table_number}
                            </h3>
                            <p className="text-sm text-gray-600">{order.order_number}</p>
                            {order.server_name && (
                              <p className="text-xs text-blue-600 mt-1">
                                Serveur: {order.server_name}
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Prête à payer
                          </span>
                        </div>
                        <div className="space-y-2 mb-3">
                          {orderItems.slice(0, 3).map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="truncate">{item.quantity}x {item.item_name}</span>
                              <span className="whitespace-nowrap">{item.total_price.toLocaleString()} f CFA</span>
                            </div>
                          ))}
                          {orderItems.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{orderItems.length - 3} autre(s) article(s)
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center border-t border-orange-200 pt-3">
                          <div className="text-sm font-semibold">
                            {displayAmount.toLocaleString()} f CFA
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => onSwitchToOrder(order)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                            >
                              Voir détails
                            </button>
                            <button
                              onClick={() => {
                                const paymentEvent = new CustomEvent('navigate-to-payment', {
                                  detail: { orderId: order.id }
                                });
                                window.dispatchEvent(paymentEvent);
                              }}
                              className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition"
                            >
                              Payer maintenant
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {activeOrders.length === 0 && (
            <div className="col-span-3 text-center py-8 bg-white rounded-lg border">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Aucune commande en cours</p>
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Tables Disponibles</h2>
          <div className="text-sm text-gray-600">
            {availableTables.length} table(s) disponible(s)
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {availableTables.map(table => (
            <div
              key={table.id}
              className="bg-green-100 border-2 border-green-300 p-4 rounded-lg text-green-800 hover:bg-green-200 transition text-center group relative cursor-pointer"
              onClick={() => onStartNewOrder(table)}
            >
              <div className="font-bold text-lg">Table {table.table_number}</div>
              <div className="text-sm">{table.capacity} places</div>
              <div className="text-xs mt-2">Disponible</div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTable(table);
                  }}
                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTable(table.id);
                  }}
                  className="p-1 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
          {availableTables.length === 0 && (
            <div className="col-span-6 text-center py-4 text-gray-500 bg-white rounded-lg border">
              Aucune table disponible
            </div>
          )}
        </div>
      </div>
      {occupiedTables.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tables Occupées</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {occupiedTables.map(table => (
              <div
                key={table.id}
                className="bg-red-100 border-2 border-red-300 p-4 rounded-lg text-red-800 text-center relative"
              >
                <div className="font-bold text-lg">Table {table.table_number}</div>
                <div className="text-sm">{table.capacity} places</div>
                <div className="text-xs mt-2">Occupée</div>
                <div className="absolute top-2 right-2">
                  <div
                    onClick={() => onEditTable(table)}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TableView({
  tables,
  onTableSelect,
  onBack,
  onAddTable,
  onEditTable,
  onDeleteTable
}: any) {
  const availableTables = tables.filter((t: Table) => t.status === 'available' && t.is_active);
  const occupiedTables = tables.filter((t: Table) => t.status === 'occupied' && t.is_active);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sélectionnez une table</h2>
        <div className="flex space-x-3">
          <button
            onClick={onAddTable}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Ajouter Table
          </button>
          <button
            onClick={onBack}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Retour
          </button>
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tables Disponibles ({availableTables.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {availableTables.map((table: Table) => (
            <div key={table.id} className="relative group">
              <div
                onClick={() => onTableSelect(table)}
                className="w-full bg-green-100 border-2 border-green-300 p-6 rounded-lg text-green-800 hover:bg-green-200 transition text-center cursor-pointer"
              >
                <div className="text-2xl mb-2">Table {table.table_number}</div>
                <div className="text-sm font-normal">{table.capacity} places</div>
                <div className="text-xs mt-2">Disponible</div>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <div
                  onClick={() => onEditTable(table)}
                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                </div>
                <div
                  onClick={() => onDeleteTable(table.id)}
                  className="p-1 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {occupiedTables.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tables Occupées ({occupiedTables.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {occupiedTables.map((table: Table) => (
              <div key={table.id} className="relative">
                <div className="w-full bg-red-100 border-2 border-red-300 p-6 rounded-lg text-red-800 text-center">
                  <div className="text-2xl mb-2">Table {table.table_number}</div>
                  <div className="text-sm font-normal">{table.capacity} places</div>
                  <div className="text-xs mt-2">Occupée</div>
                </div>
                <div className="absolute top-2 right-2 flex space-x-1">
                  <div
                    onClick={() => onEditTable(table)}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tables.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Aucune table configurée</p>
          <button
            onClick={onAddTable}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >
            Ajouter la première table
          </button>
        </div>
      )}
    </div>
  );
}

function OrderView({
  order,
  table,
  onOrderUpdated,
  onClose,
  searchTerm,
  onSearchChange,
  servers,
  onCancelOrder,
  menuData,
  refreshOrder,
  setCurrentOrder,
  currentOrder: parentCurrentOrder
}: any) {
  const { user } = useAuth();
  const { settings } = useRestaurant();
  const [customerCount, setCustomerCount] = useState(order.customer_count || 1);
  const [orderNotes, setOrderNotes] = useState(order.notes || '');
  const [selectedServer, setSelectedServer] = useState(order.server_id || '');
  const [serverName, setServerName] = useState(order.server_name || user?.user_metadata?.full_name || '');
  const [localOrderItems, setLocalOrderItems] = useState<any[]>(order.items || []);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'sur_place' | 'a_emporter' | 'livraison'>(order.order_type || 'sur_place');
  const [deliveryFee, setDeliveryFee] = useState(order.delivery_fee || 0);
  const [deliveryAddress, setDeliveryAddress] = useState(order.delivery_address || '');
  const [customerName, setCustomerName] = useState(order.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || '');
  const [orderStatus, setOrderStatus] = useState(order.status || 'open');
  const [isGeneratingTickets, setIsGeneratingTickets] = useState(false);
  const [ticketsGenerated, setTicketsGenerated] = useState(order.tickets_generated || false);
  const [isSendingToCashier, setIsSendingToCashier] = useState(false);
  const [generatedTickets, setGeneratedTickets] = useState<{
    kitchenItems: string[];
    barItems: string[];
    allGenerated: boolean;
  }>(order.tickets_data || {
    kitchenItems: [],
    barItems: [],
    allGenerated: false
  });

  useEffect(() => {
    setLocalOrderItems(order.items || []);
    setOrderStatus(order.status || 'open');
    setTicketsGenerated(order.tickets_generated || false);
    setGeneratedTickets(order.tickets_data || {
      kitchenItems: [],
      barItems: [],
      allGenerated: false
    });
  }, [order]);

  const updateTicketsInDatabase = async (ticketsData: any) => {
    try {
      await supabase
        .from('pos_orders')
        .update({
          tickets_data: ticketsData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
    } catch (error) {
      console.error('Erreur mise à jour tickets:', error);
    }
  };

  const updateServer = async (serverId: string) => {
    try {
      const selectedServer = servers.find(s => s.id === serverId);
      const serverName = selectedServer ? `${selectedServer.first_name} ${selectedServer.last_name}` : '';
      const { error } = await supabase
        .from('pos_orders')
        .update({
          server_id: serverId,
          server_name: serverName
        })
        .eq('id', order.id);
      if (error) throw error;
      setServerName(serverName);
    } catch (error) {
      console.error('Error updating server:', error);
    }
  };

  const updateOrderType = async () => {
    try {
      const updateData: any = {
        order_type: orderType,
        delivery_fee: deliveryFee,
        updated_at: new Date().toISOString()
      };
      try {
        updateData.delivery_address = deliveryAddress;
        updateData.customer_name = customerName;
        updateData.customer_phone = customerPhone;
      } catch (error) {
        console.log('Certains champs optionnels ne sont pas disponibles');
      }
      const { error } = await supabase
        .from('pos_orders')
        .update(updateData)
        .eq('id', order.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating order type:', error);
    }
  };

  const identifyItemType = (item: any) => {
    const categoryName = item.category?.toLowerCase() || '';
    const isBarItem = (
      categoryName.includes('boisson') ||
      categoryName.includes('bar') ||
      categoryName.includes('drink') ||
      categoryName.includes('vin') ||
      categoryName.includes('bière') ||
      categoryName.includes('cocktail') ||
      categoryName.includes('soda')
    );
    return isBarItem ? 'bar' : 'kitchen';
  };

  const generateAllTickets = async () => {
    if (localOrderItems.length === 0) {
      alert('Veuillez ajouter des articles au panier avant de générer les tickets');
      return;
    }
    setIsGeneratingTickets(true);
    try {
      const kitchenItems = localOrderItems.filter(item =>
        identifyItemType(item) === 'kitchen'
      );
      const barItems = localOrderItems.filter(item =>
        identifyItemType(item) === 'bar'
      );
      if (kitchenItems.length > 0) {
        await generateGroupedKitchenTicket(kitchenItems, settings);
      }
      if (barItems.length > 0) {
        await generateGroupedBarTicket(barItems, settings);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      const ticketsData = {
        kitchenItems: kitchenItems.map(item => item.id),
        barItems: barItems.map(item => item.id),
        allGenerated: true
      };
      await supabase
        .from('pos_orders')
        .update({
          tickets_generated: true,
          tickets_data: ticketsData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      setGeneratedTickets(ticketsData);
      setTicketsGenerated(true);
      alert(`✅ Tickets imprimés automatiquement !
🍽️ CUISINE : ${kitchenItems.length} article(s)
 BAR : ${barItems.length} article(s)`);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'impression des tickets');
    } finally {
      setIsGeneratingTickets(false);
    }
  };

  const generateGroupedKitchenTicket = async (kitchenItems: any[], settings: any) => {
    const itemsByCategory: { [key: string]: any[] } = {};
    kitchenItems.forEach(item => {
      const category = item.category || 'Cuisine';
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
      }
      itemsByCategory[category].push(item);
    });
    for (const [categoryName, items] of Object.entries(itemsByCategory)) {
      const ticketContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `
<div style="text-align: center; margin-bottom: 10px;">
<img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain; filter: grayscale(100%);" />
</div>
` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
<div class="ticket-title">⭐ BON DE CUISINE ⭐</div>
<div class="service-indicator">SERVICE CUISINE</div>
</div>
<div class="section">
<h3>INFORMATIONS COMMANDE</h3>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N°Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Créer par:</strong><span>${user?.user_metadata?.full_name || user?.email || 'Utilisateur'}</span></div>
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Catégorie:</strong><strong>${categoryName.toUpperCase()}</strong></div>
</div>
</div>
</div>
<div class="section">
<h3>ARTICLES À PRÉPARER (${items.length})</h3>
<table class="items-table">
<thead><tr><th class="left">Article</th><th class="center">Qté</th><th class="center">Notes</th></tr></thead>
<tbody>
${items.map(item => `
<tr>
<td class="left"><strong>${item.item_name}</strong></td>
<td class="center"><strong>${item.quantity}</strong></td>
<td class="center">${item.kitchen_note ? `<div class="note-indicator" title="${item.kitchen_note}">📝</div>` : '-'}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
<div class="footer">
<p class="thank-you">Total ${items.length} article(s) pour ${categoryName}</p>
<p class="signature">Service Cuisine - ${settings?.name || 'Restaurant'}</p>
<div class="timestamp">Imprimé le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.info-row:last-child { border-bottom: none; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000 !important; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.ticket-title { font-size: 13px; font-weight: bold; color: #000000 !important; margin: 4px 0; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f5f5f5 !important; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; border: 1px solid #cccccc !important; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table th { border-bottom: 2px solid #000000 !important; padding: 5px 0; font-weight: bold; color: #000000 !important; background: #f0f0f0 !important; font-size: 11px; }
.items-table td { padding: 5px 0; border-bottom: 1px dotted #000000 !important; font-weight: bold; font-size: 11px; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.note-indicator { cursor: help; font-size: 12px; }
.footer { text-align: center; margin-top: 15px; border-top: 2px dashed #000000 !important; padding-top: 10px; font-size: 10px; }
.thank-you { font-style: italic; color: #000000 !important; font-weight: bold; margin-bottom: 4px; }
.signature { color: #000000 !important; font-size: 9px; margin-bottom: 3px; }
.service-indicator { font-size: 11px; font-weight: bold; color: #d35400; background: #fef9e7; padding: 3px 8px; border-radius: 20px; display: inline-block; margin-top: 4px; border: 1px solid #f8c471; }
.timestamp { color: #000000 !important; font-size: 8px; font-style: italic; }
@media print { body { margin: 0; } .receipt { padding: 8px; } * { color: #000000 !important; } }
</style>`;
      await printTicket(ticketContent, `Bon de Cuisine - ${categoryName}`);
      await waitForPrint();
    }
  };

  const generateGroupedBarTicket = async (barItems: any[], settings: any) => {
    const itemsByCategory: { [key: string]: any[] } = {};
    barItems.forEach(item => {
      const category = item.category || 'Bar';
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
      }
      itemsByCategory[category].push(item);
    });
    for (const [categoryName, items] of Object.entries(itemsByCategory)) {
      const ticketContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `
<div style="text-align: center; margin-bottom: 10px;">
<img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain; filter: grayscale(100%);" />
</div>
` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
<div class="ticket-title">🍷 BON DE BAR 🍷</div>
</div>
<div class="section">
<h3>INFORMATIONS COMMANDE</h3>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N°Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Créer par:</strong><span>${user?.user_metadata?.full_name || user?.email || 'Utilisateur'}</span></div>
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Catégorie:</strong><strong>${categoryName.toUpperCase()}</strong></div>
</div>
</div>
</div>
<div class="section">
<h3>ARTICLES À PRÉPARER (${items.length})</h3>
<table class="items-table">
<thead><tr><th class="left">Article</th><th class="center">Qté</th><th class="right">Prix U.</th><th class="center">Total</th></tr></thead>
<tbody>
${items.map(item => `
<tr>
<td class="left"><strong>${item.item_name}</strong></td>
<td class="center"><strong>${item.quantity}</strong></td>
<td class="right">${item.unit_price.toLocaleString()} f CFA</td>
<td class="right"><strong>${item.total_price.toLocaleString()} f CFA</strong></td>
</tr>
`).join('')}
</tbody>
</table>
</div>
<div class="footer">
<p class="thank-you">À votre service ! 🍸🍹</p>
<p class="signature">Service Bar - ${settings?.name || 'Restaurant'}</p>
<div class="timestamp">Imprimé le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.info-row:last-child { border-bottom: none; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000 !important; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.ticket-title { font-size: 13px; font-weight: bold; color: #000000 !important; margin: 4px 0; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f0f0f0 !important; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; border: 1px solid #cccccc !important; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table th { border-bottom: 2px solid #000000 !important; padding: 5px 0; font-weight: bold; color: #000000 !important; background: #e8e8e8 !important; font-size: 11px; }
.items-table td { padding: 5px 0; border-bottom: 1px dotted #000000 !important; font-weight: bold; font-size: 11px; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.footer { text-align: center; margin-top: 15px; border-top: 2px dashed #000000 !important; padding-top: 10px; font-size: 10px; }
.thank-you { font-style: italic; color: #000000 !important; font-weight: bold; margin-bottom: 4px; }
.signature { color: #000000 !important; font-size: 9px; margin-bottom: 3px; }
.timestamp { color: #000000 !important; font-size: 8px; font-style: italic; }
@media print { body { margin: 0; } .receipt { padding: 8px; } * { color: #000000 !important; } }
</style>`;
      await printTicket(ticketContent, `Bon de Bar - ${categoryName}`);
      await waitForPrint();
    }
  };

  const waitForPrint = (): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(resolve, 800);
    });
  };

  const generateGroupedSummaryTicket = async (kitchenItems: any[], barItems: any[], settings: any) => {
    const totals = calculateTotal();
    const kitchenByCategory: { [key: string]: any[] } = {};
    kitchenItems.forEach(item => {
      const category = item.category || 'Cuisine';
      if (!kitchenByCategory[category]) kitchenByCategory[category] = [];
      kitchenByCategory[category].push(item);
    });
    const barByCategory: { [key: string]: any[] } = {};
    barItems.forEach(item => {
      const category = item.category || 'Bar';
      if (!barByCategory[category]) barByCategory[category] = [];
      barByCategory[category].push(item);
    });
    const summaryContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain; filter: grayscale(100%);" /></div>` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
<div class="ticket-title">📋 RÉCAPITULATIF COMMANDE</div>
</div>
<div class="section">
<h2>INFORMATIONS COMMANDE</h2>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N° Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Clients:</strong><span>${customerCount} personne(s)</span></div>
</div>
</div>
</div>
${Object.keys(kitchenByCategory).length > 0 ? `
<div class="section">
<h3>CUISINE (${kitchenItems.length} article(s))</h3>
${Object.entries(kitchenByCategory).map(([category, items]) => `
<div class="category-section">
<h4>${category.toUpperCase()} (${items.length} article(s))</h4>
<table class="items-table"><tbody>
${items.map(item => `<tr><td class="left">${item.item_name}</td><td class="center">${item.quantity}x</td><td class="right">${item.total_price.toLocaleString()} f CFA</td></tr>`).join('')}
</tbody></table>
</div>
`).join('')}
</div>` : ''}
${Object.keys(barByCategory).length > 0 ? `
<div class="section">
<h3>BAR (${barItems.length} article(s))</h3>
${Object.entries(barByCategory).map(([category, items]) => `
<div class="category-section">
<h4>${category.toUpperCase()} (${items.length} article(s))</h4>
<table class="items-table"><tbody>
${items.map(item => `<tr><td class="left">${item.item_name}</td><td class="center">${item.quantity}x</td><td class="right">${item.total_price.toLocaleString()} f CFA</td></tr>`).join('')}
</tbody></table>
</div>
`).join('')}
</div>` : ''}
<div class="section">
<h3>RÉCAPITULATIF GÉNÉRAL</h3>
<table class="total-table">
<tr><td><strong>Nombre de catégories cuisine:</strong></td><td class="right"><strong>${Object.keys(kitchenByCategory).length}</strong></td></tr>
<tr><td><strong>Nombre de catégories bar:</strong></td><td class="right"><strong>${Object.keys(barByCategory).length}</strong></td></tr>
<tr><td><strong>Total articles:</strong></td><td class="right"><strong>${localOrderItems.length} article(s)</strong></td></tr>
<tr><td><strong>Sous-total:</strong></td><td class="right"><strong>${totals.subtotal.toLocaleString()} f CFA</strong></td></tr>
${totals.deliveryFee > 0 ? `<tr><td>Frais de livraison:</td><td class="right">${totals.deliveryFee.toLocaleString()} f CFA</td></tr>` : ''}
<tr><td><strong>TOTAL GÉNÉRAL:</strong></td><td class="right"><strong>${totals.total.toLocaleString()} f CFA</strong></td></tr>
</table>
</div>
<div class="footer">
<p class="thank-you">Récapitulatif généré le ${new Date().toLocaleString('fr-FR')}</p>
<p class="signature">${settings?.name || 'Restaurant'}</p>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000 !important; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.ticket-title { font-size: 13px; font-weight: bold; color: #000000 !important; margin: 4px 0; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f0f0f0 !important; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; }
.category-section { margin-bottom: 8px; }
.category-section h4 { font-size: 10px; color: #000000 !important; margin: 6px 0 3px 0; padding-left: 4px; border-left: 3px solid #000000 !important; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table td { padding: 3px 0; border-bottom: 1px dotted #000000 !important; font-size: 11px; }
.total-table td { padding: 5px 0; font-weight: bold; border-bottom: 1px solid #000000 !important; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000000 !important; padding-top: 10px; font-size: 10px; }
.thank-you { font-style: italic; color: #000000 !important; font-weight: bold; margin-bottom: 4px; }
.signature { color: #000000 !important; font-size: 9px; }
@media print { body { margin: 0; } .receipt { padding: 8px; } * { color: #000000 !important; } }
</style>`;
    await printTicket(summaryContent, 'Récapitulatif Commande');
    await waitForPrint();
  };

  const filterMenuItems = (items: MenuItem[], search: string) => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      (menuData.categories.find(c => c.id === item.category_id)?.name.toLowerCase().includes(searchLower))
    );
  };

  const updateOrderTotals = async (orderId: string) => {
    try {
      const { data: items, error } = await supabase
        .from('pos_order_items')
        .select('*')
        .eq('order_id', orderId);
      if (error) throw error;
      const subtotal = items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      const taxAmount = subtotal * 0;
      const totalAmount = subtotal + taxAmount + deliveryFee;
      await supabase
        .from('pos_orders')
        .update({
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    } catch (error) {
      console.error('Error updating order totals:', error);
    }
  };

  // 🔥 CORRECTION #1 : checkAndConsumeStock gère maintenant les consommations (UNIQUEMENT pour sale_type === 'consumption')
  const checkAndConsumeStock = async (menuItemId: string, quantity: number) => {
    try {
      console.log(`🔍 Vérification du stock pour le menu ${menuItemId}, quantité: ${quantity}`);
      
      // 1. Vérifier et consommer les ingrédients
      const { data: menuIngredients, error: ingredientsError } = await supabase
        .from('menu_ingredients')
        .select(`
          inventory_item_id,
          quantity_required,
          unit,
          inventory_items (id, name, current_quantity, unit)
        `)
        .eq('menu_id', menuItemId);

      if (ingredientsError) {
        console.error('Erreur récupération ingrédients:', ingredientsError);
        return { success: false, message: 'Erreur lors de la récupération des ingrédients' };
      }

      if (menuIngredients && menuIngredients.length > 0) {
        const stockWarnings = [];
        for (const ingredient of menuIngredients) {
          const requiredQuantity = ingredient.quantity_required * quantity;
          const currentStock = ingredient.inventory_items?.current_quantity || 0;
          if (currentStock < requiredQuantity) {
            stockWarnings.push(`${ingredient.inventory_items?.name}: Stock insuffisant (${currentStock} ${ingredient.unit} disponible, ${requiredQuantity} ${ingredient.unit} requis)`);
          }
        }

        if (stockWarnings.length > 0) {
          return { success: false, message: `Stock insuffisant:\n${stockWarnings.join('\n')}` };
        }

        for (const ingredient of menuIngredients) {
          const requiredQuantity = ingredient.quantity_required * quantity;
          const inventoryItemId = ingredient.inventory_item_id;
          const currentStock = ingredient.inventory_items?.current_quantity || 0;
          const newQuantity = currentStock - requiredQuantity;

          await supabase
            .from('inventory_items')
            .update({ current_quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', inventoryItemId);

          await supabase
            .from('inventory_transactions')
            .insert({
              inventory_item_id: inventoryItemId,
              transaction_type: 'sale',
              quantity: -requiredQuantity,
              reference_type: 'order',
              reference_id: order.id,
              notes: `Vente menu: ${menuItemId}, quantité: ${quantity}`,
              created_by: user?.id
            });
        }
      }

      // 2. Vérifier et consommer les consommations de bouteilles (UNIQUEMENT pour sale_type === 'consumption')
      const { data: menuItem, error: menuError } = await supabase
        .from('pos_menus')
        .select('sale_type, current_servings, servings_per_bottle, is_available, name')
        .eq('id', menuItemId)
        .single();

      if (menuError) {
        console.error('Erreur récupération menu:', menuError);
      } else if (menuItem && menuItem.sale_type === 'consumption') {  // 🔥 UNIQUEMENT 'consumption', PAS 'bottle'
        const requiredServings = quantity;
        const currentServings = menuItem.current_servings || 0;
        
        if (currentServings < requiredServings) {
          return { 
            success: false, 
            message: `Pas assez de consommations restantes pour "${menuItem.name}" (${currentServings} disponibles, ${requiredServings} requises)` 
          };
        }

        const newServings = currentServings - requiredServings;
        await supabase
          .from('pos_menus')
          .update({
            current_servings: newServings,
            is_available: newServings > 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', menuItemId);
          
        console.log(` Consommation déduite: ${menuItem.name} → ${newServings} restantes`);
      }

      return { success: true, message: 'Stock consommé avec succès' };
    } catch (error: any) {
      console.error('❌ Erreur dans checkAndConsumeStock:', error);
      return { success: false, message: `Erreur lors de la consommation du stock: ${error.message}` };
    }
  };

  // 🔥 CORRECTION #2 : addItemToOrder sans double vérification et sans handleBottleConsumption
  const addItemToOrder = async (menuItem: MenuItem) => {
    if (!user || isAddingItem) return;
    setIsAddingItem(true);
    try {
      const category = menuData.categories.find(c => c.id === menuItem.category_id);
      const isBarItem = category?.name.toLowerCase().includes('boisson') ||
        category?.name.toLowerCase().includes('bar') ||
        category?.name.toLowerCase().includes('drink') ||
        category?.name.toLowerCase().includes('vin') ||
        category?.name.toLowerCase().includes('bière') ||
        category?.name.toLowerCase().includes('cocktail');

      // ✅ checkAndConsumeStock gère maintenant TOUT (ingrédients + consommations)
      const stockCheckResult = await checkAndConsumeStock(menuItem.id, 1);
      if (!stockCheckResult.success) {
        alert(`❌ Stock insuffisant: ${stockCheckResult.message}`);
        setIsAddingItem(false);
        return;
      }

      const { data: newItem, error } = await supabase
        .from('pos_order_items')
        .insert({
          order_id: order.id,
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          quantity: 1,
          unit_price: menuItem.price,
          total_price: menuItem.price,
          status: 'ordered',
          category: category?.name,
          kitchen_note: !isBarItem ? orderNotes : null,
          bar_note: isBarItem ? orderNotes : null,
        })
        .select()
        .single();

      if (error) throw error;

      if (newItem) {
        const updatedItems = [...localOrderItems, newItem];
        setLocalOrderItems(updatedItems);
        await updateOrderTotals(order.id);

        // ❌ SUPPRIMÉ : handleBottleConsumption n'est plus nécessaire ici
        // if (isBarItem) {
        //   await handleBottleConsumption(newItem);
        // }

        if (generatedTickets.allGenerated) {
          await generateSingleTicket(newItem, category?.name || 'Non catégorisé', isBarItem);
        }

        if (onOrderUpdated) onOrderUpdated();
        if (refreshOrder) refreshOrder();
      }
    } catch (error) {
      console.error('Error in addItemToOrder:', error);
      alert('Erreur lors de l\'ajout de l\'article');
    } finally {
      setIsAddingItem(false);
    }
  };

  const generateTicketsForUngeneratedItems = async () => {
    try {
      const ungeneratedItems = localOrderItems.filter(item =>
        !generatedTickets.kitchenItems.includes(item.id) &&
        !generatedTickets.barItems.includes(item.id)
      );
      if (ungeneratedItems.length === 0) {
        alert('Tous les articles ont déjà des tickets générés.');
        return;
      }
      const kitchenItems = ungeneratedItems.filter(item =>
        identifyItemType(item) === 'kitchen'
      );
      const barItems = ungeneratedItems.filter(item =>
        identifyItemType(item) === 'bar'
      );
      if (kitchenItems.length > 0) {
        await generateGroupedKitchenTicket(kitchenItems, settings);
        setGeneratedTickets(prev => ({
          ...prev,
          kitchenItems: [...prev.kitchenItems, ...kitchenItems.map(item => item.id)]
        }));
      }
      if (barItems.length > 0) {
        await generateGroupedBarTicket(barItems, settings);
        setGeneratedTickets(prev => ({
          ...prev,
          barItems: [...prev.barItems, ...barItems.map(item => item.id)]
        }));
      }
      alert(`✅ ${ungeneratedItems.length} ticket(s) manquant(s) généré(s) !
${kitchenItems.length > 0 ? `🍽️ ${kitchenItems.length} ticket(s) cuisine` : ''}
${barItems.length > 0 ? `🍷 ${barItems.length} ticket(s) bar` : ''}`);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la génération des tickets manquants');
    }
  };

  // 🔥 CORRECTION #7 : generateSingleTicket avec le if/else corrigé
  const generateSingleTicket = async (item: any, category: string, isBarItem: boolean) => {
    try {
      const itemType = isBarItem ? 'bar' : 'kitchen';
      const alreadyGenerated = isBarItem
        ? generatedTickets.barItems.includes(item.id)
        : generatedTickets.kitchenItems.includes(item.id);
      
      if (!alreadyGenerated) {
        // ✅ CORRECTION : Ajout du if (isBarItem) manquant
        if (isBarItem) {
          await generateBarTicket(item, settings);
        } else {
          await generateKitchenTicket(item, settings);
        }
        
        // Mettre à jour l'état local
        const updatedTickets = {
          ...generatedTickets,
          [isBarItem ? 'barItems' : 'kitchenItems']: [
            ...generatedTickets[isBarItem ? 'barItems' : 'kitchenItems'],
            item.id
          ]
        };
        setGeneratedTickets(updatedTickets);
        
        // Sauvegarder dans la base
        await updateTicketsInDatabase(updatedTickets);
        
        alert(`✅ Nouvel article "${item.item_name}" ajouté et ticket envoyé ${isBarItem ? 'au bar' : 'en cuisine'} !`);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du ticket:', error);
      alert('Erreur lors de la génération du ticket pour le nouvel article');
    }
  };

  const handleBottleConsumption = async (orderItem: any) => {
    if (!user) return;
    try {
      const { data: menuItem, error: menuError } = await supabase
        .from('pos_menus')
        .select('sale_type, current_servings, servings_per_bottle')
        .eq('id', orderItem.menu_item_id)
        .single();
      if (menuError) throw menuError;
      if (menuItem && menuItem.sale_type === 'bottle' && menuItem.current_servings > 0) {
        const consumptionsToDeduct = orderItem.quantity;
        if (menuItem.current_servings < consumptionsToDeduct) {
          alert(`Attention: Il ne reste que ${menuItem.current_servings} consommations sur cette bouteille!`);
          return;
        }
        const newServings = menuItem.current_servings - consumptionsToDeduct;
        const { error: updateError } = await supabase
          .from('pos_menus')
          .update({
            current_servings: newServings,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderItem.menu_item_id);
        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error handling bottle consumption:', error);
    }
  };

  // 🔥 CORRECTION #3 : Nouvelle fonction restoreStockForItem
  const restoreStockForItem = async (item: any) => {
    try {
      console.log(`🔄 Restauration stock pour: ${item.item_name} (qté: ${item.quantity})`);
      
      // 1. Restaurer les ingrédients
      const { data: menuIngredients, error } = await supabase
        .from('menu_ingredients')
        .select(`
          inventory_item_id,
          quantity_required,
          unit,
          inventory_items (id, name, current_quantity)
        `)
        .eq('menu_id', item.menu_item_id);

      if (!error && menuIngredients && menuIngredients.length > 0) {
        for (const ingredient of menuIngredients) {
          const quantityToRestore = ingredient.quantity_required * item.quantity;
          const inventoryItemId = ingredient.inventory_item_id;
          const currentStock = ingredient.inventory_items?.current_quantity || 0;
          const newQuantity = currentStock + quantityToRestore;

          await supabase
            .from('inventory_items')
            .update({
              current_quantity: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', inventoryItemId);

          await supabase
            .from('inventory_transactions')
            .insert({
              inventory_item_id: inventoryItemId,
              transaction_type: 'adjustment',
              quantity: quantityToRestore,
              reference_type: 'order_item_removal',
              reference_id: item.id,
              notes: `Suppression article: ${item.item_name} (x${item.quantity})`,
              created_by: user?.id
            });

          console.log(`✅ Stock restauré: ${ingredient.inventory_items?.name} +${quantityToRestore}`);
        }
      }

      // 2. Restaurer les consommations de bouteilles (UNIQUEMENT pour sale_type === 'consumption')
      const { data: menuItem } = await supabase
        .from('pos_menus')
        .select('sale_type, current_servings')
        .eq('id', item.menu_item_id)
        .single();

      if (menuItem && menuItem.sale_type === 'consumption') {  // 🔥 UNIQUEMENT 'consumption'
        const newServings = (menuItem.current_servings || 0) + item.quantity;
        await supabase
          .from('pos_menus')
          .update({
            current_servings: newServings,
            is_available: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.menu_item_id);
        console.log(`🍾 Consommation restaurée: +${item.quantity} → ${newServings} restantes`);
      }
    } catch (error) {
      console.error('❌ Erreur restauration stock:', error);
    }
  };

  // 🔥 CORRECTION #4 : Nouvelle fonction adjustStockForItem
  const adjustStockForItem = async (item: any, quantityDiff: number) => {
    try {
      console.log(`🔄 Ajustement stock pour: ${item.item_name} (diff: ${quantityDiff})`);
      
      // 1. Ajuster les ingrédients
      const { data: menuIngredients, error } = await supabase
        .from('menu_ingredients')
        .select(`
          inventory_item_id,
          quantity_required,
          unit,
          inventory_items (id, name, current_quantity)
        `)
        .eq('menu_id', item.menu_item_id);

      if (!error && menuIngredients && menuIngredients.length > 0) {
        for (const ingredient of menuIngredients) {
          const quantityToAdjust = ingredient.quantity_required * quantityDiff;
          const inventoryItemId = ingredient.inventory_item_id;
          const currentStock = ingredient.inventory_items?.current_quantity || 0;
          const newQuantity = currentStock - quantityToAdjust;

          if (newQuantity < 0) {
            alert(`⚠️ Stock insuffisant pour ${ingredient.inventory_items?.name}`);
            throw new Error('Stock insuffisant');
          }

          await supabase
            .from('inventory_items')
            .update({
              current_quantity: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', inventoryItemId);

          await supabase
            .from('inventory_transactions')
            .insert({
              inventory_item_id: inventoryItemId,
              transaction_type: 'adjustment',
              quantity: -quantityToAdjust,
              reference_type: 'order_item_update',
              reference_id: item.id,
              notes: `Modification quantité: ${item.item_name} (${quantityDiff > 0 ? '+' : ''}${quantityDiff})`,
              created_by: user?.id
            });

          console.log(`✅ Stock ajusté: ${ingredient.inventory_items?.name} → ${newQuantity}`);
        }
      }

      // 2. Ajuster les consommations de bouteilles (UNIQUEMENT pour sale_type === 'consumption')
      const { data: menuItem } = await supabase
        .from('pos_menus')
        .select('sale_type, current_servings')
        .eq('id', item.menu_item_id)
        .single();

      if (menuItem && menuItem.sale_type === 'consumption') {  // 🔥 UNIQUEMENT 'consumption'
        const newServings = (menuItem.current_servings || 0) - quantityDiff;
        if (newServings < 0) {
          alert(`⚠️ Pas assez de consommations restantes pour cette bouteille`);
          throw new Error('Consommations insuffisantes');
        }
        await supabase
          .from('pos_menus')
          .update({
            current_servings: newServings,
            is_available: newServings > 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.menu_item_id);
        console.log(`🍾 Consommation ajustée: ${newServings} restantes`);
      }
    } catch (error) {
      console.error('❌ Erreur ajustement stock:', error);
      throw error;
    }
  };

  // 🔥 CORRECTION #5 : removeItemFromOrder restaure maintenant le stock
  const removeItemFromOrder = async (itemId: string) => {
    if (orderStatus === 'ready' || orderStatus === 'confirmed') {
      alert('Impossible de retirer des articles après confirmation de la commande');
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir retirer cet article de la commande ?')) return;
    
    setRemovingItemId(itemId);
    try {
      // 🔥 ÉTAPE 1 : Récupérer l'article AVANT suppression pour restaurer le stock
      const itemToRemove = localOrderItems.find(item => item.id === itemId);
      if (itemToRemove) {
        await restoreStockForItem(itemToRemove);
      }

      // ÉTAPE 2 : Supprimer l'article de la commande
      const { error } = await supabase
        .from('pos_order_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;

      const updatedItems = localOrderItems.filter(item => item.id !== itemId);
      setLocalOrderItems(updatedItems);
      await updateOrderTotals(order.id);
      
      await supabase
        .from('pos_kitchen_orders')
        .delete()
        .eq('order_item_id', itemId);

      if (onOrderUpdated) onOrderUpdated();
      if (refreshOrder) refreshOrder();
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Erreur lors du retrait de l\'article');
    } finally {
      setRemovingItemId(null);
    }
  };

  // 🔥 CORRECTION #6 : updateItemQuantity ajuste maintenant le stock
  const updateItemQuantity = async (itemId: string, newQuantity: number) => {
    if (orderStatus === 'ready' || orderStatus === 'confirmed') {
      alert('Impossible de modifier la quantité après confirmation de la commande');
      return;
    }
    if (newQuantity < 1) {
      await removeItemFromOrder(itemId);
      return;
    }

    try {
      const item = localOrderItems.find(item => item.id === itemId);
      if (!item) return;

      const oldQuantity = item.quantity;
      const quantityDiff = newQuantity - oldQuantity;

      // 🔥 Ajuster le stock selon la différence
      if (quantityDiff !== 0) {
        await adjustStockForItem(item, quantityDiff);
      }

      const newTotalPrice = item.unit_price * newQuantity;
      const { error } = await supabase
        .from('pos_order_items')
        .update({
          quantity: newQuantity,
          total_price: newTotalPrice,
        })
        .eq('id', itemId);
      if (error) throw error;

      const updatedItems = localOrderItems.map(it =>
        it.id === itemId
          ? { ...it, quantity: newQuantity, total_price: newTotalPrice }
          : it
      );
      setLocalOrderItems(updatedItems);
      await updateOrderTotals(order.id);

      if (onOrderUpdated) onOrderUpdated();
      if (refreshOrder) refreshOrder();
    } catch (error) {
      console.error('Error updating item quantity:', error);
      alert('Erreur lors de la modification de la quantité');
    }
  };

  const cancelOrder = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.')) return;
    try {
      await onCancelOrder(order.id);
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  };

  const printOrderSummaryTicket = async () => {
    if (!settings) {
      alert("Impossible de récupérer les informations du restaurant");
      return;
    }
    const totals = calculateTotal();
    const kitchenItems = localOrderItems.filter(item =>
      identifyItemType(item) === 'kitchen'
    );
    const barItems = localOrderItems.filter(item =>
      identifyItemType(item) === 'bar'
    );
    try {
      await generateGroupedSummaryTicket(kitchenItems, barItems, settings);
    } catch (error) {
      console.error("Erreur lors de l'impression du ticket récapitulatif:", error);
      alert("Erreur lors de l'impression du ticket récapitulatif");
    }
  };

  const calculateTotal = () => {
    const subtotal = localOrderItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
    const total = subtotal + deliveryFee;
    return {
      subtotal,
      deliveryFee,
      total
    };
  };

  const generateKitchenTicket = async (orderItem: any, settings: any) => {
    const ticketContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain;" /></div>` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
<div class="ticket-title">⭐ BON DE CUISINE (SUPPLEMENTAIRE) ⭐</div>
</div>
<div class="section">
<h3>INFORMATIONS COMMANDE</h3>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N° Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Enregistré par:</strong><span>${user?.user_metadata?.full_name || user?.email || 'Utilisateur'}</span></div>
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Note:</strong><span style="color: #e74c3c;">ARTICLE AJOUTÉ APRÈS COMMANDE INITIALE</span></div>
</div>
</div>
</div>
<div class="section">
<h3>ARTICLE À PRÉPARER</h3>
<table class="items-table">
<thead><tr><th class="left">Article</th><th class="center">Qté</th><th class="center">Catégorie</th></tr></thead>
<tbody>
<tr>
<td class="left"><strong>${orderItem.item_name}</strong></td>
<td class="center"><strong>${orderItem.quantity}</strong></td>
<td class="center">${orderItem.category || 'Cuisine'}</td>
</tr>
</tbody>
</table>
</div>
${orderItem.kitchen_note ? `
<div class="section">
<h3>NOTES SPÉCIALES</h3>
<div class="notes urgent">${orderItem.kitchen_note}</div>
</div>
` : ''}
<div class="section">
<h3>INSTRUCTIONS</h3>
<div class="instructions">
<p>• Préparer avec soin et qualité</p>
<p>• Respecter les temps de préparation</p>
<p>• Vérifier la présentation</p>
<p>• Signaler tout problème immédiatement</p>
</div>
</div>
<div class="footer">
<p class="thank-you">Article supplémentaire - Merci pour votre travail d'équipe ! 👨‍🍳👩‍🍳</p>
<p class="signature">Service Cuisine - ${settings?.name || 'Restaurant'}</p>
<div class="timestamp">Imprimé le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.info-row:last-child { border-bottom: none; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000 !important; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.ticket-title { font-size: 13px; font-weight: bold; color: #000000 !important; margin: 4px 0; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f5f5f5 !important; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; border: 1px solid #cccccc !important; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table th { border-bottom: 2px solid #000000 !important; padding: 5px 0; font-weight: bold; color: #000000 !important; background: #f0f0f0 !important; font-size: 11px; }
.items-table td { padding: 5px 0; border-bottom: 1px dotted #000000 !important; font-weight: bold; font-size: 11px; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.notes.urgent { background: #f0f0f0 !important; padding: 8px; border-radius: 6px; border-left: 4px solid #808080 !important; font-size: 11px; color: #000000 !important; font-weight: bold; }
.instructions { background: #f8f8f8 !important; padding: 8px; border-radius: 6px; border: 1px dashed #000000 !important; font-size: 10px; color: #000000 !important; }
.instructions p { margin: 3px 0; }
.footer { text-align: center; margin-top: 15px; border-top: 2px dashed #000000 !important; padding-top: 10px; font-size: 10px; }
.thank-you { font-style: italic; color: #000000 !important; font-weight: bold; margin-bottom: 4px; }
.signature { color: #000000 !important; font-size: 9px; margin-bottom: 3px; }
.timestamp { color: #000000 !important; font-size: 8px; font-style: italic; }
@media print { body { margin: 0; } .receipt { padding: 8px; } * { color: #000000 !important; } }
</style>`;
    await printTicket(ticketContent, 'Bon de Cuisine Supplémentaire');
  };

  const generateBarTicket = async (orderItem: any, settings: any) => {
    const ticketContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain;" /></div>` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
<div class="ticket-title"> BON DE BAR (SUPPLEMENTAIRE) </div>
</div>
<div class="section">
<h3>INFORMATIONS COMMANDE</h3>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N° Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Enregistré par:</strong><span>${user?.user_metadata?.full_name || user?.email || 'Utilisateur'}</span></div>
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Note:</strong><span style="color: #3498db;">ARTICLE AJOUTÉ APRÈS COMMANDE INITIALE</span></div>
</div>
</div>
</div>
<div class="section">
<h3>ARTICLE À PRÉPARER</h3>
<table class="items-table">
<thead><tr><th class="left">Article</th><th class="center">Qté</th><th class="right">Prix U.</th><th class="center">Type</th></tr></thead>
<tbody>
<tr>
<td class="left"><strong>${orderItem.item_name}</strong></td>
<td class="center"><strong>${orderItem.quantity}</strong></td>
<td class="right">${orderItem.unit_price.toLocaleString()} f CFA</td>
<td class="center">${orderItem.category || 'Bar'}</td>
</tr>
</tbody>
</table>
</div>
${orderItem.bar_note ? `
<div class="section">
<h3>NOTES SPÉCIALES</h3>
<div class="notes cocktail">${orderItem.bar_note}</div>
</div>
` : ''}
<div class="section">
<h3>CONSOMMATION BOUTEILLE</h3>
<div class="bottle-info">
${orderItem.category?.toLowerCase().includes('bouteille') || orderItem.item_name.toLowerCase().includes('bouteille') ? `
<p>• Vérifier le niveau de la bouteille</p>
<p>• Noter la consommation</p>
<p>• Signaler si bouteille vide</p>
` : `
<p>• Préparer avec soin</p>
<p>• Respecter les recettes</p>
<p>• Soigner la présentation</p>
`}
</div>
</div>
<div class="footer">
<p class="thank-you">Article supplémentaire - À votre service ! 🍸🍹</p>
<p class="signature">Service Bar - ${settings?.name || 'Restaurant'}</p>
<div class="timestamp">Imprimé le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.info-row:last-child { border-bottom: none; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000 !important; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.ticket-title { font-size: 13px; font-weight: bold; color: #000000 !important; margin: 4px 0; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f0f0f0 !important; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; border: 1px solid #cccccc !important; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table th { border-bottom: 2px solid #000000 !important; padding: 5px 0; font-weight: bold; color: #000000 !important; background: #e8e8e8 !important; font-size: 11px; }
.items-table td { padding: 5px 0; border-bottom: 1px dotted #000000 !important; font-weight: bold; font-size: 11px; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.notes.cocktail { background: #f0f0f0 !important; padding: 8px; border-radius: 6px; border-left: 4px solid #808080 !important; font-size: 11px; color: #000000 !important; font-weight: bold; }
.bottle-info { background: #f8f8f8 !important; padding: 8px; border-radius: 6px; border: 1px dashed #000000 !important; font-size: 10px; color: #000000 !important; }
.bottle-info p { margin: 3px 0; }
.footer { text-align: center; margin-top: 15px; border-top: 2px dashed #000000 !important; padding-top: 10px; font-size: 10px; }
.thank-you { font-style: italic; color: #000000 !important; font-weight: bold; margin-bottom: 4px; }
.signature { color: #000000 !important; font-size: 9px; margin-bottom: 3px; }
.timestamp { color: #000000 !important; font-size: 8px; font-style: italic; }
@media print { body { margin: 0; } .receipt { padding: 8px; } * { color: #000000 !important; } }
</style>`;
    await printTicket(ticketContent, 'Bon de Bar Supplémentaire');
  };

  const printTicket = (content: string, title: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          document.body.removeChild(iframe);
          resolve();
          return;
        }
        iframeDoc.open();
        iframeDoc.write(`
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
@media print { @page { margin: 0; } body { margin: 0.5cm; } }
body { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 13px; line-height: 1.4; }
</style>
<script>
window.onload = function() {
  setTimeout(function() {
    window.print();
    setTimeout(function() {
      if (window.opener === null) { window.close(); }
    }, 100);
  }, 300);
};
</script>
</head>
<body>
${content}
</body>
</html>
`);
        iframeDoc.close();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve();
        }, 1500);
      } catch (error) {
        console.error('Erreur impression:', error);
        resolve();
      }
    });
  };

  const generateOrderSummary = async (settings: any) => {
    const totals = calculateTotal();
    const summaryContent = `
<div class="receipt">
<div class="header">
${settings?.logo_url ? `<div style="text-align: center; margin-bottom: 5px;"><img src="${settings.logo_url}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain;" /></div>` : ''}
<div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
${settings?.phone ? `<div class="contact">📞 ${settings.phone}</div>` : ''}
${settings?.address ? `<div class="address">📍 ${settings.address}</div>` : ''}
</div>
<div class="section">
<h3>RÉCAPITULATIF COMMANDE CONFIRMÉE</h3>
<div class="info-grid">
<div class="info-column">
<div class="info-row"><strong>N° Cmde:</strong><span>${order.order_number}</span></div>
<div class="info-row"><strong>Table:</strong><span>${order.table_number}</span></div>
<div class="info-row"><strong>Type:</strong><span>${orderType.replace('_', ' ').toUpperCase()}</span></div>
<div class="info-row"><strong>Serveur:</strong><span>${serverName}</span></div>
</div>
<div class="info-column">
<div class="info-row"><strong>Confirmé par:</strong><span>${user?.user_metadata?.full_name || user?.email || 'Utilisateur'}</span></div>
<div class="info-row"><strong>Clients:</strong><span>${customerCount} personne(s)</span></div>
<div class="info-row"><strong>Date:</strong><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="info-row"><strong>Heure:</strong><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>
</div>
</div>
${customerName ? `<div class="info-row" style="grid-column: span 2; margin-top: 5px;"><strong>Client:</strong><span>${customerName}</span></div>` : ''}
${customerPhone ? `<div class="info-row" style="grid-column: span 2;"><strong>Téléphone:</strong><span>${customerPhone}</span></div>` : ''}
${deliveryAddress ? `<div class="info-row" style="grid-column: span 2;"><strong>Adresse:</strong><span>${deliveryAddress}</span></div>` : ''}
</div>
<div class="section">
<h3>DÉTAIL DE LA COMMANDE</h3>
<table class="items-table">
<thead><tr><th class="left">Article</th><th class="center">Qté</th><th class="right">Prix U.</th><th class="right">Total</th></tr></thead>
<tbody>
${localOrderItems.map((item: any) => `
<tr>
<td class="left">${item.item_name}</td>
<td class="center">${item.quantity}</td>
<td class="right">${item.unit_price.toLocaleString()} f CFA</td>
<td class="right">${item.total_price.toLocaleString()} f CFA</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
<div class="total-section">
<table class="total-table">
<tr><td><strong>SOUS-TOTAL:</strong></td><td class="right"><strong>${totals.subtotal.toLocaleString()} f CFA</strong></td></tr>
${totals.deliveryFee > 0 ? `<tr><td>Frais de livraison:</td><td class="right">${totals.deliveryFee.toLocaleString()} f CFA</td></tr>` : ''}
<tr><td><strong>TOTAL GÉNÉRAL:</strong></td><td class="right"><strong>${totals.total.toLocaleString()} f CFA</strong></td></tr>
</table>
</div>
<div class="section">
<h3>INFORMATIONS DE CONFIRMATION</h3>
<div class="info-grid">
<div class="info-row" style="grid-column: span 2;"><strong>Statut:</strong><span style="color: #27ae60; font-weight: bold;">CONFIRMÉE ✓</span></div>
<div class="info-row" style="grid-column: span 2;"><strong>En attente de:</strong><span style="font-weight: bold;">Paiement à la caisse</span></div>
</div>
</div>
${orderNotes ? `
<div class="section">
<h3>NOTES</h3>
<div class="notes">${orderNotes}</div>
</div>
` : ''}
<div class="footer">
<p class="thank-you">Commande confirmée avec succès ! Le client peut régler à la caisse. ️</p>
<p class="payment-note">
Vous pouvez régler votre facture par :<br>
<strong>Orange Money: *144*10*04043435*${totals.total.toLocaleString()}#</strong><br>
<strong>Wave:</strong> 04043435
</p>
<p class="signature">${settings?.name || 'Restaurant'}</p>
<div class="timestamp">Imprimé le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</div>
<style>
.receipt { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 15px; font-size: 12px; line-height: 1.3; color: #000000 !important; }
* { color: #000000 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.info-column { display: flex; flex-direction: column; gap: 4px; }
.info-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #000000 !important; padding-bottom: 3px; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px double #000000; padding-bottom: 10px; }
.restaurant-name { font-size: 15px; font-weight: bold; margin: 6px 0; color: #000000 !important; }
.contact, .address { font-size: 10px; margin: 2px 0; color: #000000 !important; }
.section { margin: 10px 0; }
.section h3 { text-align: center; margin: 8px 0; font-size: 11px; background: #f8f9fa; padding: 5px; border-radius: 4px; font-weight: bold; color: #000000 !important; border: 1px solid #cccccc; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.items-table th { border-bottom: 2px solid #000000; padding: 5px 0; font-weight: bold; color: #000000 !important; background: #f0f0f0; font-size: 11px; }
.items-table td { padding: 4px 0; border-bottom: 1px dotted #000000; color: #000000 !important; font-size: 11px; }
.total-table { border-top: 2px solid #000000; margin-top: 10px; padding-top: 8px; }
.total-table td { padding: 5px 0; font-weight: bold; color: #000000 !important; font-size: 11px; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
.notes { background: #f8f9fa; padding: 8px; border-radius: 6px; border-left: 4px solid #000000; font-size: 11px; color: #000000 !important; }
.footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000000; padding-top: 10px; font-size: 10px; color: #000000 !important; }
.thank-you { font-style: italic; font-weight: bold; margin-bottom: 6px; color: #000000 !important; }
.payment-note { background: #f0f0f0; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 10px; color: #000000 !important; border: 1px dashed #000000; }
.signature { font-size: 9px; margin-top: 6px; color: #000000 !important; }
.timestamp { font-size: 8px; font-style: italic; margin-top: 4px; color: #000000 !important; }
@media print { body { margin: 0; } .receipt { padding: 8px; color: #000000 !important; } * { color: #000000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>`;
    await printTicket(summaryContent, 'Récapitulatif Commande Confirmée');
  };

  const confirmOrder = async () => {
    if (localOrderItems.length === 0) {
      alert('Veuillez ajouter des articles à la commande');
      return;
    }
    if (!generatedTickets.allGenerated) {
      const shouldGenerate = confirm('Aucun ticket n\'a été généré. Voulez-vous générer les tickets avant de confirmer ?');
      if (shouldGenerate) {
        await generateAllTickets();
        return;
      } else {
        alert('La confirmation nécessite la génération des tickets.');
        return;
      }
    }
    try {
      await generateOrderSummary(settings);
      await updateOrderTotals(order.id);
      await updateOrderType();
      const { error } = await supabase
        .from('pos_orders')
        .update({
          customer_count: customerCount,
          notes: orderNotes,
          server_id: selectedServer,
          server_name: serverName,
          status: 'confirmed',
          tickets_generated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (error) throw error;
      setOrderStatus('confirmed');
      alert('✅ Commande confirmée avec succès ! Le ticket récapitulatif a été généré pour le client.');
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la confirmation de la commande');
    }
  };
// Fonction pour l'encaissement direct (bypass la file d'attente)
const handleDirectPayment = async () => {
  if (!confirm(`Confirmer le paiement de ${totals.total.toLocaleString()} f CFA pour la table ${order.table_number} ?`)) {
    return;
  }
  
  setIsSendingToCashier(true);
  try {
    console.log('💰 Encaissement direct - Commande:', order.id);
    
    // 1. Mettre à jour le statut à 'paid' directement
    const { error: orderUpdateError } = await supabase
      .from('pos_orders')
      .update({
        status: 'paid',
        payment_method: 'cash',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
      
    if (orderUpdateError) throw orderUpdateError;
    
    console.log('✅ Commande marquée comme payée');
    
    // 2. Créer l'enregistrement de paiement
    const receiptNumber = `REC-${Date.now()}`;
    const { error: paymentError } = await supabase
      .from('pos_payments')
      .insert({
        order_id: order.id,
        amount_paid: totals.total,
        payment_method: 'cash',
        change_amount: 0,
        receipt_number: receiptNumber,
        created_by: user?.id,
        customer_ticket: null,
      });
      
    if (paymentError) {
      console.error('⚠️ Erreur création paiement:', paymentError);
      // Continuer quand même car la commande est marquée payée
    } else {
      console.log('✅ Paiement enregistré:', receiptNumber);
    }
    
    // 3. Libérer la table
    if (order.table_id) {
      await supabase
        .from('pos_tables')
        .update({
          status: 'available',
          current_order_id: null
        })
        .eq('id', order.table_id);
      console.log('✅ Table libérée');
    }
    
    // 4. Mettre à jour l'état local
    setOrderStatus('paid');
    
    alert(`✅ Paiement encaissé avec succès !

💰 Montant: ${totals.total.toLocaleString()} f CFA
🧾 Reçu: ${receiptNumber}
 Table ${order.table_number} libérée`);
    
    // 5. Fermer la vue
    setTimeout(() => {
      if (onOrderUpdated) onOrderUpdated();
      onClose();
    }, 1500);
    
  } catch (error: any) {
    console.error('❌ Erreur encaissement direct:', error);
    alert(`Erreur lors de l'encaissement: ${error.message}`);
  } finally {
    setIsSendingToCashier(false);
  }
};
  const sendToCashier = async () => {
  if (!confirm('Êtes-vous sûr de vouloir envoyer cette commande à la caisse pour paiement ?')) {
    return;
  }
  setIsSendingToCashier(true);
  try {
    console.log('🔄 Envoi à la caisse - Commande:', order.id, 'Statut actuel:', orderStatus);
    
    // 1. Mettre à jour le statut dans la base de données
    const { error: orderUpdateError } = await supabase
      .from('pos_orders')
      .update({
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
      
    if (orderUpdateError) {
      console.error('❌ Erreur mise à jour statut:', orderUpdateError);
      throw orderUpdateError;
    }
    
    console.log('✅ Statut mis à jour à "ready" dans la base');
    
    // 2. Mettre à jour l'état local IMMÉDIATEMENT
    setOrderStatus('ready');
    
    // 3. Émettre l'événement pour CashierQueue avec un délai
    const paymentEvent = new CustomEvent('navigate-to-payment', {
      detail: {
        orderId: order.id,
        tableNumber: order.table_number,
        orderNumber: order.order_number
      }
    });
    
    // Donner du temps à Supabase de propager le changement
    await new Promise(resolve => setTimeout(resolve, 500));
    
    window.dispatchEvent(paymentEvent);
    console.log('📤 Événement navigate-to-payment émis');
    
    alert(`✅ Commande envoyée à la caisse avec succès !

📍 Table: ${order.table_number}
🔢 N° Commande: ${order.order_number}

La commande apparaît maintenant dans la file d'attente de la caisse.`);
    
    // 4. Fermer la vue après un délai
    setTimeout(() => {
      if (onOrderUpdated) onOrderUpdated();
      onClose();
    }, 2000);
    
  } catch (error: any) {
    console.error('❌ Erreur envoi à la caisse:', error);
    alert(`Erreur lors de l'envoi à la caisse: ${error.message}`);
  } finally {
    setIsSendingToCashier(false);
  }
};

  const renderCategoriesWithSearch = () => {
    const filteredMenuItems = filterMenuItems(menuData.menuItems, searchTerm);
    const groupedItems = menuData.categories.map(category => ({
      ...category,
      items: filteredMenuItems.filter(item => item.category_id === category.id)
    })).filter(category => category.items.length > 0);
    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Menu</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={orderStatus === 'ready' || orderStatus === 'confirmed'}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {searchTerm && (
          <div className="mb-3 text-sm text-blue-600">
            {filteredMenuItems.length} article(s) trouvé(s) pour "{searchTerm}"
          </div>
        )}
        <div className="space-y-4">
          {groupedItems.map(category => {
            const categoryItems = filteredMenuItems.filter(item => item.category_id === category.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            if (categoryItems.length === 0) return null;
            return (
              <div key={category.id}>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                  <span>{category.name}</span>
                  <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                    {categoryItems.length}
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {categoryItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addItemToOrder(item)}
                      disabled={isAddingItem || !item.is_available || orderStatus === 'ready' || orderStatus === 'confirmed'}
                      className={`bg-white border rounded-lg p-3 text-left hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed relative ${
                        searchTerm &&
                        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.description?.toLowerCase().includes(searchTerm.toLowerCase()))
                          ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-gray-300'
                      }`}
                    >
                      {searchTerm &&
                        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.description?.toLowerCase().includes(searchTerm.toLowerCase())) && (
                        <div className="absolute -top-1 -right-1">
                          <div className="bg-blue-500 text-white text-xs px-1 rounded">Recherche</div>
                        </div>
                      )}
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-600">{item.price.toLocaleString()} f CFA</div>
                      {!item.is_available && (
                        <div className="text-xs text-red-600 mt-1">Indisponible</div>
                      )}
                      {orderStatus === 'confirmed' && (
                        <div className="text-xs text-gray-500 mt-1">Commande confirmée - Modification impossible</div>
                      )}
                      {isAddingItem && (
                        <div className="text-xs text-blue-600 mt-1">Ajout en cours...</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {groupedItems.length === 0 && searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Aucun article trouvé pour "{searchTerm}"</p>
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Effacer la recherche
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totals = calculateTotal();

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Commande - Table {order.table_number}
          </h2>
          <p className="text-gray-600">N° {order.order_number}</p>
          <div className="flex items-center space-x-6 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serveur *
              </label>
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  updateServer(e.target.value);
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm w-48"
                required
              >
                <option value="">Sélectionner un serveur</option>
                {servers.map(server => (
                  <option key={server.id} value={server.id}>
                    {server.first_name} {server.last_name} - {server.employee_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de clients
              </label>
              <input
                type="number"
                value={customerCount}
                onChange={(e) => setCustomerCount(parseInt(e.target.value) || 1)}
                min="1"
                className="px-3 py-1 border border-gray-300 rounded text-sm w-20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm w-64"
                placeholder="Notes pour la commande..."
              />
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={cancelOrder}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={orderStatus === 'ready'}
          >
            <Trash2 className="w-4 h-4 inline mr-2" />
            Annuler la commande
          </button>
          <button
            onClick={printOrderSummaryTicket}
            disabled={localOrderItems.length === 0 || orderStatus === 'ready'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer Ticket
          </button>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Retour aux commandes
          </button>
          <button
            onClick={generateAllTickets}
            disabled={localOrderItems.length === 0 || isGeneratingTickets || orderStatus === 'ready'}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4 inline mr-2" />
            {isGeneratingTickets ? 'Génération...' : 'Commander (Générer les tickets)'}
          </button>
          {(ticketsGenerated || generatedTickets.allGenerated) && (
            <button
              onClick={confirmOrder}
              disabled={localOrderItems.length === 0 || !selectedServer || orderStatus === 'ready' || orderStatus === 'confirmed'}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              {orderStatus === 'confirmed' ? 'Confirmée ✓' : 'Confirmer la Commande'}
            </button>
          )}
          {orderStatus === 'confirmed' && (
            <button
              onClick={sendToCashier}
              disabled={isSendingToCashier}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center"
            >
              {isSendingToCashier ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer à la Caisse
                </>
              )}
            </button>
          )}
          {order.status === 'confirmed' && (
            <button
              onClick={() => {
                const paymentEvent = new CustomEvent('navigate-to-payment', {
                  detail: { orderId: order.id }
                });
                window.dispatchEvent(paymentEvent);
              }}
              className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition ml-2"
            >
              Payer maintenant
            </button>
          )}
          {orderStatus === 'ready' && (
            <div className="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-lg">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="font-medium">Prête à payer</span>
            </div>
          )}
        </div>
      </div>
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de commande *
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setOrderType('sur_place');
              setDeliveryFee(0);
              updateOrderType();
            }}
            className={`p-3 border rounded-lg text-center ${
              orderType === 'sur_place'
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <Utensils className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm font-medium">Sur place</div>
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType('a_emporter');
              setDeliveryFee(0);
              updateOrderType();
            }}
            className={`p-3 border rounded-lg text-center ${
              orderType === 'a_emporter'
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <Home className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm font-medium">À emporter</div>
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType('livraison');
              setDeliveryFee(1000);
              updateOrderType();
            }}
            className={`p-3 border rounded-lg text-center ${
              orderType === 'livraison'
                ? 'bg-orange-100 border-orange-500 text-orange-700'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <Truck className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm font-medium">Livraison</div>
          </button>
        </div>
        {orderType === 'livraison' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frais de livraison (f CFA)
              </label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => {
                  setDeliveryFee(parseFloat(e.target.value) || 0);
                  updateOrderType();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse de livraison
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  updateOrderType();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Adresse complète"
              />
            </div>
          </div>
        )}
        {(orderType === 'a_emporter' || orderType === 'livraison') && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du client
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  updateOrderType();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nom du client"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  updateOrderType();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Numéro de téléphone"
              />
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {renderCategoriesWithSearch()}
        </div>
        <div className="col-span-1">
          <div className="bg-gray-50 rounded-lg p-4 sticky top-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Panier</h3>
              <button
                onClick={refreshOrder}
                className="text-blue-600 hover:text-blue-800 transition"
                title="Actualiser le panier"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {generatedTickets.allGenerated && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-700 font-medium">
                      Tickets générés
                    </span>
                  </div>
                  <div className="text-xs text-blue-600">
                    🍽️ {generatedTickets.kitchenItems.length} | 🍷 {generatedTickets.barItems.length}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {orderStatus === 'confirmed' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                    <span className="text-sm text-yellow-700 font-medium">
                      Commande confirmée - Aucune modification possible
                    </span>
                  </div>
                </div>
              )}
              {orderStatus === 'ready' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm text-green-700 font-medium">
                      Commande prête à payer - Aucune modification possible
                    </span>
                  </div>
                </div>
              )}
              {localOrderItems.map((item: any) => (
                <div key={item.id} className="bg-white p-3 rounded border relative">
                  <button
                    onClick={() => removeItemFromOrder(item.id)}
                    disabled={removingItemId === item.id || orderStatus === 'ready' || orderStatus === 'confirmed'}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-800 transition disabled:opacity-50"
                    title="Retirer cet article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="font-medium pr-6">{item.item_name}</div>
                  <div className="text-sm text-gray-600">
                    {item.unit_price.toLocaleString()} f CFA l'unité
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        disabled={removingItemId === item.id || orderStatus === 'ready' || orderStatus === 'confirmed'}
                        className="w-6 h-6 bg-red-100 text-red-600 rounded flex items-center justify-center hover:bg-red-200 transition disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        disabled={removingItemId === item.id || orderStatus === 'ready' || orderStatus === 'confirmed'}
                        className="w-6 h-6 bg-green-100 text-green-600 rounded flex items-center justify-center hover:bg-green-200 transition disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-semibold text-right">
                      {item.total_price.toLocaleString()} f CFA
                    </div>
                  </div>
                  {removingItemId === item.id && (
                    <div className="text-xs text-blue-600 mt-1 text-center">
                      Suppression...
                    </div>
                  )}
                </div>
              ))}
              {generatedTickets.allGenerated && localOrderItems.length >
                (generatedTickets.kitchenItems.length + generatedTickets.barItems.length) && (
                <button
                  onClick={generateTicketsForUngeneratedItems}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition"
                >
                  <Send className="w-4 h-4 inline mr-2" />
                  Générer tickets manquants
                </button>
              )}
              {localOrderItems.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  Aucun article dans le panier
                </div>
              )}
            </div>
            {localOrderItems.length > 0 && (
              <>
                <div className="border-t pt-3 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total:</span>
                    <span>{totals.subtotal.toLocaleString()} f CFA</span>
                  </div>
                  {totals.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Frais de livraison:</span>
                      <span>{totals.deliveryFee.toLocaleString()} f CFA</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total général:</span>
                    <span>{totals.total.toLocaleString()} f CFA</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={generateAllTickets}
                    disabled={isGeneratingTickets || localOrderItems.length === 0 || orderStatus === 'ready'}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    <Send className="w-4 h-4 inline mr-2" />
                    {isGeneratingTickets ? 'Génération des tickets...' : 'Commander (Générer les tickets)'}
                  </button>
                  {(ticketsGenerated || generatedTickets.allGenerated) && (
                    <button
                      onClick={confirmOrder}
                      disabled={!selectedServer || orderStatus === 'ready' || orderStatus === 'confirmed'}
                      className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      {orderStatus === 'confirmed' ? 'Commande Confirmée ✓' : 'Confirmer la Commande'}
                    </button>
                  )}
                  {orderStatus === 'confirmed' && (
                    <button
                      onClick={sendToCashier}
                      className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition"
                    >
                      <Send className="w-4 h-4 inline mr-2" />
                      Envoyer à la Caisse
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
