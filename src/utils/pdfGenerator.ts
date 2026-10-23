// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Interface pour les articles de commande
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
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
  items: OrderItem[];
}

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

interface DateRange {
  startDate: string;
  endDate: string;
}

interface TimeRange {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  notes?: string;
  expense_categories?: {
    name: string;
  };
  expense_category_type?: 'fixed' | 'current';
  is_recurring?: boolean;
  recurrence_frequency?: string;
}

interface SupplierOrder {
  id: string;
  order_number: string;
  total_amount: number;
  order_date: string;
  status: string;
  suppliers?: {
    name: string;
  };
  supplier_order_payments?: any[];
}

interface SupplierPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  supplier_orders?: {
    order_number: string;
    total_amount: number;
    suppliers?: {
      name: string;
    };
  };
}

export class PDFGenerator {
  // Méthodes manquantes à ajouter
  static async generateSalesReportPDF(
    sales: OrderWithItems[],
    totalSales: number,
    salesCount: number,
    dateRange: DateRange,
    timeRange: TimeRange,
    paymentMethodFilter: string,
    sortOrder: string
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT DES VENTES', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} ${timeRange.startHour}:${timeRange.startMinute} à ${dateRange.endDate} ${timeRange.endHour}:${timeRange.endMinute}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Filtre: ${paymentMethodFilter === 'all' ? 'Toutes méthodes' : this.getPaymentMethodText(paymentMethodFilter)}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Tri: ${sortOrder === 'desc' ? 'Plus récent au plus ancien' : 'Plus ancien au plus récent'}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Statistiques
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('STATISTIQUES', 15, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre de commandes: ${salesCount}`, 20, currentY);
    currentY += 6;
    pdf.text(`Chiffre d'affaires total: ${this.formatNumber(totalSales)} f CFA`, 20, currentY);
    currentY += 6;
    pdf.text(`Moyenne par commande: ${salesCount > 0 ? this.formatNumber(totalSales / salesCount) : 0} f CFA`, 20, currentY);
    currentY += 15;

    // Tableau des ventes
    if (sales.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DÉTAIL DES COMMANDES', 15, currentY);
      currentY += 10;

      const tableData = sales.map(sale => [
        sale.order_number || `#${sale.id.slice(-8)}`,
        new Date(sale.created_at).toLocaleDateString('fr-FR'),
        new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        sale.table_number || '-',
        this.getPaymentMethodText(sale.payment_method || ''),
        sale.server_name || '-',
        `${this.formatNumber(sale.total_amount || 0)} f CFA`
      ]);

      const tableHeaders = ['N° Cde', 'Date', 'Heure', 'Table', 'Paiement', 'Serveur', 'Montant'];

      // Utiliser autoTable si disponible, sinon créer un tableau simple
      try {
        // @ts-ignore - autoTable est ajouté via jsPDF plugin
        pdf.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });

        // @ts-ignore
        currentY = pdf.lastAutoTable.finalY + 10;
      } catch (error) {
        // Fallback si autoTable n'est pas disponible
        this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
        currentY += tableData.length * 7 + 20;
      }
    } else {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune vente trouvée avec les filtres actuels', 15, currentY);
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, 280, { align: 'center' });
    pdf.text(`Page 1/1`, pageWidth / 2, 285, { align: 'center' });

