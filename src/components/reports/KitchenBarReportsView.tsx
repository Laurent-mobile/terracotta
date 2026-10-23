// src/components/reports/KitchenBarReportsView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Utensils, Coffee, Clock, Filter, Download, FileText, Printer,
  ChevronDown, ChevronUp, Search, X, Calendar, CheckCircle, XCircle, AlertCircle,
  BarChart3, List, Grid, Hash, DollarSign, Package
} from 'lucide-react';

interface KitchenBarReportsViewProps {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  timeRange: {
    startHour: string;
    startMinute: string;
    endHour: string;
    endMinute: string;
  };
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  kitchen_note?: string;
  bar_note?: string;
  status: string;
  created_at: string;
}

interface OrderWithItems {
  id: string;
  order_number: string;
  table_number: string;
  total_amount: number;
  status: string;
  payment_method?: string;
  created_at: string;
  notes?: string;
  order_type?: string;
  server_name?: string;
  items: OrderItem[];
}

interface ItemSummary {
  item_name: string;
  category: string;
  total_quantity: number;
  total_amount: number;
  unit_price: number;
  is_kitchen: boolean;
  is_bar: boolean;
}

type ViewMode = 'detailed' | 'summary';

export default function KitchenBarReportsView({ dateRange, timeRange }: KitchenBarReportsViewProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');

  useEffect(() => {
    loadKitchenBarData();
  }, [dateRange, timeRange]);

  const loadKitchenBarData = async () => {
    try {
      setLoading(true);
      
      const startDateTime = `${dateRange.startDate}T${timeRange.startHour}:${timeRange.startMinute}:00`;
      const endDateTime = `${dateRange.endDate}T${timeRange.endHour}:${timeRange.endMinute}:59`;

      const { data, error } = await supabase
        .from('pos_orders')
        .select(`
          *,
          pos_order_items(*)
        `)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur chargement données cuisine & bar:', error);
        return;
      }

      const ordersWithItems = (data || []).map(order => ({
        ...order,
        items: order.pos_order_items || []
      })) as OrderWithItems[];

      console.log('🍽️ Données cuisine & bar:', {
        commandes: ordersWithItems.length,
        articles: ordersWithItems.reduce((sum, order) => sum + (order.items?.length || 0), 0)
      });

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('💥 Erreur générale:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemCategories = () => {
    const categories = new Set<string>();
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (item.category) {
          categories.add(item.category);
        }
      });
    });
    return Array.from(categories);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'servi':
      case 'served':
      case 'prêt':
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'en préparation':
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'en attente':
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'annulé':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'servi':
      case 'served':
      case 'prêt':
      case 'ready':
        return <CheckCircle className="w-4 h-4" />;
      case 'annulé':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const isKitchenItem = (item: OrderItem) => {
    const kitchenCategories = ['plats', 'entrées', 'desserts', 'menus', 'accompagnements', 'soupe', 'salade', 'viande', 'poisson', 'poulet', 'burger', 'pizza', 'pâtes', 'riz'];
    return kitchenCategories.some(cat => 
      item.category?.toLowerCase().includes(cat)
    );
  };

  const isBarItem = (item: OrderItem) => {
    const barCategories = ['boissons', 'cocktails', 'vins', 'bières', 'soft', 'jus', 'soda', 'eau', 'apéritif', 'digestif', 'thé', 'café'];
    return barCategories.some(cat => 
      item.category?.toLowerCase().includes(cat)
    );
  };

  const getFilteredItems = () => {
    const allItems = orders.flatMap(order => 
      order.items?.map(item => ({
        ...item,
        order_number: order.order_number,
        order_id: order.id,
        table_number: order.table_number,
        server_name: order.server_name,
        order_created_at: order.created_at,
        is_kitchen: isKitchenItem(item),
        is_bar: isBarItem(item)
      })) || []
    );

    let filtered = allItems;

    // Filtrer par type (cuisine/bar)
    if (itemTypeFilter === 'kitchen') {
      filtered = filtered.filter(item => item.is_kitchen);
    } else if (itemTypeFilter === 'bar') {
      filtered = filtered.filter(item => item.is_bar);
    }

    // Filtrer par catégorie
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Filtrer par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Filtrer par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.item_name?.toLowerCase().includes(term) ||
        item.order_number?.toLowerCase().includes(term) ||
        item.table_number?.toString().includes(term) ||
        item.server_name?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  // Nouvelle fonction pour générer le résumé par plat
  const getItemSummary = () => {
    const filteredItems = getFilteredItems();
    const summaryMap = new Map<string, ItemSummary>();

    filteredItems.forEach(item => {
      const key = `${item.item_name}_${item.category}`;
      const existing = summaryMap.get(key);
      
      if (existing) {
        existing.total_quantity += item.quantity;
        existing.total_amount += item.total_price;
      } else {
        summaryMap.set(key, {
          item_name: item.item_name,
          category: item.category || 'Non catégorisé',
          total_quantity: item.quantity,
          total_amount: item.total_price,
          unit_price: item.unit_price,
          is_kitchen: isKitchenItem(item),
          is_bar: isBarItem(item)
        });
      }
    });

    // Convertir en tableau et trier par quantité (décroissant)
    return Array.from(summaryMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity);
  };

  const getStatistics = () => {
    const filteredItems = getFilteredItems();
    const kitchenItems = filteredItems.filter(item => item.is_kitchen);
    const barItems = filteredItems.filter(item => item.is_bar);

    return {
      totalItems: filteredItems.length,
      totalQuantity: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
      totalRevenue: filteredItems.reduce((sum, item) => sum + (item.total_price || 0), 0),
      
      kitchenItems: kitchenItems.length,
      kitchenQuantity: kitchenItems.reduce((sum, item) => sum + item.quantity, 0),
      kitchenRevenue: kitchenItems.reduce((sum, item) => sum + (item.total_price || 0), 0),
      
      barItems: barItems.length,
      barQuantity: barItems.reduce((sum, item) => sum + item.quantity, 0),
      barRevenue: barItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
    };
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filteredItems = getFilteredItems();
    const itemSummary = getItemSummary();
    const stats = getStatistics();

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Cuisine & Bar</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; color: #333; }
          .period { color: #666; margin: 5px 0; }
          .date { color: #999; font-size: 12px; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
          .stat-card.kitchen { border-top: 4px solid #10b981; }
          .stat-card.bar { border-top: 4px solid #3b82f6; }
          .stat-card.total { border-top: 4px solid #8b5cf6; }
          .stat-card .count { font-size: 14px; color: #666; margin-top: 5px; }
          .stat-card .amount { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .filters { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .status-badge { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600;
          }
          .kitchen-badge { background-color: #10b981; color: white; }
          .bar-badge { background-color: #3b82f6; color: white; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          .total-row { background-color: #f8f9fa; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport Cuisine & Bar</h1>
          <div class="period">Période: ${dateRange.startDate} ${timeRange.startHour}:${timeRange.startMinute} à ${dateRange.endDate} ${timeRange.endHour}:${timeRange.endMinute}</div>
          <div class="date">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
        </div>
        
        <div class="filters">
          <h3>Filtres appliqués:</h3>
          <p>
            <strong>Type:</strong> ${itemTypeFilter === 'all' ? 'Tous' : itemTypeFilter === 'kitchen' ? 'Cuisine uniquement' : 'Bar uniquement'}<br>
            <strong>Catégorie:</strong> ${categoryFilter === 'all' ? 'Toutes' : categoryFilter}<br>
            <strong>Statut:</strong> ${statusFilter === 'all' ? 'Tous' : statusFilter}<br>
            <strong>Recherche:</strong> ${searchTerm || 'Aucune'}
          </p>
        </div>

        <div class="stats">
          <div class="stat-card total">
            <h3>Total</h3>
            <div class="amount">${stats.totalRevenue.toLocaleString()} f CFA</div>
            <div class="count">${stats.totalQuantity} unité(s) • ${stats.totalItems} article(s)</div>
          </div>
          
          <div class="stat-card kitchen">
            <h3>Cuisine</h3>
            <div class="amount">${stats.kitchenRevenue.toLocaleString()} f CFA</div>
            <div class="count">${stats.kitchenQuantity} unité(s) • ${stats.kitchenItems} article(s)</div>
          </div>
          
          <div class="stat-card bar">
            <h3>Bar</h3>
            <div class="amount">${stats.barRevenue.toLocaleString()} f CFA</div>
            <div class="count">${stats.barQuantity} unité(s) • ${stats.barItems} article(s)</div>
          </div>
        </div>

        <h2>Résumé par Plat/Boisson (${viewMode === 'summary' ? 'Vue Résumé' : 'Vue Détaillée'})</h2>
        
        ${viewMode === 'summary' ? `
          <h3>Quantités vendues par article</h3>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Type</th>
                <th>Quantité Totale</th>
                <th>Prix Unitaire</th>
                <th>Montant Total</th>
                <th>% du Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemSummary.map(item => {
                const percentage = stats.totalRevenue > 0 ? ((item.total_amount / stats.totalRevenue) * 100).toFixed(1) : '0';
                return `
                  <tr>
                    <td>${item.item_name}</td>
                    <td>${item.category}</td>
                    <td>
                      <span class="status-badge ${item.is_kitchen ? 'kitchen-badge' : 'bar-badge'}">
                        ${item.is_kitchen ? 'Cuisine' : 'Bar'}
                      </span>
                    </td>
                    <td>${item.total_quantity}</td>
                    <td>${item.unit_price?.toLocaleString()} f CFA</td>
                    <td>${item.total_amount.toLocaleString()} f CFA</td>
                    <td>${percentage}%</td>
                  </tr>
                `;
              }).join('')}
              
              <tr class="total-row">
                <td colspan="3"><strong>TOTAL</strong></td>
                <td><strong>${stats.totalQuantity}</strong></td>
                <td></td>
                <td><strong>${stats.totalRevenue.toLocaleString()} f CFA</strong></td>
                <td><strong>100%</strong></td>
              </tr>
            </tbody>
          </table>
        ` : `
          <h3>Détail des Articles</h3>
          <p>Total filtré: ${filteredItems.length} article(s) - ${stats.totalQuantity} unité(s) - ${stats.totalRevenue.toLocaleString()} f CFA</p>
          
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Type</th>
                <th>N° Commande</th>
                <th>Table</th>
                <th>Statut</th>
                <th>Quantité</th>
                <th>Prix Unitaire</th>
                <th>Total</th>
                <th>Heure</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.map(item => `
                <tr>
                  <td>${item.item_name}</td>
                  <td>${item.category || '-'}</td>
                  <td>
                    <span class="status-badge ${item.is_kitchen ? 'kitchen-badge' : 'bar-badge'}">
                      ${item.is_kitchen ? 'Cuisine' : 'Bar'}
                    </span>
                  </td>
                  <td>${item.order_number || '-'}</td>
                  <td>${item.table_number || '-'}</td>
                  <td>${item.status || '-'}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit_price?.toLocaleString()} f CFA</td>
                  <td>${item.total_price?.toLocaleString()} f CFA</td>
                  <td>${new Date(item.order_created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              `).join('')}
              
              <tr class="total-row">
                <td colspan="6"><strong>TOTAL</strong></td>
                <td><strong>${stats.totalQuantity}</strong></td>
                <td></td>
                <td><strong>${stats.totalRevenue.toLocaleString()} f CFA</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        `}

        <div class="footer">
          <p>Rapport généré automatiquement par le système de gestion du restaurant</p>
          <p class="no-print">Cliquez sur Fichier → Imprimer ou appuyez sur Ctrl+P pour imprimer</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const exportSummaryToCSV = () => {
    const itemSummary = getItemSummary();
    const stats = getStatistics();

    const headers = ['Article', 'Catégorie', 'Type', 'Quantité Totale', 'Prix Unitaire', 'Montant Total', '% du Total'];
    
    const data = itemSummary.map(item => {
      const percentage = stats.totalRevenue > 0 ? ((item.total_amount / stats.totalRevenue) * 100).toFixed(2) : '0';
      return [
        item.item_name,
        item.category,
        item.is_kitchen ? 'Cuisine' : 'Bar',
        item.total_quantity,
        item.unit_price,
        item.total_amount,
        percentage
      ];
    });

    // Ajouter la ligne de total
    data.push([
      'TOTAL',
      '',
      '',
      stats.totalQuantity,
      '',
      stats.totalRevenue,
      '100'
    ]);

    const csv = [headers, ...data]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-cuisine-bar-${dateRange.startDate}-${dateRange.endDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
        <p className="mt-4 text-slate-600">Chargement du rapport cuisine & bar...</p>
      </div>
    );
  }

  const categories = getItemCategories();
  const filteredItems = getFilteredItems();
  const itemSummary = getItemSummary();
  const stats = getStatistics();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Rapport Cuisine & Bar</h3>
              <p className="text-sm text-slate-600">
                {viewMode === 'detailed' ? `${filteredItems.length} article(s)` : `${itemSummary.length} article(s) résumé(s)`}
                <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  {timeRange.startHour}:{timeRange.startMinute} - {timeRange.endHour}:{timeRange.endMinute}
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Boutons de vue */}
            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-2 text-sm flex items-center space-x-2 ${
                  viewMode === 'detailed' 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Détail</span>
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-2 text-sm flex items-center space-x-2 ${
                  viewMode === 'summary' 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Résumé</span>
              </button>
            </div>
            
            <button
              onClick={printReport}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={exportSummaryToCSV}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
        
        {/* Statistiques avec totaux */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalRevenue.toLocaleString()} f CFA</p>
                <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                  <div className="flex items-center">
                    <Package className="w-3 h-3 mr-1" />
                    {stats.totalQuantity} unités
                  </div>
                  <div className="flex items-center">
                    <Hash className="w-3 h-3 mr-1" />
                    {stats.totalItems} articles
                  </div>
                </div>
              </div>
              <div className="bg-purple-100 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Cuisine</p>
                <p className="text-2xl font-bold text-green-800">{stats.kitchenRevenue.toLocaleString()} f CFA</p>
                <div className="flex items-center space-x-2 text-xs text-green-600 mt-1">
                  <div className="flex items-center">
                    <Package className="w-3 h-3 mr-1" />
                    {stats.kitchenQuantity} unités
                  </div>
                  <div className="flex items-center">
                    <Hash className="w-3 h-3 mr-1" />
                    {stats.kitchenItems} articles
                  </div>
                </div>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <Utensils className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Bar</p>
                <p className="text-2xl font-bold text-blue-800">{stats.barRevenue.toLocaleString()} f CFA</p>
                <div className="flex items-center space-x-2 text-xs text-blue-600 mt-1">
                  <div className="flex items-center">
                    <Package className="w-3 h-3 mr-1" />
                    {stats.barQuantity} unités
                  </div>
                  <div className="flex items-center">
                    <Hash className="w-3 h-3 mr-1" />
                    {stats.barItems} articles
                  </div>
                </div>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <Coffee className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Indicateurs de filtres actifs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {itemTypeFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <Filter className="w-3 h-3 mr-1" />
              Type: {itemTypeFilter === 'kitchen' ? 'Cuisine' : 'Bar'}
            </span>
          )}
          {categoryFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Filter className="w-3 h-3 mr-1" />
              Catégorie: {categoryFilter}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <Filter className="w-3 h-3 mr-1" />
              Statut: {statusFilter}
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <Search className="w-3 h-3 mr-1" />
              Recherche: "{searchTerm}"
            </span>
          )}
          {(itemTypeFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setItemTypeFilter('all');
              }}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200"
            >
              <X className="w-3 h-3 mr-1" />
              Effacer tous
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Tous les types</option>
              <option value="kitchen">Cuisine uniquement</option>
              <option value="bar">Bar uniquement</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Catégorie</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="servi">Servi</option>
              <option value="en préparation">En préparation</option>
              <option value="en attente">En attente</option>
              <option value="annulé">Annulé</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher article..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contenu selon le mode de vue */}
      {viewMode === 'detailed' ? (
        /* Vue détaillée */
        <div className="divide-y">
          {filteredItems.map((item, index) => (
            <div key={`${item.order_id}-${item.id}`} className="p-6 hover:bg-slate-50 transition">
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleSection(`item-${item.order_id}-${item.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${
                      item.is_kitchen ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {item.is_kitchen ? (
                        <Utensils className="w-5 h-5 text-green-600" />
                      ) : (
                        <Coffee className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-slate-900">{item.item_name}</h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          <span className="ml-1">{item.status}</span>
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.is_kitchen ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.is_kitchen ? 'Cuisine' : 'Bar'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Commande {item.order_number} • Table {item.table_number || '-'} • 
                        {item.server_name && ` Serveur: ${item.server_name}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(item.order_created_at).toLocaleDateString('fr-FR')} • 
                        {new Date(item.order_created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="font-bold text-lg text-slate-900">
                      {item.total_price?.toLocaleString()} f CFA
                    </div>
                    <div className="text-sm text-slate-500">
                      {item.quantity} x {item.unit_price?.toLocaleString()} f CFA
                    </div>
                  </div>
                  {expandedSections[`item-${item.order_id}-${item.id}`] ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {expandedSections[`item-${item.order_id}-${item.id}`] && (
                <div className="mt-4 pl-12">
                  {(item.kitchen_note || item.bar_note) && (
                    <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        {item.kitchen_note && <><strong>Note cuisine:</strong> {item.kitchen_note}<br /></>}
                        {item.bar_note && <><strong>Note bar:</strong> {item.bar_note}</>}
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h5 className="font-medium text-slate-900 mb-3">Informations</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Catégorie:</span>
                        <span className="ml-2 font-medium">{item.category || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Type:</span>
                        <span className="ml-2 font-medium">{item.is_kitchen ? 'Cuisine' : 'Bar'}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Commande:</span>
                        <span className="ml-2 font-medium">{item.order_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Créé le:</span>
                        <span className="ml-2 font-medium">
                          {new Date(item.created_at).toLocaleDateString('fr-FR')} à{' '}
                          {new Date(item.created_at).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                Aucun article ne correspond à vos critères de recherche
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Vue résumé par plat */
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Article
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Quantité Totale
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Prix Unitaire
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Montant Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    % du Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {itemSummary.map((item, index) => {
                  const percentage = stats.totalRevenue > 0 ? ((item.total_amount / stats.totalRevenue) * 100).toFixed(1) : '0';
                  return (
                    <tr key={`${item.item_name}-${index}`} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.item_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.is_kitchen ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.is_kitchen ? 'Cuisine' : 'Bar'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 text-slate-400 mr-2" />
                          {item.total_quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {item.unit_price?.toLocaleString()} f CFA
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                        {item.total_amount.toLocaleString()} f CFA
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <div className="flex items-center">
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-emerald-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, parseFloat(percentage))}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 w-12">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                
                {/* Ligne de total */}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 text-slate-600 mr-2" />
                      {stats.totalQuantity}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700">
                    {stats.totalRevenue.toLocaleString()} f CFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {itemSummary.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                Aucun article à afficher dans le résumé
              </p>
            </div>
          )}

          {/* Résumé graphique */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Top 5 des articles</h4>
              <div className="space-y-3">
                {itemSummary.slice(0, 5).map((item, index) => {
                  const percentage = stats.totalQuantity > 0 ? ((item.total_quantity / stats.totalQuantity) * 100).toFixed(1) : '0';
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900 truncate mr-2">
                            {item.item_name}
                          </span>
                          <span className="text-sm text-slate-600">{item.total_quantity} unités</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Répartition par type</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-green-700">Cuisine</span>
                    <span className="text-sm text-slate-600">
                      {stats.kitchenQuantity} unités ({stats.totalQuantity > 0 ? ((stats.kitchenQuantity / stats.totalQuantity) * 100).toFixed(1) : '0'}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${stats.totalQuantity > 0 ? (stats.kitchenQuantity / stats.totalQuantity) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-blue-700">Bar</span>
                    <span className="text-sm text-slate-600">
                      {stats.barQuantity} unités ({stats.totalQuantity > 0 ? ((stats.barQuantity / stats.totalQuantity) * 100).toFixed(1) : '0'}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${stats.totalQuantity > 0 ? (stats.barQuantity / stats.totalQuantity) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{stats.kitchenQuantity}</div>
                  <div className="text-xs text-green-600">Unités cuisine</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{stats.barQuantity}</div>
                  <div className="text-xs text-blue-600">Unités bar</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
