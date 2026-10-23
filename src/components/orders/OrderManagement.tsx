// src/components/orders/OrderManagement.tsx 
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ShoppingCart, 
  Plus, 
  Users, 
  Printer,
  CheckCircle,
  DollarSign,
  Minus,
  Trash2,
  Send
} from 'lucide-react';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  is_available: boolean;
}

interface OrderItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  menu_item_id?: string;
}

interface Order {
  id?: string;
  table_number: number;
  order_number: string;
  status: 'draft' | 'confirmed' | 'ready' | 'paid' | 'cancelled';
  customer_count: number;
  total_amount: number;
  items: OrderItem[];
  notes?: string;
  server_name?: string;
}

export default function OrderManagement() {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeView, setActiveView] = useState<'tables' | 'order'>('tables');
  const [customerCount, setCustomerCount] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [tablesRes, menusRes] = await Promise.all([
        supabase.from('pos_tables').select('*').order('table_number'),
        supabase.from('pos_menus').select('*').eq('is_available', true),
      ]);

      setTables(tablesRes.data || []);
      setMenuItems(menusRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const selectTable = (table: Table) => {
    setSelectedTable(table);
    
    const orderNumber = `CMD-${Date.now()}`;
    const newOrder: Order = {
      table_number: table.table_number,
      order_number: orderNumber,
      status: 'draft',
      customer_count: customerCount,
      total_amount: 0,
      items: [],
      notes: '',
      server_name: serverName
    };
    setCurrentOrder(newOrder);
    setIsConfirmed(false);
    
    setActiveView('order');
  };

  const addItemToOrder = async (menuItem: MenuItem) => {
    if (!currentOrder) return;

    const existingItemIndex = currentOrder.items.findIndex(item => 
      item.menu_item_id === menuItem.id
    );

    let updatedItems: OrderItem[];
    
    if (existingItemIndex !== -1) {
      updatedItems = [...currentOrder.items];
      const existingItem = updatedItems[existingItemIndex];
      existingItem.quantity += 1;
      existingItem.total_price = existingItem.unit_price * existingItem.quantity;
    } else {
      const newItem: OrderItem = {
        item_name: menuItem.name,
        quantity: 1,
        unit_price: menuItem.price,
        total_price: menuItem.price,
        menu_item_id: menuItem.id
      };
      updatedItems = [...currentOrder.items, newItem];
    }
    
    updateOrderWithItems(updatedItems);
  };

  const updateItemQuantity = (itemIndex: number, quantity: number) => {
    if (!currentOrder) return;
    
    if (quantity <= 0) {
      removeItem(itemIndex);
      return;
    }

    const updatedItems = [...currentOrder.items];
    const item = updatedItems[itemIndex];
    
    if (item) {
      item.quantity = quantity;
      item.total_price = item.unit_price * quantity;
      updateOrderWithItems(updatedItems);
    }
  };

  const removeItem = (itemIndex: number) => {
    if (!currentOrder) return;
    
    const updatedItems = currentOrder.items.filter((_, index) => index !== itemIndex);
    updateOrderWithItems(updatedItems);
  };

  const updateOrderWithItems = (items: OrderItem[]) => {
    if (!currentOrder) return;

    const total = items.reduce((sum, item) => sum + item.total_price, 0);
    
    setCurrentOrder({
      ...currentOrder,
      items,
      total_amount: total
    });
  };

  const confirmOrder = async () => {
    if (!currentOrder || currentOrder.items.length === 0 || !user) {
      alert('Veuillez ajouter des articles à la commande');
      return;
    }

    try {
      const subtotal = currentOrder.items.reduce((sum, item) => sum + item.total_price, 0);
      const taxAmount = 0; // Pas de TVA
      const totalAmount = subtotal; // Total = subtotal

      const orderData = {
        table_number: currentOrder.table_number,
        order_number: currentOrder.order_number,
        status: 'confirmed' as const, // Statut "confirmed" pour commande confirmée mais pas encore à la caisse
        customer_count: currentOrder.customer_count,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: orderNotes,
        server_name: serverName, // Ajouter le nom du serveur
        created_by: user.id,
      };

      console.log('📤 Confirmation de commande:', orderData);

      // Insérer ou mettre à jour la commande
      let orderId = currentOrder.id;
      
      if (!orderId) {
        // Nouvelle commande
        const { data: order, error } = await supabase
          .from('pos_orders')
          .insert(orderData)
          .select()
          .single();

        if (error) throw error;
        orderId = order.id;
        
        // Insérer les articles
        await processOrderItems(order.id);
      } else {
        // Commande existante - mise à jour
        const { error } = await supabase
          .from('pos_orders')
          .update(orderData)
          .eq('id', orderId);

        if (error) throw error;
      }

      // Mettre à jour l'état local
      setCurrentOrder(prev => prev ? { 
        ...prev, 
        id: orderId, 
        status: 'confirmed',
        server_name: serverName 
      } : null);
      setIsConfirmed(true);
      
      // Imprimer le ticket de confirmation
      printOrderConfirmation(currentOrder, serverName);

      alert('✅ Commande confirmée avec succès ! Vous pouvez maintenant l\'envoyer à la caisse quand le client sera prêt à payer.');

    } catch (error: any) {
      console.error('💥 Erreur confirmation:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const sendToCashier = async () => {
    if (!currentOrder?.id) {
      alert('Veuillez d\'abord confirmer la commande');
      return;
    }

    try {
      // Changer le statut de la commande pour l'envoyer à la caisse
      const { error } = await supabase
        .from('pos_orders')
        .update({
          status: 'ready', // Statut "ready" pour indiquer que c'est prêt pour paiement
          updated_at: new Date().toISOString()
        })
        .eq('id', currentOrder.id);

      if (error) throw error;

      // Mettre à jour la table
      await supabase
        .from('pos_tables')
        .update({ status: 'occupied' })
        .eq('table_number', currentOrder.table_number);

      alert('✅ Commande envoyée à la caisse avec succès ! Le client peut maintenant payer.');

      // Réinitialiser
      setActiveView('tables');
      setCurrentOrder(null);
      setSelectedTable(null);
      setCustomerCount(1);
      setOrderNotes('');
      setServerName('');
      setIsConfirmed(false);

    } catch (error: any) {
      console.error('💥 Erreur envoi caisse:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const processOrderItems = async (orderId: string) => {
    if (!currentOrder) return;

    // Insérer les articles
    const orderItemsData = currentOrder.items.map(item => ({
      order_id: orderId,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      menu_item_id: item.menu_item_id,
      status: 'ordered'
    }));

    const { error: itemsError } = await supabase
      .from('pos_order_items')
      .insert(orderItemsData);

    if (itemsError) throw itemsError;
  };

  const printOrderConfirmation = (order: Order, server: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Confirmation de Commande</title>
        <style>
          body { font-family: monospace; width: 80mm; margin: 0; padding: 10px; font-size: 14px; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { border-top: 2px solid #000; margin-top: 10px; padding-top: 5px; font-weight: bold; }
          .footer { text-align: center; margin-top: 15px; font-style: italic; }
          .status { background: #e8f5e8; padding: 5px; text-align: center; margin: 10px 0; border-radius: 5px; }
          .info { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>CONFIRMATION COMMANDE</h2>
          <div class="info">Table ${order.table_number}</div>
          <div class="info">Serveur: ${server}</div>
          <div class="info">${new Date().toLocaleString('fr-FR')}</div>
          <div class="info">N°: ${order.order_number}</div>
        </div>
        
        <div class="status">
          <strong>COMMANDE CONFIRMÉE</strong><br>
          En attente de paiement
        </div>
        
        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <span>${item.quantity}x ${item.item_name}</span>
              <span>${item.total_price.toLocaleString()} f CFA</span>
            </div>
          `).join('')}
        </div>
        
        <div class="total">
          <div class="item">
            <span>Total:</span>
            <span>${order.total_amount.toLocaleString()} f CFA</span>
          </div>
        </div>
        
        <div class="footer">
          Commande confirmée<br>
          À envoyer à la caisse pour paiement
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestion des Commandes</h2>
          <p className="text-slate-600 mt-1">Prise de commande et confirmation</p>
        </div>
      </div>

      {activeView === 'tables' && (
        <div>
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Informations serveur</h3>
            <div className="bg-white p-4 rounded-lg border max-w-md">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nom du serveur *
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Votre nom"
                required
              />
              <p className="text-sm text-slate-500 mt-2">
                Ce nom apparaîtra sur les tickets
              </p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-slate-900 mb-4">Sélectionnez une table</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => serverName ? selectTable(table) : alert('Veuillez saisir votre nom')}
                className={`p-6 rounded-lg border-2 font-bold text-lg transition ${
                  table.status === 'available' && serverName
                    ? 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                disabled={table.status !== 'available' || !serverName}
              >
                <div className="text-2xl mb-2">Table {table.table_number}</div>
                <div className="text-sm font-normal">
                  {table.capacity} places
                </div>
                <div className="text-xs mt-2">
                  {table.status === 'available' ? 'Disponible' : 'Occupée'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeView === 'order' && currentOrder && (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Commande - Table {currentOrder.table_number}
                </h3>
                <p className="text-slate-600">N° {currentOrder.order_number}</p>
                <p className="text-slate-600">Serveur: {serverName}</p>
                {isConfirmed && (
                  <div className="mt-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium inline-flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Commande Confirmée - Prête pour envoi à la caisse
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-slate-500" />
                  <span className="text-sm">Clients:</span>
                  <select
                    value={customerCount}
                    onChange={(e) => {
                      setCustomerCount(Number(e.target.value));
                      setCurrentOrder(prev => prev ? {
                        ...prev,
                        customer_count: Number(e.target.value)
                      } : null);
                    }}
                    className="border rounded px-2 py-1"
                    disabled={isConfirmed}
                  >
                    {[1,2,3,4,5,6,7,8].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={() => {
                    setActiveView('tables');
                    setCurrentOrder(null);
                    setSelectedTable(null);
                    setIsConfirmed(false);
                  }}
                  className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
                >
                  Changer de table
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes de commande
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Instructions spéciales, allergies, etc."
                disabled={isConfirmed}
              />
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <h4 className="font-semibold text-slate-900 mb-4">Menu</h4>
                <div className="grid grid-cols-2 gap-3">
                  {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => !isConfirmed && addItemToOrder(item)}
                      disabled={!item.is_available || isConfirmed}
                      className="p-4 border rounded-lg hover:bg-slate-50 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {item.price.toLocaleString()} f CFA
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-1">
                <div className="bg-slate-50 rounded-lg p-4 sticky top-4">
                  <h4 className="font-semibold text-slate-900 mb-4">
                    {isConfirmed ? 'Commande Confirmée' : 'Commande en cours'}
                  </h4>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                    {currentOrder.items.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">Aucun article</p>
                    ) : (
                      currentOrder.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-white p-3 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-sm text-slate-600">
                              {item.unit_price.toLocaleString()} f CFA
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => !isConfirmed && updateItemQuantity(index, item.quantity - 1)}
                                disabled={isConfirmed}
                                className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 disabled:opacity-50"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => !isConfirmed && updateItemQuantity(index, item.quantity + 1)}
                                disabled={isConfirmed}
                                className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 disabled:opacity-50"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="w-20 text-right font-semibold">
                              {item.total_price.toLocaleString()} f CFA
                            </div>
                            {!isConfirmed && (
                              <button
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {currentOrder.items.length > 0 && (
                    <>
                      <div className="border-t pt-3 mb-4">
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span>{currentOrder.total_amount.toLocaleString()} f CFA</span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {!isConfirmed ? (
                          <>
                            <button
                              onClick={() => printOrderConfirmation(currentOrder, serverName)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Imprimer</span>
                            </button>
                            <button
                              onClick={confirmOrder}
                              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center space-x-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Confirmer</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => printOrderConfirmation(currentOrder, serverName)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Imprimer</span>
                            </button>
                            <button
                              onClick={sendToCashier}
                              className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition flex items-center justify-center space-x-2"
                            >
                              <Send className="w-4 h-4" />
                              <span>Envoyer à la Caisse</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
