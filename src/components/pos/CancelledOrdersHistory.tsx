// src/components/pos/CancelledOrdersHistory.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Calendar,
  Trash2,
  Eye,
  RefreshCw,
  Filter,
  Download,
  Printer,
  AlertCircle,
  Clock,
  User,
  Utensils,
  Home,
  Truck,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

interface CancelledOrder {
  id: string;
  order_number: string;
  table_number: string;
  customer_count: number;
  total_amount: number;
  status: string;
  order_type: 'sur_place' | 'a_emporter' | 'livraison';
  notes: string;
  cancelled_at: string;
  cancelled_by: string;
  cancelled_by_email?: string;
  server_name?: string;
  items: CancelledOrderItem[];
  created_at: string;
}

interface CancelledOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  category?: string;
}

export default function CancelledOrdersHistory() {
  const { user } = useAuth();
  const [cancelledOrders, setCancelledOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'sur_place' | 'a_emporter' | 'livraison'>('all');
  const [selectedOrder, setSelectedOrder] = useState<CancelledOrder | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // Charger les commandes annulées
  const loadCancelledOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('pos_orders')
        .select(`
          *,
          pos_order_items(*)
        `)
        .eq('status', 'cancelled')
        .order('cancelled_at', { ascending: false });

      // Appliquer les filtres
      if (dateRange.start) {
        query = query.gte('cancelled_at', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('cancelled_at', `${dateRange.end}T23:59:59`);
      }

      if (orderTypeFilter !== 'all') {
        query = query.eq('order_type', orderTypeFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      // Charger les emails des utilisateurs qui ont annulé
      const cancelledByUserIds = new Set<string>();
      ordersData?.forEach(order => {
        if (order.cancelled_by) {
          cancelledByUserIds.add(order.cancelled_by);
        }
      });

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(cancelledByUserIds));

      const usersMap = new Map(usersData?.map(user => [user.id, user.email]) || []);

      // Préparer les commandes avec emails
      const ordersWithEmails = ordersData?.map(order => ({
        ...order,
        cancelled_by_email: order.cancelled_by ? usersMap.get(order.cancelled_by) || 'Utilisateur inconnu' : 'Système',
        items: order.pos_order_items || []
      })) || [];

      setCancelledOrders(ordersWithEmails);

    } catch (error) {
      console.error('Error loading cancelled orders:', error);
      setError('Erreur lors du chargement de l\'historique des commandes annulées');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCancelledOrders();
  }, [dateRange, orderTypeFilter]);

  // Calcul des statistiques
  const stats = {
    totalCancelled: cancelledOrders.length,
    totalAmountLost: cancelledOrders.reduce((sum, order) => sum + order.total_amount, 0),
    todayCancelled: cancelledOrders.filter(order => 
      new Date(order.cancelled_at).toDateString() === new Date().toDateString()
    ).length,
    byOrderType: cancelledOrders.reduce((acc, order) => {
      acc[order.order_type] = (acc[order.order_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byUser: cancelledOrders.reduce((acc, order) => {
      const user = order.cancelled_by_email || order.cancelled_by;
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  // Filtrer les commandes par terme de recherche
  const filteredOrders = cancelledOrders.filter(order => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(searchLower) ||
        order.table_number.toLowerCase().includes(searchLower) ||
        order.server_name?.toLowerCase().includes(searchLower) ||
        order.cancelled_by_email?.toLowerCase().includes(searchLower) ||
        order.notes?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' f CFA';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOrderTypeIcon = (orderType: string) => {
    switch (orderType) {
      case 'sur_place':
        return <Utensils className="w-4 h-4" />;
      case 'a_emporter':
        return <Home className="w-4 h-4" />;
      case 'livraison':
        return <Truck className="w-4 h-4" />;
      default:
        return <Utensils className="w-4 h-4" />;
    }
  };

  const getOrderTypeColor = (orderType: string) => {
    switch (orderType) {
      case 'sur_place':
        return 'bg-blue-100 text-blue-800';
      case 'a_emporter':
        return 'bg-green-100 text-green-800';
      case 'livraison':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setOrderTypeFilter('all');
  };

  const exportToCSV = () => {
    const headers = [
      'Date Annulation',
      'Heure Annulation',
      'N° Commande',
      'Table',
      'Type',
      'Serveur',
      'Annulé par',
      'Nombre articles',
      'Montant total',
      'Raison',
      'Client(s)'
    ];

    const csvData = cancelledOrders.map(order => [
      new Date(order.cancelled_at).toLocaleDateString('fr-FR'),
      new Date(order.cancelled_at).toLocaleTimeString('fr-FR'),
      order.order_number,
      order.table_number,
      order.order_type.replace('_', ' '),
      order.server_name || '-',
      order.cancelled_by_email || '-',
      order.items.length,
      order.total_amount,
      order.notes || '-',
      order.customer_count
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes-annulees-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printOrderDetails = (order: CancelledOrder) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Détails Commande Annulée - ${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 20px; }
          .section-title { background: #f0f0f0; padding: 10px; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .items-table th { background: #f5f5f5; }
          .cancelled-badge { color: #e74c3c; font-weight: bold; }
          @media print { body { margin: 0; } .container { max-width: 100%; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Commande Annulée - ${order.order_number}</h1>
            <p class="cancelled-badge">❌ COMMANDE ANNULÉE</p>
          </div>
          
          <div class="section">
            <div class="section-title">Informations Générales</div>
            <div class="info-grid">
              <div>
                <div class="info-row">
                  <span>N° Commande:</span>
                  <span>${order.order_number}</span>
                </div>
                <div class="info-row">
                  <span>Table:</span>
                  <span>${order.table_number}</span>
                </div>
                <div class="info-row">
                  <span>Type:</span>
                  <span>${order.order_type.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div class="info-row">
                  <span>Clients:</span>
                  <span>${order.customer_count} personne(s)</span>
                </div>
              </div>
              <div>
                <div class="info-row">
                  <span>Date création:</span>
                  <span>${formatDate(order.created_at)}</span>
                </div>
                <div class="info-row">
                  <span>Date annulation:</span>
                  <span>${formatDate(order.cancelled_at)}</span>
                </div>
                <div class="info-row">
                  <span>Annulé par:</span>
                  <span>${order.cancelled_by_email || order.cancelled_by}</span>
                </div>
                <div class="info-row">
                  <span>Serveur:</span>
                  <span>${order.server_name || '-'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Articles Annulés (${order.items.length})</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Catégorie</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td>${item.item_name}</td>
                    <td>${item.category || '-'}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unit_price)}</td>
                    <td>${formatCurrency(item.total_price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">Résumé Financier</div>
            <div class="info-grid">
              <div>
                <div class="info-row">
                  <span>Nombre d'articles:</span>
                  <span>${order.items.length}</span>
                </div>
                <div class="info-row">
                  <span>Montant total:</span>
                  <span><strong>${formatCurrency(order.total_amount)}</strong></span>
                </div>
              </div>
            </div>
          </div>
          
          ${order.notes ? `
          <div class="section">
            <div class="section-title">Raison de l'annulation</div>
            <div style="background: #fee; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c;">
              ${order.notes}
            </div>
          </div>
          ` : ''}
          
          <div class="section" style="text-align: center; margin-top: 40px; color: #666; font-size: 12px;">
            Généré le ${new Date().toLocaleString('fr-FR')}
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const openOrderDetails = (order: CancelledOrder) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-xl font-semibold text-gray-700 mt-4">Chargement de l'historique...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* En-tête fixe */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Historique des Commandes Annulées</h1>
            <p className="text-gray-600 mt-2">Traçabilité complète des commandes annulées</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              disabled={cancelledOrders.length === 0}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Exporter CSV</span>
            </button>
            <button
              onClick={loadCancelledOrders}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center text-sm text-gray-600">
          <Trash2 className="w-4 h-4 mr-2" />
          <span>{cancelledOrders.length} commande(s) annulée(s) au total</span>
        </div>
      </div>

      {/* Contenu principal qui défile */}
      <div className="flex-1 overflow-auto p-6">
        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-700">Total annulées</p>
            <p className="text-2xl font-bold text-red-900 mt-2">{stats.totalCancelled}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm font-medium text-orange-700">Perte totale</p>
            <p className="text-2xl font-bold text-orange-900 mt-2">{formatCurrency(stats.totalAmountLost)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-700">Aujourd'hui</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">{stats.todayCancelled}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-700">Types</p>
            <p className="text-sm text-green-900 mt-2">
              Sur place: {stats.byOrderType.sur_place || 0}<br/>
              À emporter: {stats.byOrderType.a_emporter || 0}<br/>
              Livraison: {stats.byOrderType.livraison || 0}
            </p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="N° commande, table, serveur..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les types</option>
                <option value="sur_place">Sur place</option>
                <option value="a_emporter">À emporter</option>
                <option value="livraison">Livraison</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date début
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date fin
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-600">
              {filteredOrders.length} commande(s) trouvée(s)
            </div>
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              <Filter className="w-4 h-4" />
              <span>Réinitialiser filtres</span>
            </button>
          </div>
        </div>

        {/* Tableau des commandes annulées */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commande
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Articles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Annulé par
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Heure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.order_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.server_name || 'Serveur non spécifié'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Table {order.table_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.customer_count} client(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderTypeColor(order.order_type)}`}>
                        {getOrderTypeIcon(order.order_type)}
                        <span className="ml-1 capitalize">
                          {order.order_type.replace('_', ' ')}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.items.length} article(s)
                      </div>
                      {order.items.slice(0, 2).map((item, index) => (
                        <div key={index} className="text-xs text-gray-500 truncate max-w-xs">
                          {item.quantity}x {item.item_name}
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <div className="text-xs text-gray-400">
                          +{order.items.length - 2} autre(s)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.cancelled_by_email || order.cancelled_by}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(order.cancelled_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openOrderDetails(order)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Détails</span>
                        </button>
                        <button
                          onClick={() => printOrderDetails(order)}
                          className="text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition flex items-center space-x-1"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Imprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Aucune commande annulée trouvée</h3>
              <p className="text-gray-500 mt-1">
                {cancelledOrders.length === 0 
                  ? "Aucune commande n'a été annulée pour le moment."
                  : "Aucune commande ne correspond à vos critères de recherche."
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal des détails de commande */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-8 border-b border-gray-200">
              <div>
                <h3 className="text-3xl font-bold text-gray-900">Détails Commande Annulée</h3>
                <p className="text-gray-600 mt-2">
                  {selectedOrder.order_number} • Annulée le {formatDate(selectedOrder.cancelled_at)}
                </p>
              </div>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-400 hover:text-gray-600 transition text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">N° Commande</span>
                        <span className="font-medium">{selectedOrder.order_number}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Table</span>
                        <span className="font-medium">{selectedOrder.table_number}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Type</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderTypeColor(selectedOrder.order_type)}`}>
                          {getOrderTypeIcon(selectedOrder.order_type)}
                          <span className="ml-1 capitalize">
                            {selectedOrder.order_type.replace('_', ' ')}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Clients</span>
                        <span className="font-medium">{selectedOrder.customer_count} personne(s)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Personnel</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Serveur</span>
                        <span className="font-medium">{selectedOrder.server_name || 'Non spécifié'}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Annulé par</span>
                        <span className="font-medium">{selectedOrder.cancelled_by_email || selectedOrder.cancelled_by}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Dates</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Créée le</span>
                        <span className="font-medium">{formatDate(selectedOrder.created_at)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Annulée le</span>
                        <span className="font-medium text-red-600">{formatDate(selectedOrder.cancelled_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Finances</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Articles</span>
                        <span className="font-medium">{selectedOrder.items.length} article(s)</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Montant total</span>
                        <span className="font-bold text-xl text-red-600">{formatCurrency(selectedOrder.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Articles Annulés ({selectedOrder.items.length})</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Article
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Catégorie
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prix unitaire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {item.item_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {item.category || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          Total général:
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {formatCurrency(selectedOrder.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Raison de l'annulation</h4>
                  <div className="bg-red-50 rounded-lg p-6 border-l-4 border-red-500">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end space-x-4">
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Fermer
                </button>
                <button
                  onClick={() => printOrderDetails(selectedOrder)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
                >
                  Imprimer les détails
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