    pdf.save(`ventes-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  static async generateExpensesReportPDF(
    expenses: Expense[],
    totalExpenses: number,
    expenseType: string,
    dateRange: DateRange,
    reportData?: ReportData
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`RAPPORT DES DÉPENSES ${expenseType.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} à ${dateRange.endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Type: ${expenseType}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Statistiques
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('STATISTIQUES', 15, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre de dépenses: ${expenses.length}`, 20, currentY);
    currentY += 6;
    pdf.text(`Total des dépenses: ${this.formatNumber(totalExpenses)} f CFA`, 20, currentY);
    currentY += 6;
    
    if (reportData) {
      const expensePercentage = reportData.totalExpenses > 0 ? 
        (totalExpenses / reportData.totalExpenses) * 100 : 0;
      pdf.text(`Pourcentage du total: ${expensePercentage.toFixed(1)}%`, 20, currentY);
      currentY += 6;
    }
    
    pdf.text(`Moyenne par dépense: ${expenses.length > 0 ? this.formatNumber(totalExpenses / expenses.length) : 0} f CFA`, 20, currentY);
    currentY += 15;

    // Tableau des dépenses
    if (expenses.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DÉTAIL DES DÉPENSES', 15, currentY);
      currentY += 10;

      const tableData = expenses.map(expense => [
        new Date(expense.expense_date).toLocaleDateString('fr-FR'),
        expense.description.substring(0, 30) + (expense.description.length > 30 ? '...' : ''),
        expense.expense_categories?.name || '-',
        expense.payment_method === 'cash' ? 'Espèces' : 
        expense.payment_method === 'mobile_money' ? 'Mobile Money' : 
        expense.payment_method === 'bank_transfer' ? 'Virement' : 'Chèque',
        expense.is_recurring ? 'Oui' : 'Non',
        `${this.formatNumber(expense.amount)} f CFA`
      ]);

      const tableHeaders = ['Date', 'Description', 'Catégorie', 'Paiement', 'Récurrent', 'Montant'];

      try {
        // @ts-ignore
        pdf.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: expenseType === 'Courantes' ? [59, 130, 246] : [139, 92, 246], textColor: [255, 255, 255] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });

        // @ts-ignore
        currentY = pdf.lastAutoTable.finalY + 10;
      } catch (error) {
        this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
        currentY += tableData.length * 7 + 20;
      }

      // Notes détaillées (si peu de dépenses)
      if (expenses.length <= 10) {
        const expensesWithNotes = expenses.filter(e => e.notes);
        if (expensesWithNotes.length > 0) {
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text('NOTES DÉTAILLÉES', 15, currentY);
          currentY += 10;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          expensesWithNotes.forEach(expense => {
            if (currentY > 270) {
              pdf.addPage();
              currentY = 20;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${expense.description.substring(0, 20)}...`, 15, currentY);
            currentY += 5;
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Notes: ${expense.notes}`, 20, currentY);
            currentY += 8;
          });
        }
      }
    } else {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune dépense trouvée pour cette période', 15, currentY);
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`depenses-${expenseType.toLowerCase()}-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  static async generateSupplierOrdersReportPDF(
    orders: SupplierOrder[],
    reportData: ReportData,
    dateRange: DateRange
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT DES COMMANDES FOURNISSEURS', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} à ${dateRange.endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Statistiques
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('STATISTIQUES', 15, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total commandes: ${reportData.supplierOrdersCount}`, 20, currentY);
    currentY += 6;
    pdf.text(`Montant total: ${this.formatNumber(reportData.totalSupplierOrders)} f CFA`, 20, currentY);
    currentY += 6;
    pdf.text(`Commandes payées: ${reportData.paidSupplierOrdersCount} (${this.formatNumber(reportData.totalPaidSupplierOrders)} f CFA)`, 20, currentY);
    currentY += 6;
    pdf.text(`Commandes impayées: ${reportData.unpaidSupplierOrdersCount} (${this.formatNumber(reportData.totalUnpaidSupplierOrders)} f CFA)`, 20, currentY);
    currentY += 6;
    pdf.text(`Commandes partiellement payées: ${reportData.partiallyPaidSupplierOrdersCount} (${this.formatNumber(reportData.totalPartiallyPaidSupplierOrders)} f CFA)`, 20, currentY);
    currentY += 15;

    // Tableau des commandes
    if (orders.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DÉTAIL DES COMMANDES', 15, currentY);
      currentY += 10;

      const tableData = orders.map(order => {
        const totalPaid = order.supplier_order_payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        const status = totalPaid >= (order.total_amount || 0) ? 'Payée' : 
                      totalPaid > 0 ? `${Math.round((totalPaid / (order.total_amount || 1)) * 100)}%` : 'Impayée';
        
        return [
          order.order_number || `#${order.id.slice(-8)}`,
          new Date(order.order_date).toLocaleDateString('fr-FR'),
          order.suppliers?.name || '-',
          this.getStatusText(order.status),
          status,
          `${this.formatNumber(order.total_amount || 0)} f CFA`,
          `${this.formatNumber(totalPaid)} f CFA`,
          `${this.formatNumber(Math.max(0, (order.total_amount || 0) - totalPaid))} f CFA`
        ];
      });

      const tableHeaders = ['N° Cde', 'Date', 'Fournisseur', 'Statut', 'Paiement', 'Total', 'Payé', 'Reste'];

      try {
        // @ts-ignore
        pdf.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });

