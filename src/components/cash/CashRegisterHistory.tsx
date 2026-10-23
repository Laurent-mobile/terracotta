// src/components/cash/CashRegisterHistory.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Printer,
  Maximize2,
  Filter,
  RefreshCw,
  BarChart3,
  PlusCircle,
  List,
  ShoppingCart,
  Receipt
} from 'lucide-react';

interface CashRegisterSession {
  id: string;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  closed_by: string | null;
  total_cash_sales: number | null;
  total_mobile_sales: number | null;
  total_card_sales: number | null;
  total_sales: number | null;
  total_expenses: number | null;
  total_cash_supplies: number | null;
  notes?: string;
  opened_by_email?: string;
  closed_by_email?: string;
}

interface CashRegisterReport {
  id: string;
  cash_register_id: string;
  report_content: string;
  generated_by: string;
  generated_by_email?: string;
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

export default function CashRegisterHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [reports, setReports] = useState<Map<string, CashRegisterReport>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [detailedReportData, setDetailedReportData] = useState<{
    sales: OrderWithItems[];
    expenses: any[];
    supplies: any[];
  }>({
    sales: [],
    expenses: [],
    supplies: []
  });
  const [loadingDetailedReport, setLoadingDetailedReport] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('cash_register')
        .select('*')
        .order('opened_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (dateRange.start) {
        query = query.gte('opened_at', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('opened_at', `${dateRange.end}T23:59:59`);
      }

      const { data: sessionsData, error: sessionsError } = await query;

      if (sessionsError) throw sessionsError;

      const userIds = new Set<string>();
      sessionsData?.forEach(session => {
        userIds.add(session.opened_by);
        if (session.closed_by) userIds.add(session.closed_by);
      });

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(userIds));

      const usersMap = new Map(usersData?.map(user => [user.id, user.email]) || []);

      const sessionsWithDetails = await Promise.all(
        sessionsData?.map(async (session) => {
          let totalCashSupplies = 0;
          if (session.closed_at) {
            const { data: suppliesData } = await supabase
              .from('expenses')
              .select('amount')
              .gte('created_at', session.opened_at)
              .lte('created_at', session.closed_at)
              .eq('payment_method', 'cash')
              .eq('expense_type', 'cash_supply')
              .eq('expense_category_type', 'current');

            totalCashSupplies = suppliesData?.reduce((sum, supply) => sum + supply.amount, 0) || 0;
          }

          return {
            ...session,
            total_cash_supplies: totalCashSupplies,
            opened_by_email: usersMap.get(session.opened_by) || 'Utilisateur inconnu',
            closed_by_email: session.closed_by ? usersMap.get(session.closed_by) || 'Utilisateur inconnu' : undefined
          };
        }) || []
      );

      setSessions(sessionsWithDetails);

