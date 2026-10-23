// src/components/dashboard/DashboardView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRestaurant } from '../../contexts/RestaurantContext';
import {
  fetchAllOrders,
  fetchAllPayments,
  fetchAllExpenses,
  fetchAllOrderItems,
  fetchAllSupplierPayments
} from '../../utils/pagination';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, 
  Users, ShoppingCart, BarChart3, PieChart,
  AlertTriangle, Calendar, Clock, ChefHat,
  CreditCard, Utensils, Coffee, Receipt,
  ShoppingBag, Tag, BarChart
} from 'lucide-react';

interface DashboardStats {
  // Première ligne de cartes
  totalSales: number;
  totalExpenses: number;
  totalCurrentExpenses: number;
  totalFixedExpenses: number;
  totalSupplierPayments: number;
  revenue: number; // Chiffre d'affaires
  netProfit: number;
  
  // Deuxième ligne de cartes
  activeOrders: number;
  lowStockItems: number;
  salesCount: number;
  averageTicket: number;
  
  // Données supplémentaires
  customerCount: number;
  popularItems: any[];
  salesTrend: any[];
  categoryDistribution: any[];
  stockStatus: {
    low: number;
    medium: number;
    good: number;
  };
  paymentMethods: {
    cash: number;
    mobile_money: number;
    card: number;
  };
  totalProducts: number;
  monthlyGrowth: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function DashboardView() {
  const { settings } = useRestaurant();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    totalCurrentExpenses: 0,
    totalFixedExpenses: 0,
    totalSupplierPayments: 0,
    revenue: 0,
    netProfit: 0,
    activeOrders: 0,
    lowStockItems: 0,
    salesCount: 0,
    averageTicket: 0,
    customerCount: 0,
    popularItems: [],
    salesTrend: [],
    categoryDistribution: [],
    stockStatus: { low: 0, medium: 0, good: 0 },
    paymentMethods: { cash: 0, mobile_money: 0, card: 0 },
    totalProducts: 0,
    monthlyGrowth: 0
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('today');

  useEffect(() => {
    loadDashboardStats();
  }, [timeRange]);

  // Fonction pour obtenir le début et la fin de la semaine en cours (lundi au dimanche)
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = dimanche, 1 = lundi, ...
    const diffToMonday = day === 0 ? -6 : 1 - day; // Si dimanche, aller au lundi précédent
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { start: monday, end: sunday };
  };

  // Fonction pour obtenir le début et la fin du mois en cours
  const getMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    firstDay.setHours(0, 0, 0, 0);
    lastDay.setHours(23, 59, 59, 999);
    
