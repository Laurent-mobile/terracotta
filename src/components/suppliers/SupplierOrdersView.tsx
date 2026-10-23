// src/components/suppliers/SupplierOrdersViews.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Supplier, SupplierOrder } from '../../types/database';
import { 
  ShoppingCart, Plus, Edit, Trash2, CheckCircle, Package, 
  Truck, Clock, AlertCircle, Download, Printer, Search,
  Eye, DollarSign, Filter, Save, CreditCard, CheckSquare, Users,
  Calendar, TrendingUp, BarChart, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SupplierOrderPayments from './SupplierOrderPayments';

// Interface pour les items de commande temporaires
interface TempOrderItem {
  name: string;
  quantity_ordered: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes?: string;
}

// Interface pour les résumés mensuels
interface MonthlySummary {
  month: string;
  total_orders: number;
  total_amount: number;
  total_paid: number;
  total_due: number;
  paid_percentage: number;
  unpaid_percentage: number;
}

export default function SupplierOrdersView() {
  const { user } = useAuth();
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<SupplierOrder | null>(null);
  const [orderItems, setOrderItems] = useState<TempOrderItem[]>([]);
  const [receivedQuantities, setReceivedQuantities] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [selectedOrderForPayments, setSelectedOrderForPayments] = useState<SupplierOrder | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // États pour le paiement groupé
  const [bulkPaymentMode, setBulkPaymentMode] = useState(false);
  const [selectedSupplierForBulk, setSelectedSupplierForBulk] = useState<string | null>(null);
  const [supplierOrdersMap, setSupplierOrdersMap] = useState<{[key: string]: SupplierOrder[]}>({});
  const [selectedOrdersForBulk, setSelectedOrdersForBulk] = useState<string[]>([]);
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState('');
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('cash');
  const [bulkPaymentNotes, setBulkPaymentNotes] = useState('');
  const [bulkReferenceNumber, setBulkReferenceNumber] = useState('');
  const [supplierBalances, setSupplierBalances] = useState<{[key: string]: {
    totalDue: number;
    totalPaid: number;
    remainingBalance: number;
    pendingOrders: number;
  }}>({});

  // États pour les résumés mensuels et impressions
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [selectedMonthForPrint, setSelectedMonthForPrint] = useState<string>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [currentItem, setCurrentItem] = useState({
    name: '',
    notes: '',
    quantity_ordered: '',
    unit: '',
    unit_cost: '',
  });

  useEffect(() => {
    loadSupplierOrders();
    loadSuppliers();
    loadSupplierOrdersMap();
    calculateSupplierBalances();
    calculateMonthlySummaries();
  }, []);

  useEffect(() => {
  // Vérifier si un fournisseur a été sélectionné pour paiement
  const storedSupplier = localStorage.getItem('selectedSupplierForPayment');
  if (storedSupplier) {
    try {
      const supplier = JSON.parse(storedSupplier);
      setBulkPaymentMode(true);
      setSelectedSupplierForBulk(supplier.id);
      
      // Calculer le montant dû pour ce fournisseur
      const totalDue = calculateSupplierTotalDue(supplier.id);
      setBulkPaymentAmount(totalDue.toString());
      setBulkReferenceNumber(`BULK-${Date.now()}`);
      
      // Nettoyer le stockage après utilisation
      localStorage.removeItem('selectedSupplierForPayment');
    } catch (error) {
      console.error('Error parsing stored supplier:', error);
    }
  }
  
  loadSupplierOrders();
  loadSuppliers();
  loadSupplierOrdersMap();
  calculateSupplierBalances();
  calculateMonthlySummaries();
}, []);
  // Recalculer les résumés quand les commandes changent
  useEffect(() => {
    if (supplierOrders.length > 0) {
      calculateMonthlySummaries();
    }
  }, [supplierOrders]);

  const loadSupplierOrders = async () => {
  try {
    // 🔴 MODIFICATION: Ajouter le filtre pour exclure les commandes annulées
    const { data, error } = await supabase
      .from('supplier_orders')
      .select(`
        *,
        suppliers(name)
      `)
      .neq('status', 'cancelled') // Exclure les commandes annulées
      .order('created_at', { ascending: false });

    if (error) throw error;
    setSupplierOrders(data || []);
  } catch (error) {
    console.error('Error loading supplier orders:', error);
  } finally {
    setLoading(false);
  }
};

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadSupplierOrdersMap = async () => {
  try {
    const { data, error } = await supabase
      .from('supplier_orders')
      .select(`
        *,
        suppliers(name),
        supplier_order_payments(amount)
      `)
      .neq('status', 'cancelled') // 🔴 Exclure les commandes annulées
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Grouper les commandes par fournisseur
    const groupedOrders: {[key: string]: SupplierOrder[]} = {};
    data?.forEach(order => {
      const supplierId = order.supplier_id;
      if (!groupedOrders[supplierId]) {
        groupedOrders[supplierId] = [];
      }
      groupedOrders[supplierId].push(order);
    });
    
    setSupplierOrdersMap(groupedOrders);
  } catch (error) {
    console.error('Error loading supplier orders map:', error);
  }
};

  const calculateSupplierBalances = async () => {
  try {
    const { data: orders, error } = await supabase
      .from('supplier_orders')
      .select('id, supplier_id, total_amount, amount_paid, payment_status, status')
      .neq('status', 'cancelled'); // 🔴 Exclure les commandes annulées

    if (error) throw error;

    const balances: {[key: string]: {
      totalDue: number;
      totalPaid: number;
      remainingBalance: number;
      pendingOrders: number;
    }} = {};

    orders?.forEach(order => {
      const supplierId = order.supplier_id;
      if (!balances[supplierId]) {
        balances[supplierId] = {
          totalDue: 0,
          totalPaid: 0,
          remainingBalance: 0,
          pendingOrders: 0
        };
      }

      balances[supplierId].totalDue += order.total_amount;
      balances[supplierId].totalPaid += order.amount_paid || 0;
      const remaining = Math.max(0, order.total_amount - (order.amount_paid || 0));
      balances[supplierId].remainingBalance += remaining;
      
      if (remaining > 0 && order.payment_status !== 'paid') {
        balances[supplierId].pendingOrders += 1;
      }
    });

    setSupplierBalances(balances);
  } catch (error) {
    console.error('Error calculating supplier balances:', error);
  }
};

  const calculateMonthlySummaries = async () => {
  try {
    // Charger toutes les commandes avec leurs paiements
    const { data: orders, error } = await supabase
      .from('supplier_orders')
      .select(`
        *,
        suppliers(name),
        supplier_order_payments(amount, payment_date)
      `)
      .neq('status', 'cancelled');

    if (error) throw error;

    // Grouper par mois
    const monthlyData: { [key: string]: {
      month: string;
      total_orders: number;
      total_amount: number;
      total_paid: number;
      orders: SupplierOrder[];
    } } = {};

    orders?.forEach(order => {
      // 🔴 CORRECTION: Ignorer les commandes annulées
      if (order.status === 'cancelled') {
        return; // Ne pas inclure les commandes annulées dans les résumés
      }
      
      const orderDate = new Date(order.order_date);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total_orders: 0,
          total_amount: 0,
          total_paid: 0,
          orders: []
        };
      }

      monthlyData[monthKey].total_orders += 1;
      monthlyData[monthKey].total_amount += order.total_amount;
      monthlyData[monthKey].total_paid += order.amount_paid || 0;
      monthlyData[monthKey].orders.push(order);
    });

    // Convertir en tableau et calculer le pourcentage payé
    const summaries = Object.values(monthlyData).map(data => ({
      ...data,
      total_due: Math.max(0, data.total_amount - data.total_paid),
      paid_percentage: data.total_amount > 0 ? Math.round((data.total_paid / data.total_amount) * 100) : 0,
      unpaid_percentage: data.total_amount > 0 ? Math.round(((data.total_amount - data.total_paid) / data.total_amount) * 100) : 0
    })).sort((a, b) => b.month.localeCompare(a.month)); // Trier par mois décroissant

    setMonthlySummaries(summaries);
  } catch (error) {
    console.error('Error calculating monthly summaries:', error);
  }
};

  const loadOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('supplier_order_items')
        .select('*')
        .eq('supplier_order_id', orderId);

      if (error) throw error;
      setOrderDetails(data || []);
    } catch (error) {
      console.error('Error loading order details:', error);
    }
  };

 const createExpenseFromOrder = async (order: SupplierOrder, totalAmount: number) => {
  if (!user) return;

  try {
    // VÉRIFICATION CRITIQUE : 
    // Ne créer une dépense QUE si un paiement est effectué (au moins partiel)
    const amountPaid = order.amount_paid || 0;
    
    if (amountPaid <= 0) {
      console.log('Commande non payée - Aucune dépense créée');
      return;
    }
    
    let expenseCategory;
    
    const { data: existingCategory } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('name', 'Achats Fournisseurs')
      .single();

    if (existingCategory) {
      expenseCategory = existingCategory;
    } else {
      const { data: newCategory, error: categoryError } = await supabase
        .from('expense_categories')
        .insert([{
          name: 'Achats Fournisseurs',
          description: 'Dépenses pour les commandes aux fournisseurs',
          category_type: 'current',
          is_system_category: true
        }])
        .select()
        .single();

      if (categoryError) throw categoryError;
      expenseCategory = newCategory;
    }

    // Créer la dépense avec SEULEMENT le montant payé
    const { error: expenseError } = await supabase
      .from('expenses')
      .insert([{
        category_id: expenseCategory.id,
        description: `Paiement commande fournisseur ${order.order_number}`,
        amount: amountPaid, // <-- Seulement le montant payé
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        expense_type: 'general',
        expense_category_type: 'current',
        reference_id: order.id,
        reference_type: 'supplier_order_payment', // <-- Nouveau type
        created_by: user.id,
        notes: `PAIEMENT_FOURNISSEUR - ${amountPaid.toLocaleString()} f CFA / ${totalAmount.toLocaleString()} f CFA`
      }]);

    if (expenseError) {
      console.error('Error creating expense:', expenseError);
    } else {
      console.log(`Dépense créée pour paiement fournisseur: ${amountPaid.toLocaleString()} f CFA`);
    }
  } catch (error) {
    console.error('Error in createExpenseFromOrder:', error);
  }
};

  // Fonction d'impression améliorée
  const handlePrint = (type: 'orders' | 'monthly-summary' | 'detailed-report' = 'orders', specificMonth?: string) => {
    setIsPrinting(true);
    
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        let printHtml = '';
        
        if (type === 'monthly-summary') {
          printHtml = generateMonthlySummaryPrint(specificMonth);
        } else if (type === 'detailed-report') {
          printHtml = generateDetailedReportPrint();
        } else {
          printHtml = generateOrdersPrint();
        }
        
        printWindow.document.write(`
          <html>
            <head>
              <title>${getPrintTitle(type, specificMonth)} - ${new Date().toLocaleDateString('fr-FR')}</title>
              <style>
                ${getPrintStyles()}
              </style>
            </head>
            <body>
              ${printHtml}
            </body>
          </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          setIsPrinting(false);
        }, 250);
      }
    }, 100);
  };

  const getPrintTitle = (type: string, specificMonth?: string) => {
    switch(type) {
      case 'monthly-summary':
        return specificMonth && specificMonth !== 'all' 
          ? `Résumé Mensuel ${new Date(specificMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
          : 'Résumé Mensuel';
      case 'detailed-report':
        return 'Rapport Détaillé des Commandes';
      default:
        return 'Commandes Fournisseurs';
    }
  };

  const getPrintStyles = () => `
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      line-height: 1.4;
      margin: 0;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1e293b;
    }
    .header .subtitle {
      color: #64748b;
      margin-top: 5px;
    }
    .print-date {
      text-align: right;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 20px;
    }
    .filters {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 10px;
      font-size: 12px;
      color: #475569;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    th {
      background-color: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 11px;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
    }
    .draft { background-color: #f1f5f9; color: #475569; }
    .ordered { background-color: #dbeafe; color: #1e40af; }
    .received { background-color: #dcfce7; color: #166534; }
    .partial { background-color: #fef3c7; color: #92400e; }
    .cancelled { background-color: #fee2e2; color: #991b1b; }
    .payment-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
    }
    .pending { background-color: #f1f5f9; color: #475569; }
    .partial-paid { background-color: #fef3c7; color: #92400e; }
    .paid { background-color: #dcfce7; color: #166534; }
    .overdue { background-color: #fee2e2; color: #991b1b; }
    .amount {
      font-weight: 600;
      color: #1e293b;
    }
    .summary {
      margin-top: 30px;
      padding: 20px;
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .summary h3 {
      margin-top: 0;
      color: #1e293b;
      font-size: 16px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      background: white;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .summary-item .label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 5px;
    }
    .summary-item .value {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }
    .progress-bar {
      height: 8px;
      background-color: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 5px;
    }
    .progress-fill {
      height: 100%;
      background-color: #10b981;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .monthly-summary {
      margin-bottom: 20px;
    }
    .monthly-summary h2 {
      color: #374151;
      margin-bottom: 20px;
      font-size: 20px;
    }
    .monthly-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    .stat-card .stat-value {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .stat-card.paid .stat-value { color: #10b981; }
    .stat-card.due .stat-value { color: #ef4444; }
    .stat-card.total .stat-value { color: #3b82f6; }
    .stat-card .stat-label {
      font-size: 12px;
      color: #6b7280;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
    }
    .payment-details {
      background: #f8fafc;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
    }
    .payment-detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .payment-detail-row .label {
      color: #64748b;
    }
    .payment-detail-row .value {
      font-weight: 600;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      table { font-size: 10px; }
      .summary { break-inside: avoid; }
    }
  `;

 const generateOrdersPrint = () => {
  const now = new Date();
  // 🔴 Filtrer les commandes - option 1: exclure les annulées par défaut
  const filteredOrdersForPrint = getFilteredOrders().filter(order => 
    order.status !== 'cancelled' // Exclure les commandes annulées de l'impression
  );
  
  // 🔴 Option 2: Inclure les annulées mais les marquer clairement
  // const filteredOrdersForPrint = getFilteredOrders();
  
  // Calculer les totaux en excluant les annulées
  const totalAmount = filteredOrdersForPrint.reduce((sum, order) => sum + order.total_amount, 0);
  const totalPaid = filteredOrdersForPrint.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  const totalDue = filteredOrdersForPrint.reduce((sum, order) => {
    const amountPaid = order.amount_paid || 0;
    return sum + Math.max(0, order.total_amount - amountPaid);
  }, 0);
  
  return `
    <div class="header">
      <h1>Commandes Fournisseurs</h1>
      <div class="subtitle">LA TERRA COTTA OUAGA</div>
      <div class="print-date">
        Imprimé le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div class="filters">
        <div>Recherche: ${searchTerm || 'Aucune'}</div>
        <div>Statut: ${statusFilter === 'all' ? 'Tous' : getStatusText(statusFilter)}</div>
        <div>Commandes affichées: ${filteredOrdersForPrint.length}</div>
        <div class="text-xs text-slate-500 mt-1">
          * Les commandes annulées ne sont pas incluses dans les totaux
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Commande</th>
          <th>Fournisseur</th>
          <th>Date</th>
          <th>Paiement</th>
          <th>Montant</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${filteredOrdersForPrint.map((order) => `
          <tr ${order.status === 'cancelled' ? 'style="opacity: 0.6; background-color: #fee2e2;"' : ''}>
            <td>${order.order_number}</td>
            <td>${(order as any).suppliers?.name || 'N/A'}</td>
            <td>${new Date(order.order_date).toLocaleDateString('fr-FR')}</td>
            <td>
              <span class="payment-badge ${order.payment_status}">
                ${getPaymentStatusText(order.payment_status)}
                ${(order.amount_paid || 0) > 0 && order.payment_status !== 'paid' ? 
                  `<span style="margin-left: 5px; font-size: 10px">
                    (${order.amount_paid?.toLocaleString() || 0} / ${order.total_amount.toLocaleString()} f CFA)
                  </span>` : ''}
              </span>
            </td>
            <td class="amount">${order.total_amount.toLocaleString()} f CFA</td>
            <td>
              <span class="status-badge ${order.status}">
                ${getStatusText(order.status)}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <h3>Résumé des commandes</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="label">Total commandes</div>
          <div class="value">${filteredOrdersForPrint.length}</div>
        </div>
        <div class="summary-item">
          <div class="label">Montant total</div>
          <div class="value">
            ${totalAmount.toLocaleString()} f CFA
          </div>
        </div>
        <div class="summary-item">
          <div class="label">Montant payé</div>
          <div class="value">
            ${totalPaid.toLocaleString()} f CFA
          </div>
        </div>
        <div class="summary-item">
          <div class="label">Reste à payer</div>
          <div class="value">
            ${totalDue.toLocaleString()} f CFA
          </div>
        </div>
      </div>

      <div style="margin-top: 20px">
        <h4 style="margin-bottom: 10px; font-size: 14px">Répartition par statut</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          ${['draft', 'ordered', 'partial', 'received', 'cancelled'].map((status) => {
            const count = filteredOrdersForPrint.filter(order => order.status === status).length;
            const amount = filteredOrdersForPrint
              .filter(order => order.status === status)
              .reduce((sum, order) => sum + order.total_amount, 0);
            
            if (count === 0) return '';
            
            // Style spécial pour les commandes annulées
            const bgColor = status === 'cancelled' ? '#fee2e2' : '#fff';
            const borderColor = status === 'cancelled' ? '#fecaca' : '#e2e8f0';
            
            return `
              <div style="background: ${bgColor}; padding: 10px; border-radius: 6px; border: 1px solid ${borderColor}; min-width: 120px">
                <div style="font-size: 12px; color: ${status === 'cancelled' ? '#991b1b' : '#64748b'}; margin-bottom: 5px">
                  ${getStatusText(status)}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <span style="font-size: 14px; font-weight: 600; color: ${status === 'cancelled' ? '#991b1b' : '#1e293b'}">${count}</span>
                  <span style="font-size: 12px; color: ${status === 'cancelled' ? '#991b1b' : '#475569'}">
                    ${amount.toLocaleString()} f CFA
                  </span>
                </div>
              </div>
            `;
          }).filter(Boolean).join('')}
        </div>
      </div>
      
      ${filteredOrdersForPrint.some(order => order.status === 'cancelled') ? `
        <div style="margin-top: 20px; padding: 10px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; color: #991b1b;">
          <strong>Note :</strong> Les commandes annulées (en rouge dans le tableau) ne sont pas incluses dans les calculs financiers des résumés mensuels et des balances fournisseurs, mais elles apparaissent ici pour référence.
        </div>
      ` : ''}
    </div>

    <div class="footer">
      Document généré automatiquement par le système de gestion LA TERRA COTTA OUAGA
    </div>
  `;
};

  const generateMonthlySummaryPrint = (specificMonth?: string) => {
    const now = new Date();
    const data = specificMonth && specificMonth !== 'all' 
      ? monthlySummaries.filter(s => s.month === specificMonth)
      : monthlySummaries;
    
    const totalSummary = {
      total_orders: data.reduce((sum, s) => sum + s.total_orders, 0),
      total_amount: data.reduce((sum, s) => sum + s.total_amount, 0),
      total_paid: data.reduce((sum, s) => sum + s.total_paid, 0),
      total_due: data.reduce((sum, s) => sum + s.total_due, 0),
      paid_percentage: data.reduce((sum, s) => sum + s.total_amount, 0) > 0 
        ? Math.round((data.reduce((sum, s) => sum + s.total_paid, 0) / data.reduce((sum, s) => sum + s.total_amount, 0)) * 100)
        : 0
    };
    
    return `
      <div class="header">
        <h1>Résumé Mensuel des Commandes Fournisseurs</h1>
        <div class="subtitle">LA TERRA COTTA OUAGA</div>
        <div class="print-date">
          Imprimé le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style="text-align: center; margin-top: 10px; font-weight: 600; color: #4b5563">
          ${specificMonth && specificMonth !== 'all' 
            ? new Date(specificMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            : 'Tous les mois'}
        </div>
      </div>

      <div class="summary">
        <h3>Résumé Global</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Commandes</div>
            <div class="value">${totalSummary.total_orders}</div>
          </div>
          <div class="summary-item">
            <div class="label">Montant Total</div>
            <div class="value">${totalSummary.total_amount.toLocaleString()} f CFA</div>
          </div>
          <div class="summary-item">
            <div class="label">Montant Payé</div>
            <div class="value">${totalSummary.total_paid.toLocaleString()} f CFA</div>
          </div>
          <div class="summary-item">
            <div class="label">Reste à Payer</div>
            <div class="value">${totalSummary.total_due.toLocaleString()} f CFA</div>
          </div>
          <div class="summary-item">
            <div class="label">Taux de Paiement</div>
            <div class="value">${totalSummary.paid_percentage}%</div>
          </div>
        </div>
      </div>

      ${data.map((s, index) => {
        const monthDate = new Date(s.month + '-01');
        const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        
        return `
          <div class="monthly-summary ${index > 0 ? 'page-break' : ''}">
            <h2>${monthName}</h2>
            
            <div class="monthly-stats">
              <div class="stat-card total">
                <div class="stat-value">${s.total_amount.toLocaleString()} f CFA</div>
                <div class="stat-label">Montant Total</div>
              </div>
              <div class="stat-card paid">
                <div class="stat-value">${s.total_paid.toLocaleString()} f CFA</div>
                <div class="stat-label">Payé (${s.paid_percentage}%)</div>
              </div>
              <div class="stat-card due">
                <div class="stat-value">${s.total_due.toLocaleString()} f CFA</div>
                <div class="stat-label">Reste à Payer</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${s.total_orders}</div>
                <div class="stat-label">Commandes</div>
              </div>
            </div>
            
            <div style="margin: 20px 0; background: #f3f4f6; padding: 15px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: 600; color: #374151">Progression du paiement</span>
                <span style="font-weight: 700; color: #059669">${s.paid_percentage}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${s.paid_percentage}%"></div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Détail</th>
                  <th>Commandes</th>
                  <th>Montant</th>
                  <th>Payé</th>
                  <th>Reste</th>
                  <th>Taux Payé</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total ${monthName}</td>
                  <td>${s.total_orders}</td>
                  <td>${s.total_amount.toLocaleString()} f CFA</td>
                  <td>${s.total_paid.toLocaleString()} f CFA</td>
                  <td>${s.total_due.toLocaleString()} f CFA</td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px">
                      <span>${s.paid_percentage}%</span>
                      <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px">
                        <div style="width: ${s.paid_percentage}%; height: 100%; background: #059669; border-radius: 3px"></div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join('')}

      <div class="footer">
        Document généré automatiquement par le système de gestion LA TERRA COTTA OUAGA
      </div>
    `;
  };

  const generateDetailedReportPrint = () => {
    const now = new Date();
    const filteredOrdersForPrint = getFilteredOrders();
    
    return `
      <div class="header">
        <h1>Rapport Détaillé des Commandes Fournisseurs</h1>
        <div class="subtitle">LA TERRA COTTA OUAGA</div>
        <div class="print-date">
          Imprimé le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div class="summary">
        <h3>Résumé Financier</h3>
        <div class="payment-details">
          ${monthlySummaries.map(s => {
            const monthDate = new Date(s.month + '-01');
            const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            return `
              <div class="payment-detail-row">
                <span class="label">${monthName}:</span>
                <span class="value">
                  Payé: ${s.total_paid.toLocaleString()} f CFA | 
                  Dû: ${s.total_due.toLocaleString()} f CFA | 
                  Total: ${s.total_amount.toLocaleString()} f CFA
                </span>
              </div>
            `;
          }).join('')}
          
          <div class="payment-detail-row" style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px;">
            <span class="label" style="font-weight: bold;">TOTAL GÉNÉRAL:</span>
            <span class="value" style="font-weight: bold;">
              Payé: ${monthlySummaries.reduce((sum, s) => sum + s.total_paid, 0).toLocaleString()} f CFA | 
              Dû: ${monthlySummaries.reduce((sum, s) => sum + s.total_due, 0).toLocaleString()} f CFA | 
              Total: ${monthlySummaries.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()} f CFA
            </span>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Mois</th>
            <th>Commandes</th>
            <th>Montant Total</th>
            <th>Montant Payé</th>
            <th>Reste à Payer</th>
            <th>Taux Payé</th>
          </tr>
        </thead>
        <tbody>
          ${monthlySummaries.map(s => {
            const monthDate = new Date(s.month + '-01');
            const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            
            return `
              <tr>
                <td>${monthName}</td>
                <td>${s.total_orders}</td>
                <td>${s.total_amount.toLocaleString()} f CFA</td>
                <td>${s.total_paid.toLocaleString()} f CFA</td>
                <td>${s.total_due.toLocaleString()} f CFA</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px">
                    <span>${s.paid_percentage}%</span>
                    <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px">
                      <div style="width: ${s.paid_percentage}%; height: 100%; background: #059669; border-radius: 3px"></div>
                    </div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        Document généré automatiquement par le système de gestion LA TERRA COTTA OUAGA
      </div>
    `;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (orderItems.length === 0) {
      alert('Veuillez ajouter au moins un article à la commande');
      return;
    }

    if (!formData.supplier_id) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    try {
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total_cost, 0);
      const orderNumber = `CMD-${Date.now()}`;

      const { data: orderData, error: orderError } = await supabase
        .from('supplier_orders')
        .insert([{
          supplier_id: formData.supplier_id,
          order_number: orderNumber,
          order_date: formData.order_date,
          expected_delivery_date: formData.expected_delivery_date,
          total_amount: totalAmount,
          status: 'draft',
          notes: formData.notes,
          created_by: user.id,
          payment_status: 'pending',
          amount_paid: 0
        }])
        .select();

      if (orderError) throw orderError;

      if (orderData && orderData.length > 0) {
        const orderId = orderData[0].id;

        const orderItemsData = orderItems.map(item => ({
          supplier_order_id: orderId,
          name: item.name,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit: item.unit || 'unité',
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          notes: item.notes || '',
          inventory_item_id: null,
          description: item.notes || '',
          purchase_unit: 'piece',
          bottles_per_unit: 1
        }));

        const { error: itemsError } = await supabase
          .from('supplier_order_items')
          .insert(orderItemsData);

        if (itemsError) throw itemsError;

        await createExpenseFromOrder(orderData[0], totalAmount);

        alert('Commande créée avec succès !');
        resetForm();
        loadSupplierOrders();
        loadSupplierOrdersMap();
        calculateSupplierBalances();
        calculateMonthlySummaries();
      }
    } catch (error: any) {
      console.error('Error creating supplier order:', error);
      alert(`Erreur lors de la création de la commande: ${error.message}`);
    }
  };

  const addItemToOrder = () => {
    // Convertir les valeurs string en number
    const quantity = parseFloat(currentItem.quantity_ordered) || 0;
    const unitCost = parseFloat(currentItem.unit_cost) || 0;
    
    if (!currentItem.name || quantity <= 0 || unitCost < 0) {
      alert('Veuillez remplir au moins le nom, la quantité et le prix unitaire');
      return;
    }

    const totalCost = quantity * unitCost;

    const newItem: TempOrderItem = {
      name: currentItem.name,
      quantity_ordered: quantity,
      unit: currentItem.unit || 'unité',
      unit_cost: unitCost,
      total_cost: totalCost,
      notes: currentItem.notes
    };

    setOrderItems([...orderItems, newItem]);
    setCurrentItem({
      name: '',
      notes: '',
      quantity_ordered: '',
      unit: '',
      unit_cost: '',
    });
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const confirmOrder = async (orderId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir confirmer cette commande ?')) return;

    try {
      const { data: updatedOrder, error } = await supabase
        .from('supplier_orders')
        .update({
          status: 'ordered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      loadSupplierOrders();
      calculateMonthlySummaries();
      alert('Commande confirmée avec succès !');
    } catch (error: any) {
      console.error('Error confirming order:', error);
      alert(`Erreur lors de la confirmation: ${error.message}`);
    }
  };

  const openPaymentsModal = (order: SupplierOrder) => {
    if (!order || !order.id) {
      console.error('Cannot open payments modal: order or order.id is undefined');
      alert('Erreur: Impossible d\'ouvrir la gestion des paiements pour cette commande');
      return;
    }
    
    const orderWithSupplier = {
      ...order,
      supplier: (order as any).suppliers
    };
    
    setSelectedOrderForPayments(orderWithSupplier);
    setShowPaymentsModal(true);
  };

  const canManagePayments = (order: SupplierOrder) => {
    if (order.status === 'draft' || order.status === 'cancelled') {
      return false;
    }
    
    if (order.payment_status === 'paid') {
      return false;
    }
    
    return true;
  };

  const isPaymentComplete = (order: SupplierOrder) => {
    return order.payment_status === 'paid';
  };

  const startReceiving = async (order: SupplierOrder) => {
    setReceivingOrder(order);
    await loadOrderDetails(order.id);
    setShowReceiveForm(true);
  };

  const viewOrderDetails = async (order: SupplierOrder) => {
    setSelectedOrder(order);
    await loadOrderDetails(order.id);
    setShowOrderDetails(true);
  };

  const handleReceiveItems = async () => {
    if (!receivingOrder || !user) return;

    try {
      let allItemsReceived = true;
      let someItemsReceived = false;

      for (const item of orderDetails) {
        const receivedQty = receivedQuantities[item.id] || 0;
        const totalReceivedQty = item.quantity_received + receivedQty;
        
        if (receivedQty > 0) {
          someItemsReceived = true;

          const { error: updateError } = await supabase
            .from('supplier_order_items')
            .update({
              quantity_received: totalReceivedQty,
              received_at: new Date().toISOString(),
              is_received: true,
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }

        if (totalReceivedQty < item.quantity_ordered) {
          allItemsReceived = false;
        }
      }

      let newStatus = receivingOrder.status;
      if (allItemsReceived) {
        newStatus = 'received';
      } else if (someItemsReceived) {
        newStatus = 'partial';
      }

      const { error: orderError } = await supabase
        .from('supplier_orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receivingOrder.id);

      if (orderError) throw orderError;

      alert('Réception enregistrée avec succès !');
      setShowReceiveForm(false);
      setReceivingOrder(null);
      setReceivedQuantities({});
      loadSupplierOrders();
      calculateMonthlySummaries();

    } catch (error: any) {
      console.error('Error receiving items:', error);
      alert(`Erreur lors de l'enregistrement de la réception: ${error.message}`);
    }
  };

  // 🔴 REMPLACER l'ancienne fonction cancelOrder par celle-ci
const deleteOrder = async (orderId: string) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette commande ? Elle sera marquée comme annulée et n\'apparaîtra plus dans la liste.')) return;

  try {
    const { error } = await supabase
      .from('supplier_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) throw error;

    // Recharger les données sans la commande annulée
    await loadSupplierOrders();
    await loadSupplierOrdersMap();
    await calculateSupplierBalances();
    await calculateMonthlySummaries();
    
    alert('Commande supprimée avec succès !');
  } catch (error: any) {
    console.error('Error deleting order:', error);
    alert(`Erreur lors de la suppression: ${error.message}`);
  }
};

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setOrderItems([]);
    setCurrentItem({
      name: '',
      notes: '',
      quantity_ordered: '',
      unit: '',
      unit_cost: '',
    });
    setShowForm(false);
  };

  // Fonctions pour le paiement groupé
  const calculateSupplierTotalDue = (supplierId: string) => {
    const orders = supplierOrdersMap[supplierId] || [];
    return orders.reduce((total, order) => {
      if (order.payment_status !== 'paid') {
        const paidAmount = order.amount_paid || 0;
        return total + (order.total_amount - paidAmount);
      }
      return total;
    }, 0);
  };

  const calculateSupplierTotalPaid = (supplierId: string) => {
    const orders = supplierOrdersMap[supplierId] || [];
    return orders.reduce((total, order) => {
      return total + (order.amount_paid || 0);
    }, 0);
  };

  const handleBulkPaySupplier = async () => {
    if (!user) return;
    
    const supplierId = selectedSupplierForBulk;
    if (!supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    // Filtrer les commandes avec un solde dû
    const ordersToPay = (supplierOrdersMap[supplierId] || []).filter(order => {
      const paidAmount = order.amount_paid || 0;
      return order.payment_status !== 'paid' && order.total_amount > paidAmount;
    });

    if (ordersToPay.length === 0) {
      alert('Ce fournisseur n\'a pas de commandes en attente de paiement');
      return;
    }

    // Déterminer quelles commandes payer
    let selectedOrders: SupplierOrder[] = [];
    if (selectedOrdersForBulk.length > 0) {
      selectedOrders = ordersToPay.filter(order => selectedOrdersForBulk.includes(order.id));
    } else {
      selectedOrders = ordersToPay;
    }

    // Calculer le total dû pour la sélection
    const totalDue = selectedOrders.reduce((sum, order) => {
      const paidAmount = order.amount_paid || 0;
      return sum + (order.total_amount - paidAmount);
    }, 0);

    const paymentAmount = parseFloat(bulkPaymentAmount) || totalDue;

    if (paymentAmount <= 0) {
      alert('Le montant du paiement doit être supérieur à 0');
      return;
    }

    if (paymentAmount > totalDue) {
      alert(`Le montant du paiement (${paymentAmount.toLocaleString()} f CFA) ne peut pas dépasser le total dû (${totalDue.toLocaleString()} f CFA)`);
      return;
    }

    try {
      let remainingPayment = paymentAmount;
      
      // Calculer les pourcentages pour la répartition proportionnelle
      const orderPercentages: {[key: string]: number} = {};
      selectedOrders.forEach(order => {
        const paidAmount = order.amount_paid || 0;
        const orderDue = order.total_amount - paidAmount;
        orderPercentages[order.id] = orderDue / totalDue;
      });

      // Pour chaque commande, créer un paiement individuel
      for (const order of selectedOrders) {
        if (remainingPayment <= 0) break;

        const paidAmount = order.amount_paid || 0;
        const orderDue = order.total_amount - paidAmount;
        
        // Calculer le montant à payer pour cette commande (proportionnel)
        let paymentForThisOrder = 0;
        if (paymentAmount === totalDue) {
          paymentForThisOrder = orderDue;
        } else {
          paymentForThisOrder = Math.min(orderDue, Math.round(orderDue * (paymentAmount / totalDue)));
        }
        
        // Ajuster pour s'assurer qu'on ne dépasse pas le montant total
        paymentForThisOrder = Math.min(paymentForThisOrder, remainingPayment);
        
        if (paymentForThisOrder > 0) {
          // Créer un paiement individuel
          const { error: paymentError } = await supabase
            .from('supplier_order_payments')
            .insert([{
              supplier_order_id: order.id,
              payment_date: new Date().toISOString().split('T')[0],
              amount: paymentForThisOrder,
              payment_method: bulkPaymentMethod,
              reference_number: bulkReferenceNumber || `BULK-${Date.now()}-${order.id.substring(0, 8)}`,
              notes: bulkPaymentNotes || `Paiement groupé - ${selectedOrders.length} commande(s)`,
              created_by: user.id
            }]);

          if (paymentError) throw paymentError;

          // Mettre à jour le statut de paiement de la commande
          const newPaidAmount = paidAmount + paymentForThisOrder;
          const newPaymentStatus = newPaidAmount >= order.total_amount ? 'paid' : 
                                  newPaidAmount > 0 ? 'partial' : 'pending';

          const { error: orderError } = await supabase
            .from('supplier_orders')
            .update({
              amount_paid: newPaidAmount,
              payment_status: newPaymentStatus,
              last_payment_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (orderError) throw orderError;

          // Créer une dépense pour ce paiement
          const supplier = suppliers.find(s => s.id === supplierId);
          await createExpenseForPayment(order, paymentForThisOrder, supplier?.name || 'Fournisseur');

          remainingPayment -= paymentForThisOrder;
        }
      }

      // Réinitialiser le formulaire
      setBulkPaymentMode(false);
      setSelectedSupplierForBulk(null);
      setSelectedOrdersForBulk([]);
      setBulkPaymentAmount('');
      setBulkPaymentMethod('cash');
      setBulkPaymentNotes('');
      setBulkReferenceNumber('');
      
      // Recharger les données
      loadSupplierOrders();
      loadSupplierOrdersMap();
      calculateSupplierBalances();
      calculateMonthlySummaries();
      
      alert(`Paiement groupé de ${paymentAmount.toLocaleString()} f CFA enregistré avec succès pour ${selectedOrders.length} commande(s)`);
    } catch (error: any) {
      console.error('Error processing bulk payment:', error);
      alert(`Erreur lors du paiement groupé: ${error.message}`);
    }
  };

 const createExpenseForPayment = async (order: SupplierOrder, amount: number, supplierName: string) => {
  if (!user) return;

  try {
    let expenseCategory;
    
    const { data: existingCategory } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('name', 'Paiements Fournisseurs')
      .single();

    if (existingCategory) {
      expenseCategory = existingCategory;
    } else {
      const { data: newCategory, error: categoryError } = await supabase
        .from('expense_categories')
        .insert([{
          name: 'Paiements Fournisseurs',
          description: 'Paiements effectués aux fournisseurs',
          category_type: 'current',
          is_system_category: true
        }])
        .select()
        .single();

      if (categoryError) throw categoryError;
      expenseCategory = newCategory;
    }

    const { error: expenseError } = await supabase
      .from('expenses')
      .insert([{
        category_id: expenseCategory.id,
        description: `Paiement commande ${order.order_number} - ${supplierName}`,
        amount: amount,
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: bulkPaymentMethod,
        expense_type: 'general',
        expense_category_type: 'current',
        reference_id: order.id,
        reference_type: 'supplier_payment',
        created_by: user.id,
        notes: `Paiement partiel: ${amount.toLocaleString()} f CFA / ${order.total_amount.toLocaleString()} f CFA`
      }]);

    if (expenseError) {
      console.error('Error creating expense for payment:', expenseError);
    }
  } catch (error) {
    console.error('Error in createExpenseForPayment:', error);
  }
};

  const toggleOrderSelection = (orderId: string) => {
    if (selectedOrdersForBulk.includes(orderId)) {
      setSelectedOrdersForBulk(selectedOrdersForBulk.filter(id => id !== orderId));
    } else {
      setSelectedOrdersForBulk([...selectedOrdersForBulk, orderId]);
    }
  };

  const selectAllOrders = (supplierId: string) => {
    const orders = supplierOrdersMap[supplierId] || [];
    const pendingOrders = orders.filter(order => {
      const paidAmount = order.amount_paid || 0;
      return order.payment_status !== 'paid' && order.total_amount > paidAmount;
    });
    setSelectedOrdersForBulk(pendingOrders.map(order => order.id));
  };

  const startBulkPayment = (supplierId: string) => {
    setBulkPaymentMode(true);
    setSelectedSupplierForBulk(supplierId);
    setSelectedOrdersForBulk([]);
    
    const totalDue = calculateSupplierTotalDue(supplierId);
    setBulkPaymentAmount(totalDue.toString());
    setBulkReferenceNumber(`BULK-${Date.now()}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'ordered': return 'bg-blue-100 text-blue-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'ordered': return <Package className="w-4 h-4" />;
      case 'received': return <CheckCircle className="w-4 h-4" />;
      case 'partial': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <Trash2 className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'ordered': return 'Commandée';
      case 'received': return 'Reçue';
      case 'partial': return 'Partiellement reçue';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Payé';
      case 'partial': return 'Partiel';
      case 'overdue': return 'En retard';
      default: return 'En attente';
    }
  };

  const getFilteredOrders = () => {
  return supplierOrders.filter(order => {
    // 🔴 Les commandes annulées sont déjà exclues de supplierOrders
    // Mais on garde cette vérification pour être sûr
    if (order.status === 'cancelled') return false;
    
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order as any).suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentStatusFilter === 'all' || order.payment_status === paymentStatusFilter;
    
    // Filtrer par date
    const orderDate = new Date(order.order_date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    const matchesDate = orderDate >= startDate && orderDate <= endDate;
    
    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });
};

  const filteredOrders = getFilteredOrders();

  const toggleMonthExpansion = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

 const getMonthlyStats = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // 🔴 Calculer dynamiquement les stats du mois en cours en excluant les annulées
  const currentMonthOrders = supplierOrders.filter(order => {
    const orderMonth = order.order_date.slice(0, 7);
    return orderMonth === currentMonth && order.status !== 'cancelled';
  });
  
  const totalAmount = currentMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalPaid = currentMonthOrders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  const totalDue = totalAmount - totalPaid;
  const paidPercentage = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
  
  return {
    totalAmount,
    totalPaid,
    totalDue,
    paidPercentage
  };
};

  const monthlyStats = getMonthlyStats();

  if (loading) {
    return <div className="p-8 text-center">Chargement des commandes fournisseurs...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Commandes Fournisseurs</h2>
          <p className="text-slate-600 mt-1">Gestion simplifiée des commandes aux fournisseurs</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle Commande</span>
        </button>
      </div>

      {/* Stats mensuelles en haut */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Montant Total ce Mois</p>
              <p className="text-2xl font-bold text-slate-900">
                {monthlyStats.totalAmount.toLocaleString()} f CFA
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Payé ce Mois</p>
              <p className="text-2xl font-bold text-green-600">
                {monthlyStats.totalPaid.toLocaleString()} f CFA
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Impayé ce Mois</p>
              <p className="text-2xl font-bold text-red-600">
                {monthlyStats.totalDue.toLocaleString()} f CFA
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Taux de Paiement</p>
              <p className="text-2xl font-bold text-purple-600">
                {monthlyStats.paidPercentage}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche améliorés */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Numéro de commande ou fournisseur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Statut commande
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="ordered">Commandée</option>
              <option value="partial">Partiellement reçue</option>
              <option value="received">Totalement reçue</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Statut paiement
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Tous les paiements</option>
              <option value="pending">En attente</option>
              <option value="partial">Partiel</option>
              <option value="paid">Payé</option>
              <option value="overdue">En retard</option>
            </select>
          </div>

          <div className="md:col-span-1 flex items-end space-x-3">
            <div className="text-sm text-slate-600">
              {filteredOrders.length} commande(s)
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={() => setShowMonthlySummary(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <BarChart className="w-4 h-4" />
            <span>Résumé Mensuel</span>
          </button>
          
          <button
            onClick={() => setBulkPaymentMode(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
          >
            <CreditCard className="w-4 h-4" />
            <span>Paiement Groupé</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePrint('orders')}
              disabled={isPrinting || filteredOrders.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPrinting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Impression...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Imprimer Liste</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => handlePrint('detailed-report')}
              disabled={isPrinting || monthlySummaries.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Rapport Détaillé</span>
            </button>
          </div>
        </div>
      </div>

      {/* Liste des commandes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Commande
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Fournisseur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Paiement
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOrders.map((order) => {
              const supplierBalance = supplierBalances[order.supplier_id];
              const supplier = suppliers.find(s => s.id === order.supplier_id);
              
              return (
                <tr key={order.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{order.order_number}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(order.order_date).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">
                      {(order as any).suppliers?.name}
                    </div>
                    {supplierBalance && supplierBalance.pendingOrders > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {supplierBalance.pendingOrders} commande(s) en attente • 
                        Dû: {supplierBalance.remainingBalance.toLocaleString()} f CFA
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {new Date(order.order_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getPaymentStatusColor(order.payment_status)
                      }`}>
                        {getPaymentStatusText(order.payment_status)}
                      </span>
                      {(order.amount_paid || 0) > 0 && order.payment_status !== 'paid' && (
                        <span className="text-xs text-slate-500">
                          {order.amount_paid?.toLocaleString() || '0'} f CFA / {order.total_amount.toLocaleString()} f CFA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                    {order.total_amount.toLocaleString()} f CFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{getStatusText(order.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="text-blue-600 hover:text-blue-900 transition"
                        title="Voir les détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {order.status === 'draft' && (
                        <>
                          <button
                            onClick={() => confirmOrder(order.id)}
                            className="text-green-600 hover:text-green-900 transition"
                            title="Confirmer la commande"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="text-red-600 hover:text-red-900 transition"
                            title="Annuler la commande"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      {(order.status === 'ordered' || order.status === 'partial') && (
                        <button
                          onClick={() => startReceiving(order)}
                          className="text-orange-600 hover:text-orange-900 transition"
                          title="Réceptionner les articles"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      
                      {canManagePayments(order) ? (
                        <button
                          onClick={() => openPaymentsModal(order)}
                          className="text-purple-600 hover:text-purple-900 transition group relative"
                          title={`Gérer les paiements (${order.amount_paid?.toLocaleString() || '0'} f CFA payés sur ${order.total_amount.toLocaleString()} f CFA)`}
                        >
                          <DollarSign className="w-4 h-4" />
                          {(order.amount_paid || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {Math.round(((order.amount_paid || 0) / order.total_amount) * 100)}%
                            </span>
                          )}
                        </button>
                      ) : isPaymentComplete(order) ? (
                        <button
                          onClick={() => openPaymentsModal(order)}
                          className="text-green-600 hover:text-green-900 transition"
                          title="Paiement complet - Voir les détails"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Aucune commande ne correspond aux critères' 
                : 'Aucune commande fournisseur enregistrée'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition"
              >
                Créer la première commande
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de création de commande */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="text-2xl font-bold text-slate-900">
                Nouvelle commande fournisseur
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Informations de base */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-slate-50 rounded-xl p-6 space-y-6">
                    <h4 className="text-lg font-semibold text-slate-900">Informations de base</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Fournisseur *
                      </label>
                      <select
                        value={formData.supplier_id}
                        onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                      >
                        <option value="">Sélectionner un fournisseur</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Date de commande *
                      </label>
                      <input
                        type="date"
                        value={formData.order_date}
                        onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Date de livraison prévue
                      </label>
                      <input
                        type="date"
                        value={formData.expected_delivery_date}
                        onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                        placeholder="Notes supplémentaires pour la commande..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section articles */}
                <div className="lg:col-span-2">
                  <div className="border-2 border-slate-200 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-slate-900 mb-6">Articles de la commande</h4>
                    
                    <div className="bg-slate-50 rounded-lg p-6 mb-6">
                      <h5 className="font-medium text-slate-900 mb-4">Ajouter un article</h5>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nom de l'article *
                          </label>
                          <input
                            type="text"
                            value={currentItem.name}
                            onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                            placeholder="Ex: Coca-Cola 33cl"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Unité
                          </label>
                          <input
                            type="text"
                            value={currentItem.unit}
                            onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
                            placeholder="Ex: bouteille, kg, pièce..."
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Quantité *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={currentItem.quantity_ordered}
                            onChange={(e) => setCurrentItem({ ...currentItem, quantity_ordered: e.target.value })}
                            placeholder="Ex: 10"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Entrez 0.5 pour une demi-unité si nécessaire
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Prix unitaire (f CFA) *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={currentItem.unit_cost}
                            onChange={(e) => setCurrentItem({ ...currentItem, unit_cost: e.target.value })}
                            placeholder="Ex: 1500"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Utilisez le point pour les décimales
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Notes (optionnel)
                        </label>
                        <textarea
                          value={currentItem.notes}
                          onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                          rows={2}
                          placeholder="Notes sur l'article..."
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-base"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                          {currentItem.quantity_ordered && currentItem.unit_cost ? (
                            <span className="font-medium">
                              Total: {(parseFloat(currentItem.quantity_ordered) * parseFloat(currentItem.unit_cost)).toLocaleString()} f CFA
                            </span>
                          ) : (
                            'Remplissez quantité et prix pour voir le total'
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addItemToOrder}
                          disabled={!currentItem.name || 
                            !currentItem.quantity_ordered || 
                            parseFloat(currentItem.quantity_ordered) <= 0 || 
                            !currentItem.unit_cost || 
                            parseFloat(currentItem.unit_cost) < 0}
                          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Ajouter l'article</span>
                        </button>
                      </div>
                    </div>

                    {/* Liste des articles ajoutés */}
                    {orderItems.length > 0 ? (
                      <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-800 text-white px-6 py-4">
                          <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                            <div className="col-span-4">Article</div>
                            <div className="col-span-2 text-center">Unité</div>
                            <div className="col-span-2 text-center">Quantité</div>
                            <div className="col-span-2 text-center">Prix unitaire</div>
                            <div className="col-span-2 text-center">Total</div>
                            <div className="col-span-1"></div>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                          {orderItems.map((item, index) => (
                            <div key={index} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition">
                              <div className="col-span-4">
                                <div className="font-medium text-slate-900">{item.name}</div>
                                {item.notes && (
                                  <div className="text-slate-500 text-sm mt-1">{item.notes}</div>
                                )}
                              </div>
                              <div className="col-span-2 text-center text-slate-700">
                                {item.unit || 'unité'}
                              </div>
                              <div className="col-span-2 text-center text-slate-700 font-medium">
                                {item.quantity_ordered}
                              </div>
                              <div className="col-span-2 text-center text-slate-700 font-medium">
                                {item.unit_cost.toLocaleString()} f CFA
                              </div>
                              <div className="col-span-2 text-center text-green-600 font-bold text-lg">
                                {item.total_cost.toLocaleString()} f CFA
                              </div>
                              <div className="col-span-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItemFromOrder(index)}
                                  className="text-red-600 hover:text-red-900 transition p-2 rounded-lg hover:bg-red-50"
                                  title="Supprimer cet article"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-slate-800 text-white px-6 py-4 border-t border-slate-700">
                          <div className="flex justify-between items-center font-bold text-lg">
                            <span>Total commande:</span>
                            <span className="text-green-400">
                              {orderItems.reduce((sum, item) => sum + item.total_cost, 0).toLocaleString()} f CFA
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg">
                        <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 text-lg">
                          Aucun article ajouté à la commande
                        </p>
                        <p className="text-slate-500 text-sm mt-2">
                          Utilisez le formulaire ci-dessus pour ajouter des articles
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-8 py-4 border-2 border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition text-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={orderItems.length === 0 || !formData.supplier_id || !formData.order_date}
                  className="flex-1 px-8 py-4 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 disabled:opacity-50 transition text-lg flex items-center justify-center space-x-3"
                >
                  <Save className="w-6 h-6" />
                  <span>Créer la commande</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de détails de commande */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Détails de la commande {selectedOrder.order_number}
              </h3>
              <button
                onClick={() => {
                  setShowOrderDetails(false);
                  setSelectedOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Informations</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Fournisseur:</span>
                      <span className="font-medium">{(selectedOrder as any).suppliers?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date de commande:</span>
                      <span className="font-medium">{new Date(selectedOrder.order_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Statut:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusText(selectedOrder.status)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Paiement</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Statut:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                        {getPaymentStatusText(selectedOrder.payment_status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Montant payé:</span>
                      <span className="font-medium">{selectedOrder.amount_paid?.toLocaleString() || '0'} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Reste à payer:</span>
                      <span className="font-medium">
                        {Math.max(0, (selectedOrder.total_amount - (selectedOrder.amount_paid || 0))).toLocaleString()} f CFA
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Montants</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total commande:</span>
                      <span className="font-medium text-lg">{selectedOrder.total_amount.toLocaleString()} f CFA</span>
                    </div>
                  </div>
                </div>
              </div>

              {orderDetails.length > 0 ? (
                <div className="border rounded-lg">
                  <div className="bg-slate-50 px-4 py-3 border-b">
                    <h4 className="font-semibold text-slate-900">Articles commandés ({orderDetails.length})</h4>
                  </div>
                  <div className="divide-y">
                    {orderDetails.map((item, index) => (
                      <div key={item.id || index} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-4 text-sm">
                          <div className="font-medium">{item.name || 'Article sans nom'}</div>
                          {item.notes && (
                            <div className="text-slate-500 text-xs">{item.notes}</div>
                          )}
                        </div>
                        <div className="col-span-2 text-sm text-center">
                          <div>{item.unit || 'unité'}</div>
                        </div>
                        <div className="col-span-2 text-sm text-center">
                          <div className="font-medium">Commandé: {item.quantity_ordered || 0}</div>
                        </div>
                        <div className="col-span-2 text-sm text-center">
                          <div>Reçu: {item.quantity_received || 0}</div>
                        </div>
                        <div className="col-span-2 text-sm font-semibold text-center">
                          {item.total_cost ? item.total_cost.toLocaleString() : '0'} f CFA
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 px-4 py-3 border-t">
                    <div className="flex justify-end items-center">
                      <div className="text-sm text-slate-600 mr-4">
                        Total articles: {orderDetails.length}
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        Total: {orderDetails.reduce((sum, item) => sum + (item.total_cost || 0), 0).toLocaleString()} f CFA
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p>Aucun article trouvé pour cette commande</p>
                  <p className="text-sm mt-1">Les articles peuvent ne pas avoir été enregistrés correctement</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de réception */}
      {showReceiveForm && receivingOrder && orderDetails.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Réception de la commande {receivingOrder.order_number}
              </h3>
              <button
                onClick={() => {
                  setShowReceiveForm(false);
                  setReceivingOrder(null);
                  setReceivedQuantities({});
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note :</strong> La réception des articles ne met pas à jour automatiquement les stocks.
                  Les stocks doivent être gérés séparément via le module d'inventaire.
                </p>
              </div>

              {orderDetails.length > 0 ? (
                <>
                  <div className="border rounded-lg">
                    <div className="bg-slate-50 px-4 py-3 border-b">
                      <div className="grid grid-cols-12 gap-3 text-sm font-medium text-slate-700">
                        <div className="col-span-4">Article</div>
                        <div className="col-span-2 text-center">Commandé</div>
                        <div className="col-span-2 text-center">Déjà reçu</div>
                        <div className="col-span-2 text-center">À recevoir</div>
                        <div className="col-span-2 text-center">Quantité à recevoir</div>
                      </div>
                    </div>
                    <div className="divide-y">
                      {orderDetails.map((item) => {
                        const maxQuantity = item.quantity_ordered - (item.quantity_received || 0);
                        const remainingToReceive = Math.max(0, maxQuantity);
                        
                        return (
                          <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-4 text-sm">
                              <div className="font-medium">{item.name || 'Article sans nom'}</div>
                              <div className="text-slate-500 text-xs">
                                {item.unit || 'unité'}
                                {item.notes && ` • ${item.notes}`}
                              </div>
                            </div>
                            <div className="col-span-2 text-sm text-center">
                              <div>{item.quantity_ordered || 0}</div>
                            </div>
                            <div className="col-span-2 text-sm text-center">
                              <div>{item.quantity_received || 0}</div>
                            </div>
                            <div className="col-span-2 text-sm text-center">
                              <div>{remainingToReceive}</div>
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="0"
                                max={remainingToReceive}
                                value={receivedQuantities[item.id] || 0}
                                onChange={(e) => setReceivedQuantities({
                                  ...receivedQuantities,
                                  [item.id]: Math.min(parseInt(e.target.value) || 0, remainingToReceive)
                                })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                              />
                              <div className="text-xs text-slate-500 mt-1 text-center">
                                Max: {remainingToReceive}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowReceiveForm(false);
                        setReceivingOrder(null);
                        setReceivedQuantities({});
                      }}
                      className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleReceiveItems}
                      className="px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
                    >
                      Enregistrer la réception
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p>Aucun article trouvé pour cette commande</p>
                  <p className="text-sm mt-1">Impossible de procéder à la réception</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion des paiements */}
      {showPaymentsModal && selectedOrderForPayments && (
        <SupplierOrderPayments
          orderId={selectedOrderForPayments.id}
          orderNumber={selectedOrderForPayments.order_number}
          totalAmount={selectedOrderForPayments.total_amount}
          supplierName={(selectedOrderForPayments as any).suppliers?.name || 'Non spécifié'}
          onClose={() => {
            setShowPaymentsModal(false);
            setSelectedOrderForPayments(null);
          }}
          onUpdate={() => {
            loadSupplierOrders();
            loadSupplierOrdersMap();
            calculateSupplierBalances();
            calculateMonthlySummaries();
          }}
        />
      )}

      {/* Modal de paiement groupé */}
      {bulkPaymentMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Paiement Groupé - Fournisseur
              </h3>
              <button
                onClick={() => {
                  setBulkPaymentMode(false);
                  setSelectedSupplierForBulk(null);
                  setSelectedOrdersForBulk([]);
                  setBulkPaymentAmount('');
                  setBulkPaymentMethod('cash');
                  setBulkPaymentNotes('');
                  setBulkReferenceNumber('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Sélection du fournisseur */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sélectionner le fournisseur *
                </label>
                <select
                  value={selectedSupplierForBulk || ''}
                  onChange={(e) => {
                    const supplierId = e.target.value;
                    setSelectedSupplierForBulk(supplierId);
                    setSelectedOrdersForBulk([]);
                    if (supplierId) {
                      const totalDue = calculateSupplierTotalDue(supplierId);
                      setBulkPaymentAmount(totalDue.toString());
                      setBulkReferenceNumber(`BULK-${Date.now()}`);
                    }
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Choisir un fournisseur...</option>
                  {suppliers
                    .filter(supplier => {
                      const orders = supplierOrdersMap[supplier.id] || [];
                      const hasPendingPayments = orders.some(order => {
                        const paidAmount = order.amount_paid || 0;
                        return order.payment_status !== 'paid' && order.total_amount > paidAmount;
                      });
                      return hasPendingPayments;
                    })
                    .map(supplier => {
                      const totalDue = calculateSupplierTotalDue(supplier.id);
                      const totalPaid = calculateSupplierTotalPaid(supplier.id);
                      const pendingOrders = (supplierOrdersMap[supplier.id] || []).filter(order => {
                        const paidAmount = order.amount_paid || 0;
                        return order.payment_status !== 'paid' && order.total_amount > paidAmount;
                      }).length;
                      
                      return (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} - Dû: {totalDue.toLocaleString()} f CFA ({pendingOrders} commandes)
                        </option>
                      );
                    })}
                </select>
              </div>

              {selectedSupplierForBulk && (
                <>
                  {/* Liste des commandes avec sélection */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-slate-900">
                        Commandes avec solde dû
                      </h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => selectAllOrders(selectedSupplierForBulk)}
                          className="text-sm text-blue-600 hover:text-blue-900 px-3 py-1 bg-blue-50 rounded-lg"
                        >
                          Tout sélectionner
                        </button>
                        <button
                          onClick={() => setSelectedOrdersForBulk([])}
                          className="text-sm text-red-600 hover:text-red-900 px-3 py-1 bg-red-50 rounded-lg"
                        >
                          Tout désélectionner
                        </button>
                      </div>
                    </div>

                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      {supplierOrdersMap[selectedSupplierForBulk]
                        ?.filter(order => {
                          const paidAmount = order.amount_paid || 0;
                          return order.payment_status !== 'paid' && order.total_amount > paidAmount;
                        })
                        .map(order => {
                          const paidAmount = order.amount_paid || 0;
                          const orderDue = order.total_amount - paidAmount;
                          
                          return (
                            <div
                              key={order.id}
                              className={`p-3 border-b last:border-b-0 flex items-center justify-between hover:bg-slate-50 ${
                                selectedOrdersForBulk.includes(order.id) ? 'bg-blue-50 border-blue-200' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => toggleOrderSelection(order.id)}
                                  className={`w-5 h-5 border rounded flex items-center justify-center ${
                                    selectedOrdersForBulk.includes(order.id)
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {selectedOrdersForBulk.includes(order.id) && (
                                    <CheckSquare className="w-3 h-3" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-medium">{order.order_number}</div>
                                  <div className="text-sm text-slate-600">
                                    {new Date(order.order_date).toLocaleDateString('fr-FR')} • 
                                    Total: {order.total_amount.toLocaleString()} f CFA
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold ${
                                  order.payment_status === 'paid' ? 'text-green-600' :
                                  order.payment_status === 'partial' ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  Dû: {orderDue.toLocaleString()} f CFA
                                </div>
                                <div className="text-sm text-slate-500">
                                  Payé: {paidAmount.toLocaleString()} f CFA
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-600">Total commandes sélectionnées:</div>
                          <div className="font-semibold">
                            {selectedOrdersForBulk.length} commande(s)
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-600">Total dû sélectionné:</div>
                          <div className="font-semibold text-green-600">
                            {selectedOrdersForBulk.reduce((total, orderId) => {
                              const order = supplierOrdersMap[selectedSupplierForBulk]?.find(o => o.id === orderId);
                              if (order) {
                                const paidAmount = order.amount_paid || 0;
                                return total + (order.total_amount - paidAmount);
                              }
                              return total;
                            }, 0).toLocaleString()} f CFA
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Formulaire de paiement */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Montant à payer (f CFA) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={bulkPaymentAmount}
                        onChange={(e) => setBulkPaymentAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        placeholder="Montant du paiement"
                      />
                      <div className="text-sm text-slate-500 mt-1">
                        Montant dû total: {calculateSupplierTotalDue(selectedSupplierForBulk).toLocaleString()} f CFA
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Mode de paiement *
                      </label>
                      <select
                        value={bulkPaymentMethod}
                        onChange={(e) => setBulkPaymentMethod(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      >
                        <option value="cash">Espèces</option>
                        <option value="bank_transfer">Virement bancaire</option>
                        <option value="check">Chèque</option>
                        <option value="mobile_money">Mobile Money</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Numéro de référence
                    </label>
                    <input
                      type="text"
                      value={bulkReferenceNumber}
                      onChange={(e) => setBulkReferenceNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Numéro de référence du paiement"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (optionnel)
                    </label>
                    <textarea
                      value={bulkPaymentNotes}
                      onChange={(e) => setBulkPaymentNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Notes sur ce paiement groupé..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setBulkPaymentMode(false);
                        setSelectedSupplierForBulk(null);
                        setSelectedOrdersForBulk([]);
                        setBulkPaymentAmount('');
                        setBulkPaymentMethod('cash');
                        setBulkPaymentNotes('');
                        setBulkReferenceNumber('');
                      }}
                      className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleBulkPaySupplier}
                      disabled={!selectedSupplierForBulk || !bulkPaymentAmount || parseFloat(bulkPaymentAmount) <= 0}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-5 h-5" />
                        <span>Effectuer le paiement</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de résumé mensuel */}
      {showMonthlySummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Résumé Mensuel des Paiements
              </h3>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedMonthForPrint}
                  onChange={(e) => setSelectedMonthForPrint(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="all">Tous les mois</option>
                  {monthlySummaries.map(summary => (
                    <option key={summary.month} value={summary.month}>
                      {new Date(summary.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handlePrint('monthly-summary', selectedMonthForPrint === 'all' ? undefined : selectedMonthForPrint)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                  disabled={isPrinting}
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setShowMonthlySummary(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Aperçu de l'impression */}
              <div className="bg-white p-6 border rounded-lg">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">Résumé Mensuel des Commandes Fournisseurs</h1>
                  <div className="text-slate-600">LA TERRA COTTA OUAGA</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {selectedMonthForPrint === 'all' 
                      ? 'Tous les mois' 
                      : new Date(selectedMonthForPrint + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {monthlySummaries
                  .filter(s => selectedMonthForPrint === 'all' || s.month === selectedMonthForPrint)
                  .map((summary) => {
                    const monthDate = new Date(summary.month + '-01');
                    const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    
                    const isExpanded = expandedMonths.has(summary.month);
                    
                    return (
                      <div key={summary.month} className="mb-8 last:mb-0">
                        <div 
                          className="bg-slate-50 p-4 rounded-lg mb-4 cursor-pointer hover:bg-slate-100 transition"
                          onClick={() => toggleMonthExpansion(summary.month)}
                        >
                          <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">{monthName}</h2>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                          <div className="grid grid-cols-4 gap-4 mt-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-2xl font-bold text-slate-900">
                                {summary.total_amount.toLocaleString()} f CFA
                              </div>
                              <div className="text-sm text-slate-600">Montant Total</div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                              <div className="text-2xl font-bold text-green-600">
                                {summary.total_paid.toLocaleString()} f CFA
                              </div>
                              <div className="text-sm text-slate-600">
                                Payé ({summary.paid_percentage}%)
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
                              <div className="text-2xl font-bold text-red-600">
                                {summary.total_due.toLocaleString()} f CFA
                              </div>
                              <div className="text-sm text-slate-600">Reste à Payer</div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-2xl font-bold text-slate-900">
                                {summary.total_orders}
                              </div>
                              <div className="text-sm text-slate-600">Commandes</div>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <>
                            {/* Barre de progression */}
                            <div className="mb-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-slate-700">Progression du paiement</span>
                                <span className="text-sm font-bold text-green-600">{summary.paid_percentage}%</span>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                                  style={{ width: `${summary.paid_percentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Tableau détaillé */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50">
                                    <th className="py-3 px-4 text-left">Détail</th>
                                    <th className="py-3 px-4 text-center">Commandes</th>
                                    <th className="py-3 px-4 text-right">Montant</th>
                                    <th className="py-3 px-4 text-right">Payé</th>
                                    <th className="py-3 px-4 text-right">Reste</th>
                                    <th className="py-3 px-4 text-center">Taux Payé</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 font-medium">Total {monthName}</td>
                                    <td className="py-3 px-4 text-center">{summary.total_orders}</td>
                                    <td className="py-3 px-4 text-right font-bold">
                                      {summary.total_amount.toLocaleString()} f CFA
                                    </td>
                                    <td className="py-3 px-4 text-right text-green-600 font-bold">
                                      {summary.total_paid.toLocaleString()} f CFA
                                    </td>
                                    <td className="py-3 px-4 text-right text-red-600 font-bold">
                                      {summary.total_due.toLocaleString()} f CFA
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-bold">{summary.paid_percentage}%</span>
                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${summary.paid_percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Détail par statut de paiement */}
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-sm font-medium text-blue-900 mb-2">Commandes Payées</div>
                                <div className="text-2xl font-bold text-blue-600">
                                  {summary.total_paid > 0 
                                    ? `${Math.round(summary.total_paid)} f CFA`
                                    : '0 f CFA'}
                                </div>
                              </div>
                              <div className="bg-red-50 p-4 rounded-lg">
                                <div className="text-sm font-medium text-red-900 mb-2">Commandes Impayées</div>
                                <div className="text-2xl font-bold text-red-600">
                                  {summary.total_due > 0 
                                    ? `${Math.round(summary.total_due)} f CFA`
                                    : '0 f CFA'}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Total général */}
              {selectedMonthForPrint === 'all' && monthlySummaries.length > 0 && (
                <div className="mt-6 bg-slate-800 text-white p-6 rounded-lg">
                  <h4 className="text-lg font-bold mb-4">Total Général</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-slate-300">Total Montant</div>
                      <div className="text-2xl font-bold">
                        {monthlySummaries.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()} f CFA
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Total Payé</div>
                      <div className="text-2xl font-bold text-green-400">
                        {monthlySummaries.reduce((sum, s) => sum + s.total_paid, 0).toLocaleString()} f CFA
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Total Dû</div>
                      <div className="text-2xl font-bold text-red-400">
                        {monthlySummaries.reduce((sum, s) => sum + s.total_due, 0).toLocaleString()} f CFA
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Total Commandes</div>
                      <div className="text-2xl font-bold">
                        {monthlySummaries.reduce((sum, s) => sum + s.total_orders, 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
