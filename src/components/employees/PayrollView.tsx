// src/components/employees/PayrollView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  DollarSign,
  Calculator,
  FileText,
  Download,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface PayrollPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'calculated' | 'paid' | 'closed';
  total_amount: number;
  employee_count: number;
}

export default function PayrollView() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null);
  const [payrollDetails, setPayrollDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayrollPeriods();
  }, []);

  const loadPayrollPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error('Error loading payroll periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayroll = async (periodId: string) => {
    try {
      // Logique de calcul de la paie pour tous les employés actifs
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active');

      if (!employees) return;

      const payrollCalculations = await Promise.all(
        employees.map(async (employee) => {
          // Calculer les heures supplémentaires
          const overtimeHours = await calculateOvertime(employee.id, periodId);
          
          // Calculer les primes
          const bonuses = await calculateBonuses(employee.id, periodId);
          
          // Calculer les déductions
          const deductions = await calculateDeductions(employee.id, periodId);
          
          // Calculer les avances
          const advances = await calculateAdvances(employee.id, periodId);

          const netSalary = employee.base_salary + bonuses - deductions - advances + (overtimeHours * employee.base_salary * 1.5);

          return {
            employee_id: employee.id,
            period_id: periodId,
            base_salary: employee.base_salary,
            overtime_hours: overtimeHours,
            overtime_amount: overtimeHours * employee.base_salary * 1.5,
            bonuses: bonuses,
            deductions: deductions,
            advances: advances,
            net_salary: netSalary,
            status: 'calculated'
          };
        })
      );

      // Sauvegarder les calculs
      for (const calculation of payrollCalculations) {
        await supabase
          .from('salary_payments')
          .upsert(calculation);
      }

      alert('Paie calculée avec succès!');
      loadPayrollDetails(periodId);
    } catch (error) {
      console.error('Error calculating payroll:', error);
      alert('Erreur lors du calcul de la paie');
    }
  };

  // Fonctions de calcul auxiliaires
  const calculateOvertime = async (employeeId: string, periodId: string) => {
    // Implémentation du calcul des heures supplémentaires
    return 0;
  };

  const calculateBonuses = async (employeeId: string, periodId: string) => {
    // Implémentation du calcul des primes
    return 0;
  };

  const calculateDeductions = async (employeeId: string, periodId: string) => {
    // Implémentation du calcul des déductions
    return 0;
  };

  const calculateAdvances = async (employeeId: string, periodId: string) => {
    // Implémentation du calcul des avances
    return 0;
  };

  // 🔥 FONCTION CORRIGÉE
  const loadPayrollDetails = async (periodId: string) => {
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select(`
          *,
          employees:employee_id(first_name, last_name, employee_number)
        `)
        .eq('period_id', periodId);

      if (error) {
        console.error('❌ Erreur chargement détails:', error);
        throw error;
      }
      
      console.log('✅ Détails chargés:', data?.length, 'employés');
      setPayrollDetails(data || []);
    } catch (error) {
      console.error(' Error loading payroll details:', error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestion de la Paie</h2>
          <p className="text-slate-600 mt-1">Calcul et gestion des salaires</p>
        </div>
        <button className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Nouvelle Période</span>
        </button>
      </div>

      {/* Liste des périodes de paie */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {periods.map((period) => (
          <div key={period.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{period.period_name}</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                period.status === 'paid' 
                  ? 'bg-green-100 text-green-800'
                  : period.status === 'calculated'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-800'
              }`}>
                {period.status === 'draft' && <Clock className="w-3 h-3 mr-1" />}
                {period.status === 'calculated' && <Calculator className="w-3 h-3 mr-1" />}
                {period.status === 'paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                {period.status === 'draft' ? 'Brouillon' : 
                 period.status === 'calculated' ? 'Calculé' : 'Payé'}
              </span>
            </div>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Période:</span>
                <span>
                  {new Date(period.start_date).toLocaleDateString('fr-FR')} - {new Date(period.end_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Employés:</span>
                <span>{period.employee_count}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Total:</span>
                <span>{period.total_amount.toLocaleString()} f CFA</span>
              </div>
            </div>

            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => calculatePayroll(period.id)}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Calculer
              </button>
              <button
                onClick={() => loadPayrollDetails(period.id)}
                className="flex-1 bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
              >
                Détails
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Détails de la paie */}
      {payrollDetails.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Détails de la paie</h3>
          </div>
          
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Salaire base
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Heures sup
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Primes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Déductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Net à payer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payrollDetails.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-slate-900">
                        {payment.employees?.first_name || 'N/A'} {payment.employees?.last_name || ''}
                      </div>
                      <div className="text-sm text-slate-500">{payment.employees?.employee_number || ''}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                    {payment.base_salary.toLocaleString()} f CFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                    {payment.overtime_hours}h ({payment.overtime_amount.toLocaleString()} f CFA)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                    +{payment.bonuses.toLocaleString()} f CFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                    -{payment.deductions.toLocaleString()} f CFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900">
                    {payment.net_salary.toLocaleString()} f CFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