    return { start: firstDay, end: lastDay };
  };

  // Dans la fonction loadDashboardStats du DashboardView.tsx
    const loadDashboardStats = async () => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let startDate: string;
    let endDate: string;
    
    // Calcul des dates selon la période
    if (timeRange === 'today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (timeRange === 'week') {
      const weekRange = getWeekRange();
      startDate = weekRange.start.toISOString().split('T')[0];
      endDate = weekRange.end.toISOString().split('T')[0];
    } else if (timeRange === 'month') {
      const monthRange = getMonthRange();
      startDate = monthRange.start.toISOString().split('T')[0];
      endDate = monthRange.end.toISOString().split('T')[0];
    } else { // year
      const yearStart = new Date(today.getFullYear(), 0, 1);
      startDate = yearStart.toISOString().split('T')[0];
      endDate = todayStr;
    }

    console.log('📊 Période sélectionnée:', { startDate, endDate, timeRange });

    // Récupération de TOUTES les données nécessaires avec pagination
    const [
      posOrdersData,
      posPaymentsData,
      expensesData,
      supplierPaymentsData,
      inventoryData,
      orderItemsData,
      activeOrdersData,
      orderItemsByCategoryData
    ] = await Promise.all([
      fetchAllOrders(supabase, startDate, endDate, ['paid', 'closed']),
      fetchAllPayments(supabase, startDate, endDate),
      fetchAllExpenses(supabase, startDate, endDate), // 🔥 Déjà filtré dans fetchAllExpenses
      fetchAllSupplierPayments(supabase, startDate, endDate),
      supabase
        .from('inventory_items')
        .select('current_quantity, min_quantity, name, unit_cost, is_active')
        .eq('is_active', true),
      fetchAllOrderItems(supabase, startDate, endDate),
      supabase
        .from('pos_orders')
        .select('*')
        .in('status', ['open', 'confirmed', 'ready'])
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      fetchAllOrderItems(supabase, startDate, endDate)
    ]);

    // Logs pour débogage
    console.log('📊 Données récupérées - Période:', { startDate, endDate });
    console.log('💰 Ventes - Nombre de commandes:', posOrdersData?.length || 0);
    console.log('💸 Dépenses - Nombre total (après exclusion des supprimées):', expensesData?.length || 0);

    // VENTES
    const completedOrders = posOrdersData || [];
    const totalSales = completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const salesCount = completedOrders.length;
    const averageTicket = salesCount > 0 ? totalSales / salesCount : 0;

    // 🔥 DÉPENSES - Déjà filtrées dans fetchAllExpenses
    const allExpenses = expensesData || [];
    
    console.log('📈 Toutes les dépenses actives récupérées:', allExpenses.length);
    
    // Afficher les premières dépenses pour débogage
    allExpenses.slice(0, 5).forEach((expense: any, index: number) => {
      console.log(`Dépense ${index + 1}:`, {
        description: expense.description,
        amount: expense.amount,
        expense_date: expense.expense_date,
        is_deleted: expense.is_deleted,
        category_type: expense.expense_categories?.category_type
      });
    });

    // Filtrer comme dans les rapports détaillés
    const currentExpenses = allExpenses.filter((expense: any) => 
      (expense.expense_categories?.category_type === 'current' || 
       !expense.expense_categories?.category_type) &&
      expense.expense_type !== 'supplier_order' &&
      !expense.reference_type?.includes('supplier')
    );
    
    const fixedExpenses = allExpenses.filter((expense: any) => 
      expense.expense_categories?.category_type === 'fixed' &&
      expense.expense_type !== 'supplier_order' &&
      !expense.reference_type?.includes('supplier')
    );

    const totalCurrentExpenses = currentExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalFixedExpenses = fixedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    console.log('📊 Dépenses filtrées:', {
      total: allExpenses.length,
      courantes: currentExpenses.length,
      fixes: fixedExpenses.length,
      montantCourantes: totalCurrentExpenses,
      montantFixes: totalFixedExpenses
    });

    // PAIEMENTS FOURNISSEURS
    const supplierPayments = supplierPaymentsData || [];
    const totalSupplierPayments = supplierPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    console.log('💳 Paiements fournisseurs:', {
      total: totalSupplierPayments,
      count: supplierPayments.length
    });

    // CALCUL DES DÉPENSES TOTALES (comme dans les rapports détaillés)
    const totalExpenses = totalFixedExpenses + totalSupplierPayments + totalCurrentExpenses;

    console.log('🧮 Calcul final des dépenses:', {
      fixes: totalFixedExpenses,
      paiementsFournisseurs: totalSupplierPayments,
      courantes: totalCurrentExpenses,
      total: totalExpenses,
      formule: `${totalFixedExpenses} + ${totalSupplierPayments} + ${totalCurrentExpenses} = ${totalExpenses}`
    });

    // Chiffre d'affaires = total des ventes
    const revenue = totalSales;
    
    // Bénéfice net = revenus - dépenses totales
    const netProfit = revenue - totalExpenses;

    console.log('✅ Résumé financier:', {
      'Ventes totales': revenue,
      'Dépenses totales': totalExpenses,
      'Bénéfice net': netProfit,
      'Marge': revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(2)}%` : '0%'
    });

    // Stocks faibles
    const inventoryItems = inventoryData.data || [];
    const lowStockItems = inventoryItems.filter(item =>
      item.current_quantity <= item.min_quantity
    ).length;

    // Commandes actives
    const activeOrders = activeOrdersData?.length || 0;

    // Articles populaires
    const itemCounts: { [key: string]: { quantity: number, revenue: number } } = {};
    (orderItemsData || []).forEach(item => {
      if (!itemCounts[item.item_name]) {
        itemCounts[item.item_name] = { quantity: 0, revenue: 0 };
      }
      itemCounts[item.item_name].quantity += item.quantity;
      itemCounts[item.item_name].revenue += item.total_price;
    });
    
    const popularItems = Object.entries(itemCounts)
      .map(([name, data]) => ({ 
        name, 
        count: data.quantity,
        revenue: data.revenue 
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Tendances des ventes par jour
    const salesByDay: { [date: string]: number } = {};
    
    if (timeRange === 'week') {
      const weekRange = getWeekRange();
      const currentDay = new Date(weekRange.start);
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentDay);
        date.setDate(currentDay.getDate() + i);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
        salesByDay[formattedDate] = 0;
      }
      
      completedOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const formattedDate = orderDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
        salesByDay[formattedDate] = (salesByDay[formattedDate] || 0) + order.total_amount;
      });
    } else if (timeRange === 'month') {
      completedOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const weekOfMonth = Math.ceil(orderDate.getDate() / 7);
        const label = `Semaine ${weekOfMonth}`;
        salesByDay[label] = (salesByDay[label] || 0) + order.total_amount;
      });
      
      const monthRange = getMonthRange();
      const daysInMonth = monthRange.end.getDate();
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      
      for (let week = 1; week <= weeksInMonth; week++) {
        const label = `Semaine ${week}`;
        if (!salesByDay[label]) {
          salesByDay[label] = 0;
        }
      }
    } else {
      completedOrders.forEach(order => {
        const date = new Date(order.created_at);
        let formattedDate: string;
        
        if (timeRange === 'today') {
          formattedDate = 'Aujourd\'hui';
        } else if (timeRange === 'year') {
          formattedDate = date.toLocaleDateString('fr-FR', { month: 'short' });
        } else {
          formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        }
        
        salesByDay[formattedDate] = (salesByDay[formattedDate] || 0) + order.total_amount;
      });
    }
    
    const salesTrend = Object.entries(salesByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => {
        if (timeRange === 'month' && a.date.includes('Semaine') && b.date.includes('Semaine')) {
          return parseInt(a.date.split(' ')[1]) - parseInt(b.date.split(' ')[1]);
        }
        if (timeRange === 'week') {
          const weekDays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
          return weekDays.indexOf(a.date.split(' ')[0]) - weekDays.indexOf(b.date.split(' ')[0]);
        }
        return 0;
      });

    // Répartition des méthodes de paiement
    const paymentMethods = {
      cash: (posPaymentsData || []).filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + p.amount_paid, 0),
      mobile_money: (posPaymentsData || []).filter(p => p.payment_method === 'mobile_money').reduce((sum, p) => sum + p.amount_paid, 0),
      card: (posPaymentsData || []).filter(p => p.payment_method === 'card').reduce((sum, p) => sum + p.amount_paid, 0)
    };

    // Distribution par catégorie
    const orderItemsByCategory = orderItemsByCategoryData || [];
    const categoryTotals: { [category: string]: number } = {};
    
    orderItemsByCategory.forEach(item => {
      const category = normalizeCategory(item.category || 'Non catégorisé');
      categoryTotals[category] = (categoryTotals[category] || 0) + item.total_price;
    });
    
    const categoryDistribution = Object.entries(categoryTotals)
      .map(([name, value]) => ({ 
        name, 
        value: Math.round(value) 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Statut du stock
    const stockStatus = {
      low: inventoryItems.filter(item => item.current_quantity <= item.min_quantity).length,
      medium: inventoryItems.filter(item => 
        item.current_quantity > item.min_quantity && item.current_quantity <= item.min_quantity * 2
      ).length,
      good: inventoryItems.filter(item => item.current_quantity > item.min_quantity * 2).length
    };

    // Nombre total de produits actifs
    const totalProducts = inventoryItems.length;

    // Calcul de la croissance
    let monthlyGrowth = 0;
    if (timeRange === 'month') {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      
      const previousMonthData = await fetchAllOrders(
        supabase,
        lastMonthStart.toISOString().split('T')[0],
        lastMonthEnd.toISOString().split('T')[0],
        ['paid', 'closed']
      );

      const previousMonthSales = previousMonthData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      monthlyGrowth = previousMonthSales > 0 
        ? ((revenue - previousMonthSales) / previousMonthSales) * 100 
        : revenue > 0 ? 100 : 0;
    }

    setStats({
      totalSales,
      totalExpenses,
      totalCurrentExpenses,
      totalFixedExpenses,
      totalSupplierPayments,
      revenue,
      netProfit,
      activeOrders,
      lowStockItems,
      salesCount,
      averageTicket,
      customerCount: salesCount * 2.5,
      popularItems,
      salesTrend: salesTrend.length > 0 ? salesTrend : [{ date: 'Aujourd\'hui', amount: revenue }],
      categoryDistribution: categoryDistribution.length > 0 ? categoryDistribution : [
        { name: 'Plats', value: 45 },
        { name: 'Boissons', value: 30 },
        { name: 'Desserts', value: 15 },
        { name: 'Entrées', value: 10 }
      ],
      stockStatus,
      paymentMethods,
      totalProducts,
      monthlyGrowth
    });

  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
  } finally {
    setLoading(false);
  }
};

  const normalizeCategory = (category: string): string => {
    if (!category) return 'Non catégorisé';
    
    const lowerCategory = category.toLowerCase().trim();
    
    const categoryMap: { [key: string]: string } = {
      'plat': 'Plats',
      'plats': 'Plats',
      'main': 'Plats',
      'principal': 'Plats',
      'entrée': 'Entrées',
      'entrées': 'Entrées',
      'starter': 'Entrées',
      'appetizer': 'Entrées',
      'dessert': 'Desserts',
      'desserts': 'Desserts',
      'sweet': 'Desserts',
      'boisson': 'Boissons',
      'boissons': 'Boissons',
      'drink': 'Boissons',
      'beverage': 'Boissons',
      'vin': 'Boissons',
      'wine': 'Boissons',
      'bière': 'Boissons',
      'beer': 'Boissons',
    };
    
    return categoryMap[lowerCategory] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatDateRange = () => {
    const today = new Date();
    
    if (timeRange === 'today') {
      return `Aujourd'hui (${today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })})`;
    } else if (timeRange === 'week') {
      const weekRange = getWeekRange();
      const startStr = weekRange.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const endStr = weekRange.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `Semaine en cours (${startStr} - ${endStr})`;
    } else if (timeRange === 'month') {
      const monthRange = getMonthRange();
      const monthName = monthRange.start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return `Mois en cours (${monthName})`;
    } else {
      return `Année ${today.getFullYear()}`;
    }
  };

  // Les composants graphiques restent inchangés...
  const SimpleBarChart = ({ data, title }: { data: any[], title: string }) => {
    const maxValue = Math.max(...data.map(item => item.count || item.value || 0));
    
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-slate-900 text-sm mb-3">{title}</h4>
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-24 text-sm text-slate-600 truncate">{item.name}</div>
            <div className="flex-1">
              <div 
                className="h-6 rounded transition-all duration-500"
                style={{ 
                  width: `${((item.count || item.value || 0) / maxValue) * 100}%`,
                  backgroundColor: COLORS[index % COLORS.length]
                }}
              ></div>
            </div>
            <div className="w-12 text-sm font-semibold text-right text-slate-700">
              {item.count || item.value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const SimplePieChart = ({ data, title }: { data: any[], title: string }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const formattedData = total > 0 
      ? data.map(item => ({
          ...item,
          percentage: ((item.value / total) * 100).toFixed(1)
        }))
      : [];
    
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-900 text-sm mb-3">{title}</h4>
        {formattedData.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              ></div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-600 truncate block">{item.name}</span>
                {total > 0 && (
                  <span className="text-xs text-slate-400">
                    {item.value.toLocaleString()} {settings.currency}
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {item.percentage}%
            </div>
          </div>
        ))}
        {formattedData.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            Aucune donnée de catégorie disponible
          </div>
        )}
      </div>
    );
  };

  const PieChartVisual = ({ data, title }: { data: any[], title: string }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const size = 160;
    const radius = size / 2;
    const strokeWidth = 20;
    const innerRadius = radius - strokeWidth;
    
    if (total === 0 || data.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-40 h-40 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <PieChart className="w-12 h-12 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">Aucune donnée disponible</p>
        </div>
      );
    }
    
    let cumulativeAngle = 0;
    
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-900 text-sm mb-3">{title}</h4>
        <div className="relative mx-auto" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {data.map((item, index) => {
              const percentage = item.value / total;
              const angle = percentage * 360;
              const largeArcFlag = angle > 180 ? 1 : 0;
              
              const startX = radius + innerRadius * Math.cos(cumulativeAngle * Math.PI / 180);
              const startY = radius + innerRadius * Math.sin(cumulativeAngle * Math.PI / 180);
              
              cumulativeAngle += angle;
              
              const endX = radius + innerRadius * Math.cos(cumulativeAngle * Math.PI / 180);
              const endY = radius + innerRadius * Math.sin(cumulativeAngle * Math.PI / 180);
              
              const pathData = [
                `M ${startX} ${startY}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L ${radius} ${radius}`,
                'Z'
              ].join(' ');
              
              return (
                <path
                  key={index}
                  d={pathData}
                  fill={COLORS[index % COLORS.length]}
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-lg font-bold text-slate-900">
              {total.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600">{settings.currency}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <span className="text-slate-600">{item.name}</span>
              </div>
              <div className="text-slate-900 font-medium">
                {((item.value / total) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SimpleAreaChart = ({ data, title }: { data: any[], title: string }) => {
    if (!data || data.length === 0) {
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 text-sm mb-3">{title}</h4>
          <div className="h-32 flex items-center justify-center border border-slate-200 rounded">
            <p className="text-slate-500 text-sm">Aucune donnée disponible</p>
          </div>
        </div>
      );
    }

    const amounts = data.map(item => item.amount || 0);
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const range = maxAmount - minAmount;
    
    const hasVariation = range > 0;
    const pointHeight = data.length === 1 ? 50 : undefined;
    
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-slate-900 text-sm mb-3">{title}</h4>
        <div className="h-32 relative border-l border-b border-slate-200">
          {data.map((item, index) => {
            const x = data.length === 1 
              ? 50 
              : (index / Math.max(1, data.length - 1)) * 100;
            
            const y = pointHeight !== undefined 
              ? pointHeight 
              : hasVariation 
                ? 100 - (((item.amount || 0) - minAmount) / range) * 100
                : 50;
            
            return (
              <div
                key={index}
                className="absolute w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1"
                style={{ 
                  left: `${Math.max(0, Math.min(100, x))}%`, 
                  top: `${Math.max(0, Math.min(100, y))}%` 
                }}
              ></div>
            );
          })}
          
          {data.length > 1 && (
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={data.map((item, index) => {
                  const x = (index / Math.max(1, data.length - 1)) * 100;
                  const y = hasVariation 
                    ? 100 - (((item.amount || 0) - minAmount) / range) * 100
                    : 50;
                  
                  const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(100, x));
                  const safeY = isNaN(y) ? 100 : Math.max(0, Math.min(100, y));
                  
                  return `${safeX},${safeY}`;
                }).join(' ')}
              />
            </svg>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          {data.map((item, index) => (
            <div key={index} className="text-center truncate" style={{ width: `${100/data.length}%` }}>
              {item.date}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-lg text-slate-600">Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* En-tête avec logo et sélecteur de période */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          {settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt={`Logo ${settings.name}`} 
              className="w-12 h-12 rounded-lg object-cover border border-slate-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{settings.name}</h2>
            <p className="text-slate-600 mt-1">{formatDateRange()}</p>
          </div>
        </div>
        <div className="flex space-x-2 bg-white rounded-lg border border-slate-200 p-1">
          {(['today', 'week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {range === 'today' ? 'Aujourd\'hui' : 
               range === 'week' ? 'Semaine' : 
               range === 'month' ? 'Mois' : 
               'Année'}
            </button>
          ))}
        </div>
      </div>

      {/* Première ligne de cartes : Totaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total des ventes */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">Total des ventes</p>
              <p className="text-2xl font-bold">
                {stats.totalSales.toLocaleString()} {settings.currency}
              </p>
              <p className="text-blue-100 text-xs mt-1">
                {stats.salesCount} transaction{stats.salesCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-blue-400 p-3 rounded-lg">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Total des dépenses */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm mb-1">Total des dépenses</p>
              <p className="text-2xl font-bold">
                {stats.totalExpenses.toLocaleString()} {settings.currency}
              </p>
              <div className="text-red-100 text-xs mt-1 space-y-1">
                <div className="flex justify-between">
                  <span>Fixes:</span>
                  <span>{stats.totalFixedExpenses.toLocaleString()} {settings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paiements fourn.:</span>
                  <span>{stats.totalSupplierPayments.toLocaleString()} {settings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Courantes:</span>
                  <span>{stats.totalCurrentExpenses.toLocaleString()} {settings.currency}</span>
                </div>
              </div>
            </div>
            <div className="bg-red-400 p-3 rounded-lg">
              <TrendingDown className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Chiffre d'affaires */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">Chiffre d'affaires</p>
              <p className="text-2xl font-bold">
                {stats.revenue.toLocaleString()} {settings.currency}
              </p>
              <p className="text-green-100 text-xs mt-1">
                {timeRange === 'month' && stats.monthlyGrowth !== 0 && (
                  <>Croissance: {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth.toFixed(1)}% (vs. mois dernier)</>
                )}
                {timeRange !== 'month' && 'Ventes totales'}
              </p>
            </div>
            <div className="bg-green-400 p-3 rounded-lg">
              <BarChart className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Bénéfice net */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm mb-1">Bénéfice net</p>
              <p className="text-2xl font-bold">
                {stats.netProfit.toLocaleString()} {settings.currency}
              </p>
              <p className="text-emerald-100 text-xs mt-1">
                Marge: {stats.revenue > 0 ? `${((stats.netProfit / stats.revenue) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="bg-emerald-400 p-3 rounded-lg">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Deuxième ligne de cartes : Métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Nombre de commandes actives */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Commandes actives</h3>
            <ShoppingBag className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.activeOrders}</p>
          <p className="text-sm text-slate-600 mt-1">En cours de préparation</p>
        </div>

        {/* Stock faible */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Stock faible</h3>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.lowStockItems}</p>
          <p className="text-sm text-slate-600 mt-1">Articles à réapprovisionner</p>
        </div>

        {/* Nombre de ventes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Nombre de ventes</h3>
            <Receipt className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats.salesCount}</p>
          <p className="text-sm text-slate-600 mt-1">Transactions effectuées</p>
        </div>

        {/* Panier moyen */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Panier moyen</h3>
            <Tag className="w-5 h-5 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold text-cyan-600">
            {stats.averageTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })} {settings.currency}
          </p>
          <p className="text-sm text-slate-600 mt-1">Par transaction</p>
        </div>
      </div>

      {/* Le reste du code reste inchangé... */}
      {/* Graphiques et visualisations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Évolution du chiffre d'affaires */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Évolution du chiffre d'affaires
            </h3>
          </div>
          
          <div className="relative">
            <div className="flex items-end justify-between h-48">
              {stats.salesTrend.length > 0 ? (
                stats.salesTrend.map((item, index) => {
                  const maxAmount = Math.max(...stats.salesTrend.map(i => i.amount || 0));
                  const currentHeight = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                  
                  return (
                    <div key={index} className="flex items-end flex-1 mx-1">
                      <div 
                        className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80"
                        style={{ 
                          height: `${currentHeight}%`,
                          backgroundColor: '#3b82f6',
                          backgroundImage: 'linear-gradient(to bottom, #3b82f6, #2563eb)'
                        }}
                        title={`${item.date}: ${item.amount.toLocaleString()} ${settings.currency}`}
                      ></div>
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-48 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Aucune donnée disponible</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-6">
              {stats.salesTrend.map((item, index) => (
                <div key={index} className="text-center flex-1">
                  <div className="text-xs text-slate-600 font-medium truncate w-full">
                    {item.date}
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Répartition des ventes par catégorie */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-emerald-600" />
            Répartition des ventes
          </h3>
          <div className="h-80 flex items-center justify-center">
            <PieChartVisual data={stats.categoryDistribution} title="Répartition par catégorie" />
          </div>
        </div>
      </div>

      {/* Deuxième ligne de graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Articles les plus vendus */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <Utensils className="w-5 h-5 mr-2 text-orange-600" />
            Articles les plus vendus
          </h3>
          <div className="h-80">
            <SimpleBarChart data={stats.popularItems} title="Top des ventes" />
          </div>
        </div>

        {/* Méthodes de paiement */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
            Méthodes de paiement
          </h3>
          <div className="h-80 flex items-center justify-center">
            <SimplePieChart 
              data={[
                { name: 'Espèces', value: stats.paymentMethods.cash },
                { name: 'Mobile Money', value: stats.paymentMethods.mobile_money },
                { name: 'Carte', value: stats.paymentMethods.card }
              ]} 
              title="Répartition des paiements" 
            />
          </div>
        </div>
      </div>

      {/* Alertes et actions rapides */}
      {stats.lowStockItems > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-2">
                Alertes de stock
              </h3>
              <p className="text-amber-800 text-sm">
                {stats.lowStockItems} article(s) sont en stock faible et nécessitent un réapprovisionnement.
                Vérifiez l'inventaire pour maintenir votre niveau de service.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Indicateurs de performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">Performance quotidienne</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Ventes moyennes/jour:</span>
              <span className="font-semibold">
                {timeRange === 'today' ? stats.totalSales : 
                 timeRange === 'week' ? (stats.totalSales / 7).toLocaleString(undefined, { maximumFractionDigits: 0 }) :
                 timeRange === 'month' ? (stats.totalSales / 30).toLocaleString(undefined, { maximumFractionDigits: 0 }) :
                 (stats.totalSales / 365).toLocaleString(undefined, { maximumFractionDigits: 0 })} {settings.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Commandes/jour:</span>
              <span className="font-semibold">
                {timeRange === 'today' ? stats.salesCount :
                 timeRange === 'week' ? Math.round(stats.salesCount / 7) :
                 timeRange === 'month' ? Math.round(stats.salesCount / 30) :
                 Math.round(stats.salesCount / 365)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Panier moyen:</span>
              <span className="font-semibold">
                {stats.averageTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })} {settings.currency}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">Efficacité des coûts</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Ratio dépenses/ventes:</span>
              <span className="font-semibold">
                {stats.revenue > 0 ? `${((stats.totalExpenses / stats.revenue) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Marge nette:</span>
              <span className={`font-semibold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.netProfit.toLocaleString()} {settings.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Retour sur investissement:</span>
              <span className="font-semibold">
                {stats.totalExpenses > 0 ? `${((stats.netProfit / stats.totalExpenses) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">État du stock</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Articles en stock faible:</span>
              <span className="font-semibold text-amber-600">{stats.stockStatus.low}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Articles en stock moyen:</span>
              <span className="font-semibold text-blue-600">{stats.stockStatus.medium}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Articles en bon stock:</span>
              <span className="font-semibold text-emerald-600">{stats.stockStatus.good}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section d'actions rapides */}
      <div className="mt-8 bg-slate-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-500 transition text-left">
            <ShoppingCart className="w-6 h-6 text-blue-600 mb-2" />
            <div className="font-medium text-slate-900">Nouvelle commande</div>
            <div className="text-sm text-slate-600">Créer une commande table</div>
          </button>
          
          <button className="bg-white p-4 rounded-lg border border-slate-200 hover:border-green-500 transition text-left">
            <Package className="w-6 h-6 text-green-600 mb-2" />
            <div className="font-medium text-slate-900">Gérer le stock</div>
            <div className="text-sm text-slate-600">Vérifier l'inventaire</div>
          </button>
          
          <button className="bg-white p-4 rounded-lg border border-slate-200 hover:border-purple-500 transition text-left">
            <DollarSign className="w-6 h-6 text-purple-600 mb-2" />
            <div className="font-medium text-slate-900">Rapports</div>
            <div className="text-sm text-slate-600">Voir les analyses</div>
          </button>
          
          <button className="bg-white p-4 rounded-lg border border-slate-200 hover:border-orange-500 transition text-left">
            <Users className="w-6 h-6 text-orange-600 mb-2" />
            <div className="font-medium text-slate-900">Clients</div>
            <div className="text-sm text-slate-600">Gérer les tables</div>
          </button>
        </div>
      </div>
    </div>
  );
}