        // @ts-ignore
        currentY = pdf.lastAutoTable.finalY + 10;
      } catch (error) {
        this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
        currentY += tableData.length * 7 + 20;
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`commandes-fournisseurs-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  static async generateSupplierPaymentsReportPDF(
    payments: SupplierPayment[],
    reportData: ReportData,
    dateRange: DateRange
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT DES PAIEMENTS FOURNISSEURS', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} à ${dateRange.endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Total paiements: ${this.formatNumber(reportData.totalSupplierPayments)} f CFA`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Tableau des paiements
    if (payments.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DÉTAIL DES PAIEMENTS', 15, currentY);
      currentY += 10;

      const tableData = payments.map(payment => [
        new Date(payment.payment_date).toLocaleDateString('fr-FR'),
        payment.supplier_orders?.order_number || '-',
        payment.supplier_orders?.suppliers?.name || '-',
        this.getPaymentMethodText(payment.payment_method),
        payment.reference_number || '-',
        `${this.formatNumber(payment.amount)} f CFA`,
        payment.supplier_orders?.total_amount ? 
          `${Math.round((payment.amount / payment.supplier_orders.total_amount) * 100)}%` : '100%'
      ]);

      const tableHeaders = ['Date', 'N° Cde', 'Fournisseur', 'Méthode', 'Référence', 'Montant', '% Cde'];

      try {
        // @ts-ignore
        pdf.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });

        // @ts-ignore
        currentY = pdf.lastAutoTable.finalY + 10;
      } catch (error) {
        this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
        currentY += tableData.length * 7 + 20;
      }
    } else {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucun paiement fournisseur trouvé pour cette période', 15, currentY);
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`paiements-fournisseurs-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  static async generateSalesByPaymentMethodPDF(
    sales: OrderWithItems[],
    dateRange: DateRange,
    timeRange: TimeRange,
    paymentMethodFilter: string,
    sortOrder: string
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('VENTES PAR MÉTHODE DE PAIEMENT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} ${timeRange.startHour}:${timeRange.startMinute} à ${dateRange.endDate} ${timeRange.endHour}:${timeRange.endMinute}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Analyse par méthode de paiement
    const paymentMethods: { [key: string]: { count: number; total: number } } = {};
    let overallTotal = 0;

    sales.forEach(sale => {
      const method = sale.payment_method || 'unknown';
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 };
      }
      paymentMethods[method].count++;
      paymentMethods[method].total += sale.total_amount || 0;
      overallTotal += sale.total_amount || 0;
    });

    // Statistiques
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RÉPARTITION PAR MÉTHODE DE PAIEMENT', 15, currentY);
    currentY += 15;

    Object.entries(paymentMethods).forEach(([method, data]) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      const percentage = overallTotal > 0 ? (data.total / overallTotal) * 100 : 0;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(this.getPaymentMethodText(method), 20, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${data.count} commande(s)`, 80, currentY);
      pdf.text(`${this.formatNumber(data.total)} f CFA`, 120, currentY);
      pdf.text(`${percentage.toFixed(1)}%`, pageWidth - 20, currentY, { align: 'right' });
      
      currentY += 8;

      // Barre de progression visuelle
      const barWidth = (percentage / 100) * 100;
      pdf.setFillColor(59, 130, 246);
      pdf.rect(20, currentY, barWidth, 4, 'F');
      currentY += 8;
    });

    currentY += 5;

    // Total
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL GÉNÉRAL', 20, currentY);
    pdf.text(`${this.formatNumber(overallTotal)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
    currentY += 8;
    pdf.text(`${sales.length} commande(s)`, 20, currentY);
    currentY += 15;

    // Détail des ventes (premières 50 commandes)
    if (sales.length > 0) {
      const maxRows = Math.min(50, sales.length);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`DÉTAIL DES VENTES (${maxRows} premières)`, 15, currentY);
      currentY += 10;

      const tableData = sales.slice(0, maxRows).map(sale => [
        sale.order_number || `#${sale.id.slice(-8)}`,
        new Date(sale.created_at).toLocaleDateString('fr-FR'),
        new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        sale.table_number || '-',
        this.getPaymentMethodText(sale.payment_method || ''),
        sale.server_name || '-',
        `${this.formatNumber(sale.total_amount || 0)} f CFA`
      ]);

      const tableHeaders = ['N° Cde', 'Date', 'Heure', 'Table', 'Paiement', 'Serveur', 'Montant'];

      try {
        // @ts-ignore
        pdf.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });
      } catch (error) {
        this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`ventes-paiement-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  static async generateCompleteReportPDF(
    reportData: ReportData,
    detailedData: any,
    dateRange: DateRange,
    timeRange: TimeRange,
    currentExpenses: Expense[],
    fixedExpenses: Expense[],
    expensesByType: any
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT COMPLET DU RESTAURANT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} ${timeRange.startHour}:${timeRange.startMinute} à ${dateRange.endDate} ${timeRange.endHour}:${timeRange.endMinute}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // Table des matières
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TABLE DES MATIÈRES', 15, currentY);
    currentY += 10;

    const sections = [
      '1. SYNTHÈSE FINANCIÈRE',
      '2. DÉTAIL DES VENTES',
      '3. DÉTAIL DES DÉPENSES',
      '4. COMMANDES FOURNISSEURS',
      '5. PAIEMENTS FOURNISSEURS'
    ];

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    sections.forEach((section, index) => {
      pdf.text(section, 20, currentY);
      pdf.text(`Page ${index + 2}`, pageWidth - 20, currentY, { align: 'right' });
      currentY += 7;
    });

    currentY += 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Note: Ce rapport contient toutes les données financières pour la période spécifiée.', 15, currentY);

    // Ajouter les sections suivantes sur des pages séparées
    const sectionsData = [
      { title: 'SYNTHÈSE FINANCIÈRE', content: () => this.addFinancialSummary(pdf, reportData, pageWidth) },
      { title: 'DÉTAIL DES VENTES', content: () => this.addSalesSummary(pdf, detailedData.sales, pageWidth) },
      { title: 'DÉTAIL DES DÉPENSES', content: () => this.addExpensesSummary(pdf, currentExpenses, fixedExpenses, pageWidth) },
      { title: 'COMMANDES FOURNISSEURS', content: () => this.addSupplierOrdersSummary(pdf, detailedData.supplierOrders, pageWidth) },
      { title: 'PAIEMENTS FOURNISSEURS', content: () => this.addSupplierPaymentsSummary(pdf, detailedData.supplierPayments, pageWidth) }
    ];

    sectionsData.forEach((section, index) => {
      pdf.addPage();
      currentY = 20;
      
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(section.title, 15, currentY);
      currentY += 15;

      section.content();
    });

    // Footer final
    pdf.addPage();
    currentY = 50;
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FIN DU RAPPORT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Ce rapport a été généré automatiquement par le système de gestion du restaurant.', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;
    pdf.text('Pour toute question, veuillez contacter l\'administration.', pageWidth / 2, currentY, { align: 'center' });

    // Ajouter les numéros de page sur toutes les pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} / ${totalPages}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`rapport-complet-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  private static addFinancialSummary(pdf: jsPDF, reportData: ReportData, pageWidth: number): void {
    let currentY = 40;

    // Cartes de synthèse
    const summaryCards = [
      { title: 'Ventes Totales', value: reportData.totalSales, color: [16, 185, 129] },
      { title: 'Dépenses Totales', value: reportData.totalExpenses, color: [239, 68, 68] },
      { title: 'Profit Net', value: reportData.netProfit, color: reportData.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { title: 'Marge', value: reportData.profitMargin, suffix: '%', color: reportData.profitMargin >= 0 ? [16, 185, 129] : [239, 68, 68] }
    ];

    summaryCards.forEach((card, index) => {
      const x = index % 2 === 0 ? 20 : pageWidth / 2;
      const y = currentY + (index >= 2 ? 30 : 0);
      
      // Carte
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(x, y, 75, 25, 3, 3, 'F');
      
      // Titre
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(card.title, x + 5, y + 8);
      
      // Valeur
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(card.color[0], card.color[1], card.color[2]);
      pdf.text(`${this.formatNumber(card.value)}${card.suffix || ' f CFA'}`, x + 5, y + 18);
      
      pdf.setTextColor(0, 0, 0);
    });

    currentY += 60;

    // Répartition des dépenses
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RÉPARTITION DES DÉPENSES', 20, currentY);
    currentY += 15;

    const expenseTypes = [
      { label: 'Dépenses Courantes', amount: reportData.totalCurrentExpenses, color: [59, 130, 246] },
      { label: 'Dépenses Fixes', amount: reportData.totalFixedExpenses, color: [139, 92, 246] },
      { label: 'Paiements Fournisseurs', amount: reportData.totalSupplierPayments, color: [245, 158, 11] }
    ];

    const totalExpenses = expenseTypes.reduce((sum, type) => sum + type.amount, 0);

    expenseTypes.forEach((type, index) => {
      const percentage = totalExpenses > 0 ? (type.amount / totalExpenses) * 100 : 0;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(type.label, 25, currentY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${this.formatNumber(type.amount)} f CFA`, pageWidth - 80, currentY);
      pdf.text(`${percentage.toFixed(1)}%`, pageWidth - 20, currentY, { align: 'right' });
      
      // Barre
      const barWidth = (percentage / 100) * 150;
      pdf.setFillColor(type.color[0], type.color[1], type.color[2]);
      pdf.rect(25, currentY + 2, barWidth, 4, 'F');
      
      currentY += 10;
    });

    // Total
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL DÉPENSES', 25, currentY);
    pdf.text(`${this.formatNumber(totalExpenses)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
  }

  private static addSalesSummary(pdf: jsPDF, sales: any[], pageWidth: number): void {
    let currentY = 40;

    if (sales.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune vente pour cette période', 20, currentY);
      return;
    }

    // Statistiques
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const avgSale = sales.length > 0 ? totalSales / sales.length : 0;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre de commandes: ${sales.length}`, 20, currentY);
    currentY += 7;
    pdf.text(`Chiffre d'affaires total: ${this.formatNumber(totalSales)} f CFA`, 20, currentY);
    currentY += 7;
    pdf.text(`Moyenne par commande: ${this.formatNumber(avgSale)} f CFA`, 20, currentY);
    currentY += 15;

    // Tableau récapitulatif (10 premières commandes)
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('10 DERNIÈRES COMMANDES', 20, currentY);
    currentY += 10;

    const recentSales = sales.slice(0, 10);
    const tableData = recentSales.map(sale => [
      sale.order_number || `#${sale.id.slice(-8)}`,
      new Date(sale.created_at).toLocaleDateString('fr-FR'),
      new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      this.getPaymentMethodText(sale.payment_method || ''),
      `${this.formatNumber(sale.total_amount || 0)} f CFA`
    ]);

    const tableHeaders = ['N° Cde', 'Date', 'Heure', 'Paiement', 'Montant'];

    try {
      // @ts-ignore
      pdf.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        margin: { left: 20, right: 20 }
      });
    } catch (error) {
      this.addSimpleTable(pdf, tableHeaders, tableData, currentY, pageWidth);
    }
  }

  private static addExpensesSummary(pdf: jsPDF, currentExpenses: Expense[], fixedExpenses: Expense[], pageWidth: number): void {
    let currentY = 40;

    // Dépenses courantes
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DÉPENSES COURANTES', 20, currentY);
    currentY += 10;

    if (currentExpenses.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune dépense courante', 25, currentY);
      currentY += 15;
    } else {
      const totalCurrent = currentExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nombre: ${currentExpenses.length}`, 25, currentY);
      currentY += 6;
      pdf.text(`Total: ${this.formatNumber(totalCurrent)} f CFA`, 25, currentY);
      currentY += 6;
      pdf.text(`Moyenne: ${this.formatNumber(currentExpenses.length > 0 ? totalCurrent / currentExpenses.length : 0)} f CFA`, 25, currentY);
      currentY += 15;

      // 5 dépenses courantes les plus importantes
      const topCurrent = [...currentExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
      pdf.setFont('helvetica', 'bold');
      pdf.text('5 DÉPENSES COURANTES LES PLUS IMPORTANTES', 25, currentY);
      currentY += 10;

      topCurrent.forEach(expense => {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const desc = expense.description.length > 30 ? expense.description.substring(0, 27) + '...' : expense.description;
        pdf.text(desc, 30, currentY);
        pdf.text(`${this.formatNumber(expense.amount)} f CFA`, pageWidth - 25, currentY, { align: 'right' });
        currentY += 6;
      });
      currentY += 10;
    }

    // Dépenses fixes
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DÉPENSES FIXES', 20, currentY);
    currentY += 10;

    if (fixedExpenses.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune dépense fixe', 25, currentY);
    } else {
      const totalFixed = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const recurring = fixedExpenses.filter(e => e.is_recurring).length;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nombre: ${fixedExpenses.length} (dont ${recurring} récurrentes)`, 25, currentY);
      currentY += 6;
      pdf.text(`Total: ${this.formatNumber(totalFixed)} f CFA`, 25, currentY);
      currentY += 6;
      pdf.text(`Moyenne: ${this.formatNumber(fixedExpenses.length > 0 ? totalFixed / fixedExpenses.length : 0)} f CFA`, 25, currentY);
    }
  }

  private static addSupplierOrdersSummary(pdf: jsPDF, orders: any[], pageWidth: number): void {
    let currentY = 40;

    if (orders.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucune commande fournisseur', 20, currentY);
      return;
    }

    // Statistiques
    const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const paidOrders = orders.filter(order => {
      const totalPaid = order.supplier_order_payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      return totalPaid >= (order.total_amount || 0);
    });
    const unpaidOrders = orders.filter(order => {
      const totalPaid = order.supplier_order_payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      return totalPaid === 0;
    });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre total de commandes: ${orders.length}`, 20, currentY);
    currentY += 6;
    pdf.text(`Montant total: ${this.formatNumber(totalAmount)} f CFA`, 20, currentY);
    currentY += 6;
    pdf.text(`Commandes payées: ${paidOrders.length}`, 20, currentY);
    currentY += 6;
    pdf.text(`Commandes impayées: ${unpaidOrders.length}`, 20, currentY);
    currentY += 15;

    // 5 commandes les plus importantes
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('5 COMMANDES LES PLUS IMPORTANTES', 20, currentY);
    currentY += 10;

    const topOrders = [...orders].sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0)).slice(0, 5);
    
    topOrders.forEach(order => {
      const totalPaid = order.supplier_order_payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const status = totalPaid >= (order.total_amount || 0) ? 'Payée' : 
                    totalPaid > 0 ? 'Partielle' : 'Impayée';
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${order.order_number || 'N/A'} - ${order.suppliers?.name || 'Fournisseur inconnu'}`, 25, currentY);
      pdf.text(`${this.formatNumber(order.total_amount || 0)} f CFA (${status})`, pageWidth - 25, currentY, { align: 'right' });
      currentY += 6;
    });
  }

  private static addSupplierPaymentsSummary(pdf: jsPDF, payments: any[], pageWidth: number): void {
    let currentY = 40;

    if (payments.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Aucun paiement fournisseur', 20, currentY);
      return;
    }

    // Statistiques
    const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const paymentMethods: { [key: string]: { count: number; total: number } } = {};

    payments.forEach(payment => {
      const method = payment.payment_method || 'inconnu';
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 };
      }
      paymentMethods[method].count++;
      paymentMethods[method].total += payment.amount || 0;
    });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre total de paiements: ${payments.length}`, 20, currentY);
    currentY += 6;
    pdf.text(`Montant total payé: ${this.formatNumber(totalPayments)} f CFA`, 20, currentY);
    currentY += 15;

    // Répartition par méthode de paiement
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RÉPARTITION PAR MÉTHODE DE PAIEMENT', 20, currentY);
    currentY += 10;

    Object.entries(paymentMethods).forEach(([method, data]) => {
      const percentage = totalPayments > 0 ? (data.total / totalPayments) * 100 : 0;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(this.getPaymentMethodText(method), 25, currentY);
      pdf.text(`${data.count} paiement(s)`, 100, currentY);
      pdf.text(`${this.formatNumber(data.total)} f CFA`, 140, currentY);
      pdf.text(`${percentage.toFixed(1)}%`, pageWidth - 25, currentY, { align: 'right' });
      
      currentY += 8;
    });
  }

  // Méthodes auxiliaires existantes (garder celles qui existent déjà)
  private static addSimpleTable(pdf: jsPDF, headers: string[], data: any[][], startY: number, pageWidth: number): number {
    let currentY = startY;
    
    // Headers
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    headers.forEach((header, index) => {
      const x = 15 + index * 30;
      pdf.text(header, x, currentY);
    });
    
    currentY += 5;
    pdf.line(15, currentY, pageWidth - 15, currentY);
    currentY += 3;
    
    // Data
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    data.forEach(row => {
      if (currentY > 270) {
        pdf.addPage();
        currentY = 20;
      }
      
      row.forEach((cell, index) => {
        const x = 15 + index * 30;
        pdf.text(cell.toString(), x, currentY);
      });
      
      currentY += 5;
    });
    
    return currentY;
  }

  private static addHeader(pdf: jsPDF, title: string, pageWidth: number): void {
    // Logo et titre
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, 20, { align: 'center' });

    // Ligne de séparation
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, 30, pageWidth - 10, 30);

    // Date de génération
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Généré le ${date}`, pageWidth - 10, 40, { align: 'right' });

    // Réinitialiser la position Y
    pdf.setFontSize(12);
  }

  // Fonction pour formater les nombres sans séparateur de milliers
  private static formatNumber(num: number): string {
    if (num === null || num === undefined) return '0';
    return num.toString();
  }

  private static getPaymentMethodText(method: string): string {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte';
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Virement';
      case 'check': return 'Chèque';
      default: return method;
    }
  }

  private static getStatusText(status: string): string {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'ordered': return 'Commandée';
      case 'received': return 'Reçue';
      case 'partial': return 'Partielle';
      case 'cancelled': return 'Annulée';
      case 'pending': return 'En attente';
      default: return status;
    }
  }

  static async generateDetailedReportPDF(
    reportData: any,
    detailedData: any,
    dateRange: { startDate: string; endDate: string },
    type: 'summary' | 'sales' | 'expenses' | 'supplier-orders' | 'kitchen-bar'
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT DÉTAILLÉ DU RESTAURANT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Période: ${dateRange.startDate} à ${dateRange.endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // Contenu selon le type
    switch (type) {
      case 'summary':
        this.addSummaryContent(pdf, reportData, pageWidth, currentY);
        break;
      case 'sales':
        this.addSalesContent(pdf, detailedData.sales, pageWidth, currentY);
        break;
      case 'expenses':
        this.addExpensesContent(pdf, detailedData.expenses, pageWidth, currentY);
        break;
      case 'supplier-orders':
        this.addSupplierOrdersContent(pdf, detailedData.supplierOrders, pageWidth, currentY);
        break;
      case 'kitchen-bar':
        this.addKitchenBarContent(pdf, detailedData, pageWidth, currentY);
        break;
    }

    // Footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    pdf.save(`rapport-${type}-${dateRange.startDate}-${dateRange.endDate}.pdf`);
  }

  private static addSummaryContent(pdf: jsPDF, reportData: any, pageWidth: number, startY: number): void {
    let currentY = startY;

    // Cartes de résumé
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SYNTHÈSE FINANCIÈRE', 15, currentY);
    currentY += 15;

    const cards = [
      { title: 'Ventes Totales', value: reportData.totalSales, suffix: 'f CFA', count: reportData.salesCount },
      { title: 'Dépenses Totales', value: reportData.totalExpenses + reportData.totalSupplierOrders, suffix: 'f CFA', count: reportData.expensesCount + reportData.supplierOrdersCount },
      { title: 'Profit Net', value: reportData.netProfit, suffix: 'f CFA', isProfit: true },
      { title: 'Marge Bénéficiaire', value: reportData.profitMargin, suffix: '%', isProfit: true }
    ];

    cards.forEach((card, index) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      const x = index % 2 === 0 ? 15 : pageWidth / 2 + 5;
      if (index % 2 === 0 && index > 0) currentY += 35;

      this.addSummaryCard(pdf, card, x, currentY);
    });

    currentY += 45;

    // Détail des dépenses
    if (currentY > 200) {
      pdf.addPage();
      currentY = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DÉTAIL DES DÉPENSES', 15, currentY);
    currentY += 15;

    const expenses = [
      { label: 'Dépenses Directes', amount: reportData.totalExpenses, count: reportData.expensesCount },
      { label: 'Commandes Fournisseurs', amount: reportData.totalSupplierOrders, count: reportData.supplierOrdersCount }
    ];

    const totalExpenses = reportData.totalExpenses + reportData.totalSupplierOrders;

    expenses.forEach(expense => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      const percentage = totalExpenses > 0 ? (expense.amount / totalExpenses) * 100 : 0;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(expense.label, 20, currentY);
      pdf.text(`${this.formatNumber(expense.amount)} f CFA`, pageWidth - 60, currentY, { align: 'right' });
      pdf.text(`${expense.count} item(s)`, pageWidth - 20, currentY, { align: 'right' });
      currentY += 6;
      pdf.text(`(${percentage.toFixed(1)}% du total)`, 20, currentY);
      currentY += 10;
    });

    // Ligne totale
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL DÉPENSES', 20, currentY);
    pdf.text(`${this.formatNumber(totalExpenses)} f CFA`, pageWidth - 60, currentY, { align: 'right' });
    pdf.text(`${reportData.expensesCount + reportData.supplierOrdersCount} item(s)`, pageWidth - 20, currentY, { align: 'right' });
  }

  private static addSummaryCard(pdf: jsPDF, card: any, x: number, y: number): void {
    // Fond de la carte
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(x, y, 80, 30, 3, 3, 'F');
    
    // Bordure
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, y, 80, 30, 3, 3, 'D');

    // Titre
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(card.title, x + 5, y + 8);

    // Valeur - CORRECTION : Utiliser setTextColor avec des nombres purs
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    // Définir la couleur en fonction du profit
    if (card.isProfit) {
      if (card.value >= 0) {
        pdf.setTextColor(16, 185, 129); // Vert pour profit positif
      } else {
        pdf.setTextColor(239, 68, 68); // Rouge pour profit négatif
      }
    } else {
      pdf.setTextColor(15, 23, 42); // Noir par défaut
    }
    
    pdf.text(`${this.formatNumber(card.value)} ${card.suffix}`, x + 5, y + 18);

    // Count si disponible
    if (card.count !== undefined) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${card.count} item(s)`, x + 5, y + 24);
    }

    // Réinitialiser la couleur du texte pour les prochains éléments
    pdf.setTextColor(0, 0, 0);
  }

  private static addSalesContent(pdf: jsPDF, sales: OrderWithItems[], pageWidth: number, startY: number): void {
    let currentY = startY;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DÉTAIL DES VENTES AVEC ARTICLES', 15, currentY);
    currentY += 10;

    if (sales.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Aucune vente enregistrée pour cette période.', 15, currentY);
      return;
    }

    sales.forEach((sale, index) => {
      // Vérifier si on doit ajouter une nouvelle page
      if (currentY > 200) {
        pdf.addPage();
        currentY = 20;
      }

      // En-tête de la commande
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Commande ${sale.order_number || `#${sale.id.slice(-8)}`}`, 15, currentY);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Date: ${new Date(sale.created_at).toLocaleDateString('fr-FR')}`, 15, currentY + 5);
      pdf.text(`Table: ${sale.table_number || 'N/A'}`, 60, currentY + 5);
      pdf.text(`Type: ${sale.order_type || 'Sur place'}`, 100, currentY + 5);
      
      if (sale.server_name) {
        pdf.text(`Serveur: ${sale.server_name}`, 140, currentY + 5);
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Total: ${this.formatNumber(sale.total_amount || 0)} f CFA`, pageWidth - 20, currentY, { align: 'right' });

      currentY += 12;

      // Détails des articles
      if (sale.items && sale.items.length > 0) {
        // En-tête du tableau des articles
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 116, 139);
        
        pdf.text('Article', 20, currentY);
        pdf.text('Qté', 100, currentY);
        pdf.text('Prix U.', 120, currentY);
        pdf.text('Total', pageWidth - 20, currentY, { align: 'right' });
        
        currentY += 5;
        
        // Ligne de séparation
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, currentY, pageWidth - 15, currentY);
        currentY += 3;

        // Articles
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(15, 23, 42);

        sale.items.forEach((item: OrderItem) => {
          if (currentY > 250) {
            pdf.addPage();
            currentY = 20;
            
            // Ré-afficher l'en-tête du tableau sur la nouvelle page
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            pdf.text('Article', 20, currentY);
            pdf.text('Qté', 100, currentY);
            pdf.text('Prix U.', 120, currentY);
            pdf.text('Total', pageWidth - 20, currentY, { align: 'right' });
            currentY += 8;
          }

          // Nom de l'article (avec troncature si trop long)
          const itemName = item.item_name.length > 40 ? item.item_name.substring(0, 37) + '...' : item.item_name;
          pdf.text(itemName, 20, currentY);
          
          // Quantité
          pdf.text(item.quantity.toString(), 100, currentY);
          
          // Prix unitaire
          pdf.text(`${this.formatNumber(item.unit_price)} f CFA`, 120, currentY);
          
          // Prix total
          pdf.text(`${this.formatNumber(item.total_price)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
          
          currentY += 5;

          // Informations supplémentaires sur l'article
          if (item.category || item.status !== 'served') {
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            
            let extraInfo = '';
            if (item.category) extraInfo += `Cat: ${item.category}`;
            if (item.status !== 'served') {
              if (extraInfo) extraInfo += ' • ';
              extraInfo += `Statut: ${item.status}`;
            }
            
            if (extraInfo) {
              pdf.text(extraInfo, 22, currentY);
              currentY += 4;
            }
            
            pdf.setFontSize(8);
            pdf.setTextColor(15, 23, 42);
          }

          // Notes
          if (item.kitchen_note) {
            pdf.setFontSize(7);
            pdf.setTextColor(245, 158, 11); // Orange pour les notes cuisine
            pdf.text(`🍳 ${item.kitchen_note}`, 22, currentY);
            currentY += 4;
            pdf.setFontSize(8);
            pdf.setTextColor(15, 23, 42);
          }

          if (item.bar_note) {
            pdf.setFontSize(7);
            pdf.setTextColor(59, 130, 246); // Bleu pour les notes bar
            pdf.text(`🍸 ${item.bar_note}`, 22, currentY);
            currentY += 4;
            pdf.setFontSize(8);
            pdf.setTextColor(15, 23, 42);
          }

          currentY += 2;
        });

        // Sous-totaux de la commande
        currentY += 3;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, currentY, pageWidth - 15, currentY);
        currentY += 5;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        
        if (sale.subtotal) {
          pdf.text(`Sous-total: ${this.formatNumber(sale.subtotal)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
          currentY += 4;
        }
        
        if (sale.tax_amount && sale.tax_amount > 0) {
          pdf.text(`Taxe: ${this.formatNumber(sale.tax_amount)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
          currentY += 4;
        }
        
        if (sale.delivery_fee && sale.delivery_fee > 0) {
          pdf.text(`Livraison: ${this.formatNumber(sale.delivery_fee)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
          currentY += 4;
        }

        pdf.setFontSize(10);
        pdf.setTextColor(16, 185, 129); // Vert pour le total
        pdf.text(`TOTAL: ${this.formatNumber(sale.total_amount || 0)} f CFA`, pageWidth - 20, currentY, { align: 'right' });
        pdf.setTextColor(15, 23, 42);
        
        currentY += 8;
      } else {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Aucun article dans cette commande', 20, currentY);
        currentY += 8;
      }

      // Notes de la commande
      if (sale.notes) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Notes commande: ${sale.notes}`, 20, currentY);
        currentY += 6;
      }

      // Ligne de séparation entre les commandes
      if (index < sales.length - 1) {
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, currentY, pageWidth - 15, currentY);
        currentY += 10;
      }
    });

    // Résumé total des ventes
    if (currentY > 220) {
      pdf.addPage();
      currentY = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RÉSUMÉ DES VENTES', 15, currentY);
    currentY += 10;

    const totalArticles = sales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre total de commandes: ${sales.length}`, 20, currentY);
    currentY += 6;
    pdf.text(`Nombre total d'articles vendus: ${totalArticles}`, 20, currentY);
    currentY += 6;
    pdf.text(`Chiffre d'affaires total: ${this.formatNumber(totalRevenue)} f CFA`, 20, currentY);
  }

  private static addExpensesContent(pdf: jsPDF, expenses: any[], pageWidth: number, startY: number): void {
    let currentY = startY;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DÉTAIL DES DÉPENSES', 15, currentY);
    currentY += 10;

    if (expenses.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Aucune dépense enregistrée pour cette période.', 15, currentY);
      return;
    }

    expenses.forEach((expense, index) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(expense.description || 'Dépense sans description', 15, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${new Date(expense.expense_date).toLocaleDateString('fr-FR')}`, 15, currentY + 6);
      pdf.text(`Méthode: ${expense.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}`, 80, currentY + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Montant: ${this.formatNumber(expense.amount)} f CFA`, pageWidth - 20, currentY, { align: 'right' });

      currentY += 15;

      if (expense.notes) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`Notes: ${expense.notes}`, 15, currentY);
        currentY += 8;
      }

      // Ligne de séparation
      if (index < expenses.length - 1) {
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, currentY, pageWidth - 15, currentY);
        currentY += 5;
      }
    });
  }

  private static addSupplierOrdersContent(pdf: jsPDF, orders: any[], pageWidth: number, startY: number): void {
    let currentY = startY;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COMMANDES FOURNISSEURS', 15, currentY);
    currentY += 10;

    if (orders.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Aucune commande fournisseur enregistrée pour cette période.', 15, currentY);
      return;
    }

    orders.forEach((order, index) => {
      if (currentY > 220) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Commande ${order.order_number}`, 15, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${new Date(order.order_date).toLocaleDateString('fr-FR')}`, 15, currentY + 6);
      pdf.text(`Statut: ${this.getStatusText(order.status)}`, 80, currentY + 6);
      pdf.text(`Livraison prévue: ${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('fr-FR') : 'Non définie'}`, 120, currentY + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total: ${this.formatNumber(order.total_amount)} f CFA`, pageWidth - 20, currentY, { align: 'right' });

      currentY += 15;

      if (order.notes) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`Notes: ${order.notes}`, 15, currentY);
        currentY += 8;
      }

      // Ligne de séparation
      if (index < orders.length - 1) {
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, currentY, pageWidth - 15, currentY);
        currentY += 5;
      }
    });
  }

  private static addKitchenBarContent(pdf: jsPDF, data: any, pageWidth: number, startY: number): void {
    let currentY = startY;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT CUISINE & BAR', 15, currentY);
    currentY += 15;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Ce rapport nécessite des données spécifiques de la cuisine et du bar.', 15, currentY);
    currentY += 8;
    pdf.text('Veuillez utiliser la fonction d\'export PDF depuis l\'onglet Cuisine & Bar.', 15, currentY);
  }
}
