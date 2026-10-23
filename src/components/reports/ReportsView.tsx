//src/components/reports/ReportsView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Download } from 'lucide-react';

interface DailyReport {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
  margin: number;
}

export default function ReportsView() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadReports();
  }, [filterMonth]);

  const loadReports = async () => {
    try {
      const startDate = `${filterMonth}-01`;
      const endDate = new Date(filterMonth + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().slice(0, 10);

      const [salesData, expensesData] = await Promise.all([
        supabase
          .from('sales')
          .select('sale_date, total_amount')
          .gte('sale_date', startDate)
          .lt('sale_date', endDateStr),
        supabase
          .from('expenses')
          .select('expense_date, amount')
          .gte('expense_date', startDate)
          .lt('expense_date', endDateStr),
      ]);

      const dailyReports: { [key: string]: DailyReport } = {};

      (salesData.data || []).forEach((sale) => {
        if (!dailyReports[sale.sale_date]) {
          dailyReports[sale.sale_date] = {
            date: sale.sale_date,
            sales: 0,
            expenses: 0,
            profit: 0,
            margin: 0,
          };
        }
        dailyReports[sale.sale_date].sales += sale.total_amount;
      });

      (expensesData.data || []).forEach((expense) => {
        if (!dailyReports[expense.expense_date]) {
          dailyReports[expense.expense_date] = {
            date: expense.expense_date,
            sales: 0,
            expenses: 0,
            profit: 0,
            margin: 0,
          };
        }
        dailyReports[expense.expense_date].expenses += expense.amount;
      });

      const reportsList = Object.values(dailyReports).map((report) => ({
        ...report,
        profit: report.sales - report.expenses,
        margin: report.sales > 0 ? ((report.sales - report.expenses) / report.sales) * 100 : 0,
      }));

      reportsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReports(reportsList);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = reports.reduce((sum, r) => sum + r.sales, 0);
  const totalExpenses = reports.reduce((sum, r) => sum + r.expenses, 0);
  const totalProfit = totalSales - totalExpenses;
  const avgMargin = reports.length > 0 ? reports.reduce((sum, r) => sum + r.margin, 0) / reports.length : 0;

  const handleExport = () => {
    const csv = [
      ['Date', 'Ventes', 'Dépenses', 'Bénéfice', 'Marge %'],
      ...reports.map(r => [
        new Date(r.date).toLocaleDateString('fr-FR'),
        r.sales.toLocaleString(),
        r.expenses.toLocaleString(),
        r.profit.toLocaleString(),
        r.margin.toFixed(2),
      ]),
      ['', '', '', '', ''],
      ['Total', totalSales.toLocaleString(), totalExpenses.toLocaleString(), totalProfit.toLocaleString(), avgMargin.toFixed(2)],
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${filterMonth}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Rapports</h2>
          <p className="text-slate-600 mt-1">Marges bénéficiaires et analyses</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center space-x-2"
        >
          <Download className="w-5 h-5" />
          <span>Exporter CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total des ventes</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalSales.toLocaleString()} f CFA
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total des dépenses</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalExpenses.toLocaleString()} f CFA
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Bénéfice total</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalProfit.toLocaleString()} f CFA
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mois
          </label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Ventes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Dépenses
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Bénéfice
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Marge %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reports.map((report) => (
              <tr key={report.date} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {new Date(report.date).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                  {report.sales.toLocaleString()} f CFA
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                  {report.expenses.toLocaleString()} f CFA
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`text-sm font-medium ${report.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {report.profit.toLocaleString()} f CFA
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <TrendingUp className={`w-4 h-4 ${report.margin >= 20 ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span className={`text-sm font-medium ${report.margin >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {report.margin.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reports.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Aucun rapport trouvé</p>
          </div>
        )}
      </div>

      <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Interprétation des marges</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>20% et plus: Excellente marge</li>
          <li>10-20%: Bonne marge</li>
          <li>Moins de 10%: Marge faible, vérifiez vos coûts</li>
        </ul>
      </div>
    </div>
  );
}
