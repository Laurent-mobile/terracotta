// src/components/reports/DetailedReportsView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp, Download, Filter, Calendar, DollarSign,
  ShoppingCart, Package, Users, BarChart3, Eye,
  ChevronDown, ChevronUp, Search, Utensils, FileText, Unlock, Lock, Repeat,
  Wallet, Smartphone, Printer, X, CreditCard, Clock,
  Info, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import KitchenBarReportsView from './KitchenBarReportsView';
import { PDFGenerator } from '../../utils/pdfGenerator';
import {
  fetchAllOrders,
  fetchAllOrderItems,
  fetchAllExpenses,
  fetchAllPayments,
  fetchAllSupplierPayments
} from '../../utils/pagination';

interface ReportData {
  period: string;
  totalSales: number;
  totalExpenses: number;
  totalCurrentExpenses: number;
  totalFixedExpenses: number;
  totalSupplierPayments: number;
  totalSupplierOrders: number;
  totalPaidSupplierOrders: number;
  totalUnpaidSupplierOrders: number;
  totalPartiallyPaidSupplierOrders: number;
  netProfit: number;
  profitMargin: number;
  salesCount: number;
  currentExpensesCount: number;
  fixedExpensesCount: number;
  supplierOrdersCount: number;
  paidSupplierOrdersCount: number;
  unpaidSupplierOrdersCount: number;
  partiallyPaidSupplierOrdersCount: number;
}

interface DetailedData {
  sales: any[];
  expenses: any[];
  supplierOrders: any[];
  supplierPayments: any[];
  inventoryTransactions: any[];
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
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
}

type PaymentMethodFilter = 'all' | 'cash' | 'mobile_money' | 'card';
type SortOrder = 'asc' | 'desc';

interface TimeRange {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
}

type PDFExportType = 'summary' | 'sales' | 'expenses' | 'fixed-expenses' | 'supplier-orders' | 'supplier-payments' | 'kitchen-bar' | 'sales-by-payment' | 'all-data';