      const closedSessions = sessionsWithDetails.filter(s => s.status === 'closed');
      if (closedSessions.length > 0) {
        await loadReports(closedSessions.map(s => s.id));
      }

    } catch (error) {
      console.error('Error loading cash register sessions:', error);
      setError('Erreur lors du chargement de l\'historique des caisses');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async (cashRegisterIds: string[]) => {
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from('cash_register_reports')
        .select('*')
        .in('cash_register_id', cashRegisterIds);

      if (reportsError) {
        console.warn('Error loading reports:', reportsError);
        return;
      }

      if (!reportsData || reportsData.length === 0) return;

      const reportUserIds = new Set(reportsData.map(report => report.generated_by));
      const { data: reportUsersData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(reportUserIds));

      const reportUsersMap = new Map(reportUsersData?.map(user => [user.id, user.email]) || []);

      const reportsMap = new Map<string, CashRegisterReport>();
      reportsData.forEach(report => {
        reportsMap.set(report.cash_register_id, {
          id: report.id,
          cash_register_id: report.cash_register_id,
          report_content: report.report_content,
          generated_by: report.generated_by,
          generated_by_email: reportUsersMap.get(report.generated_by) || 'Utilisateur inconnu'
        });
      });

      setReports(reportsMap);
    } catch (error) {
      console.warn('Error in loadReports:', error);
    }
  };

  const loadDetailedReportData = async (sessionId: string, openedAt: string, closedAt: string | null) => {
    try {
      setLoadingDetailedReport(true);
      
      const endDate = closedAt || new Date().toISOString();
      
      const [salesResult, expensesResult, suppliesResult] = await Promise.all([
        supabase
          .from('pos_orders')
          .select(`
            *,
            pos_order_items(*)
          `)
          .gte('created_at', openedAt)
          .lte('created_at', endDate)
          .eq('status', 'paid')
          .order('created_at', { ascending: true }),
        
        supabase
          .from('expenses')
          .select('*')
          .gte('created_at', openedAt)
          .lte('created_at', endDate)
          .eq('expense_category_type', 'current')
          .neq('expense_type', 'cash_supply')
          .order('created_at', { ascending: true }),
        
        supabase
          .from('expenses')
          .select('*')
          .gte('created_at', openedAt)
          .lte('created_at', endDate)
          .eq('payment_method', 'cash')
          .eq('expense_type', 'cash_supply')
          .eq('expense_category_type', 'current')
          .order('created_at', { ascending: true })
      ]);

      const salesData = salesResult.data || [];
      const expensesData = expensesResult.data || [];
      const suppliesData = suppliesResult.data || [];

      const salesWithItems: OrderWithItems[] = salesData.map(sale => ({
        ...sale,
        items: sale.pos_order_items || []
      }));

      setDetailedReportData({
        sales: salesWithItems,
        expenses: expensesData,
        supplies: suppliesData
      });
      
      return true;
    } catch (error) {
      console.error('Erreur chargement données détaillées:', error);
      return false;
    } finally {
      setLoadingDetailedReport(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [statusFilter, dateRange]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' f CFA';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'open') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <Clock className="w-4 h-4 mr-2" />
          Ouverte
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
        <CheckCircle className="w-4 h-4 mr-2" />
        Fermée
      </span>
    );
  };

  const getDifferenceBadge = (difference: number | null) => {
    if (difference === null || difference === undefined) return null;
    
    if (difference === 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          ✅ Équilibre
        </span>
      );
    } else if (difference > 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          <TrendingUp className="w-4 h-4 mr-2" />
          Excédent: +{formatCurrency(difference)}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <TrendingDown className="w-4 h-4 mr-2" />
          Déficit: {formatCurrency(difference)}
        </span>
      );
    }
  };

  const showFullReport = (sessionId: string) => {
    const report = reports.get(sessionId);
    if (!report?.report_content) {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const generatedReport = generateReportFromSession(session);
        if (generatedReport) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(generatedReport);
            printWindow.document.close();
            setTimeout(() => {
              printWindow.print();
            }, 500);
          }
          return;
        }
      }
      alert('Aucun rapport disponible pour cette session');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(report.report_content);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const generateReportFromSession = (session: CashRegisterSession) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Rapport de Caisse - ${session.id}</title>
  <style>
    body { 
      font-family: 'Arial', sans-serif; 
      padding: 30px; 
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.6;
      color: #333;
    }
    .header { 
      text-align: center; 
      margin-bottom: 40px;
      border-bottom: 3px double #2c3e50;
      padding-bottom: 20px;
    }
    .restaurant-name {
      font-size: 28px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 10px;
    }
    .section { 
      margin-bottom: 30px;
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section-title { 
      background: #34495e;
      color: white;
      padding: 12px 15px;
      font-weight: bold;
      margin: -20px -20px 20px -20px;
      border-radius: 10px 10px 0 0;
    }
    .info-row { 
      display: flex; 
      justify-content: space-between; 
      margin: 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px dotted #ccc;
    }
    .total-row {
      font-weight: bold;
      font-size: 16px;
      background: #ecf0f1;
      padding: 12px;
      border-radius: 5px;
      margin: 10px 0;
    }
    .supply-row {
      color: #27ae60;
      font-weight: bold;
    }
    .expense-row {
      color: #e74c3c;
      font-weight: bold;
    }
    .difference {
      text-align: center;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
      font-size: 20px;
      font-weight: bold;
    }
    .difference.zero {
      background: #d5f5e3;
      color: #27ae60;
      border: 3px solid #27ae60;
    }
    .difference.positive {
      background: #fef9e7;
      color: #f39c12;
      border: 3px solid #f39c12;
    }
    .difference.negative {
      background: #fdedec;
      color: #e74c3c;
      border: 3px solid #e74c3c;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px dashed #7f8c8d;
      color: #7f8c8d;
      font-size: 12px;
      text-align: center;
    }
    @media print {
      body { padding: 15px; }
      .section { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">LA TERRA COTTA OUAGA</div>
    <h1>Rapport de Caisse - Historique</h1>
    <p>Session du ${new Date(session.opened_at).toLocaleString('fr-FR')}</p>
    ${session.closed_at ? 
      `<p>Fermée le ${new Date(session.closed_at).toLocaleString('fr-FR')}</p>` : 
      '<p><strong style="color: #27ae60;">● Caisse encore ouverte</strong></p>'
    }
  </div>
  
  <div class="section">
    <div class="section-title">INFORMATIONS GÉNÉRALES</div>
    <div class="info-row">
      <span>Statut:</span>
      <span><strong>${session.status === 'open' ? 'OUVERTE' : 'FERMÉE'}</strong></span>
    </div>
    <div class="info-row">
      <span>ID Session:</span>
      <span><code>${session.id.substring(0, 12)}...</code></span>
    </div>
    <div class="info-row">
      <span>Ouvert par:</span>
      <span>${session.opened_by_email || 'Inconnu'}</span>
    </div>
    ${session.closed_by_email ? `
    <div class="info-row">
      <span>Fermé par:</span>
      <span>${session.closed_by_email}</span>
    </div>
    ` : ''}
    <div class="info-row">
      <span>Durée session:</span>
      <span>${session.closed_at ? 
        `${Math.round((new Date(session.closed_at).getTime() - new Date(session.opened_at).getTime()) / (1000 * 60 * 60) * 10) / 10} heures` : 
        'En cours'
      }</span>
    </div>
  </div>
  
  ${session.closing_balance ? `
  <div class="section">
    <div class="section-title">SOLDES ET CALCULS</div>
    <div class="info-row">
      <span>Solde d'ouverture:</span>
      <span><strong>${session.opening_balance.toLocaleString()} f CFA</strong></span>
    </div>
    ${session.total_cash_supplies && session.total_cash_supplies > 0 ? `
    <div class="info-row supply-row">
      <span>➕ Approvisionnements caisse:</span>
      <span>+ ${session.total_cash_supplies.toLocaleString()} f CFA</span>
    </div>
    ` : ''}
    <div class="info-row">
      <span>Ventes en espèces nettes:</span>
      <span>+ ${session.total_cash_sales ? session.total_cash_sales.toLocaleString() : '0'} f CFA</span>
    </div>
    ${session.total_expenses && session.total_expenses > 0 ? `
    <div class="info-row expense-row">
      <span>➖ Dépenses de caisse:</span>
      <span>- ${session.total_expenses.toLocaleString()} f CFA</span>
    </div>
    ` : ''}
    <div class="total-row">
      <span>SOLDE THÉORIQUE CALCULÉ:</span>
      <span>
        ${(session.opening_balance + 
          (session.total_cash_sales || 0) - 
          (session.total_expenses || 0) + 
          (session.total_cash_supplies || 0)).toLocaleString()} f CFA
      </span>
    </div>
    <div class="info-row">
      <span>Solde réel de fermeture:</span>
      <span><strong>${session.closing_balance.toLocaleString()} f CFA</strong></span>
    </div>
    
    <div class="difference ${session.difference === 0 ? 'zero' : session.difference && session.difference > 0 ? 'positive' : 'negative'}">
      ${session.difference === 0 ? '✅ SOLDE CORRECT - AUCUN ÉCART' : 
        session.difference && session.difference > 0 ? 
        `⚠️ EXCÉDENT DE ${session.difference.toLocaleString()} f CFA` : 
        `❌ DÉFICIT DE ${session.difference ? Math.abs(session.difference).toLocaleString() : '0'} f CFA`}
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">VENTES PAR MÉTHODE DE PAIEMENT</div>
    <div class="info-row">
      <span>💵 Espèces:</span>
      <span>${session.total_cash_sales ? session.total_cash_sales.toLocaleString() : '0'} f CFA</span>
    </div>
    <div class="info-row">
      <span>📱 Mobile Money:</span>
      <span>${session.total_mobile_sales ? session.total_mobile_sales.toLocaleString() : '0'} f CFA</span>
    </div>
    <div class="info-row">
      <span>💳 Carte bancaire:</span>
      <span>${session.total_card_sales ? session.total_card_sales.toLocaleString() : '0'} f CFA</span>
    </div>
    <div class="total-row">
      <span>TOTAL VENTES:</span>
      <span><strong>${session.total_sales ? session.total_sales.toLocaleString() : '0'} f CFA</strong></span>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">RÉCAPITULATIF FINANCIER</div>
    <div class="info-row">
      <span>Chiffre d'affaires total:</span>
      <span>${session.total_sales ? session.total_sales.toLocaleString() : '0'} f CFA</span>
    </div>
    ${session.total_cash_supplies && session.total_cash_supplies > 0 ? `
    <div class="info-row supply-row">
      <span>Approvisionnements caisse:</span>
      <span>+ ${session.total_cash_supplies.toLocaleString()} f CFA</span>
    </div>
    ` : ''}
    ${session.total_expenses && session.total_expenses > 0 ? `
    <div class="info-row expense-row">
      <span>Dépenses de caisse:</span>
      <span>- ${session.total_expenses.toLocaleString()} f CFA</span>
    </div>
    ` : ''}
    <div class="total-row">
      <span>FLUX NET DE CAISSE:</span>
      <span>
        ${((session.total_cash_sales || 0) + 
          (session.total_cash_supplies || 0) - 
          (session.total_expenses || 0)).toLocaleString()} f CFA
      </span>
    </div>
  </div>
  ` : `
  <div class="section">
    <div class="section-title">SESSION EN COURS</div>
    <div class="info-row">
      <span>Statut:</span>
      <span style="color: #27ae60; font-weight: bold;">● CAISSE OUVERTE</span>
    </div>
    <div class="info-row">
      <span>Solde initial:</span>
      <span><strong>${session.opening_balance.toLocaleString()} f CFA</strong></span>
    </div>
    <div class="info-row">
      <span>Ouverte depuis:</span>
      <span>${Math.round((new Date().getTime() - new Date(session.opened_at).getTime()) / (1000 * 60 * 60 * 24 * 10)) / 10} jours</span>
    </div>
    <div style="text-align: center; margin-top: 20px; color: #7f8c8d;">
      ⚠️ Cette session n'est pas encore fermée
    </div>
  </div>
  `}
  
  ${session.notes ? `
  <div class="section">
    <div class="section-title">NOTES ET OBSERVATIONS</div>
    <p style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
      ${session.notes}
    </p>
  </div>
  ` : ''}
  
  <div class="footer">
    <div>Rapport généré automatiquement par le système de gestion de caisse</div>
    <div>Généré le ${new Date().toLocaleString('fr-FR')}</div>
    <div style="margin-top: 10px; font-size: 10px;">
      ID Session: ${session.id} • ${session.status === 'closed' ? 'Fermée' : 'En cours'}
    </div>
  </div>
</body>
</html>`;
  };

  const generateDetailedReportHTML = (session: CashRegisterSession, data: typeof detailedReportData) => {
    const totalCashSales = data.sales
      .filter(sale => sale.payment_method === 'cash')
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    
    const totalMobileSales = data.sales
      .filter(sale => sale.payment_method === 'mobile_money')
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    
    const totalCardSales = data.sales
      .filter(sale => sale.payment_method === 'card')
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    
    const totalExpenses = data.expenses
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
    
    const totalSupplies = data.supplies
      .reduce((sum, supply) => sum + (supply.amount || 0), 0);

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Rapport Détaillé de Session - ${session.id}</title>
  <style>
    body { 
      font-family: 'Arial', sans-serif; 
      padding: 25px; 
      max-width: 1000px;
      margin: 0 auto;
      line-height: 1.6;
      color: #333;
      font-size: 12px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px;
      border-bottom: 3px double #2c3e50;
      padding-bottom: 15px;
    }
    .restaurant-name {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    .report-title {
      font-size: 18px;
      font-weight: bold;
      color: #34495e;
      margin-bottom: 10px;
    }
    .section { 
      margin-bottom: 25px;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      page-break-inside: avoid;
    }
    .section-title { 
      background: #34495e;
      color: white;
      padding: 10px 12px;
      font-weight: bold;
      margin: -15px -15px 15px -15px;
      border-radius: 8px 8px 0 0;
      font-size: 14px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .summary-card .label {
      font-size: 11px;
      color: #666;
      margin-bottom: 5px;
    }
    .summary-card .value {
      font-size: 16px;
      font-weight: bold;
    }
    .summary-card.cash { border-left: 4px solid #27ae60; }
    .summary-card.mobile { border-left: 4px solid #3498db; }
    .summary-card.card { border-left: 4px solid #9b59b6; }
    .summary-card.expenses { border-left: 4px solid #e74c3c; }
    .summary-card.supplies { border-left: 4px solid #f39c12; }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 11px;
    }
    .data-table th {
      background-color: #2c3e50;
      color: white;
      text-align: left;
      padding: 8px 10px;
      font-weight: bold;
      border: 1px solid #34495e;
    }
    .data-table td {
      padding: 6px 10px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    .data-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .data-table tr:hover {
      background-color: #f1f1f1;
    }
    
    .total-row {
      background-color: #ecf0f1 !important;
      font-weight: bold;
    }
    
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      min-width: 70px;
    }
    .status-paid { background-color: #d5f5e3; color: #27ae60; }
    .status-cash { background-color: #27ae60; color: white; }
    .status-mobile { background-color: #3498db; color: white; }
    .status-card { background-color: #9b59b6; color: white; }
    
    .time-badge {
      font-size: 10px;
      color: #7f8c8d;
      background: #ecf0f1;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin: 2px 0;
    }
    
    .notes {
      background: #fffde7;
      border-left: 3px solid #f1c40f;
      padding: 8px 10px;
      margin: 5px 0;
      font-size: 10px;
      border-radius: 3px;
    }
    
    .item-details {
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      margin-top: 5px;
      font-size: 10px;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px dashed #7f8c8d;
      color: #7f8c8d;
      font-size: 10px;
      text-align: center;
    }
    
    @media print {
      body { padding: 10px; font-size: 10px; }
      .section { box-shadow: none; border: 1px solid #ddd; }
      .no-print { display: none; }
      .summary-grid { grid-template-columns: repeat(5, 1fr); }
      .page-break { page-break-before: always; }
    }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .mt-2 { margin-top: 8px; }
    .mb-2 { margin-bottom: 8px; }
    .ml-2 { margin-left: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">LA TERRA COTTA OUAGA</div>
    <div class="report-title">RAPPORT DÉTAILLÉ DE SESSION DE CAISSE</div>
    <div style="font-size: 13px; margin-top: 10px;">
      Session du <strong>${new Date(session.opened_at).toLocaleDateString('fr-FR')}</strong> 
      de <strong>${new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
      ${session.closed_at ? `à <strong>${new Date(session.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>` : ''}
    </div>
    <div style="margin-top: 5px; font-size: 11px;">
      ID Session: ${session.id.substring(0, 8)} • 
      Ouverte par: ${session.opened_by_email || 'Inconnu'}
      ${session.closed_by_email ? `• Fermée par: ${session.closed_by_email}` : ''}
    </div>
  </div>
  
  <div class="summary-grid">
    <div class="summary-card cash">
      <div class="label">💵 Espèces</div>
      <div class="value">${totalCashSales.toLocaleString()} f CFA</div>
      <div style="font-size: 10px; color: #666; margin-top: 3px;">
        ${data.sales.filter(s => s.payment_method === 'cash').length} vente(s)
      </div>
    </div>
    
    <div class="summary-card mobile">
      <div class="label">📱 Mobile Money</div>
      <div class="value">${totalMobileSales.toLocaleString()} f CFA</div>
      <div style="font-size: 10px; color: #666; margin-top: 3px;">
        ${data.sales.filter(s => s.payment_method === 'mobile_money').length} vente(s)
      </div>
    </div>
    
    <div class="summary-card card">
      <div class="label">💳 Carte Bancaire</div>
      <div class="value">${totalCardSales.toLocaleString()} f CFA</div>
      <div style="font-size: 10px; color: #666; margin-top: 3px;">
        ${data.sales.filter(s => s.payment_method === 'card').length} vente(s)
      </div>
    </div>
    
    <div class="summary-card expenses">
      <div class="label">➖ Dépenses</div>
      <div class="value">${totalExpenses.toLocaleString()} f CFA</div>
      <div style="font-size: 10px; color: #666; margin-top: 3px;">
        ${data.expenses.length} dépense(s)
      </div>
    </div>
    
    <div class="summary-card supplies">
      <div class="label">💰 Approvisionnements</div>
      <div class="value">${totalSupplies.toLocaleString()} f CFA</div>
      <div style="font-size: 10px; color: #666; margin-top: 3px;">
        ${data.supplies.length} approvisionnement(s)
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">RÉSUMÉ FINANCIER DE LA SESSION</div>
    <table class="data-table">
      <tr>
        <td width="70%">Solde d'ouverture</td>
        <td width="30%" class="text-right font-bold">${session.opening_balance.toLocaleString()} f CFA</td>
      </tr>
      
      ${totalSupplies > 0 ? `
      <tr>
        <td>➕ Approvisionnements caisse</td>
        <td class="text-right" style="color: #f39c12;">+ ${totalSupplies.toLocaleString()} f CFA</td>
      </tr>
      ` : ''}
      
      <tr>
        <td>💵 Ventes en espèces nettes</td>
        <td class="text-right" style="color: #27ae60;">+ ${totalCashSales.toLocaleString()} f CFA</td>
      </tr>
      
      ${totalExpenses > 0 ? `
      <tr>
        <td>➖ Dépenses de caisse</td>
        <td class="text-right" style="color: #e74c3c;">- ${totalExpenses.toLocaleString()} f CFA</td>
      </tr>
      ` : ''}
      
      <tr class="total-row">
        <td>SOLDE THÉORIQUE CALCULÉ</td>
        <td class="text-right font-bold">
          ${(session.opening_balance + totalCashSales - totalExpenses + totalSupplies).toLocaleString()} f CFA
        </td>
      </tr>
      
      <tr>
        <td>Solde réel de fermeture</td>
        <td class="text-right font-bold">${session.closing_balance ? session.closing_balance.toLocaleString() + ' f CFA' : '-'}</td>
      </tr>
      
      ${session.difference !== null ? `
      <tr class="${session.difference === 0 ? 'status-paid' : session.difference > 0 ? '' : ''}" 
           style="${session.difference === 0 ? 'background-color: #d5f5e3;' : session.difference > 0 ? 'background-color: #fffde7;' : 'background-color: #fdedec;'}">
        <td>${session.difference === 0 ? '✅ ÉQUILIBRE' : session.difference > 0 ? `⚠️ EXCÉDENT (+${session.difference.toLocaleString()} f CFA)` : `❌ DÉFICIT (${session.difference.toLocaleString()} f CFA)`}</td>
        <td class="text-right font-bold" style="${session.difference === 0 ? 'color: #27ae60;' : session.difference > 0 ? 'color: #f39c12;' : 'color: #e74c3c;'}">
          ${session.difference === 0 ? '0 f CFA' : 
            session.difference > 0 ? `+${session.difference.toLocaleString()} f CFA` : 
            `${session.difference.toLocaleString()} f CFA`}
        </td>
      </tr>
      ` : ''}
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">VENTES DÉTAILLÉES (${data.sales.length})</div>
    ${data.sales.length === 0 ? 
      '<div style="text-align: center; padding: 20px; color: #7f8c8d;">Aucune vente enregistrée</div>' : 
      data.sales.map((sale, index) => `
        <div style="margin-bottom: ${index < data.sales.length - 1 ? '15px' : '0'}; ${index < data.sales.length - 1 ? 'border-bottom: 1px dashed #ddd; padding-bottom: 15px;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #2c3e50; margin-bottom: 3px;">
                ${sale.order_number || `Commande #${sale.id.slice(-8)}`}
                <span class="status-badge ${sale.payment_method === 'cash' ? 'status-cash' : sale.payment_method === 'mobile_money' ? 'status-mobile' : 'status-card'}" style="margin-left: 8px;">
                  ${sale.payment_method === 'cash' ? 'ESPÈCES' : sale.payment_method === 'mobile_money' ? 'MOBILE' : 'CARTE'}
                </span>
              </div>
              <div class="time-badge">
                ${new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • 
                ${sale.table_number ? `Table ${sale.table_number}` : 'Livraison'}
                ${sale.server_name ? ` • ${sale.server_name}` : ''}
              </div>
              ${sale.notes ? `<div class="notes">Note: ${sale.notes}</div>` : ''}
              
              ${sale.items && sale.items.length > 0 ? `
              <div class="item-details">
                ${sale.items.map((item: OrderItem) => `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 3px 0; border-bottom: 1px dotted #eee;">
                    <div>
                      <span style="font-weight: 500;">${item.item_name}</span>
                      <span style="color: #666; font-size: 9px; margin-left: 5px;">× ${item.quantity}</span>
                      ${item.status ? `<span style="font-size: 9px; color: #3498db; margin-left: 5px;">(${item.status})</span>` : ''}
                    </div>
                    <div style="font-weight: bold;">
                      ${item.total_price.toLocaleString()} f CFA
                    </div>
                  </div>
                `).join('')}
              </div>
              ` : ''}
            </div>
            
            <div style="text-align: right; min-width: 100px;">
              <div style="font-size: 14px; font-weight: bold; color: #2c3e50;">
                ${sale.total_amount.toLocaleString()} f CFA
              </div>
              <div style="font-size: 10px; color: #7f8c8d; margin-top: 2px;">
                ${new Date(sale.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>
      `).join('')
    }
    
    ${data.sales.length > 0 ? `
    <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #2c3e50;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
        <div>TOTAL VENTES</div>
        <div>${(totalCashSales + totalMobileSales + totalCardSales).toLocaleString()} f CFA</div>
      </div>
    </div>
    ` : ''}
  </div>
  
  ${data.expenses.length > 0 ? `
  <div class="section">
    <div class="section-title">DÉPENSES DÉTAILLÉES (${data.expenses.length})</div>
    <table class="data-table">
      <thead>
        <tr>
          <th width="40%">Description</th>
          <th width="20%">Méthode</th>
          <th width="20%">Date</th>
          <th width="20%" class="text-right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${data.expenses.map((expense: any) => `
          <tr>
            <td>
              <div style="font-weight: 500;">${expense.description || 'Dépense'}</div>
              ${expense.notes ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${expense.notes}</div>` : ''}
            </td>
            <td>
              <span class="status-badge ${expense.payment_method === 'cash' ? 'status-cash' : 'status-mobile'}" 
                    style="background-color: ${expense.payment_method === 'cash' ? '#27ae60' : '#3498db'}">
                ${expense.payment_method === 'cash' ? 'ESPÈCES' : 'MOBILE'}
              </span>
            </td>
            <td>
              ${new Date(expense.created_at).toLocaleDateString('fr-FR')}<br>
              <span style="font-size: 9px; color: #666;">
                ${new Date(expense.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </td>
            <td class="text-right" style="color: #e74c3c; font-weight: bold;">
              - ${expense.amount.toLocaleString()} f CFA
            </td>
          </tr>
        `).join('')}
        
        <tr class="total-row">
          <td colspan="3"><strong>TOTAL DÉPENSES</strong></td>
          <td class="text-right" style="color: #e74c3c;">
            <strong>- ${totalExpenses.toLocaleString()} f CFA</strong>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}
  
  ${data.supplies.length > 0 ? `
  <div class="section">
    <div class="section-title">APPROVISIONNEMENTS CAISSE (${data.supplies.length})</div>
    <table class="data-table">
      <thead>
        <tr>
          <th width="40%">Description</th>
          <th width="20%">Date</th>
          <th width="20%">Heure</th>
          <th width="20%" class="text-right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${data.supplies.map((supply: any) => `
          <tr>
            <td>
              <div style="font-weight: 500;">${supply.description || 'Approvisionnement caisse'}</div>
              ${supply.notes ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${supply.notes}</div>` : ''}
            </td>
            <td>${new Date(supply.created_at).toLocaleDateString('fr-FR')}</td>
            <td>${new Date(supply.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="text-right" style="color: #f39c12; font-weight: bold;">
              + ${supply.amount.toLocaleString()} f CFA
            </td>
          </tr>
        `).join('')}
        
        <tr class="total-row">
          <td colspan="3"><strong>TOTAL APPROVISIONNEMENTS</strong></td>
          <td class="text-right" style="color: #f39c12;">
            <strong>+ ${totalSupplies.toLocaleString()} f CFA</strong>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}
  
  ${session.notes ? `
  <div class="section">
    <div class="section-title">NOTES ET OBSERVATIONS</div>
    <div style="white-space: pre-wrap; background: white; padding: 12px; border-radius: 5px; border: 1px solid #ddd; font-size: 11px;">
      ${session.notes}
    </div>
  </div>
  ` : ''}
  
  <div class="footer">
    <div>Rapport détaillé généré automatiquement</div>
    <div>Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
    <div style="margin-top: 8px; font-size: 9px; color: #95a5a6;">
      ID Session: ${session.id} • 
      Statut: ${session.status === 'closed' ? 'Fermée' : 'En cours'} • 
      Période: ${new Date(session.opened_at).toLocaleDateString('fr-FR')} ${new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} 
      ${session.closed_at ? `- ${new Date(session.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
    </div>
  </div>
</body>
</html>`;
  };

  const openSessionDetails = (session: CashRegisterSession) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  const closeSessionDetails = () => {
    setSelectedSession(null);
    setShowSessionDetails(false);
  };

  const exportToCSV = () => {
    const headers = [
      'Date Ouverture',
      'Heure Ouverture',
      'Date Fermeture', 
      'Heure Fermeture',
      'Statut',
      'Solde Ouverture',
      'Approvisionnements',
      'Solde Fermeture',
      'Solde Attendu',
      'Écart',
      'Ventes Espèces',
      'Ventes Mobile',
      'Ventes Carte',
      'Total Ventes',
      'Dépenses',
      'Ouvert par',
      'Fermé par',
      'Rapport Généré'
    ];

    const csvData = sessions.map(session => [
      new Date(session.opened_at).toLocaleDateString('fr-FR'),
      new Date(session.opened_at).toLocaleTimeString('fr-FR'),
      session.closed_at ? new Date(session.closed_at).toLocaleDateString('fr-FR') : '-',
      session.closed_at ? new Date(session.closed_at).toLocaleTimeString('fr-FR') : '-',
      session.status === 'open' ? 'Ouverte' : 'Fermée',
      session.opening_balance,
      session.total_cash_supplies || 0,
      session.closing_balance || '',
      session.expected_balance || '',
      session.difference || '',
      session.total_cash_sales || '',
      session.total_mobile_sales || '',
      session.total_card_sales || '',
      session.total_sales || '',
      session.total_expenses || '',
      session.opened_by_email || '',
      session.closed_by_email || '',
      reports.has(session.id) ? 'Oui' : 'Non'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historique-caisse-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateRange({ start: '', end: '' });
  };

  const filteredSessions = sessions.filter(session => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        session.opened_by_email?.toLowerCase().includes(searchLower) ||
        session.closed_by_email?.toLowerCase().includes(searchLower) ||
        session.id.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const totalSessions = sessions.length;
  const openSessions = sessions.filter(s => s.status === 'open').length;
  const closedSessions = sessions.filter(s => s.status === 'closed').length;
  const totalSales = sessions.reduce((sum, session) => sum + (session.total_sales || 0), 0);
  const totalExpenses = sessions.reduce((sum, session) => sum + (session.total_expenses || 0), 0);
  const totalSupplies = sessions.reduce((sum, session) => sum + (session.total_cash_supplies || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-2xl font-semibold text-gray-700 mt-6">Chargement de l'historique...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-0">
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Historique des Caisses</h1>
              <p className="text-gray-600 mt-2 text-lg">Consultation complète des sessions d'ouverture et fermeture de caisse</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Maximize2 className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">Plein écran</span>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
              >
                <Filter className="w-5 h-5" />
                <span>Filtres</span>
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Sessions Total</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">{totalSessions}</p>
                </div>
                <Calendar className="w-10 h-10 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Sessions Ouvertes</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">{openSessions}</p>
                </div>
                <Clock className="w-10 h-10 text-green-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Ventes Total</p>
                  <p className="text-2xl font-bold text-purple-900 mt-2">{formatCurrency(totalSales)}</p>
                </div>
                <BarChart3 className="w-10 h-10 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Dépenses Total</p>
                  <p className="text-2xl font-bold text-red-900 mt-2">{formatCurrency(totalExpenses)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-red-500" />
              </div>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Approvisionnements</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-2">
                    {formatCurrency(totalSupplies)}
                  </p>
                </div>
                <PlusCircle className="w-10 h-10 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-center">
              <XCircle className="w-6 h-6 text-red-400 mr-3" />
              <span className="text-lg text-red-800">{error}</span>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="bg-white rounded-xl shadow-lg border p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Filtres et Recherche</h2>
              <div className="flex space-x-3">
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Réinitialiser</span>
                </button>
                <button
                  onClick={loadSessions}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Recherche avancée
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par email, ID session, notes..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Statut
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="open">Caisse ouverte</option>
                  <option value="closed">Caisse fermée</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Date début
                </label>
                <div className="relative">
                  <Calendar className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Date fin
                </label>
                <div className="relative">
                  <Calendar className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <div className="text-lg text-gray-700">
                <span className="font-semibold">{filteredSessions.length}</span> session(s) trouvée(s)
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={exportToCSV}
                  disabled={sessions.length === 0}
                  className="flex items-center space-x-3 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>Exporter CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Solde Ouverture
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Solde Fermeture
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Écart
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Ventes et Approvisionnements
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Utilisateurs
                  </th>
                  <th className="px-8 py-6 text-left text-base font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSessions.map((session) => {
                  const hasReport = reports.has(session.id);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center">
                          <div className="bg-blue-100 p-3 rounded-lg mr-4">
                            <Calendar className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {new Date(session.opened_at).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-gray-600 mt-1">
                              {new Date(session.opened_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {session.closed_at && ` - ${new Date(session.closed_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}`}
                            </div>
                            <div className="mt-3">
                              {getStatusBadge(session.status)}
                            </div>
                            {hasReport && (
                              <div className="mt-3">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                  <FileText className="w-4 h-4 mr-2" />
                                  Rapport disponible
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xl font-bold text-gray-900">
                          {formatCurrency(session.opening_balance)}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xl font-bold text-gray-900">
                          {session.closing_balance ? formatCurrency(session.closing_balance) : '-'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {getDifferenceBadge(session.difference)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                              <span className="text-green-600">💵</span>
                            </span>
                            <div>
                              <div className="text-sm text-gray-500">Espèces</div>
                              <div className="font-semibold">{formatCurrency(session.total_cash_sales)}</div>
                            </div>
                          </div>
                          {session.total_cash_supplies && session.total_cash_supplies > 0 && (
                            <div className="flex items-center">
                              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3">
                                <span className="text-emerald-600">💰</span>
                              </span>
                              <div>
                                <div className="text-sm text-gray-500">Approvisionnements</div>
                                <div className="font-semibold text-emerald-600">
                                  +{formatCurrency(session.total_cash_supplies)}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center">
                            <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                              <span className="text-purple-600">📱</span>
                            </span>
                            <div>
                              <div className="text-sm text-gray-500">Mobile</div>
                              <div className="font-semibold">{formatCurrency(session.total_mobile_sales)}</div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                              <span className="text-blue-600">💳</span>
                            </span>
                            <div>
                              <div className="text-sm text-gray-500">Carte</div>
                              <div className="font-semibold">{formatCurrency(session.total_card_sales)}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm text-gray-500">Ouvert par</div>
                            <div className="font-semibold text-gray-900">{session.opened_by_email}</div>
                          </div>
                          {session.closed_by_email && (
                            <div>
                              <div className="text-sm text-gray-500">Fermé par</div>
                              <div className="font-semibold text-gray-900">{session.closed_by_email}</div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col space-y-3">
                          <button
                            onClick={() => openSessionDetails(session)}
                            className="flex items-center space-x-3 text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-4 py-3 rounded-lg transition text-lg font-medium"
                          >
                            <Eye className="w-5 h-5" />
                            <span>Détails</span>
                          </button>
                          
                          {/* Bouton pour rapport détaillé */}
                          <button
                            onClick={async () => {
                              setSelectedSession(session);
                              setShowDetailedReport(true);
                              await loadDetailedReportData(
                                session.id, 
                                session.opened_at, 
                                session.closed_at
                              );
                            }}
                            className="flex items-center space-x-3 text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-4 py-3 rounded-lg transition text-lg font-medium"
                          >
                            <List className="w-5 h-5" />
                            <span>Rapport Détaillé</span>
                          </button>
                          
                          {hasReport && (
                            <button
                              onClick={() => showFullReport(session.id)}
                              className="flex items-center space-x-3 text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-4 py-3 rounded-lg transition text-lg font-medium"
                            >
                              <Printer className="w-5 h-5" />
                              <span>Imprimer Rapport</span>
                            </button>
                          )}
                          
                          {!hasReport && session.status === 'closed' && (
                            <button
                              onClick={async () => {
                                try {
                                  const sessionDetails = generateReportFromSession(session);
                                  const printWindow = window.open('', '_blank');
                                  if (printWindow) {
                                    printWindow.document.write(sessionDetails);
                                    printWindow.document.close();
                                    setTimeout(() => {
                                      printWindow.print();
                                    }, 500);
                                  }
                                } catch (error) {
                                  console.error('Erreur génération rapport:', error);
                                  alert('❌ Erreur lors de la génération du rapport');
                                }
                              }}
                              className="flex items-center space-x-3 text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-4 py-3 rounded-lg transition text-lg font-medium"
                            >
                              <FileText className="w-5 h-5" />
                              <span>Générer Rapport</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSessions.length === 0 && (
            <div className="text-center py-16">
              <Calendar className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Aucune session trouvée</h3>
              <p className="text-gray-500 text-lg mb-8">
                {sessions.length === 0 
                  ? "Aucune session de caisse n'a été créée pour le moment."
                  : "Aucune session ne correspond à vos critères de recherche."
                }
              </p>
              <button
                onClick={clearFilters}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Système de gestion de caisse • Dernière actualisation : {new Date().toLocaleString('fr-FR')}</p>
          <p className="mt-2">
            {sessions.length} sessions au total • {reports.size} rapports disponibles • 
            Approvisionnements totaux : {formatCurrency(totalSupplies)}
          </p>
        </div>
      </div>

      {/* Modal pour les détails de session */}
      {showSessionDetails && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-8 border-b border-gray-200">
              <div>
                <h3 className="text-3xl font-bold text-gray-900">Détails de la Session</h3>
                <p className="text-gray-600 mt-2">
                  Session du {new Date(selectedSession.opened_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <button
                onClick={closeSessionDetails}
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
                        <span className="text-gray-600">Statut</span>
                        {getStatusBadge(selectedSession.status)}
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">ID Session</span>
                        <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {selectedSession.id.substring(0, 8)}...
                        </code>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Ouverte le</span>
                        <span className="font-medium">{new Date(selectedSession.opened_at).toLocaleString('fr-FR')}</span>
                      </div>
                      {selectedSession.closed_at && (
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Fermée le</span>
                          <span className="font-medium">{new Date(selectedSession.closed_at).toLocaleString('fr-FR')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Personnel</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Ouvert par</span>
                        <span className="font-medium">{selectedSession.opened_by_email}</span>
                      </div>
                      {selectedSession.closed_by_email && (
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Fermé par</span>
                          <span className="font-medium">{selectedSession.closed_by_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Finances</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Solde Ouverture</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedSession.opening_balance)}</span>
                      </div>
                      {selectedSession.total_cash_supplies && selectedSession.total_cash_supplies > 0 && (
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">➕ Approvisionnements</span>
                          <span className="font-bold text-lg text-emerald-600">
                            +{formatCurrency(selectedSession.total_cash_supplies)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">💵 Ventes Espèces</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedSession.total_cash_sales)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">➖ Dépenses</span>
                        <span className="font-bold text-lg text-red-600">
                          -{formatCurrency(selectedSession.total_expenses)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Solde Attendu</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedSession.expected_balance)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Solde Fermeture</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedSession.closing_balance)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Écart</span>
                        <div>{getDifferenceBadge(selectedSession.difference)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Ventes et Dépenses</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">💵 Espèces</span>
                        <span className="font-medium">{formatCurrency(selectedSession.total_cash_sales)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">📱 Mobile Money</span>
                        <span className="font-medium">{formatCurrency(selectedSession.total_mobile_sales)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">💳 Carte Bancaire</span>
                        <span className="font-medium">{formatCurrency(selectedSession.total_card_sales)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Total Ventes</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedSession.total_sales)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                        <span className="text-gray-600">Dépenses</span>
                        <span className="font-bold text-red-600">{formatCurrency(selectedSession.total_expenses)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedSession.notes && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedSession.notes}</p>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end space-x-4">
                <button
                  onClick={closeSessionDetails}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Fermer
                </button>
                
                <button
  onClick={async () => {
    // Ne pas fermer le modal de détails, on va le laisser ouvert
    // et ouvrir directement le rapport détaillé
    await loadDetailedReportData(
      selectedSession.id, 
      selectedSession.opened_at, 
      selectedSession.closed_at
    );
    
    // Fermer le modal de détails et ouvrir le modal de rapport détaillé
    setShowSessionDetails(false);
    setTimeout(() => {
      setShowDetailedReport(true);
    }, 100);
  }}
  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition flex items-center space-x-2"
>
  <List className="w-5 h-5" />
  <span>Rapport Détaillé</span>
</button>
                
                <button
                  onClick={() => {
                    closeSessionDetails();
                    showFullReport(selectedSession.id);
                  }}
                  disabled={!reports.has(selectedSession.id)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Rapport Simple
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour le rapport détaillé */}
      {showDetailedReport && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Rapport Détaillé de Session</h3>
                <p className="text-gray-600 mt-1">
                  Session du {new Date(selectedSession.opened_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {loadingDetailedReport && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Chargement des données...</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    const htmlContent = generateDetailedReportHTML(selectedSession, detailedReportData);
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(htmlContent);
                      printWindow.document.close();
                      setTimeout(() => {
                        printWindow.print();
                      }, 500);
                    }
                  }}
                  disabled={loadingDetailedReport}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Printer className="w-5 h-5" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setShowDetailedReport(false)}
                  className="text-gray-400 hover:text-gray-600 transition text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Aperçu du rapport</h4>
                    <p className="text-sm text-gray-600">
                      Ce rapport contient la liste complète de toutes les ventes et dépenses de la session
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-gray-500">Ventes</div>
                    <div className="font-bold">{detailedReportData.sales.length}</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-gray-500">Dépenses</div>
                    <div className="font-bold text-red-600">{detailedReportData.expenses.length}</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-gray-500">Approvisionnements</div>
                    <div className="font-bold text-emerald-600">{detailedReportData.supplies.length}</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-gray-500">Total Ventes</div>
                    <div className="font-bold">
                      {detailedReportData.sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0).toLocaleString()} f CFA
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-gray-500">Total Dépenses</div>
                    <div className="font-bold text-red-600">
                      {detailedReportData.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0).toLocaleString()} f CFA
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Printer className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Instructions d'impression</h4>
                    <ul className="text-sm text-blue-800 mt-1 space-y-1">
                      <li>• Cliquez sur "Imprimer" pour générer le rapport détaillé</li>
                      <li>• Le rapport s'ouvrira dans une nouvelle fenêtre</li>
                      <li>• Utilisez les options d'impression de votre navigateur (Ctrl+P)</li>
                      <li>• Pour un meilleur résultat, utilisez l'orientation paysage</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Prévisualisation */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2 font-medium">
                  Aperçu du contenu du rapport
                </div>
                <div className="p-4 bg-gray-900 text-gray-300 font-mono text-sm overflow-x-auto">
                  <div className="whitespace-pre">
{`LA TERRA COTTA OUAGA
RAPPORT DÉTAILLÉ DE SESSION DE CAISSE
Session du ${new Date(selectedSession.opened_at).toLocaleDateString('fr-FR')}
Statistiques: ${detailedReportData.sales.length} ventes • ${detailedReportData.expenses.length} dépenses • ${detailedReportData.supplies.length} approvisionnements
Total Ventes: ${detailedReportData.sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0).toLocaleString()} f CFA
Total Dépenses: ${detailedReportData.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0).toLocaleString()} f CFA
Solde: ${selectedSession.closing_balance ? selectedSession.closing_balance.toLocaleString() : 'En cours'} f CFA`}
                  </div>
                </div>
              </div>

              {/* Exemples de données */}
              {detailedReportData.sales.length > 0 && (
                <div className="mt-6 border rounded-lg overflow-hidden">
                  <div className="bg-emerald-800 text-white px-4 py-2 font-medium">
                    Exemple de données incluses ({detailedReportData.sales.length} ventes)
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {detailedReportData.sales.slice(0, 3).map((sale, index) => (
                        <div key={sale.id} className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <div>
                            <div className="font-medium">
                              {sale.order_number || `Commande #${sale.id.slice(-8)}`}
                            </div>
                            <div className="text-sm text-gray-600">
                              {new Date(sale.created_at).toLocaleTimeString('fr-FR')} • 
                              {sale.payment_method === 'cash' ? ' 💵 Espèces' : 
                               sale.payment_method === 'mobile_money' ? ' 📱 Mobile' : ' 💳 Carte'}
                            </div>
                          </div>
                          <div className="font-bold">
                            {sale.total_amount.toLocaleString()} f CFA
                          </div>
                        </div>
                      ))}
                      {detailedReportData.sales.length > 3 && (
                        <div className="text-center text-gray-500 text-sm mt-2">
                          ... et {detailedReportData.sales.length - 3} autres ventes
                        </div>
                      )}
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