export default function DetailedReportsView() {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedData>({
    sales: [],
    expenses: [],
    supplierOrders: [],
    supplierPayments: [],
    inventoryTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [timeRange, setTimeRange] = useState<TimeRange>({
    startHour: '00',
    startMinute: '00',
    endHour: '23',
    endMinute: '59'
  });

  const [activeTab, setActiveTab] = useState<'summary' | 'sales' | 'expenses' | 'fixed-expenses' | 'supplier-orders' | 'supplier-payments' | 'kitchen-bar'>('summary');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({
    sales: '',
    expenses: '',
    supplierOrders: '',
    supplierPayments: ''
  });

  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showTimeFilters, setShowTimeFilters] = useState(false);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, '0')
  );

  const minuteOptions = ['00', '15', '30', '45'];

        const loadReportData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Chargement des données pour la période:', dateRange);
      const startDateTime = `${dateRange.startDate}T${timeRange.startHour}:${timeRange.startMinute}:00`;
      const endDateTime = `${dateRange.endDate}T${timeRange.endHour}:${timeRange.endMinute}:59`;

      // 🔥 FONCTION DE PAGINATION POUR CONTOURNER LA LIMITE DE 1000 ENREGISTREMENTS
      const fetchAllData = async (table: string, queryFn: (q: any) => any) => {
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          
          // On ajoute .range() et count: 'exact' pour gérer la pagination
          const query = queryFn(supabase.from(table).select('*', { count: 'exact' }).range(from, to));
          const { data, error, count } = await query;

          if (error) {
            console.error(`❌ Erreur chargement ${table}:`, error);
            throw error;
          }

          if (data) {
            allData = allData.concat(data);
          }

          // Continuer si on a reçu une page complète ET qu'on n'a pas encore atteint le total
          hasMore = data && data.length === pageSize && allData.length < (count || 0);
          page++;
          
          if (page > 50) { // Limite de sécurité pour éviter les boucles infinies en cas de bug
            console.warn('⚠️ Atteinte de la limite de sécurité de pagination (50 pages)');
            break;
          }
        }
        return allData;
      };

      const [
        salesRaw,
        allExpenses,
        supplierOrders,
        supplierPayments,
        inventoryTransactions
      ] = await Promise.all([
        fetchAllData('pos_orders', (q) => 
          q.select(`
            *,
            pos_order_items(*)
          `)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime)
          .eq('status', 'paid')
        ),
        fetchAllData('expenses', (q) => 
          q.select(`
            *,
            expense_categories(name, category_type)
          `)
          .gte('expense_date', dateRange.startDate)
          .lte('expense_date', dateRange.endDate)
        ),
        fetchAllData('supplier_orders', (q) => 
          q.select(`
            *,
            suppliers(name),
            supplier_order_payments(amount, payment_method, payment_date, reference_number),
            supplier_order_items(
              name,
              description,
              quantity_ordered,
              quantity_received,
              unit_cost,
              total_cost,
              purchase_unit
            )
          `)
          .gte('order_date', dateRange.startDate)
          .lte('order_date', dateRange.endDate)
        ),
        fetchAllData('supplier_order_payments', (q) => 
          q.select(`
            *,
            supplier_orders(
              order_number,
              total_amount,
              suppliers(name)
            )
          `)
          .gte('payment_date', dateRange.startDate)
          .lte('payment_date', dateRange.endDate)
        ),
        fetchAllData('inventory_transactions', (q) => 
          q.select('*')
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime)
        )
      ]);

      // Formatage des ventes pour s'assurer que les articles sont bien un tableau
      const sales = salesRaw.map((order: any) => ({
        ...order,
        items: order.pos_order_items || []
      }));

      console.log('📊 Données récupérées (après pagination):', {
        ventes: sales.length,
        dépenses: allExpenses.length,
        commandesFournisseurs: supplierOrders.length,
        paiementsFournisseurs: supplierPayments.length,
        transactionsInventaire: inventoryTransactions.length
      });

      const currentExpenses = allExpenses.filter((expense: any) =>
        (expense.expense_category_type === 'current' || !expense.expense_category_type) &&
        expense.expense_type !== 'supplier_order' &&
        !expense.reference_type?.includes('supplier')
      );
      
      const fixedExpenses = allExpenses.filter((expense: any) =>
        expense.expense_category_type === 'fixed' &&
        expense.expense_type !== 'supplier_order' &&
        !expense.reference_type?.includes('supplier')
      );

      const totalSales = sales.reduce((sum: any, sale: any) => sum + (sale.total_amount || 0), 0);
      const totalCurrentExpenses = currentExpenses.reduce((sum: any, expense: any) => sum + (expense.amount || 0), 0);
      const totalFixedExpenses = fixedExpenses.reduce((sum: any, expense: any) => sum + (expense.amount || 0), 0);
      const totalSupplierPayments = supplierPayments.reduce((sum: any, payment: any) => sum + (payment.amount || 0), 0);
      
      const totalExpenses = totalFixedExpenses + totalSupplierPayments + totalCurrentExpenses;
      
      const totalSupplierOrders = supplierOrders.reduce((sum: any, order: any) => sum + (order.total_amount || 0), 0);
      
      const paidSupplierOrders = supplierOrders.filter((order: any) => order.payment_status === 'paid');
      const partiallyPaidSupplierOrders = supplierOrders.filter((order: any) => order.payment_status === 'partial');
      const unpaidSupplierOrders = supplierOrders.filter((order: any) => order.payment_status === 'pending' || !order.payment_status);

      const totalPaidSupplierOrders = paidSupplierOrders.reduce((sum: any, order: any) => sum + (order.total_amount || 0), 0);
      const totalPartiallyPaidSupplierOrders = partiallyPaidSupplierOrders.reduce((sum: any, order: any) => sum + (order.total_amount || 0), 0);
      const totalUnpaidSupplierOrders = unpaidSupplierOrders.reduce((sum: any, order: any) => sum + (order.total_amount || 0), 0);

      const netProfit = totalSales - totalExpenses;
      const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

      const reportDataObj = {
        period: `${new Date(dateRange.startDate).toLocaleDateString('fr-FR')} ${timeRange.startHour}:${timeRange.startMinute} - ${new Date(dateRange.endDate).toLocaleDateString('fr-FR')} ${timeRange.endHour}:${timeRange.endMinute}`,
        totalSales,
        totalExpenses,
        totalCurrentExpenses,
        totalFixedExpenses,
        totalSupplierPayments,
        totalSupplierOrders,
        totalPaidSupplierOrders,
        totalPartiallyPaidSupplierOrders,
        totalUnpaidSupplierOrders,
        netProfit,
        profitMargin,
        salesCount: sales.length,
        currentExpensesCount: currentExpenses.length,
        fixedExpensesCount: fixedExpenses.length,
        supplierOrdersCount: supplierOrders.length,
        paidSupplierOrdersCount: paidSupplierOrders.length,
        partiallyPaidSupplierOrdersCount: partiallyPaidSupplierOrders.length,
        unpaidSupplierOrdersCount: unpaidSupplierOrders.length
      };

      console.log('📈 Statistiques calculées:', {
        totalSales: `${reportDataObj.totalSales.toLocaleString()} f CFA`,
        totalCurrentExpenses: `${reportDataObj.totalCurrentExpenses.toLocaleString()} f CFA`,
        totalFixedExpenses: `${reportDataObj.totalFixedExpenses.toLocaleString()} f CFA`,
        totalSupplierPayments: `${reportDataObj.totalSupplierPayments.toLocaleString()} f CFA`,
        totalExpenses: `${reportDataObj.totalExpenses.toLocaleString()} f CFA`,
        netProfit: `${reportDataObj.netProfit.toLocaleString()} f CFA`,
        profitMargin: `${reportDataObj.profitMargin.toFixed(2)}%`
      });

      setReportData(reportDataObj);
      setDetailedData({
        sales,
        expenses: allExpenses,
        supplierOrders,
        supplierPayments,
        inventoryTransactions
      });

    } catch (error) {
      console.error('💥 Erreur générale chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const separateExpensesByType = () => {
    const currentExpenses = detailedData.expenses.filter((expense: any) =>
      (expense.expense_category_type === 'current' || !expense.expense_category_type) &&
      expense.expense_type !== 'supplier_order' &&
      !expense.reference_type?.includes('supplier')
    );

    const fixedExpenses = detailedData.expenses.filter((expense: any) =>
      expense.expense_category_type === 'fixed' &&
      expense.expense_type !== 'supplier_order' &&
      !expense.reference_type?.includes('supplier')
    );

    const supplierExpenses = detailedData.expenses.filter((expense: any) =>
      expense.expense_type === 'supplier_order' ||
      expense.reference_type?.includes('supplier')
    );

    return { currentExpenses, fixedExpenses, supplierExpenses };
  };

  const groupPaymentsByMonth = (paymentsList: any[]) => {
    const grouped: { [key: string]: any[] } = {};

    paymentsList.forEach(payment => {
      const date = new Date(payment.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(payment);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .reduce((acc, [month, payments]) => {
        acc[month] = payments.sort((a, b) =>
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );
        return acc;
      }, {} as { [key: string]: any[] });
  };

  const getFilteredAndSortedSales = () => {
    let filtered = detailedData.sales;

    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(sale =>
        sale.payment_method === paymentMethodFilter
      );
    }

    if (searchTerms.sales) {
      const searchTerm = searchTerms.sales.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.order_number?.toLowerCase().includes(searchTerm) ||
        sale.table_number?.toString().includes(searchTerm) ||
        sale.server_name?.toLowerCase().includes(searchTerm) ||
        sale.notes?.toLowerCase().includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const generatePDF = async (type: PDFExportType) => {
    try {
      if (!reportData) return;

      switch (type) {
        case 'summary':
          await PDFGenerator.generateDetailedReportPDF(
            reportData,
            detailedData,
            dateRange,
            'summary'
          );
          break;

        case 'sales':
          await PDFGenerator.generateSalesReportPDF(
            getFilteredAndSortedSales(),
            reportData.totalSales,
            reportData.salesCount,
            dateRange,
            timeRange,
            paymentMethodFilter,
            sortOrder
          );
          break;

        case 'expenses':
          const { currentExpenses } = separateExpensesByType();
          const totalCurrent = currentExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
          await PDFGenerator.generateExpensesReportPDF(
            currentExpenses,
            totalCurrent,
            'Courantes',
            dateRange,
            reportData
          );
          break;

        case 'fixed-expenses':
          const { fixedExpenses } = separateExpensesByType();
          const totalFixed = fixedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
          await PDFGenerator.generateExpensesReportPDF(
            fixedExpenses,
            totalFixed,
            'Fixes',
            dateRange,
            reportData
          );
          break;

        case 'supplier-orders':
          await PDFGenerator.generateSupplierOrdersReportPDF(
            detailedData.supplierOrders,
            reportData,
            dateRange
          );
          break;

        case 'supplier-payments':
          await PDFGenerator.generateSupplierPaymentsReportPDF(
            detailedData.supplierPayments,
            reportData,
            dateRange
          );
          break;

        case 'sales-by-payment':
          await PDFGenerator.generateSalesByPaymentMethodPDF(
            getFilteredAndSortedSales(),
            dateRange,
            timeRange,
            paymentMethodFilter,
            sortOrder
          );
          break;

        case 'all-data':
          const { currentExpenses: current, fixedExpenses: fixed } = separateExpensesByType();
          await PDFGenerator.generateCompleteReportPDF(
            reportData,
            detailedData,
            dateRange,
            timeRange,
            current,
            fixed,
            separateExpensesByType()
          );
          break;

        default:
          console.warn('Type d\'export PDF non pris en charge:', type);
          alert('Type d\'export PDF non pris en charge');
          break;
      }
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF');
    }
  };

  const exportCompleteReport = () => {
    generatePDF('all-data');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSearchChange = (type: string, value: string) => {
    setSearchTerms(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const filterData = (data: any[], type: string) => {
    const searchTerm = searchTerms[type]?.toLowerCase() || '';
    if (!searchTerm) return data;

    return data.filter(item => {
      switch (type) {
        case 'sales':
          return (
            item.id?.toLowerCase().includes(searchTerm) ||
            item.order_number?.toLowerCase().includes(searchTerm) ||
            item.table_number?.toString().includes(searchTerm) ||
            item.payment_method?.toLowerCase().includes(searchTerm) ||
            item.notes?.toLowerCase().includes(searchTerm)
          );
        case 'expenses':
          return (
            item.description?.toLowerCase().includes(searchTerm) ||
            item.payment_method?.toLowerCase().includes(searchTerm) ||
            item.notes?.toLowerCase().includes(searchTerm)
          );
        case 'supplierOrders':
          return (
            item.order_number?.toLowerCase().includes(searchTerm) ||
            item.status?.toLowerCase().includes(searchTerm) ||
            item.notes?.toLowerCase().includes(searchTerm)
          );
        case 'supplierPayments':
          return (
            item.supplier_orders?.order_number?.toLowerCase().includes(searchTerm) ||
            item.supplier_orders?.suppliers?.name?.toLowerCase().includes(searchTerm) ||
            item.reference_number?.toLowerCase().includes(searchTerm) ||
            item.notes?.toLowerCase().includes(searchTerm)
          );
        default:
          return true;
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
      case 'brouillon': return 'bg-gray-100 text-gray-800';
      case 'ordered':
      case 'commandée': return 'bg-blue-100 text-blue-800';
      case 'received':
      case 'reçue':
      case 'delivered':
      case 'livrée': return 'bg-green-100 text-green-800';
      case 'partial':
      case 'partielle':
      case 'partiellement reçue': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'annulée': return 'bg-red-100 text-red-800';
      case 'pending':
      case 'en attente': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft': return 'Brouillon';
      case 'ordered': return 'Commandée';
      case 'received':
      case 'delivered': return 'Reçue';
      case 'partial': return 'Partielle';
      case 'cancelled': return 'Annulée';
      case 'pending': return 'En attente';
      default: return status || 'Non défini';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'bank_transfer': return 'Virement bancaire';
      case 'check': return 'Chèque';
      case 'mobile_money': return 'Mobile Money';
      case 'card': return 'Carte';
      default: return method;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return Wallet;
      case 'mobile_money': return Smartphone;
      case 'card': return CreditCard;
      default: return ShoppingCart;
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !reportData) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Détaillé</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .summary-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #333; }
          .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
          .summary-card .amount { font-size: 24px; font-weight: bold; color: #333; }
          .positive { color: #10b981; }
          .negative { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          .note { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport Détaillé du Restaurant</h1>
          <div class="period">Période: ${reportData.period}</div>
          <div class="date">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
        
        <div class="summary">
          <div class="summary-card">
            <h3>Ventes Totales</h3>
            <div class="amount">${reportData.totalSales.toLocaleString()} f CFA</div>
            <div>${reportData.salesCount} vente(s)</div>
          </div>
          
          <div class="summary-card">
            <h3>Dépenses Totales</h3>
            <div class="amount">${reportData.totalExpenses.toLocaleString()} f CFA</div>
            <div>${reportData.currentExpensesCount + reportData.fixedExpensesCount + reportData.supplierOrdersCount} dépense(s)</div>
            <div style="font-size: 11px; color: #666; margin-top: 5px;">
              (fixes + paiements fournisseurs + courantes)
            </div>
          </div>
          
          <div class="summary-card">
            <h3>Profit Net</h3>
            <div class="amount ${reportData.netProfit >= 0 ? 'positive' : 'negative'}">
              ${reportData.netProfit.toLocaleString()} f CFA
            </div>
          </div>
          
          <div class="summary-card">
            <h3>Marge Bénéficiaire</h3>
            <div class="amount ${reportData.profitMargin >= 0 ? 'positive' : 'negative'}">
              ${reportData.profitMargin.toFixed(2)}%
            </div>
          </div>
        </div>

        <h2>Détail des Dépenses</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Montant</th>
              <th>Nombre</th>
              <th>Pourcentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dépenses Courantes</td>
              <td>${reportData.totalCurrentExpenses.toLocaleString()} f CFA</td>
              <td>${reportData.currentExpensesCount}</td>
              <td>${reportData.totalExpenses > 0 ? ((reportData.totalCurrentExpenses / reportData.totalExpenses) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>Dépenses Fixes</td>
              <td>${reportData.totalFixedExpenses.toLocaleString()} f CFA</td>
              <td>${reportData.fixedExpensesCount}</td>
              <td>${reportData.totalExpenses > 0 ? ((reportData.totalFixedExpenses / reportData.totalExpenses) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>Paiements Fournisseurs</td>
              <td>${reportData.totalSupplierPayments.toLocaleString()} f CFA</td>
              <td>${reportData.supplierOrdersCount}</td>
              <td>${reportData.totalExpenses > 0 ? ((reportData.totalSupplierPayments / reportData.totalExpenses) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="font-weight: bold; background-color: #f8f9fa;">
              <td>TOTAL DÉPENSES</td>
              <td>${reportData.totalExpenses.toLocaleString()} f CFA</td>
              <td>${reportData.currentExpensesCount + reportData.fixedExpensesCount + reportData.supplierOrdersCount}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>

        <h2>Informations sur les Commandes Fournisseurs</h2>
        <table>
          <thead>
            <tr>
              <th>Statut</th>
              <th>Nombre</th>
              <th>Montant Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Commandes Payées</td>
              <td>${reportData.paidSupplierOrdersCount}</td>
              <td>${reportData.totalPaidSupplierOrders.toLocaleString()} f CFA</td>
            </tr>
            <tr>
              <td>Commandes Impayées</td>
              <td>${reportData.unpaidSupplierOrdersCount}</td>
              <td>${reportData.totalUnpaidSupplierOrders.toLocaleString()} f CFA</td>
            </tr>
            <tr style="font-weight: bold; background-color: #fff3cd;">
              <td>TOTAL COMMANDES</td>
              <td>${reportData.supplierOrdersCount}</td>
              <td>${reportData.totalSupplierOrders.toLocaleString()} f CFA</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Rapport généré automatiquement par le système de gestion</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const printSalesByPaymentMethod = () => {
    const filteredSales = getFilteredAndSortedSales();
    if (filteredSales.length === 0) {
      alert('Aucune vente à imprimer avec les filtres actuels');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cashSales = filteredSales.filter(s => s.payment_method === 'cash');
    const mobileMoneySales = filteredSales.filter(s => s.payment_method === 'mobile_money');
    const cardSales = filteredSales.filter(s => s.payment_method === 'card');

    const cashTotal = cashSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const mobileMoneyTotal = mobileMoneySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const cardTotal = cardSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const overallTotal = filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Ventes par Méthode de Paiement</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; color: #333; }
          .period { color: #666; margin: 5px 0; }
          .date { color: #999; font-size: 12px; }
          .filters { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
          .summary-card.cash { border-top: 4px solid #10b981; }
          .summary-card.mobile-money { border-top: 4px solid #3b82f6; }
          .summary-card.card { border-top: 4px solid #8b5cf6; }
          .summary-card .count { font-size: 14px; color: #666; margin-top: 5px; }
          .summary-card .amount { font-size: 24px; font-weight: bold; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr.total-row { background-color: #f8f9fa; font-weight: bold; }
          .payment-method-badge { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600;
          }
          .cash-badge { background-color: #10b981; color: white; }
          .mobile-money-badge { background-color: #3b82f6; color: white; }
          .card-badge { background-color: #8b5cf6; color: white; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport Ventes par Méthode de Paiement</h1>
          <div class="period">Période: ${reportData?.period || ''}</div>
          <div class="date">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
        </div>
        
        <div class="filters">
          <h3>Filtres appliqués:</h3>
          <p>
            <strong>Période:</strong> ${dateRange.startDate} ${timeRange.startHour}:${timeRange.startMinute} à ${dateRange.endDate} ${timeRange.endHour}:${timeRange.endMinute}<br>
            <strong>Tri:</strong> ${sortOrder === 'desc' ? 'Plus récent au plus ancien' : 'Plus ancien au plus récent'}<br>
            <strong>Méthode de paiement:</strong> ${paymentMethodFilter === 'all' ? 'Toutes' : getPaymentMethodText(paymentMethodFilter)}
          </p>
        </div>

        <div class="summary-cards">
          <div class="summary-card cash">
            <h3>Espèces</h3>
            <div class="amount">${cashTotal.toLocaleString()} f CFA</div>
            <div class="count">${cashSales.length} vente(s)</div>
          </div>
          
          <div class="summary-card mobile-money">
            <h3>Mobile Money</h3>
            <div class="amount">${mobileMoneyTotal.toLocaleString()} f CFA</div>
            <div class="count">${mobileMoneySales.length} vente(s)</div>
          </div>
          
          <div class="summary-card card">
            <h3>Carte</h3>
            <div class="amount">${cardTotal.toLocaleString()} f CFA</div>
            <div class="count">${cardSales.length} vente(s)</div>
          </div>
        </div>

        <h2>Détail des Ventes</h2>
        <p>Total: ${filteredSales.length} vente(s) - ${overallTotal.toLocaleString()} f CFA</p>
        
        <table>
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Table</th>
              <th>Méthode de Paiement</th>
              <th>Montant</th>
              <th>Serveur</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map(sale => `
              <tr>
                <td>${sale.order_number || `#${sale.id.slice(-8)}`}</td>
                <td>${new Date(sale.created_at).toLocaleDateString('fr-FR')}</td>
                <td>${new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${sale.table_number || '-'}</td>
                <td>
                  <span class="payment-method-badge ${sale.payment_method}-badge">
                    ${getPaymentMethodText(sale.payment_method)}
                  </span>
                </td>
                <td>${sale.total_amount?.toLocaleString()} f CFA</td>
                <td>${sale.server_name || '-'}</td>
              </tr>
            `).join('')}
            
            <tr class="total-row">
              <td colspan="5" style="text-align: right;"><strong>TOTAL:</strong></td>
              <td><strong>${overallTotal.toLocaleString()} f CFA</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>

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

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
        <p className="mt-4 text-slate-600">Chargement du rapport détaillé...</p>
      </div>
    );
  }

  const { currentExpenses, fixedExpenses } = separateExpensesByType();
  const totalCurrentExpenses = currentExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const totalFixedExpenses = fixedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Rapports Détaillés</h2>
          <p className="text-slate-600 mt-1">Analyse complète des performances du restaurant</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={printReport}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <Eye className="w-5 h-5" />
            <span>Imprimer Résumé</span>
          </button>
          <button
            onClick={() => generatePDF('summary')}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center space-x-2"
          >
            <FileText className="w-5 h-5" />
            <span>Résumé PDF</span>
          </button>
          <button
            onClick={exportCompleteReport}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition flex items-center space-x-2"
          >
            <FileText className="w-5 h-5" />
            <span>Rapport Complet PDF</span>
          </button>
        </div>
      </div>

      {/* Filtres de période */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Filtres d'heure
              </label>
              <button
                onClick={() => setShowTimeFilters(!showTimeFilters)}
                className="flex items-center space-x-1 text-sm text-slate-600 hover:text-slate-800"
              >
                <Clock className="w-4 h-4" />
                <span>{showTimeFilters ? 'Masquer' : 'Afficher'} les heures</span>
              </button>
            </div>

            {showTimeFilters && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Heure de début
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={timeRange.startHour}
                      onChange={(e) => setTimeRange({ ...timeRange, startHour: e.target.value })}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      {hourOptions.map(hour => (
                        <option key={hour} value={hour}>{hour}h</option>
                      ))}
                    </select>
                    <select
                      value={timeRange.startMinute}
                      onChange={(e) => setTimeRange({ ...timeRange, startMinute: e.target.value })}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      {minuteOptions.map(minute => (
                        <option key={minute} value={minute}>{minute}m</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Heure de fin
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={timeRange.endHour}
                      onChange={(e) => setTimeRange({ ...timeRange, endHour: e.target.value })}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      {hourOptions.map(hour => (
                        <option key={hour} value={hour}>{hour}h</option>
                      ))}
                    </select>
                    <select
                      value={timeRange.endMinute}
                      onChange={(e) => setTimeRange({ ...timeRange, endMinute: e.target.value })}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      {minuteOptions.map(minute => (
                        <option key={minute} value={minute}>{minute}m</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-slate-500 text-center mt-2">
                    Période: {timeRange.startHour}:{timeRange.startMinute} à {timeRange.endHour}:{timeRange.endMinute}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={loadReportData}
            className="bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center justify-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Actualiser avec les filtres</span>
          </button>
        </div>
      </div>

      {reportData && (
        <>
          {/* Navigation par onglets */}
          <div className="mb-6 border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'summary'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Résumé</span>
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'sales'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Ventes ({detailedData.sales.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('expenses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'expenses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Dépenses Courantes ({currentExpenses.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('fixed-expenses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'fixed-expenses'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <Lock className="w-4 h-4" />
                <span>Dépenses Fixes ({fixedExpenses.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('supplier-orders')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'supplier-orders'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <Package className="w-4 h-4" />
                <span>Commandes Fournisseurs ({detailedData.supplierOrders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('supplier-payments')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'supplier-payments'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Paiements Fournisseurs ({detailedData.supplierPayments.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('kitchen-bar')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'kitchen-bar'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Cuisine & Bar</span>
              </button>
            </nav>
          </div>

          {/* Contenu des onglets */}
          {activeTab === 'summary' && reportData && (
            <div className="space-y-6">
              {/* Cartes de résumé */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Ventes Totales</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {reportData.totalSales.toLocaleString()} f CFA
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {reportData.salesCount} vente(s)
                      </p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-lg">
                      <ShoppingCart className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Dépenses Totales</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {reportData.totalExpenses.toLocaleString()} f CFA
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {reportData.currentExpensesCount + reportData.fixedExpensesCount + reportData.supplierOrdersCount} dépense(s)
                        <span className="block text-xs text-slate-400 mt-1">
                          (fixes + paiements fournisseurs + courantes)
                        </span>
                      </p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-lg">
                      <DollarSign className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Profit Net</p>
                      <p className={`text-2xl font-bold ${reportData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {reportData.netProfit.toLocaleString()} f CFA
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Ventes - Dépenses totales
                      </p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Marge Bénéficiaire</p>
                      <p className={`text-2xl font-bold ${reportData.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {reportData.profitMargin.toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Détail des Dépenses */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Détail des Dépenses</h3>
                  <button
                    onClick={() => generatePDF('summary')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Note sur le calcul des dépenses</p>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>Dépenses totales = Dépenses fixes + Paiements fournisseurs + Dépenses courantes</strong><br />
                        • Les commandes fournisseurs impayées ne sont pas incluses dans les dépenses
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Répartition des Dépenses</h4>
                    <div className="space-y-4">
                      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-700 flex items-center">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Dépenses Courantes
                          </span>
                          <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {reportData.currentExpensesCount}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-blue-800">
                          {reportData.totalCurrentExpenses.toLocaleString()} f CFA
                        </div>
                        <div className="mt-2 text-xs text-blue-600">
                          Dépenses opérationnelles journalières (hors paiements fournisseurs)
                        </div>
                      </div>

                      <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-purple-700 flex items-center">
                            <Lock className="w-4 h-4 mr-2" />
                            Dépenses Fixes
                          </span>
                          <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                            {reportData.fixedExpensesCount}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-purple-800">
                          {reportData.totalFixedExpenses.toLocaleString()} f CFA
                        </div>
                        <div className="mt-2 text-xs text-purple-600">
                          Charges récurrentes (loyer, salaires, etc.)
                        </div>
                      </div>

                      <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-orange-700 flex items-center">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Paiements Fournisseurs
                          </span>
                          <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                            {detailedData.supplierPayments.length}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-orange-800">
                          {reportData.totalSupplierPayments.toLocaleString()} f CFA
                        </div>
                        <div className="mt-2 text-xs text-orange-600">
                          Paiements effectués aux fournisseurs
                        </div>
                      </div>

                      <div className="p-4 border border-slate-300 rounded-lg bg-slate-50">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-slate-900">
                            TOTAL DES DÉPENSES
                          </span>
                          <span className="text-lg font-bold text-slate-900">
                            {reportData.totalExpenses.toLocaleString()} f CFA
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          = Fixes ({reportData.totalFixedExpenses.toLocaleString()} f CFA)
                          + Paiements fournisseurs ({reportData.totalSupplierPayments.toLocaleString()} f CFA)
                          + Courantes ({reportData.totalCurrentExpenses.toLocaleString()} f CFA)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Statut des Commandes Fournisseurs du mois en cours</h4>
                    <div className="space-y-4">
                      <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-green-700 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Commandes Payées
                          </span>
                          <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {reportData.paidSupplierOrdersCount}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-green-800">
                          {reportData.totalPaidSupplierOrders.toLocaleString()} f CFA
                        </div>
                      </div>

                      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-yellow-700 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Commandes Partiellement Payées
                          </span>
                          <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            {reportData.partiallyPaidSupplierOrdersCount}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-800">
                          {reportData.totalPartiallyPaidSupplierOrders.toLocaleString()} f CFA
                        </div>
                      </div>

                      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-red-700 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Commandes Impayées
                          </span>
                          <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded-full">
                            {reportData.unpaidSupplierOrdersCount}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-red-800">
                          {reportData.totalUnpaidSupplierOrders.toLocaleString()} f CFA
                        </div>
                        <div className="mt-2 text-xs text-red-600">
                          Non incluses dans les dépenses totales
                        </div>
                      </div>

                      {/* Actions d'export PDF */}
                      <div className="mt-6">
                        <h5 className="font-medium text-slate-700 mb-3">Actions d'Export PDF</h5>
                        <div className="space-y-2">
                          <button
                            onClick={() => generatePDF('sales')}
                            className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <ShoppingCart className="w-4 h-4 text-slate-400" />
                              <div>
                                <span className="text-sm font-medium text-slate-900">Exporter les ventes en PDF</span>
                                <p className="text-xs text-slate-500">{detailedData.sales.length} commande(s)</p>
                              </div>
                            </div>
                            <FileText className="w-4 h-4 text-slate-400" />
                          </button>

                          <button
                            onClick={() => generatePDF('expenses')}
                            className="w-full text-left p-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <DollarSign className="w-4 h-4 text-blue-500" />
                              <div>
                                <span className="text-sm font-medium text-slate-900">Exporter les dépenses courantes en PDF</span>
                                <p className="text-xs text-slate-500">{currentExpenses.length} dépense(s)</p>
                              </div>
                            </div>
                            <FileText className="w-4 h-4 text-slate-400" />
                          </button>

                          <button
                            onClick={() => generatePDF('supplier-payments')}
                            className="w-full text-left p-3 border border-orange-200 rounded-lg hover:bg-orange-50 transition flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <CreditCard className="w-4 h-4 text-orange-500" />
                              <div>
                                <span className="text-sm font-medium text-slate-900">Exporter les paiements fournisseurs en PDF</span>
                                <p className="text-xs text-slate-500">{detailedData.supplierPayments.length} paiement(s)</p>
                              </div>
                            </div>
                            <FileText className="w-4 h-4 text-slate-400" />
                          </button>

                          <button
                            onClick={() => generatePDF('sales-by-payment')}
                            className="w-full text-left p-3 border border-green-200 rounded-lg hover:bg-green-50 transition flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <CreditCard className="w-4 h-4 text-green-500" />
                              <div>
                                <span className="text-sm font-medium text-slate-900">Exporter ventes par méthode de paiement en PDF</span>
                                <p className="text-xs text-slate-500">Analyse par type de paiement</p>
                              </div>
                            </div>
                            <FileText className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onglet Ventes */}
          {activeTab === 'sales' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Ventes Détaillées</h3>
                    <p className="text-sm text-slate-600">
                      {getFilteredAndSortedSales().length} vente(s) filtrée(s) •
                      Total: {getFilteredAndSortedSales().reduce((sum, sale) => sum + (sale.total_amount || 0), 0).toLocaleString()} f CFA
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Rechercher commande, table, serveur..."
                        value={searchTerms.sales}
                        onChange={(e) => handleSearchChange('sales', e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethodFilter)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="all">Tous paiements</option>
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Carte</option>
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="desc">Plus récent</option>
                      <option value="asc">Plus ancien</option>
                    </select>
                    <button
                      onClick={() => generatePDF('sales')}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Export PDF</span>
                    </button>
                    <button
                      onClick={printSalesByPaymentMethod}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition flex items-center space-x-2"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimer</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenu des ventes */}
              {getFilteredAndSortedSales().length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    {searchTerms.sales ? 'Aucune vente ne correspond à votre recherche' : 'Aucune vente enregistrée'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {getFilteredAndSortedSales().map((sale) => (
                    <div key={sale.id} className="p-6 hover:bg-slate-50 transition">
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleSection(`sale-${sale.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="bg-green-100 p-2 rounded-lg">
                              <ShoppingCart className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                Commande #{sale.order_number || sale.id.slice(-8)}
                              </h4>
                              <p className="text-sm text-slate-600">
                                Table {sale.table_number || '-'} •
                                {new Date(sale.created_at).toLocaleDateString('fr-FR')} à
                                {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} •
                                Serveur: {sale.server_name || '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-bold text-lg text-slate-900">
                              {sale.total_amount?.toLocaleString()} f CFA
                            </div>
                            <div className="text-sm text-slate-500 capitalize">
                              {sale.payment_method === 'cash' ? 'Espèces' :
                                sale.payment_method === 'mobile_money' ? 'Mobile Money' : 'Carte'}
                            </div>
                          </div>
                          {expandedSections[`sale-${sale.id}`] ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedSections[`sale-${sale.id}`] && (
                        <div className="mt-4 pl-12">
                          {sale.notes && (
                            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-sm text-yellow-800">
                                <strong>Notes:</strong> {sale.notes}
                              </p>
                            </div>
                          )}

                          {sale.items && sale.items.length > 0 && (
                            <div className="mb-3 bg-slate-50 rounded-lg p-4">
                              <h5 className="font-medium text-slate-900 mb-2">Articles ({sale.items.length})</h5>
                              <div className="space-y-2">
                                {sale.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 last:border-b-0">
                                    <div>
                                      <div className="font-medium">{item.item_name}</div>
                                      <div className="text-slate-600">
                                        {item.quantity} x {item.unit_price?.toLocaleString()} f CFA
                                        {item.category && ` • ${item.category}`}
                                      </div>
                                    </div>
                                    <div className="font-bold">
                                      {item.total_price?.toLocaleString()} f CFA
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-medium text-slate-900 mb-3">Résumé financier</h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-600">Sous-total:</span>
                                <span className="ml-2 font-bold">{sale.subtotal?.toLocaleString() || sale.total_amount?.toLocaleString()} f CFA</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Taxes:</span>
                                <span className="ml-2 font-bold">{sale.tax_amount?.toLocaleString() || '0'} f CFA</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Frais de livraison:</span>
                                <span className="ml-2 font-bold">{sale.delivery_fee?.toLocaleString() || '0'} f CFA</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Total:</span>
                                <span className="ml-2 font-bold text-lg">{sale.total_amount?.toLocaleString()} f CFA</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Onglet Dépenses Courantes */}
          {activeTab === 'expenses' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Dépenses Courantes</h3>
                    <p className="text-sm text-slate-600">
                      {currentExpenses.length} dépense(s) courante(s) •
                      Total: {totalCurrentExpenses.toLocaleString()} f CFA
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchTerms.expenses}
                      onChange={(e) => handleSearchChange('expenses', e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => generatePDF('expenses')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div className="divide-y">
                {currentExpenses
                  .filter((expense: any) =>
                    !searchTerms.expenses ||
                    expense.description?.toLowerCase().includes(searchTerms.expenses.toLowerCase()) ||
                    expense.notes?.toLowerCase().includes(searchTerms.expenses.toLowerCase())
                  )
                  .map((expense: any) => (
                    <div key={expense.id} className="p-6">
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleSection(`expense-${expense.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <DollarSign className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {expense.description || 'Dépense sans description'}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                                {expense.expense_categories?.name && ` • ${expense.expense_categories.name}`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-bold text-lg text-slate-900">
                              {expense.amount.toLocaleString()} f CFA
                            </div>
                            <div className="text-sm text-slate-500 capitalize">
                              {expense.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}
                            </div>
                          </div>
                          {expandedSections[`expense-${expense.id}`] ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedSections[`expense-${expense.id}`] && expense.notes && (
                        <div className="mt-4 pl-12">
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-medium text-slate-900 mb-2">Notes</h5>
                            <p className="text-sm text-slate-700">{expense.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                {currentExpenses.length === 0 && (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      {searchTerms.expenses ? 'Aucune dépense ne correspond à votre recherche' : 'Aucune dépense courante enregistrée'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onglet Dépenses Fixes */}
          {activeTab === 'fixed-expenses' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Lock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Dépenses Fixes</h3>
                    <p className="text-sm text-slate-600">
                      {fixedExpenses.length} dépense(s) fixe(s) •
                      Total: {totalFixedExpenses.toLocaleString()} f CFA
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchTerms.expenses}
                      onChange={(e) => handleSearchChange('expenses', e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => generatePDF('fixed-expenses')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div className="divide-y">
                {fixedExpenses
                  .filter((expense: any) =>
                    !searchTerms.expenses ||
                    expense.description?.toLowerCase().includes(searchTerms.expenses.toLowerCase()) ||
                    expense.notes?.toLowerCase().includes(searchTerms.expenses.toLowerCase())
                  )
                  .map((expense: any) => (
                    <div key={expense.id} className="p-6">
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleSection(`expense-${expense.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="bg-purple-100 p-2 rounded-lg">
                              <Lock className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {expense.description || 'Dépense sans description'}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                                {expense.expense_categories?.name && ` • ${expense.expense_categories.name}`}
                                {expense.is_recurring && ` • Récurrente (${expense.recurrence_frequency === 'monthly' ? 'Mensuelle' : 'Annuelle'})`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-bold text-lg text-slate-900">
                              {expense.amount.toLocaleString()} f CFA
                            </div>
                            <div className="text-sm text-slate-500 capitalize">
                              {expense.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}
                            </div>
                          </div>
                          {expandedSections[`expense-${expense.id}`] ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedSections[`expense-${expense.id}`] && (
                        <div className="mt-4 pl-12">
                          {expense.notes && (
                            <div className="mb-3 bg-slate-50 rounded-lg p-4">
                              <h5 className="font-medium text-slate-900 mb-2">Notes</h5>
                              <p className="text-sm text-slate-700">{expense.notes}</p>
                            </div>
                          )}
                          {expense.is_recurring && (
                            <div className="bg-green-50 rounded-lg p-4">
                              <h5 className="font-medium text-green-900 mb-2 flex items-center">
                                <Repeat className="w-4 h-4 mr-2" />
                                Dépense Récurrente
                              </h5>
                              <p className="text-sm text-green-700">
                                Fréquence: {expense.recurrence_frequency === 'monthly' ? 'Mensuelle' :
                                  expense.recurrence_frequency === 'weekly' ? 'Hebdomadaire' : 'Annuelle'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                {fixedExpenses.length === 0 && (
                  <div className="text-center py-12">
                    <Lock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      {searchTerms.expenses ? 'Aucune dépense ne correspond à votre recherche' : 'Aucune dépense fixe enregistrée'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onglet Commandes Fournisseurs */}
          {activeTab === 'supplier-orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Détail des Commandes Fournisseurs</h3>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="text-sm text-slate-600">
                      Total: {detailedData.supplierOrders.length} commandes
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                        <span className="text-xs text-slate-500">
                          Payées: {reportData?.paidSupplierOrdersCount || 0}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                        <span className="text-xs text-slate-500">
                          Partielles: {reportData?.partiallyPaidSupplierOrdersCount || 0}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                        <span className="text-xs text-slate-500">
                          Impayées: {reportData?.unpaidSupplierOrdersCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher commande, fournisseur..."
                      value={searchTerms.supplierOrders}
                      onChange={(e) => handleSearchChange('supplierOrders', e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => generatePDF('supplier-orders')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div className="divide-y">
                {filterData(detailedData.supplierOrders, 'supplierOrders').map((order, index) => {
                  const amountPaid = order.supplier_order_payments?.reduce((sum: number, payment: any) =>
                    sum + (payment.amount || 0), 0) || 0;
                  const amountDue = Math.max(0, (order.total_amount || 0) - amountPaid);
                  const paymentPercentage = (order.total_amount || 0) > 0 ?
                    Math.round((amountPaid / (order.total_amount || 1)) * 100) : 0;

                  let paymentStatusColor = '';
                  let paymentStatusText = '';

                  if (paymentPercentage >= 100) {
                    paymentStatusColor = 'bg-green-100 text-green-800';
                    paymentStatusText = 'Payée';
                  } else if (paymentPercentage > 0) {
                    paymentStatusColor = 'bg-yellow-100 text-yellow-800';
                    paymentStatusText = `${paymentPercentage}% payé`;
                  } else {
                    paymentStatusColor = 'bg-red-100 text-red-800';
                    paymentStatusText = 'Impayée';
                  }

                  return (
                    <div key={order.id} className="p-6 hover:bg-slate-50 transition">
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleSection(`order-${order.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${paymentPercentage >= 100 ? 'bg-green-100' :
                              paymentPercentage > 0 ? 'bg-yellow-100' : 'bg-red-100'
                              }`}>
                              <Package className={`w-5 h-5 ${paymentPercentage >= 100 ? 'text-green-600' :
                                paymentPercentage > 0 ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-semibold text-slate-900">
                                  {order.order_number || `Commande #${order.id.slice(-8)}`}
                                </h4>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColor}`}>
                                  {paymentStatusText}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                  {getStatusText(order.status)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600">
                                Fournisseur: {order.suppliers?.name || 'Non spécifié'} •
                                Date: {new Date(order.order_date || order.created_at).toLocaleDateString('fr-FR')} •
                                Montant: {order.total_amount?.toLocaleString()} f CFA
                              </p>
                              {(paymentPercentage < 100) && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Payé: {amountPaid.toLocaleString()} f CFA •
                                  Reste: {amountDue.toLocaleString()} f CFA
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-bold text-lg text-slate-900">
                              {order.total_amount?.toLocaleString()} f CFA
                            </div>
                            {paymentPercentage < 100 && (
                              <div className="text-sm text-red-600 font-medium">
                                {amountDue.toLocaleString()} f CFA dû
                              </div>
                            )}
                          </div>
                          {expandedSections[`order-${order.id}`] ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedSections[`order-${order.id}`] && (
                        <div className="mt-4 pl-12">
                          {order.notes && (
                            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-sm text-yellow-800">
                                <strong>Notes:</strong> {order.notes}
                              </p>
                            </div>
                          )}

                          {order.supplier_order_payments && order.supplier_order_payments.length > 0 && (
                            <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-4">
                              <h5 className="font-medium text-green-900 mb-2 flex items-center">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Paiements effectués ({order.supplier_order_payments.length})
                              </h5>
                              <div className="space-y-2">
                                {order.supplier_order_payments.map((payment: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center text-sm">
                                    <div>
                                      <span className="font-medium">
                                        {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                                      </span>
                                      <span className="ml-2 text-slate-600">
                                        • {getPaymentMethodText(payment.payment_method)}
                                        {payment.reference_number && ` (Réf: ${payment.reference_number})`}
                                      </span>
                                    </div>
                                    <div className="font-bold text-green-700">
                                      {payment.amount.toLocaleString()} f CFA
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-medium text-slate-900 mb-3">Résumé financier</h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-600">Total commande:</span>
                                <span className="ml-2 font-bold">{order.total_amount?.toLocaleString()} f CFA</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Total payé:</span>
                                <span className={`ml-2 font-bold ${amountPaid > 0 ? 'text-green-600' : 'text-slate-700'
                                  }`}>
                                  {amountPaid.toLocaleString()} f CFA
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600">Reste à payer:</span>
                                <span className={`ml-2 font-bold ${amountDue > 0 ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                  {amountDue.toLocaleString()} f CFA
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600">Pourcentage payé:</span>
                                <span className={`ml-2 font-bold ${paymentPercentage >= 100 ? 'text-green-600' :
                                  paymentPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                  {paymentPercentage}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 bg-slate-50 rounded-lg p-4">
                            <h5 className="font-medium text-slate-900 mb-3">Informations de la commande</h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-600">Date prévue de livraison:</span>
                                <span className="ml-2 font-medium">
                                  {order.expected_delivery_date
                                    ? new Date(order.expected_delivery_date).toLocaleDateString('fr-FR')
                                    : 'Non définie'
                                  }
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600">Statut:</span>
                                <span className="ml-2 font-medium capitalize">
                                  {order.status || 'Non défini'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600">Créée le:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600">Dernière modification:</span>
                                <span className="ml-2 font-medium">
                                  {order.updated_at ? new Date(order.updated_at).toLocaleDateString('fr-FR') : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {order.supplier_order_items && order.supplier_order_items.length > 0 && (
                            <div className="mt-3 bg-slate-50 rounded-lg p-4">
                              <h5 className="font-medium text-slate-900 mb-3">Articles commandés ({order.supplier_order_items.length})</h5>
                              <div className="space-y-2">
                                {order.supplier_order_items.map((item: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 last:border-b-0">
                                    <div>
                                      <div className="font-medium">{item.name || item.description || 'Article sans nom'}</div>
                                      <div className="text-slate-600">
                                        {item.quantity_ordered} x {item.unit_cost?.toLocaleString()} f CFA
                                        {item.purchase_unit && ` (${item.purchase_unit})`}
                                      </div>
                                    </div>
                                    <div className="font-bold">
                                      {item.total_cost?.toLocaleString()} f CFA
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filterData(detailedData.supplierOrders, 'supplierOrders').length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      {searchTerms.supplierOrders ? 'Aucune commande ne correspond à votre recherche' : 'Aucune commande fournisseur enregistrée'}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Les commandes fournisseurs sont créées dans le module d'achat
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onglet Paiements Fournisseurs */}
          {activeTab === 'supplier-payments' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Paiements Fournisseurs</h3>
                    <p className="text-sm text-slate-600">
                      {detailedData.supplierPayments.length} paiement(s) •
                      Total: {reportData?.totalSupplierPayments.toLocaleString() || '0'} f CFA
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Rechercher fournisseur, commande ou référence..."
                        value={searchTerms.supplierPayments}
                        onChange={(e) => handleSearchChange('supplierPayments', e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => generatePDF('supplier-payments')}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {detailedData.supplierPayments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">Aucun paiement fournisseur enregistré pour cette période</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Les paiements fournisseurs sont créés lors du règlement des commandes fournisseurs
                  </p>
                </div>
              ) : (
                (() => {
                  const filteredPayments = filterData(detailedData.supplierPayments, 'supplierPayments');
                  const groupedByMonth = groupPaymentsByMonth(filteredPayments);

                  return (
                    <div className="divide-y divide-slate-200">
                      {Object.entries(groupedByMonth).map(([month, monthPayments]) => {
                        const total = monthPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        const monthDate = new Date(month + '-01');
                        const monthName = monthDate.toLocaleDateString('fr-FR', {
                          month: 'long',
                          year: 'numeric'
                        });

                        return (
                          <div key={month} className="p-6">
                            <div className="flex justify-between items-center mb-4">
                              <div>
                                <h4 className="font-semibold text-lg text-slate-900">{monthName}</h4>
                                <p className="text-sm text-slate-600">
                                  {monthPayments.length} paiement(s) • {total.toLocaleString()} f CFA
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {monthPayments.map((payment) => (
                                <div key={payment.id} className="bg-slate-50 rounded-lg p-4">
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="font-medium text-slate-900">
                                            Paiement - {payment.supplier_orders?.order_number || 'N/A'}
                                          </div>
                                          <div className="text-sm text-slate-600 mt-1">
                                            Fournisseur: {payment.supplier_orders?.suppliers?.name || 'Non spécifié'}
                                          </div>
                                          <div className="text-sm text-slate-600">
                                            Date: {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                                            {payment.reference_number && ` • Réf: ${payment.reference_number}`}
                                            {payment.notes && ` • Notes: ${payment.notes}`}
                                          </div>
                                        </div>
                                        <div className="text-right ml-4">
                                          <div className="font-bold text-lg text-slate-900">
                                            {payment.amount.toLocaleString()} f CFA
                                          </div>
                                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${payment.payment_method === 'cash'
                                            ? 'bg-green-100 text-green-800'
                                            : payment.payment_method === 'mobile_money'
                                              ? 'bg-blue-100 text-blue-800'
                                              : payment.payment_method === 'bank_transfer'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {getPaymentMethodText(payment.payment_method)}
                                          </div>
                                        </div>
                                      </div>
                                      {payment.supplier_orders?.total_amount && (
                                        <div className="mt-2 text-xs text-slate-500">
                                          Commande totale: {payment.supplier_orders.total_amount.toLocaleString()} f CFA
                                          {payment.amount < payment.supplier_orders.total_amount && (
                                            <span className="ml-2 text-amber-600">
                                              (Paiement partiel: {Math.round((payment.amount / payment.supplier_orders.total_amount) * 100)}%)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Onglet Cuisine & Bar */}
          {activeTab === 'kitchen-bar' && (
            <KitchenBarReportsView
              dateRange={dateRange}
              timeRange={timeRange}
            />
          )}
        </>
      )}
    </div>
  );
}
