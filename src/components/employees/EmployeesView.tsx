// src/components/employees/EmployeesView.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  DollarSign,
  Calendar,
  Clock,
  Eye,
  Download,
  Printer,
  Save,
  UserCheck,
  CalendarDays,
  TrendingUp,
  X,
  Mail,
  Phone,
  MapPin,
  Banknote,
  Briefcase,
  MoreVertical,
  FileText,
  CreditCard,
  UserX,
  CheckCircle,
  XCircle,
  Calculator,
  Send
} from 'lucide-react';

interface EmployeeWithDetails {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position_id: string;
  department_id: string;
  position_name: string;
  department_name: string;
  hire_date: string;
  salary_type: string;
  base_salary: number;
  status: string;
  total_advances: number;
  total_bonuses: number;
  total_deductions: number;
}

interface EmployeeFormData {
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  position_id: string;
  department_id: string;
  hire_date: string;
  salary_type: 'monthly' | 'hourly' | 'daily';
  base_salary: number;
  bank_account: string;
  emergency_contact: string;
  notes: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string;
  check_out: string;
  total_hours: number;
  status: string;
  notes?: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string;
  approved_by?: string;
  approved_at?: string;
  employee_name?: string;
}

interface PayrollCalculation {
  employee_id: string;
  base_salary: number;
  working_days: number;
  actual_days: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus_amount: number;
  deduction_amount: number;
  advance_deductions: number;
  other_deductions: number;
  gross_salary: number;
  net_salary: number;
}

interface PayrollPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'calculated' | 'paid' | 'closed';
  total_amount: number;
  employee_count: number;
  created_by: string;
}

interface PayrollEmployeeDetail {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  base_salary: number;
  working_days: number;
  actual_days: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus_amount: number;
  advance_deductions: number;
  other_deductions: number;
  gross_salary: number;
  net_salary: number;
  status: 'draft' | 'calculated' | 'paid';
  payment_date?: string;
}

interface PaymentMethod {
  type: 'cash' | 'check' | 'mobile_money';
  reference?: string;
  transaction_date: string;
}

export default function EmployeesView() {
  const { user } = useAuth();
  // États de base
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'attendance' | 'payroll' | 'leaves'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithDetails | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [selectedPeriodForPayment, setSelectedPeriodForPayment] = useState<string | null>(null);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethod>({
    type: 'mobile_money',
    reference: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });
 
  // États pour le module de paie
  const [payrollCalculations, setPayrollCalculations] = useState<PayrollCalculation[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [payrollDetails, setPayrollDetails] = useState<PayrollEmployeeDetail[]>([]);
  const [showPayrollCalculator, setShowPayrollCalculator] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{[key: string]: PaymentMethod}>({});
  const [payrollPeriod, setPayrollPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  
  // États pour le module de congés
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: ''
  });
  
  // États pour la gestion financière
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [selectedEmployeeForFinance, setSelectedEmployeeForFinance] = useState<EmployeeWithDetails | null>(null);
  const [financeFormData, setFinanceFormData] = useState({
    amount: 0,
    reason: '',
    type: 'advance' as 'advance' | 'bonus' | 'deduction',
    date: new Date().toISOString().split('T')[0]
  });

 // NOUVEAUX ÉTATS POUR LES DÉTAILS DE PAIE
const [showPayrollDetails, setShowPayrollDetails] = useState(false);
const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState<any>(null);
const [detailedPayrollData, setDetailedPayrollData] = useState<any[]>([]);
const [loadingDetails, setLoadingDetails] = useState(false);
const [showEditPayroll, setShowEditPayroll] = useState(false);
const [editingPayrollDetail, setEditingPayrollDetail] = useState<any>(null);
const [editFormData, setEditFormData] = useState({
  base_salary: 0,
  overtime_hours: 0,
  bonus_amount: 0,
  advance_deductions: 0,
  other_deductions: 0,
  notes: ''
});

  // État pour le menu déroulant des actions financières
  const [openFinanceMenu, setOpenFinanceMenu] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    position_id: '',
    department_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary_type: 'monthly',
    base_salary: 0,
    bank_account: '',
    emergency_contact: '',
    notes: ''
  });
  //Etat pour les statistiques 
 const [stats, setStats] = useState({
  activeEmployees: 0,
  totalMonthlySalary: 0,
  totalBonuses: 0,
  totalDeductions: 0,
  totalAdvances: 0
});
  // Calcul des employés filtrés
  const filteredEmployees = useMemo(() => {
  return employees.filter(employee => {
    const matchesSearch = 
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_number.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || employee.department_name === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });
}, [employees, searchTerm, statusFilter, departmentFilter]);
  
  // Fonction de calcul des statistiques
 const calculateStats = useCallback((employeesList: EmployeeWithDetails[]) => {
    const activeEmployees = employeesList.filter(emp => emp.status === 'active');
    
    const totalMonthlySalary = activeEmployees.reduce(
      (sum, emp) => sum + (emp.base_salary || 0), 0
    );
    
    const totalBonuses = employeesList.reduce(
      (sum, emp) => sum + (emp.total_bonuses || 0), 0
    );
    
    const totalDeductions = employeesList.reduce(
      (sum, emp) => sum + (emp.total_deductions || 0), 0
    );
    
    const totalAdvances = employeesList.reduce(
      (sum, emp) => sum + (emp.total_advances || 0), 0
    );

    return {
      activeEmployees: activeEmployees.length,
      totalMonthlySalary,
      totalBonuses,
      totalDeductions,
      totalAdvances
    };
  }, []);


  // Effet pour mettre à jour les statistiques
  useEffect(() => {
    if (employees.length > 0) {
      const newStats = calculateStats(filteredEmployees);
      setStats(newStats);
    }
  }, [filteredEmployees, employees.length, calculateStats]);
  // Effet pour fermer le menu déroulant quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (openFinanceMenu && !target.closest('.finance-menu-container')) {
        setOpenFinanceMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFinanceMenu]);
 
  useEffect(() => {
    loadEmployees();
    loadDepartments();
    loadPositions();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendanceRecords();
    } else if (activeTab === 'leaves') {
      loadLeaveRequests();
    } else if (activeTab === 'payroll') {
      loadPayrollData();
    }
  }, [activeTab]);

  // Fonction pour basculer le menu déroulant
  const toggleFinanceMenu = (employeeId: string) => {
    setOpenFinanceMenu(openFinanceMenu === employeeId ? null : employeeId);
  };

  // Fonctions pour la gestion financière
  const handleOpenAdvanceForm = (employee: EmployeeWithDetails) => {
    setSelectedEmployeeForFinance(employee);
    setFinanceFormData({
      amount: 0,
      reason: '',
      type: 'advance',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAdvanceForm(true);
    setOpenFinanceMenu(null); // Fermer le menu
  };

  const handleOpenBonusForm = (employee: EmployeeWithDetails) => {
    setSelectedEmployeeForFinance(employee);
    setFinanceFormData({
      amount: 0,
      reason: '',
      type: 'bonus',
      date: new Date().toISOString().split('T')[0]
    });
    setShowBonusForm(true);
    setOpenFinanceMenu(null); // Fermer le menu
  };

  const handleOpenDeductionForm = (employee: EmployeeWithDetails) => {
    setSelectedEmployeeForFinance(employee);
    setFinanceFormData({
      amount: 0,
      reason: '',
      type: 'deduction',
      date: new Date().toISOString().split('T')[0]
    });
    setShowDeductionForm(true);
    setOpenFinanceMenu(null); // Fermer le menu
  };

  const handleSubmitFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForFinance || !user) return;

    setFormLoading(true);

    try {
      let tableName = '';
      let data: any = {
        employee_id: selectedEmployeeForFinance.id,
        amount: financeFormData.amount,
        reason: financeFormData.reason
      };

      switch (financeFormData.type) {
        case 'advance':
          tableName = 'salary_advances';
          data.advance_date = financeFormData.date;
          data.repayment_status = 'pending';
          break;
        case 'bonus':
          tableName = 'bonuses';
          data.bonus_date = financeFormData.date;
          data.type = 'other';
          break;
        case 'deduction':
          tableName = 'deductions';
          data.deduction_date = financeFormData.date;
          data.type = 'other';
          break;
      }

      data.created_by = user.id;

      const { error } = await supabase
        .from(tableName)
        .insert([data]);

      if (error) throw error;

      alert(`${financeFormData.type === 'advance' ? 'Avance' : financeFormData.type === 'bonus' ? 'Prime' : 'Déduction'} enregistrée avec succès !`);
      
      // Fermer les modals
      setShowAdvanceForm(false);
      setShowBonusForm(false);
      setShowDeductionForm(false);
      setSelectedEmployeeForFinance(null);
      
      // Recharger les données
      loadEmployees();
    } catch (error: any) {
      console.error('Error saving finance data:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_positions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('first_name');

      if (employeesError) throw employeesError;

      if (!employeesData) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const { data: positionsData } = await supabase
        .from('employee_positions')
        .select('*');

      const { data: departmentsData } = await supabase
        .from('employee_departments')
        .select('*');

      const positionsMap = new Map();
      const departmentsMap = new Map();

      positionsData?.forEach(pos => positionsMap.set(pos.id, pos));
      departmentsData?.forEach(dept => departmentsMap.set(dept.id, dept));

      const employeesWithDetails = await Promise.all(
        employeesData.map(async (employee) => {
          const [advances, bonuses, deductions] = await Promise.all([
            getEmployeeAdvances(employee.id),
            getEmployeeBonuses(employee.id),
            getEmployeeDeductions(employee.id)
          ]);

          const position = positionsMap.get(employee.position_id);
          const department = departmentsMap.get(employee.department_id);

          return {
            ...employee,
            position_name: position?.name || '-',
            department_name: department?.name || '-',
            total_advances: advances || 0,
            total_bonuses: bonuses || 0,
            total_deductions: deductions || 0
          };
        })
      );

      setEmployees(employeesWithDetails);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('work_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadLeaveRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employees:employee_id(
          first_name, 
          last_name, 
          employee_departments!department_id(name)
        )
      `)
      .order('start_date', { ascending: false })
      .limit(50);
      
    if (error) {
      console.log('Table leave_requests not found or error:', error);
      setLeaveRequests([]);
      return;
    }
    
    const formattedData = data?.map(item => ({
      id: item.id,
      employee_id: item.employee_id,
      leave_type: item.leave_type,
      start_date: item.start_date,
      end_date: item.end_date,
      total_days: item.total_days,
      reason: item.reason,
      status: item.status,
      approved_by: item.approved_by,
      approved_at: item.approved_at,
      employee_name: item.employees ?
        `${item.employees.first_name} ${item.employees.last_name}` :
        'Employé inconnu'
    })) || [];
    
    setLeaveRequests(formattedData);
  } catch (error) {
    console.error('Error loading leave requests:', error);
    setLeaveRequests([]);
  }
};

  const loadPayrollData = async () => {
    try {
      // Charger les périodes de paie
      const { data: periodsData, error: periodsError } = await supabase
        .from('payroll_periods')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(12);

      if (periodsError) {
        console.log('Table payroll_periods not found, initializing empty array');
        setPayrollPeriods([]);
      } else {
        setPayrollPeriods(periodsData || []);
      }

      // Charger les détails de paie
      const { data: detailsData, error: detailsError } = await supabase
        .from('payroll_employee_details')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (detailsError) {
        console.log('Table payroll_employee_details not found, initializing empty array');
        setPayrollDetails([]);
      } else {
        setPayrollDetails(detailsData || []);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
      setPayrollPeriods([]);
      setPayrollDetails([]);
    }
  };

 // Ajoutez cette fonction dans votre composant (remplacez l'ancienne loadPayrollDetails)
const loadPayrollDetails = async (periodId: string) => {
  try {
    const { data, error } = await supabase
      .from('payroll_employee_details')
      .select(`
        *,
        employees:employee_id(
          first_name, 
          last_name, 
          employee_number, 
          employee_departments!department_id(name)
        )
      `)
      .eq('payroll_period_id', periodId);

    if (error) throw error;
    setPayrollDetails(data || []);
  } catch (error) {
    console.error('Error loading payroll details:', error);
  }
};

// Modifier un détail de paie (uniquement si statut = calculated)
const handleEditPayrollDetail = (detail: any) => {
  if (selectedPayrollPeriod?.status !== 'calculated') {
    alert('Vous ne pouvez modifier que les paies en statut "Calculé"');
    return;
  }
  setEditingPayrollDetail(detail);
  setEditFormData({
    base_salary: detail.base_salary || 0,
    overtime_hours: detail.overtime_hours || 0,
    bonus_amount: detail.bonus_amount || 0,
    advance_deductions: detail.advance_deductions || 0,
    other_deductions: detail.other_deductions || 0,
    notes: detail.notes || ''
  });
  setShowEditPayroll(true);
};

// Charger les détails complets d'une période de paie
const loadPayrollPeriodDetails = async (periodId: string) => {
  try {
    setLoadingDetails(true);
    console.log('🔍 Chargement des détails pour la période:', periodId);
    
    // 1. Charger la période
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', periodId)
      .single();
      
    if (periodError) {
      console.error('❌ Erreur chargement période:', periodError);
      throw periodError;
    }
    setSelectedPayrollPeriod(period);
    
    // 2. Charger les détails de paie (requête simplifiée pour éviter les échecs de jointure)
    const { data: details, error: detailsError } = await supabase
      .from('payroll_employee_details')
      .select(`
        *,
        employees:employee_id(
          id,
          employee_number,
          first_name,
          last_name,
          position_id,
          department_id
        )
      `)
      .eq('payroll_period_id', periodId)
      .order('created_at', { ascending: true });
      
    if (detailsError) {
      console.error('❌ Erreur chargement détails:', detailsError);
      throw detailsError;
    }
    
    console.log('📊 Détails bruts chargés:', details?.length || 0, 'employés');
    
    if (!details || details.length === 0) {
      console.warn('⚠️ Aucun détail de paie trouvé pour cette période. Avez-vous bien cliqué sur "Enregistrer la Paie" après le calcul ?');
      setDetailedPayrollData([]);
      setShowPayrollDetails(true);
      setLoadingDetails(false);
      return;
    }

    // 3. Charger les positions et départements séparément pour plus de fiabilité
    const positionIds = [...new Set(details.map(d => d.employees?.position_id).filter(Boolean))];
    const departmentIds = [...new Set(details.map(d => d.employees?.department_id).filter(Boolean))];
    
    let employeesWithDetails = details;
    
    if (positionIds.length > 0 || departmentIds.length > 0) {
      const { data: positions } = await supabase
        .from('employee_positions')
        .select('id, name')
        .in('id', positionIds);
        
      const { data: departments } = await supabase
        .from('employee_departments')
        .select('id, name')
        .in('id', departmentIds);
        
      const positionsMap = new Map(positions?.map(p => [p.id, p.name]) || []);
      const departmentsMap = new Map(departments?.map(d => [d.id, d.name]) || []);
      
      // Enrichir les données des employés
      employeesWithDetails = details.map(detail => ({
        ...detail,
        employees: {
          ...detail.employees,
          position_name: detail.employees?.position_id ? positionsMap.get(detail.employees.position_id) : 'Non défini',
          department_name: detail.employees?.department_id ? departmentsMap.get(detail.employees.department_id) : 'Non défini'
        }
      }));
    }

    // 4. Charger les avances, primes et déductions pour chaque employé
    const detailsWithFinance = await Promise.all(
      employeesWithDetails.map(async (detail) => {
        const empId = detail.employee_id;
        const startDate = period.start_date;
        const endDate = period.end_date;

        const { data: advances } = await supabase
          .from('salary_advances')
          .select('*')
          .eq('employee_id', empId)
          .gte('advance_date', startDate)
          .lte('advance_date', endDate);
          
        const { data: bonuses } = await supabase
          .from('bonuses')
          .select('*')
          .eq('employee_id', empId)
          .gte('bonus_date', startDate)
          .lte('bonus_date', endDate);
          
        const { data: deductions } = await supabase
          .from('deductions')
          .select('*')
          .eq('employee_id', empId)
          .gte('deduction_date', startDate)
          .lte('deduction_date', endDate);
          
        return {
          ...detail,
          advances: advances || [],
          bonuses: bonuses || [],
          deductions: deductions || []
        };
      })
    );
    
    console.log('✅ Détails finaux chargés avec succès:', detailsWithFinance.length, 'employés');
    setDetailedPayrollData(detailsWithFinance);
    setShowPayrollDetails(true);
  } catch (error: any) {
    console.error('❌ Erreur chargement détails paie:', error);
    alert(`Erreur: ${error.message}`);
  } finally {
    setLoadingDetails(false);
  }
};

// Sauvegarder les modifications d'un détail de paie
const handleSavePayrollEdit = async () => {
  if (!editingPayrollDetail || !selectedPayrollPeriod) return;
  try {
    const overtimeRate = (editFormData.base_salary || 0) / 173;
    const overtimeAmount = (editFormData.overtime_hours || 0) * overtimeRate * 1.25;
    const grossSalary = editFormData.base_salary + overtimeAmount + editFormData.bonus_amount;
    const totalDeductions = editFormData.advance_deductions + editFormData.other_deductions;
    const netSalary = Math.max(0, grossSalary - totalDeductions);
    
    const { error } = await supabase
      .from('payroll_employee_details')
      .update({
        base_salary: editFormData.base_salary,
        overtime_hours: editFormData.overtime_hours,
        overtime_amount: overtimeAmount,
        bonus_amount: editFormData.bonus_amount,
        advance_deductions: editFormData.advance_deductions,
        other_deductions: editFormData.other_deductions,
        gross_salary: grossSalary,
        net_salary: netSalary,
        notes: editFormData.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingPayrollDetail.id);
      
    if (error) throw error;
    
    const { data: updatedDetails } = await supabase
      .from('payroll_employee_details')
      .select('net_salary')
      .eq('payroll_period_id', selectedPayrollPeriod.id);
      
    const newTotal = updatedDetails?.reduce((sum: any, d: any) => sum + (d.net_salary || 0), 0) || 0;
    
    await supabase
      .from('payroll_periods')
      .update({ total_amount: newTotal })
      .eq('id', selectedPayrollPeriod.id);
    
    alert('✅ Modifications enregistrées avec succès !');
    setShowEditPayroll(false);
    setEditingPayrollDetail(null);
    loadPayrollPeriodDetails(selectedPayrollPeriod.id);
    loadPayrollData();
  } catch (error: any) {
    console.error('Error saving payroll edit:', error);
    alert(`Erreur: ${error.message}`);
  }
};

// Imprimer UN SEUL bulletin
const printSinglePaySlip = (detail: any) => {
  const tempData = [detail];
  const originalData = detailedPayrollData;
  setDetailedPayrollData(tempData);
  
  setTimeout(() => {
    printAllPaySlips(selectedPayrollPeriod?.id || '');
    setDetailedPayrollData(originalData);
  }, 100);
};

// Marquer la paie comme payée après modifications
const handleMarkAsPaid = async (periodId: string) => {
  if (!confirm('Confirmer le paiement de cette période de paie ?')) return;
  
  setPaymentMethodData({
    type: 'mobile_money',
    reference: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });
  setSelectedPeriodForPayment(periodId);
  setShowPaymentMethodModal(true);
};

  const getEmployeeAdvances = async (employeeId: string) => {
    try {
      const { data } = await supabase
        .from('salary_advances')
        .select('amount')
        .eq('employee_id', employeeId)
        .eq('repayment_status', 'pending')
        .gte('advance_date', payrollPeriod.start)
        .lte('advance_date', payrollPeriod.end);
      
      return data?.reduce((sum: number, advance: any) => sum + (advance.amount || 0), 0) || 0;
    } catch (error) {
      console.error('Error loading advances:', error);
      return 0;
    }
  };

  const getEmployeeBonuses = async (employeeId: string) => {
    try {
      const { data } = await supabase
        .from('bonuses')
        .select('amount')
        .eq('employee_id', employeeId)
        .gte('bonus_date', payrollPeriod.start)
        .lte('bonus_date', payrollPeriod.end)
        .eq('is_archived', false);
      
      return data?.reduce((sum: number, bonus: any) => sum + (bonus.amount || 0), 0) || 0;
    } catch (error) {
      console.error('Error loading bonuses:', error);
      return 0;
    }
  };

  const getEmployeeDeductions = async (employeeId: string) => {
    try {
      const { data } = await supabase
        .from('deductions')
        .select('amount')
        .eq('employee_id', employeeId)
        .gte('deduction_date', payrollPeriod.start)
        .lte('deduction_date', payrollPeriod.end)
        .eq('is_archived', false);
      
      return data?.reduce((sum: number, deduction: any) => sum + (deduction.amount || 0), 0) || 0;
    } catch (error) {
      console.error('Error loading deductions:', error);
      return 0;
    }
  };

  const calculatePayroll = async () => {
    try {
      setFormLoading(true);
      
      const activeEmployees = employees.filter(emp => emp.status === 'active');
      const calculations: PayrollCalculation[] = [];

      console.log('Calcul de la paie pour la période:', payrollPeriod.start, 'à', payrollPeriod.end);

      for (const employee of activeEmployees) {
        console.log('Calcul pour employé:', employee.first_name, employee.last_name);
        
        // Calcul des jours travaillés
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', employee.id)
          .gte('work_date', payrollPeriod.start)
          .lte('work_date', payrollPeriod.end);

        const workingDays = attendance?.length || 0;
        console.log('Jours travaillés:', workingDays);
        
        // Calcul des heures supplémentaires
        const overtimeHours = attendance?.reduce((total, record) => {
          const hours = record.total_hours || 0;
          return hours > 8 ? total + (hours - 8) : total;
        }, 0) || 0;

        const overtimeRate = (employee.base_salary || 0) / 173; // Taux horaire basé sur 173h/mois
        const overtimeAmount = overtimeHours * overtimeRate * 1.25; // Majoration 25%

        // Calcul des primes et déductions
        const bonuses = await getEmployeeBonuses(employee.id);
        const deductionAmount = await getEmployeeDeductions(employee.id);
        const advances = await getEmployeeAdvances(employee.id);

        const baseSalary = employee.base_salary || 0;
        const grossSalary = baseSalary + (overtimeAmount || 0) + (bonuses || 0);
        const totalDeductions = (deductionAmount || 0) + (advances || 0);
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        calculations.push({
          employee_id: employee.id,
          base_salary: baseSalary,
          working_days: workingDays,
          actual_days: 22, // Jours ouvrables standard
          overtime_hours: overtimeHours,
          overtime_amount: overtimeAmount,
          bonus_amount: bonuses,
          deduction_amount: deductionAmount,
          advance_deductions: advances,
          other_deductions: 0,
          gross_salary: grossSalary,
          net_salary: netSalary
        });
      }

      console.log('Calculs terminés. Total:', calculations.length, 'employés');
      setPayrollCalculations(calculations);
      setShowPayrollCalculator(true);
    } catch (error) {
      console.error('Error calculating payroll:', error);
      alert('Erreur lors du calcul de la paie: ' + (error as any).message);
    } finally {
      setFormLoading(false);
    }
  };

  const savePayroll = async () => {
    try {
      if (!user) {
        alert('Utilisateur non connecté');
        return;
      }

      // Vérifier si une paie existe déjà pour cette période
      const { data: existingPayrolls, error: checkError } = await supabase
        .from('payroll_periods')
        .select('*')
        .gte('start_date', payrollPeriod.start)
        .lte('end_date', payrollPeriod.end)
        .neq('status', 'draft');

      if (checkError) {
        console.error('Error checking existing payrolls:', checkError);
        throw checkError;
      }

      if (existingPayrolls && existingPayrolls.length > 0) {
        alert('Une paie a déjà été enregistrée pour cette période !');
        return;
      }

      // Créer une période de paie
      const periodName = `Paie ${new Date(payrollPeriod.start).toLocaleDateString('fr-FR')} - ${new Date(payrollPeriod.end).toLocaleDateString('fr-FR')}`;
      
      console.log('Création de la période de paie:', periodName);
      
      const { data: periodData, error: periodError } = await supabase
        .from('payroll_periods')
        .insert({
          period_name: periodName,
          start_date: payrollPeriod.start,
          end_date: payrollPeriod.end,
          status: 'calculated',
          total_amount: payrollCalculations.reduce((sum, calc) => sum + calc.net_salary, 0),
          employee_count: payrollCalculations.length,
          created_by: user.id
        })
        .select()
        .single();

      if (periodError) {
        console.error('Error creating payroll period:', periodError);
        throw periodError;
      }

      console.log('Période créée avec ID:', periodData.id);
      console.log('Nombre de calculs à sauvegarder:', payrollCalculations.length);

      // Sauvegarder les détails de chaque employé
      const detailPromises = payrollCalculations.map(async (calculation) => {
        console.log('Sauvegarde pour employé:', calculation.employee_id);
        
        // Chercher le nom de l'employé
        const employee = employees.find(e => e.id === calculation.employee_id);
        const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'Employé inconnu';
        
        const detailData = {
          payroll_period_id: periodData.id,
          employee_id: calculation.employee_id,
          base_salary: calculation.base_salary,
          working_days: calculation.working_days,
          actual_days: calculation.actual_days,
          overtime_hours: calculation.overtime_hours,
          overtime_amount: calculation.overtime_amount,
          bonus_amount: calculation.bonus_amount,
          advance_deductions: calculation.advance_deductions,
          other_deductions: calculation.deduction_amount || 0,
          gross_salary: calculation.gross_salary,
          net_salary: calculation.net_salary,
          status: 'calculated'
        };

        console.log('Données à insérer pour', employeeName, ':', detailData);

        const { data, error } = await supabase
          .from('payroll_employee_details')
          .insert([detailData])
          .select();

        if (error) {
          console.error('Error inserting payroll detail for', employeeName, ':', error);
          throw error;
        }

        console.log('Détail sauvegardé pour', employeeName);
        return data;
      });

      // Attendre que tous les détails soient sauvegardés
      await Promise.all(detailPromises);
      
      console.log('Tous les détails de paie ont été sauvegardés');

      // RÉINITIALISER les montants des primes, déductions et avances
      console.log('Début de la réinitialisation des données financières');
      await resetFinanceDataForNextPayroll();
      console.log('Données financières réinitialisées');

      // Créer les dépenses de salaire automatiquement
      console.log('Création des dépenses de salaire');
      await createSalaryExpenses(periodData.id, {
        type: 'mobile_money',
        reference: `PAIE-${periodData.id.slice(0, 8)}`,
        transaction_date: new Date().toISOString().split('T')[0]
      });
      console.log('Dépenses de salaire créées');

      alert('Paie enregistrée avec succès !\n✓ Les montants ont été réinitialisés pour la prochaine période.\n✓ Les dépenses de salaire ont été créées automatiquement.');
      
      // Fermer le modal
      setShowPayrollCalculator(false);
      
      // Réinitialiser les calculs
      setPayrollCalculations([]);
      
      // Forcer le rechargement complet des données
      setTimeout(() => {
        loadPayrollData();
        loadEmployees();
        loadDepartments();
        loadPositions();
      }, 500);

    } catch (error: any) {
      console.error('Error saving payroll:', error);
      
      if (error.message.includes('payroll_employee_details')) {
        if (error.message.includes('deduction_amount')) {
          alert(`Erreur: La colonne "deduction_amount" n'existe pas dans la table "payroll_employee_details".\n\nVeuillez exécuter cette commande SQL dans Supabase:\n\nALTER TABLE payroll_employee_details\nADD COLUMN deduction_amount DECIMAL(10, 2) DEFAULT 0;`);
        } else {
          alert(`Erreur lors de l'enregistrement des détails de paie: ${error.message}`);
        }
      } else if (error.message.includes('duplicate key')) {
        alert('Erreur: Une paie existe déjà pour cette période.');
      } else {
        alert(`Erreur lors de l'enregistrement de la paie: ${error.message}`);
      }
    }
  };

  const resetFinanceDataForNextPayroll = async () => {
    try {
      console.log('Début de la réinitialisation des données financières');
      console.log('Période:', payrollPeriod.start, 'à', payrollPeriod.end);
      
      const activeEmployees = employees.filter(emp => emp.status === 'active');
      console.log('Nombre d\'employés actifs:', activeEmployees.length);

      let resetCount = 0;
      
      for (const employee of activeEmployees) {
        try {
          // 1. Marquer les avances comme remboursées
          const { data: advances, error: advancesError } = await supabase
            .from('salary_advances')
            .select('id, amount')
            .eq('employee_id', employee.id)
            .eq('repayment_status', 'pending')
            .gte('advance_date', payrollPeriod.start)
            .lte('advance_date', payrollPeriod.end);

          if (advancesError) {
            console.error('Erreur récupération avances:', advancesError);
            continue;
          }

          if (advances && advances.length > 0) {
            const { error: updateAdvancesError } = await supabase
              .from('salary_advances')
              .update({ 
                repayment_status: 'repaid',
                repaid_at: new Date().toISOString()
              })
              .eq('employee_id', employee.id)
              .eq('repayment_status', 'pending')
              .gte('advance_date', payrollPeriod.start)
              .lte('advance_date', payrollPeriod.end);

            if (!updateAdvancesError) {
              resetCount += advances.length;
              console.log(`Avances marquées comme remboursées pour ${employee.first_name}:`, advances.length);
            }
          }

          // 2. Archiver les primes
          try {
            const { error: archiveBonusesError } = await supabase
              .from('bonuses')
              .update({ is_archived: true })
              .eq('employee_id', employee.id)
              .gte('bonus_date', payrollPeriod.start)
              .lte('bonus_date', payrollPeriod.end)
              .eq('is_archived', false);

            if (!archiveBonusesError) {
              console.log(`Primes archivées pour ${employee.first_name}`);
            }
          } catch (bonusError) {
            console.log('Note: La colonne is_archived n\'existe peut-être pas dans bonuses');
            
            const { error: deleteBonusesError } = await supabase
              .from('bonuses')
              .delete()
              .eq('employee_id', employee.id)
              .gte('bonus_date', payrollPeriod.start)
              .lte('bonus_date', payrollPeriod.end);

            if (!deleteBonusesError) {
              console.log(`Primes supprimées pour ${employee.first_name}`);
            }
          }

          // 3. Archiver les déductions
          try {
            const { error: archiveDeductionsError } = await supabase
              .from('deductions')
              .update({ is_archived: true })
              .eq('employee_id', employee.id)
              .gte('deduction_date', payrollPeriod.start)
              .lte('deduction_date', payrollPeriod.end)
              .eq('is_archived', false);

            if (!archiveDeductionsError) {
              console.log(`Déductions archivées pour ${employee.first_name}`);
            }
          } catch (deductionError) {
            console.log('Note: La colonne is_archived n\'existe peut-être pas dans deductions');
            
            const { error: deleteDeductionsError } = await supabase
              .from('deductions')
              .delete()
              .eq('employee_id', employee.id)
              .gte('deduction_date', payrollPeriod.start)
              .lte('deduction_date', payrollPeriod.end);

            if (!deleteDeductionsError) {
              console.log(`Déductions supprimées pour ${employee.first_name}`);
            }
          }

        } catch (employeeError) {
          console.error(`Erreur pour l'employé ${employee.first_name}:`, employeeError);
          continue;
        }
      }

      console.log(`Réinitialisation terminée. ${resetCount} avances traitées.`);
      await loadEmployees();
      
    } catch (error) {
      console.error('Error resetting finance data:', error);
      throw error;
    }
  };

  const markPayrollAsPaid = async (periodId: string, paymentMethod: PaymentMethod) => {
    try {
      if (!user) {
        alert('Utilisateur non connecté');
        return;
      }

      // 1. Créer les dépenses de salaire
      await createSalaryExpenses(periodId, paymentMethod);

      // 2. Mettre à jour la période de paie
      const { error: periodError } = await supabase
        .from('payroll_periods')
        .update({
          status: 'paid',
          payment_method: paymentMethod.type === 'mobile_money' ? 'mobile_money' : 'cash',
          payment_reference: paymentMethod.reference,
          paid_at: new Date().toISOString()
        })
        .eq('id', periodId);

      if (periodError) throw periodError;

      // 3. Marquer les détails comme payés
      const { error: detailsUpdateError } = await supabase
        .from('payroll_employee_details')
        .update({
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: paymentMethod.type === 'mobile_money' ? 'mobile_money' : 'cash',
          payment_reference: paymentMethod.reference
        })
        .eq('payroll_period_id', periodId);

      if (detailsUpdateError) throw detailsUpdateError;

      alert('Paie marquée comme payée et les dépenses de salaire ont été créées !');
      loadPayrollData();
      
    } catch (error: any) {
      console.error('Error marking payroll as paid:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const getSalaryCategoryId = async (): Promise<string> => {
    try {
      const { data: existingCategory, error } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('name', 'Salaires')
        .single();

      if (existingCategory) {
        return existingCategory.id;
      }

      const { data: newCategory, error: createError } = await supabase
        .from('expense_categories')
        .insert([
          {
            name: 'Salaires',
            description: 'Dépenses liées aux salaires du personnel',
            is_active: true,
            created_by: user?.id
          }
        ])
        .select()
        .single();

      if (createError) throw createError;
      return newCategory.id;
      
    } catch (error) {
      console.error('Error getting salary category:', error);
      throw error;
    }
  };

  const getPeriodName = (periodId: string): string => {
    const period = payrollPeriods.find(p => p.id === periodId);
    return period ? period.period_name : 'Période inconnue';
  };

  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vous devez être connecté pour créer une demande de congé');
      return;
    }

    setFormLoading(true);

    try {
      const startDate = new Date(leaveFormData.start_date);
      const endDate = new Date(leaveFormData.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('Dates invalides');
        return;
      }

      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (totalDays <= 0) {
        alert('La date de fin doit être après la date de début');
        return;
      }

      const leaveData: any = {
        employee_id: leaveFormData.employee_id,
        leave_type: leaveFormData.leave_type,
        start_date: leaveFormData.start_date,
        end_date: leaveFormData.end_date,
        total_days: totalDays,
        reason: leaveFormData.reason,
        status: 'pending'
      };

      try {
        leaveData.requested_by = user.id;
      } catch (error) {
        console.log('Column requested_by not available');
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .insert([leaveData])
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          alert('La table leave_requests n\'existe pas encore.');
          return;
        }
        throw error;
      }

      alert('Demande de congé créée avec succès !');
      setShowLeaveForm(false);
      setLeaveFormData({
        employee_id: '',
        leave_type: 'annual',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: ''
      });
      loadLeaveRequests();
    } catch (error: any) {
      console.error('Error creating leave request:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const generateEmployeeNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `EMP${timestamp}${random}`;
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vous devez être connecté pour créer un employé');
      return;
    }

    setFormLoading(true);

    try {
      if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.position_id || !formData.department_id) {
        alert('Veuillez remplir tous les champs obligatoires (Prénom, Nom, Département, Poste)');
        return;
      }

      if (formData.base_salary <= 0) {
        alert('Le salaire de base doit être supérieur à 0');
        return;
      }

      const employeeData = {
        employee_number: formData.employee_number.trim() || generateEmployeeNumber(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        position_id: formData.position_id,
        department_id: formData.department_id,
        hire_date: formData.hire_date,
        salary_type: formData.salary_type,
        base_salary: formData.base_salary,
        bank_account: formData.bank_account.trim() || null,
        emergency_contact: formData.emergency_contact.trim() || null,
        notes: formData.notes.trim() || null,
        status: 'active',
        created_by: user.id
      };

      console.log('Données employé:', employeeData);

      const { data, error } = await supabase
        .from('employees')
        .insert([employeeData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Erreur: ${error.message}`);
        return;
      }

      if (data) {
        alert('Employé créé avec succès !');
        resetForm();
        setShowEmployeeForm(false);
        loadEmployees();
      }
    } catch (error: any) {
      console.error('Error creating employee:', error);
      alert('Erreur lors de la création de l\'employé');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      position_id: '',
      department_id: '',
      hire_date: new Date().toISOString().split('T')[0],
      salary_type: 'monthly',
      base_salary: 0,
      bank_account: '',
      emergency_contact: '',
      notes: ''
    });
  };

  const handleDepartmentChange = (departmentId: string) => {
    const newFormData = {
      ...formData,
      department_id: departmentId,
      position_id: ''
    };

    if (departmentId) {
      const departmentPositions = positions.filter(pos => pos.department_id === departmentId);
      if (departmentPositions.length > 0) {
        newFormData.base_salary = departmentPositions[0].base_salary;
      }
    }

    setFormData(newFormData);
  };

  const handlePositionChange = (positionId: string) => {
    const selectedPosition = positions.find(pos => pos.id === positionId);
    if (selectedPosition) {
      setFormData(prev => ({
        ...prev,
        position_id: positionId,
        base_salary: selectedPosition.base_salary
      }));
    }
  };

  const handleViewEmployee = (employee: EmployeeWithDetails) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetails(true);
  };

  const createSalaryExpenses = async (periodId: string, paymentMethod: PaymentMethod) => {
    try {
      if (!user) return;

      console.log('Création des dépenses de salaire pour la période:', periodId);

      const { data: payrollDetails, error } = await supabase
        .from('payroll_employee_details')
        .select(`
          *,
          employees:employee_id(first_name, last_name)
        `)
        .eq('payroll_period_id', periodId);

      if (error) {
        console.error('Error fetching payroll details:', error);
        throw error;
      }

      if (!payrollDetails || payrollDetails.length === 0) {
        console.log('Aucun détail de paie trouvé');
        return;
      }

      console.log(`${payrollDetails.length} détails de paie à traiter`);

      const salaryCategoryId = await getSalaryCategoryId();

      const period = payrollPeriods.find(p => p.id === periodId);
      const periodName = period ? period.period_name : 'Période inconnue';
      const expenseDate = period?.end_date || new Date().toISOString().split('T')[0];

      const expensePromises = payrollDetails.map(async (detail) => {
        const employeeName = detail.employees ?
          `${detail.employees.first_name} ${detail.employees.last_name}` :
          'Employé inconnu';

        const expenseData = {
          category_id: salaryCategoryId,
          amount: detail.net_salary,
          expense_date: expenseDate,
          payment_method: paymentMethod.type === 'mobile_money' ? 'mobile_money' : 'cash',
          description: `Salaire - ${employeeName} - ${periodName}`,
          notes: paymentMethod.reference ? 
            `Référence: ${paymentMethod.reference}` : 
            `Salaire pour la période: ${periodName}`,
          expense_type: 'general',
          expense_category_type: 'fixed',
          is_recurring: true,
          recurrence_frequency: 'monthly',
          created_by: user.id,
          is_salary_expense: true,
          payroll_period_id: periodId,
          employee_id: detail.employee_id
        };

        console.log('Création de dépense pour:', employeeName, '- Montant:', detail.net_salary);

        const { error: expenseError } = await supabase
          .from('expenses')
          .insert([expenseData]);

        if (expenseError) {
          console.error('Error creating expense for', employeeName, ':', expenseError);
          throw expenseError;
        }

        console.log('Dépense créée pour:', employeeName);
        return true;
      });

      await Promise.all(expensePromises);
      
      console.log('Toutes les dépenses de salaire ont été créées avec succès');
      
      return true;
    } catch (error) {
      console.error('Error in createSalaryExpenses:', error);
      throw error;
    }
  };

  const handleEditEmployee = (employee: EmployeeWithDetails) => {
    setSelectedEmployee(employee);
    setFormData({
      employee_number: employee.employee_number,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || '',
      phone: employee.phone || '',
      address: '',
      position_id: employee.position_id,
      department_id: employee.department_id,
      hire_date: employee.hire_date,
      salary_type: employee.salary_type as any,
      base_salary: employee.base_salary,
      bank_account: '',
      emergency_contact: '',
      notes: ''
    });
    setShowEmployeeForm(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEmployee) return;

    setFormLoading(true);

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          position_id: formData.position_id,
          department_id: formData.department_id,
          salary_type: formData.salary_type,
          base_salary: formData.base_salary,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      alert('Employé modifié avec succès !');
      setShowEmployeeForm(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string, currentStatus: string) => {
  try {
    if (currentStatus === 'active') {
      // ÉTAPE 1 : Désactivation (Soft Delete)
      if (!confirm('Êtes-vous sûr de vouloir désactiver cet employé ? Il ne pourra plus se connecter et n\'apparaîtra plus dans les listes par défaut.')) return;
      
      const { error } = await supabase
        .from('employees')
        .update({ 
          status: 'inactive', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', employeeId);
        
      if (error) throw error;
      alert('✅ Employé désactivé avec succès');
      
    } else {
      // ÉTAPE 2 : Suppression définitive (Hard Delete) pour les inactifs
      if (!confirm('⚠️ ATTENTION : Vous allez SUPPRIMER DÉFINITIVEMENT cet employé de la base de données.\n\nCette action est irréversible et peut affecter l\'historique (paie, présences). Continuer ?')) return;

      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) {
        // Gestion élégante des erreurs de clé étrangère (ex: l'employé a des fiches de paie)
        if (error.code === '23503') {
          alert('⛔ Impossible de supprimer définitivement : Cet employé possède un historique lié (paie, présences, congés, etc.).\n\n💡 Conseil : Laissez-le simplement en statut "Inactif".');
          return;
        }
        throw error;
      }
      alert('🗑️ Employé supprimé définitivement avec succès');
    }
    
    // Recharger la liste
    loadEmployees();
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    alert(`❌ Erreur : ${error.message}`);
  }
};

  const handleCheckIn = async (employeeId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().split(' ')[0];

      const { error } = await supabase
        .from('attendance')
        .insert({
          employee_id: employeeId,
          work_date: today,
          check_in: now,
          status: 'present'
        });

      if (error) throw error;

      alert('Pointage enregistré avec succès');
      loadAttendanceRecords();
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Erreur lors du pointage');
    }
  };

  const handleCheckOut = async (attendanceId: string) => {
    try {
      const now = new Date().toTimeString().split(' ')[0];

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: now
        })
        .eq('id', attendanceId);

      if (error) throw error;

      alert('Pointage de sortie enregistré');
      loadAttendanceRecords();
    } catch (error) {
      console.error('Error checking out:', error);
      alert('Erreur lors du pointage de sortie');
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      const updateData: any = {
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', leaveId);

      if (error) {
        if (error.message.includes('approved_by')) {
          const { error: retryError } = await supabase
            .from('leave_requests')
            .update({
              status: 'approved'
            })
            .eq('id', leaveId);

          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      alert('Congé approuvé avec succès');
      loadLeaveRequests();
    } catch (error) {
      console.error('Error approving leave:', error);
      alert('Erreur lors de l\'approbation du congé');
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    try {
      const updateData: any = {
        status: 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', leaveId);

      if (error) {
        if (error.message.includes('approved_by')) {
          const { error: retryError } = await supabase
            .from('leave_requests')
            .update({
              status: 'rejected'
            })
            .eq('id', leaveId);

          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      alert('Congé rejeté');
      loadLeaveRequests();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      alert('Erreur lors du rejet du congé');
    }
  };

  const filteredPositions = positions.filter(position => 
    !formData.department_id || position.department_id === formData.department_id
  );

  const exportToCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Département', 'Salaire de base', 'Statut'];
    const csvData = employees.map(employee => [
      employee.employee_number,
      employee.last_name,
      employee.first_name,
      employee.position_name,
      employee.department_name,
      employee.base_salary.toString(),
      employee.status === 'active' ? 'Actif' : 'Inactif'
    ]);

    const csv = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Composant pour l'onglet Présences
  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Gestion des Présences</h3>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
          <Plus className="w-4 h-4 inline mr-2" />
          <span className="hidden sm:inline">Nouveau Pointage</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Présents aujourd'hui</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {attendanceRecords.filter(a => a.work_date === new Date().toISOString().split('T')[0] && a.status === 'present').length}
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <UserCheck className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Absents aujourd'hui</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {employees.filter(e => e.status === 'active').length - 
                  attendanceRecords.filter(a => a.work_date === new Date().toISOString().split('T')[0] && a.status === 'present').length}
              </p>
            </div>
            <div className="bg-red-100 p-2 rounded-lg">
              <UserCheck className="w-5 h-5 lg:w-6 lg:h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Retards ce mois</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">2</p>
            </div>
            <div className="bg-amber-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">
                  Employé
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Arrivée
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Départ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attendanceRecords.map((record) => {
                const employee = employees.find(e => e.id === record.employee_id);
                return (
                  <tr key={record.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {employee ? `${employee.first_name} ${employee.last_name}` : 'Employé inconnu'}
                        </div>
                        <div className="text-sm text-slate-500 truncate">
                          {new Date(record.work_date).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                      {new Date(record.work_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">
                      {record.check_in || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">
                      {record.check_out || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'present' 
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'absent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {record.status === 'present' ? 'Présent' : 
                          record.status === 'absent' ? 'Absent' : 'En retard'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!record.check_out && (
                        <button
                          onClick={() => handleCheckOut(record.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                        >
                          Pointage sortie
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {attendanceRecords.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Aucun pointage enregistré</p>
          </div>
        )}
      </div>
    </div>
  );

  // Composant pour l'onglet Paie
  const renderPayrollTab = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-slate-900">Gestion de la Paie</h3>
      <div className="flex space-x-3">
        <button
          onClick={calculatePayroll}
          disabled={formLoading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center"
        >
          <Calculator className="w-4 h-4 inline mr-2" />
          <span className="hidden sm:inline">Calculer la Paie</span>
          <span className="sm:hidden">Calculer</span>
        </button>
      </div>
    </div>

    {/* Période de paie */}
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h4 className="font-semibold text-slate-900 mb-4">Période de Paie</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date de début</label>
          <input
            type="date"
            value={payrollPeriod.start}
            onChange={(e) => setPayrollPeriod(prev => ({ ...prev, start: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date de fin</label>
          <input
            type="date"
            value={payrollPeriod.end}
            onChange={(e) => setPayrollPeriod(prev => ({ ...prev, end: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={calculatePayroll}
            disabled={formLoading}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition"
          >
            {formLoading ? 'Calcul...' : 'Calculer'}
          </button>
        </div>
      </div>
    </div>

    {/* Statistiques */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs lg:text-sm text-slate-600 mb-1">Masse salariale</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-900">
              {employees.filter(e => e.status === 'active').reduce((sum, emp) => sum + (emp.base_salary || 0), 0).toLocaleString()} f CFA
            </p>
          </div>
          <div className="bg-blue-100 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs lg:text-sm text-slate-600 mb-1">Déductions ce mois</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-900">
              {employees.reduce((sum, emp) => sum + (emp.total_deductions || 0), 0).toLocaleString()} f CFA
            </p>
          </div>
          <div className="bg-red-100 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-red-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs lg:text-sm text-slate-600 mb-1">Avances en cours</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-900">
              {employees.reduce((sum, emp) => sum + (emp.total_advances || 0), 0).toLocaleString()} f CFA
            </p>
          </div>
          <div className="bg-amber-100 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs lg:text-sm text-slate-600 mb-1">Primes ce mois</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-900">
              {employees.reduce((sum, emp) => sum + (emp.total_bonuses || 0), 0).toLocaleString()} f CFA
            </p>
          </div>
          <div className="bg-green-100 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
          </div>
        </div>
      </div>
    </div>

    {/* Historique des paies - AMÉLIORÉ */}
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Période</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Nom</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Montant</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Employés</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {payrollPeriods.map((period) => {
              const periodDetails = payrollDetails.filter(detail => detail.payroll_period_id === period.id);
              return (
                <tr key={period.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">
                    {new Date(period.start_date).toLocaleDateString('fr-FR')} - {new Date(period.end_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                    {period.period_name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                    {period.total_amount.toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 hidden lg:table-cell">
                    {period.employee_count}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      period.status === 'paid' ? 'bg-green-100 text-green-800' :
                      period.status === 'calculated' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {period.status === 'paid' ? 'Payé' :
                       period.status === 'calculated' ? 'Calculé' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Voir les détails */}
                      <button
                        onClick={() => loadPayrollPeriodDetails(period.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition flex items-center"
                        title="Voir les détails"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">Détails</span>
                      </button>
                      
                      {/* Modifier (uniquement si calculated) */}
                      {period.status === 'calculated' && (
                        <button
                          onClick={() => {
                            setSelectedPeriodForPayment(period.id);
                            setPaymentMethodData({
                              type: 'mobile_money',
                              reference: '',
                              transaction_date: new Date().toISOString().split('T')[0]
                            });
                            setShowPaymentMethodModal(true);
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition flex items-center"
                          title="Marquer comme payé"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">Payer</span>
                        </button>
                      )}
                      
                      {/* Imprimer tous les bulletins */}
                      {(period.status === 'paid' || period.status === 'calculated') && (
                        <button
                          onClick={() => printAllPaySlips(period.id)}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 transition flex items-center"
                          title="Imprimer tous les bulletins"
                        >
                          <Printer className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">Imprimer</span>
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
      {payrollPeriods.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">Aucune période de paie enregistrée</p>
          <p className="text-sm text-slate-500 mt-2">Utilisez le calculateur pour générer les premières fiches de paie</p>
        </div>
      )}
    </div>
  </div>
);

// Imprimer TOUS les bulletins d'une période
const printAllPaySlips = async (periodId: string) => {
  try {
    // Charger les détails si pas déjà chargés
    if (detailedPayrollData.length === 0 || selectedPayrollPeriod?.id !== periodId) {
      await loadPayrollPeriodDetails(periodId);
    }
    
    if (detailedPayrollData.length === 0) {
      alert('Aucun détail de paie trouvé');
      return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les pop-ups pour imprimer');
      return;
    }
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bulletins de Paie - ${selectedPayrollPeriod?.period_name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; color: #333; }
          .page-break { page-break-after: always; }
          .pay-slip { padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #2c3e50; padding-bottom: 15px; margin-bottom: 20px; }
          .company-info h1 { margin: 0; font-size: 22px; color: #2c3e50; }
          .company-info p { margin: 3px 0; font-size: 12px; color: #666; }
          .slip-title { text-align: right; }
          .slip-title h2 { margin: 0; font-size: 20px; color: #e74c3c; }
          .slip-title p { margin: 3px 0; font-size: 11px; color: #666; }
          .employee-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .employee-info .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .employee-info .row { display: flex; justify-content: space-between; font-size: 13px; }
          .employee-info .row .label { color: #666; }
          .employee-info .row .value { font-weight: bold; color: #2c3e50; }
          .section { margin-bottom: 20px; }
          .section-title { background: #34495e; color: white; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #ecf0f1; padding: 8px; text-align: left; border: 1px solid #bdc3c7; font-weight: bold; }
          td { padding: 8px; border: 1px solid #bdc3c7; }
          .amount { text-align: right; font-weight: bold; }
          .total-row { background: #f8f9fa; font-weight: bold; }
          .net-salary { background: #2c3e50; color: white; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .net-salary .row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; }
          .finance-details { background: #fffde7; border-left: 4px solid #f1c40f; padding: 10px; margin: 10px 0; font-size: 12px; }
          .finance-details h4 { margin: 0 0 8px 0; color: #f39c12; }
          .finance-details ul { margin: 5px 0; padding-left: 20px; }
          .finance-details li { margin: 3px 0; }
          .signature { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-box { width: 45%; text-align: center; }
          .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; font-size: 12px; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #95a5a6; border-top: 1px dashed #bdc3c7; padding-top: 10px; }
          @media print {
            .no-print { display: none; }
            body { background: white; }
          }
        </style>
      </head>
      <body>
    `;
    
    detailedPayrollData.forEach((detail, index) => {
      const emp = detail.employees;
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employé inconnu';
      const position = emp?.employee_positions?.name || 'Non spécifié';
      const department = emp?.employee_departments?.name || 'Non spécifié';
      
      htmlContent += `
        <div class="pay-slip ${index < detailedPayrollData.length - 1 ? 'page-break' : ''}">
          <div class="header">
            <div class="company-info">
              <h1>LA TERRA COTTA OUAGA</h1>
              <p>Ouagadougou, Burkina Faso</p>
              <p>Tél: 04 04 34 35</p>
            </div>
            <div class="slip-title">
              <h2>BULLETIN DE PAIE</h2>
              <p>Période: ${new Date(selectedPayrollPeriod.start_date).toLocaleDateString('fr-FR')} au ${new Date(selectedPayrollPeriod.end_date).toLocaleDateString('fr-FR')}</p>
              <p>N° Bulletin: BP-${String(index + 1).padStart(3, '0')}/${new Date().getFullYear()}</p>
            </div>
          </div>
          
          <div class="employee-info">
            <div class="grid">
              <div class="row"><span class="label">Nom:</span><span class="value">${empName}</span></div>
              <div class="row"><span class="label">Matricule:</span><span class="value">${emp?.employee_number || 'N/A'}</span></div>
              <div class="row"><span class="label">Poste:</span><span class="value">${position}</span></div>
              <div class="row"><span class="label">Département:</span><span class="value">${department}</span></div>
              ${emp?.bank_account ? `<div class="row"><span class="label">Compte bancaire:</span><span class="value">${emp.bank_account}</span></div>` : ''}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">RÉMUNÉRATION</div>
            <table>
              <tr><td>Salaire de base</td><td class="amount">${detail.base_salary.toLocaleString()} f CFA</td></tr>
              <tr><td>Heures supplémentaires (${detail.overtime_hours.toFixed(1)}h)</td><td class="amount">${detail.overtime_amount.toLocaleString()} f CFA</td></tr>
              <tr><td>Primes</td><td class="amount">${detail.bonus_amount.toLocaleString()} f CFA</td></tr>
              <tr class="total-row"><td><strong>SALAIRE BRUT</strong></td><td class="amount"><strong>${detail.gross_salary.toLocaleString()} f CFA</strong></td></tr>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">DÉDUCTIONS</div>
            <table>
              <tr><td>Avances sur salaire</td><td class="amount">-${detail.advance_deductions.toLocaleString()} f CFA</td></tr>
              <tr><td>Autres déductions</td><td class="amount">-${detail.other_deductions.toLocaleString()} f CFA</td></tr>
              <tr class="total-row"><td><strong>TOTAL DÉDUCTIONS</strong></td><td class="amount"><strong>-${(detail.advance_deductions + detail.other_deductions).toLocaleString()} f CFA</strong></td></tr>
            </table>
          </div>
          
          ${(detail.advances?.length > 0 || detail.bonuses?.length > 0 || detail.deductions?.length > 0) && `
            <div class="finance-details">
              <h4>📋 DÉTAIL DES OPÉRATIONS FINANCIÈRES</h4>
              ${detail.advances?.length > 0 ? `
                <div><strong>💰 Avances (${detail.advances.length}):</strong></div>
                <ul>
                  ${detail.advances.map(a => `<li>${new Date(a.advance_date).toLocaleDateString('fr-FR')}: ${a.amount.toLocaleString()} f CFA - ${a.reason || 'Sans motif'}</li>`).join('')}
                </ul>
              ` : ''}
              ${detail.bonuses?.length > 0 ? `
                <div><strong>🎁 Primes (${detail.bonuses.length}):</strong></div>
                <ul>
                  ${detail.bonuses.map(b => `<li>${new Date(b.bonus_date).toLocaleDateString('fr-FR')}: ${b.amount.toLocaleString()} f CFA - ${b.reason || 'Sans motif'} (${b.type || 'autre'})</li>`).join('')}
                </ul>
              ` : ''}
              ${detail.deductions?.length > 0 ? `
                <div><strong>️ Déductions (${detail.deductions.length}):</strong></div>
                <ul>
                  ${detail.deductions.map(d => `<li>${new Date(d.deduction_date).toLocaleDateString('fr-FR')}: ${d.amount.toLocaleString()} f CFA - ${d.reason || 'Sans motif'} (${d.type || 'autre'})</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `}
          
          <div class="net-salary">
            <div class="row">
              <span>SALAIRE NET À PAYER:</span>
              <span>${detail.net_salary.toLocaleString()} f CFA</span>
            </div>
          </div>
          
          <div class="signature">
            <div class="signature-box">
              <div class="signature-line">Signature de l'employé</div>
              <div style="font-size: 11px; margin-top: 5px;">${empName}</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Signature de l'employeur</div>
              <div style="font-size: 11px; margin-top: 5px;">La Direction</div>
            </div>
          </div>
          
          <div class="footer">
            Bulletin généré le ${new Date().toLocaleString('fr-FR')} • 
            Période de paie: ${selectedPayrollPeriod?.period_name} •
            Statut: ${detail.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}
          </div>
        </div>
      `;
    });
    
    htmlContent += `
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } catch (error: any) {
    console.error('Error printing pay slips:', error);
    alert(`Erreur: ${error.message}`);
  }
};


  // Composant pour l'onglet Congés
  const renderLeavesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Gestion des Congés</h3>
        <button 
          onClick={() => setShowLeaveForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          <span className="hidden sm:inline">Nouvelle Demande</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">En attente</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {leaveRequests.filter(l => l.status === 'pending').length}
              </p>
            </div>
            <div className="bg-amber-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Approuvés</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {leaveRequests.filter(l => l.status === 'approved').length}
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <UserCheck className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Rejetés</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {leaveRequests.filter(l => l.status === 'rejected').length}
              </p>
            </div>
            <div className="bg-red-100 p-2 rounded-lg">
              <UserCheck className="w-5 h-5 lg:w-6 lg:h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-slate-600 mb-1">Congés en cours</p>
              <p className="text-lg lg:text-2xl font-bold text-slate-900">
                {leaveRequests.filter(l => 
                  l.status === 'approved' && 
                  new Date(l.start_date) <= new Date() && 
                  new Date(l.end_date) >= new Date()
                ).length}
              </p>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <UserX className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">
                  Employé
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Période
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Jours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                  Motif
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaveRequests.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {(leave as any).employee_name || 'Employé inconnu'}
                      </div>
                      <div className="text-sm text-slate-500 md:hidden truncate">
                        {leave.leave_type === 'annual' ? 'Congé annuel' : 
                          leave.leave_type === 'sick' ? 'Congé maladie' : 
                          leave.leave_type === 'maternity' ? 'Congé maternité' : 
                          leave.leave_type === 'paternity' ? 'Congé paternité' : 
                          'Congé exceptionnel'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                    {leave.leave_type === 'annual' ? 'Congé annuel' : 
                      leave.leave_type === 'sick' ? 'Congé maladie' : 
                      leave.leave_type === 'maternity' ? 'Congé maternité' : 
                      leave.leave_type === 'paternity' ? 'Congé paternité' : 
                      'Congé exceptionnel'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">
                    {new Date(leave.start_date).toLocaleDateString('fr-FR')} - {new Date(leave.end_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden lg:table-cell">
                    {leave.total_days} jours
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-900 max-w-xs truncate hidden xl:table-cell">
                    {leave.reason}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      leave.status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : leave.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {leave.status === 'approved' ? 'Approuvé' : 
                        leave.status === 'rejected' ? 'Rejeté' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {leave.status === 'pending' && (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleApproveLeave(leave.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Approuver</span>
                          <span className="sm:hidden">✓</span>
                        </button>
                        <button
                          onClick={() => handleRejectLeave(leave.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition flex items-center"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Rejeter</span>
                          <span className="sm:hidden">✗</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leaveRequests.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Aucune demande de congé</p>
            <button
              onClick={() => setShowLeaveForm(true)}
              className="mt-4 bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Créer la première demande
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Modal de demande de congé
  const renderLeaveForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">Nouvelle Demande de Congé</h3>
          <button
            onClick={() => setShowLeaveForm(false)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleCreateLeaveRequest} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Employé *
            </label>
            <select
              value={leaveFormData.employee_id}
              onChange={(e) => setLeaveFormData(prev => ({ ...prev, employee_id: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Sélectionner un employé</option>
              {employees.filter(e => e.status === 'active').map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} - {employee.position_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type de congé *
              </label>
              <select
                value={leaveFormData.leave_type}
                onChange={(e) => setLeaveFormData(prev => ({ ...prev, leave_type: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="annual">Congé annuel</option>
                <option value="sick">Congé maladie</option>
                <option value="maternity">Congé maternité</option>
                <option value="paternity">Congé paternité</option>
                <option value="special">Congé exceptionnel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre de jours
              </label>
              <input
                type="number"
                value={Math.ceil((new Date(leaveFormData.end_date).getTime() - new Date(leaveFormData.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de début *
              </label>
              <input
                type="date"
                value={leaveFormData.start_date}
                onChange={(e) => setLeaveFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de fin *
              </label>
              <input
                type="date"
                value={leaveFormData.end_date}
                onChange={(e) => setLeaveFormData(prev => ({ ...prev, end_date: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Motif *
            </label>
            <textarea
              value={leaveFormData.reason}
              onChange={(e) => setLeaveFormData(prev => ({ ...prev, reason: e.target.value }))}
              required
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Décrivez la raison de votre demande de congé..."
            />
          </div>

          <div className="flex space-x-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowLeaveForm(false)}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
              disabled={formLoading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              {formLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Création...
                </>
              ) : (
                'Créer la demande'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Composant modal pour sélectionner le mode de paiement
  const renderPaymentMethodModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">Mode de Paiement</h3>
          <button
            onClick={() => setShowPaymentMethodModal(false)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mode de paiement *
            </label>
            <select
              value={paymentMethodData.type}
              onChange={(e) => setPaymentMethodData(prev => ({ 
                ...prev, 
                type: e.target.value as 'cash' | 'mobile_money' 
              }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="mobile_money">Mobile Money</option>
              <option value="cash">Espèces</option>
            </select>
          </div>

          {paymentMethodData.type === 'mobile_money' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Référence de transaction *
              </label>
              <input
                type="text"
                value={paymentMethodData.reference}
                onChange={(e) => setPaymentMethodData(prev => ({ ...prev, reference: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                placeholder="Numéro de transaction"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de paiement *
            </label>
            <input
              type="date"
              value={paymentMethodData.transaction_date}
              onChange={(e) => setPaymentMethodData(prev => ({ ...prev, transaction_date: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setShowPaymentMethodModal(false)}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (selectedPeriodForPayment) {
                  markPayrollAsPaid(selectedPeriodForPayment, paymentMethodData);
                  setShowPaymentMethodModal(false);
                }
              }}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
            >
              Confirmer le paiement
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Modal de calcul de paie
  const renderPayrollCalculator = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">Calcul de la Paie</h3>
          <button
            onClick={() => setShowPayrollCalculator(false)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-900 mb-2">
              Période: {new Date(payrollPeriod.start).toLocaleDateString('fr-FR')} - {new Date(payrollPeriod.end).toLocaleDateString('fr-FR')}
            </h4>
            <p className="text-slate-600">
              Calcul détaillé de la paie pour {payrollCalculations.length} employé(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700 min-w-[180px]">Employé</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden md:table-cell">Salaire Base</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden lg:table-cell">Jours travaillés</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden xl:table-cell">Heures Sup</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden xl:table-cell">Montant Heures Sup</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden md:table-cell">Primes</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden lg:table-cell">Déductions</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700 hidden xl:table-cell">Avances</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Salaire Brut</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Salaire Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payrollCalculations.map((calc, index) => {
                  const employee = employees.find(e => e.id === calc.employee_id);
                  return (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {employee ? `${employee.first_name} ${employee.last_name}` : 'Employé inconnu'}
                          </div>
                          <div className="text-sm text-slate-500 md:hidden">
                            {calc.base_salary.toLocaleString()} f CFA
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">{calc.base_salary.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">{calc.working_days}/{calc.actual_days}</td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">{calc.overtime_hours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">{calc.overtime_amount.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">{calc.bonus_amount.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">{calc.deduction_amount.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">{calc.advance_deductions.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right font-medium">{calc.gross_salary.toLocaleString()} f CFA</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{calc.net_salary.toLocaleString()} f CFA</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold">Total</td>
                  <td className="px-4 py-3 text-right font-bold hidden md:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.base_salary, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell"></td>
                  <td className="px-4 py-3 text-right font-bold hidden xl:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.overtime_hours, 0).toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-right font-bold hidden xl:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.overtime_amount, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 text-right font-bold hidden md:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.bonus_amount, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 text-right font-bold hidden lg:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.deduction_amount, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 text-right font-bold hidden xl:table-cell">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.advance_deductions, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.gross_salary, 0).toLocaleString()} f CFA
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">
                    {payrollCalculations.reduce((sum, calc) => sum + calc.net_salary, 0).toLocaleString()} f CFA
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex space-x-3 pt-6 mt-6 border-t border-slate-200">
            <button
              onClick={() => setShowPayrollCalculator(false)}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={savePayroll}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center"
            >
              <Send className="w-4 h-4 mr-2" />
              Enregistrer la Paie
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-lg text-slate-600">Chargement des employés...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Gestion des Employés</h2>
          <p className="text-slate-600 mt-1 text-sm md:text-base">Gestion complète du personnel du restaurant</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Export CSV</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setFormData(prev => ({
                ...prev,
                employee_number: generateEmployeeNumber()
              }));
              setShowEmployeeForm(true);
            }}
            className="bg-slate-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Nouvel Employé</span>
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="mb-6 border-b border-slate-200 overflow-x-auto">
        <nav className="flex space-x-4 min-w-max">
          {[
            { id: 'list', label: 'Liste', icon: Users, fullLabel: 'Liste des Employés' },
            { id: 'attendance', label: 'Présences', icon: Clock, fullLabel: 'Présences' },
            { id: 'payroll', label: 'Paie', icon: DollarSign, fullLabel: 'Paie' },
            { id: 'leaves', label: 'Congés', icon: CalendarDays, fullLabel: 'Congés' }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-2 md:px-4 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tab.fullLabel}</span>
                <span className="md:hidden">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'list' && (
        <>
          {/* Filtres et recherche */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6">
            {/* Dans la section des filtres, ajoutez ce bouton */}
<div className="mt-4 flex justify-between items-center">
  <div className="text-sm text-slate-600">
    {filteredEmployees.length} employé(s) trouvé(s) • {stats.activeEmployees} actif(s)
  </div>
  <button
    onClick={() => {
      setSearchTerm('');
      setStatusFilter('all');
      setDepartmentFilter('all');
    }}
    className="text-sm text-slate-600 hover:text-slate-900 transition flex items-center"
  >
    <X className="w-3 h-3 mr-1" />
    Réinitialiser les filtres
  </button>
</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rechercher
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Nom, prénom, matricule..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Statut
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Inactifs</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Département
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="all">Tous les départements</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
           <div className="mt-4 text-sm text-slate-600">
  {filteredEmployees.length} employé(s) trouvé(s) • {stats.activeEmployees} actif(s)
</div>
          </div>

        {/* Cartes de statistiques - Version corrigée */}
<div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs lg:text-sm text-slate-600 mb-1">Employés Actifs</p>
        <p className="text-lg lg:text-2xl font-bold text-slate-900">
          {stats.activeEmployees}
        </p>
      </div>
      <div className="bg-green-100 p-2 rounded-lg">
        <UserCheck className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
      </div>
    </div>
  </div>

  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs lg:text-sm text-slate-600 mb-1">Salaire mensuel</p>
        <p className="text-lg lg:text-2xl font-bold text-slate-900">
          {stats.totalMonthlySalary.toLocaleString()} f CFA
        </p>
      </div>
      <div className="bg-blue-100 p-2 rounded-lg">
        <DollarSign className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
      </div>
    </div>
  </div>

  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs lg:text-sm text-slate-600 mb-1">Primes ce mois</p>
        <p className="text-lg lg:text-2xl font-bold text-slate-900">
          {stats.totalBonuses.toLocaleString()} f CFA
        </p>
      </div>
      <div className="bg-green-100 p-2 rounded-lg">
        <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
      </div>
    </div>
  </div>

  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs lg:text-sm text-slate-600 mb-1">Déductions ce mois</p>
        <p className="text-lg lg:text-2xl font-bold text-slate-900">
          {stats.totalDeductions.toLocaleString()} f CFA
        </p>
      </div>
      <div className="bg-red-100 p-2 rounded-lg">
        <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-red-600" />
      </div>
    </div>
  </div>

  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs lg:text-sm text-slate-600 mb-1">Avances en cours</p>
        <p className="text-lg lg:text-2xl font-bold text-slate-900">
          {stats.totalAdvances.toLocaleString()} f CFA
        </p>
      </div>
      <div className="bg-amber-100 p-2 rounded-lg">
        <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
      </div>
    </div>
  </div>
</div>

          {/* Liste des employés */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[180px]">
                      Employé
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                      Poste
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                      Département
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                      Salaire
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                      Primes
                    </th> 
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                      Déductions
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                      Avances
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[120px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-slate-500 truncate">{employee.employee_number}</div>
                            <div className="text-xs text-slate-500 lg:hidden truncate">
                              {employee.position_name} • {employee.department_name}
                            </div>
                            <div className="text-xs text-slate-500 sm:hidden">
                              {employee.base_salary.toLocaleString()} f CFA
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden lg:table-cell">
                        {employee.position_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                        {employee.department_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 hidden sm:table-cell">
                        {employee.base_salary.toLocaleString()} f CFA
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 hidden xl:table-cell">
                        <span className={employee.total_bonuses > 0 ? 'text-green-600' : 'text-slate-500'}>
                          {employee.total_bonuses.toLocaleString()} f CFA
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 hidden xl:table-cell">
                        <span className={employee.total_deductions > 0 ? 'text-red-600' : 'text-slate-500'}>
                          {employee.total_deductions.toLocaleString()} f CFA
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 hidden xl:table-cell">
                        <span className={employee.total_advances > 0 ? 'text-amber-600' : 'text-slate-500'}>
                          {employee.total_advances.toLocaleString()} f CFA
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          employee.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button 
                            onClick={() => handleViewEmployee(employee)}
                            className="text-blue-600 hover:text-blue-900 transition p-1"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditEmployee(employee)}
                            className="text-slate-600 hover:text-slate-900 transition p-1"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          {/* Menu déroulant pour les actions financières */}
                          <div className="relative finance-menu-container">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFinanceMenu(employee.id);
                              }}
                              className="text-slate-600 hover:text-slate-900 transition p-1"
                              title="Actions financières"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {openFinanceMenu === employee.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                                <button 
                                  onClick={() => handleOpenAdvanceForm(employee)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-amber-600 hover:bg-slate-50"
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Ajouter une avance
                                </button>
                                <button 
                                  onClick={() => handleOpenBonusForm(employee)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-slate-50"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Ajouter une prime
                                </button>
                                <button 
                                  onClick={() => handleOpenDeductionForm(employee)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Ajouter une déduction
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <button
  onClick={() => handleDeleteEmployee(employee.id, employee.status)}
  className={`transition p-1 rounded ${
    employee.status === 'inactive'
      ? 'text-red-700 hover:bg-red-100 font-bold' // Plus visible pour la suppression définitive
      : 'text-red-600 hover:text-red-900'
  }`}
  title={employee.status === 'inactive' ? 'Supprimer définitivement' : 'Désactiver l\'employé'}
>
  <Trash2 className="w-4 h-4" />
</button>
                          <button 
                            onClick={() => handleCheckIn(employee.id)}
                            className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition hidden sm:inline-block"
                            title="Pointer l'arrivée"
                          >
                            Arrivée
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">
                  {searchTerm || statusFilter !== 'all' || departmentFilter !== 'all'
                    ? 'Aucun employé ne correspond aux critères' 
                    : 'Aucun employé enregistré'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && departmentFilter === 'all' && (
                  <button
                    onClick={() => {
                      resetForm();
                      setFormData(prev => ({
                        ...prev,
                        employee_number: generateEmployeeNumber()
                      }));
                      setShowEmployeeForm(true);
                    }}
                    className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
                  >
                    Ajouter le premier employé
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'attendance' && renderAttendanceTab()}
      {activeTab === 'payroll' && renderPayrollTab()}
      {activeTab === 'leaves' && renderLeavesTab()}

      {/* Modals */}
      {showPayrollCalculator && renderPayrollCalculator()}
      {showLeaveForm && renderLeaveForm()}
      {showPaymentMethodModal && renderPaymentMethodModal()}
      {showAdvanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Nouvelle Avance - {selectedEmployeeForFinance?.first_name} {selectedEmployeeForFinance?.last_name}
              </h3>
              <button
                onClick={() => setShowAdvanceForm(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitFinance} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Montant (f CFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={financeFormData.amount}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={financeFormData.date}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motif *
                </label>
                <textarea
                  value={financeFormData.reason}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  placeholder="Raison de l'avance..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanceForm(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {formLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBonusForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Nouvelle Prime - {selectedEmployeeForFinance?.first_name} {selectedEmployeeForFinance?.last_name}
              </h3>
              <button
                onClick={() => setShowBonusForm(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitFinance} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Montant (f CFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={financeFormData.amount}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={financeFormData.date}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motif *
                </label>
                <textarea
                  value={financeFormData.reason}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  placeholder="Raison de la prime..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBonusForm(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {formLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeductionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Nouvelle Déduction - {selectedEmployeeForFinance?.first_name} {selectedEmployeeForFinance?.last_name}
              </h3>
              <button
                onClick={() => setShowDeductionForm(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitFinance} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Montant (f CFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={financeFormData.amount}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={financeFormData.date}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motif *
                </label>
                <textarea
                  value={financeFormData.reason}
                  onChange={(e) => setFinanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  placeholder="Raison de la déduction..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeductionForm(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {formLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de création d'employé */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {selectedEmployee ? 'Modifier l\'employé' : 'Nouvel Employé'}
              </h3>
              <button
                onClick={() => {
                  setShowEmployeeForm(false);
                  setSelectedEmployee(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee} className="p-6 space-y-6">
              {/* Informations personnelles */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Informations Personnelles</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Matricule *
                    </label>
                    <input
                      type="text"
                      value={formData.employee_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="Généré automatiquement"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date d'embauche *
                    </label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="Prénom de l'employé"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="Nom de l'employé"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="+225 XX XX XX XX"
                    />
                  </div>
                </div>
              </div>

              {/* Poste et département */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Poste et Département</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Département *
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="">Sélectionner un département</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Poste *
                    </label>
                    <select
                      value={formData.position_id}
                      onChange={(e) => handlePositionChange(e.target.value)}
                      required
                      disabled={!formData.department_id}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 disabled:bg-slate-100"
                    >
                      <option value="">Sélectionner un poste</option>
                      {filteredPositions.map(position => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Informations salariales */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Informations Salariales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Type de salaire *
                    </label>
                    <select
                      value={formData.salary_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary_type: e.target.value as any }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="monthly">Mensuel</option>
                      <option value="hourly">Horaire</option>
                      <option value="daily">Journalier</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Salaire de base (f CFA) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.base_salary}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_salary: parseFloat(e.target.value) || 0 }))}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Informations supplémentaires */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Informations Supplémentaires</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Adresse
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="Adresse complète..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Compte bancaire
                      </label>
                      <input
                        type="text"
                        value={formData.bank_account}
                        onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        placeholder="Numéro de compte"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contact d'urgence
                      </label>
                      <input
                        type="text"
                        value={formData.emergency_contact}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        placeholder="Nom et téléphone"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      placeholder="Notes supplémentaires..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmployeeForm(false);
                    setSelectedEmployee(null);
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                  disabled={formLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition flex items-center justify-center"
                >
                  {formLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {selectedEmployee ? 'Modification...' : 'Création...'}
                    </>
                  ) : (
                    selectedEmployee ? 'Modifier l\'employé' : 'Créer l\'employé'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de détails de l'employé */}
      {showEmployeeDetails && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Détails de {selectedEmployee.first_name} {selectedEmployee.last_name}
              </h3>
              <button
                onClick={() => setShowEmployeeDetails(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Matricule</label>
                  <p className="text-slate-900">{selectedEmployee.employee_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Poste</label>
                  <p className="text-slate-900">{selectedEmployee.position_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Département</label>
                  <p className="text-slate-900">{selectedEmployee.department_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salaire</label>
                  <p className="text-slate-900">{selectedEmployee.base_salary.toLocaleString()} f CFA</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowEmployeeDetails(false)}
                  className="w-full bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal des détails de paie */}
{showPayrollDetails && selectedPayrollPeriod && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Détails de la Paie - {selectedPayrollPeriod.period_name}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {new Date(selectedPayrollPeriod.start_date).toLocaleDateString('fr-FR')} au {new Date(selectedPayrollPeriod.end_date).toLocaleDateString('fr-FR')}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
              selectedPayrollPeriod.status === 'paid' ? 'bg-green-100 text-green-800' :
              selectedPayrollPeriod.status === 'calculated' ? 'bg-blue-100 text-blue-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {selectedPayrollPeriod.status === 'paid' ? 'PAYÉ' :
               selectedPayrollPeriod.status === 'calculated' ? 'CALCULÉ' : 'BROUILLON'}
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => printAllPaySlips(selectedPayrollPeriod.id)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer tous les bulletins
          </button>
          <button
            onClick={() => setShowPayrollDetails(false)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {loadingDetails ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Chargement des détails...</p>
          </div>
        ) : (
          <>
            {/* Résumé global */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">Total Brut</p>
                <p className="text-xl font-bold text-blue-900">
                  {detailedPayrollData.reduce((sum, d) => sum + (d.gross_salary || 0), 0).toLocaleString()} f CFA
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">Total Déductions</p>
                <p className="text-xl font-bold text-red-900">
                  {detailedPayrollData.reduce((sum, d) => sum + (d.advance_deductions || 0) + (d.other_deductions || 0), 0).toLocaleString()} f CFA
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">Total Net</p>
                <p className="text-xl font-bold text-green-900">
                  {detailedPayrollData.reduce((sum, d) => sum + (d.net_salary || 0), 0).toLocaleString()} f CFA
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-700">Nombre d'employés</p>
                <p className="text-xl font-bold text-purple-900">
                  {detailedPayrollData.length}
                </p>
              </div>
            </div>
            
            {/* Tableau des employés */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Employé</th>
                    <th className="px-3 py-2 text-right">Base</th>
                    <th className="px-3 py-2 text-right hidden lg:table-cell">H. Sup</th>
                    <th className="px-3 py-2 text-right hidden md:table-cell">Primes</th>
                    <th className="px-3 py-2 text-right hidden lg:table-cell">Avances</th>
                    <th className="px-3 py-2 text-right hidden md:table-cell">Déduct.</th>
                    <th className="px-3 py-2 text-right">Brut</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {detailedPayrollData.map((detail, index) => {
                    const emp = detail.employees;
                    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Inconnu';
                    const hasFinance = (detail.advances?.length > 0 || detail.bonuses?.length > 0 || detail.deductions?.length > 0);
                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{empName}</div>
                          <div className="text-xs text-slate-500">{emp?.employee_number} • {emp?.employee_positions?.name}</div>
                          {hasFinance && (
                            <div className="flex space-x-1 mt-1">
                              {detail.advances?.length > 0 && <span className="text-xs bg-amber-100 text-amber-800 px-1 rounded">{detail.advances.length} avance(s)</span>}
                              {detail.bonuses?.length > 0 && <span className="text-xs bg-green-100 text-green-800 px-1 rounded">{detail.bonuses.length} prime(s)</span>}
                              {detail.deductions?.length > 0 && <span className="text-xs bg-red-100 text-red-800 px-1 rounded">{detail.deductions.length} déduct.</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">{detail.base_salary.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">{detail.overtime_hours.toFixed(1)}h</td>
                        <td className="px-3 py-3 text-right hidden md:table-cell text-green-600">+{detail.bonus_amount.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell text-amber-600">-{detail.advance_deductions.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right hidden md:table-cell text-red-600">-{detail.other_deductions.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-medium">{detail.gross_salary.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-bold text-green-600">{detail.net_salary.toLocaleString()}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => printSinglePaySlip(detail)}
                              className="text-purple-600 hover:text-purple-900 p-1"
                              title="Imprimer bulletin"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {selectedPayrollPeriod.status === 'calculated' && (
                              <button
                                onClick={() => handleEditPayrollDetail(detail)}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                // Afficher les détails financiers dans une alerte
                                let msg = `Détails pour ${empName}:\n\n`;
                                if (detail.advances?.length > 0) {
                                  msg += '💰 AVANCES:\n';
                                  detail.advances.forEach(a => {
                                    msg += `  - ${new Date(a.advance_date).toLocaleDateString('fr-FR')}: ${a.amount.toLocaleString()} f CFA (${a.reason || 'N/A'})\n`;
                                  });
                                }
                                if (detail.bonuses?.length > 0) {
                                  msg += '\n🎁 PRIMES:\n';
                                  detail.bonuses.forEach(b => {
                                    msg += `  - ${new Date(b.bonus_date).toLocaleDateString('fr-FR')}: ${b.amount.toLocaleString()} f CFA (${b.reason || 'N/A'})\n`;
                                  });
                                }
                                if (detail.deductions?.length > 0) {
                                  msg += '\n⚠️ DÉDUCTIONS:\n';
                                  detail.deductions.forEach(d => {
                                    msg += `  - ${new Date(d.deduction_date).toLocaleDateString('fr-FR')}: ${d.amount.toLocaleString()} f CFA (${d.reason || 'N/A'})\n`;
                                  });
                                }
                                if (!hasFinance) msg += 'Aucune opération financière pour cette période.';
                                alert(msg);
                              }}
                              className="text-slate-600 hover:text-slate-900 p-1"
                              title="Voir détails financiers"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold">
                  <tr>
                    <td className="px-3 py-3">TOTAL</td>
                    <td className="px-3 py-3 text-right">{detailedPayrollData.reduce((s, d) => s + d.base_salary, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell">{detailedPayrollData.reduce((s, d) => s + d.overtime_hours, 0).toFixed(1)}h</td>
                    <td className="px-3 py-3 text-right hidden md:table-cell text-green-600">+{detailedPayrollData.reduce((s, d) => s + d.bonus_amount, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell text-amber-600">-{detailedPayrollData.reduce((s, d) => s + d.advance_deductions, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right hidden md:table-cell text-red-600">-{detailedPayrollData.reduce((s, d) => s + d.other_deductions, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{detailedPayrollData.reduce((s, d) => s + d.gross_salary, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-green-600">{detailedPayrollData.reduce((s, d) => s + d.net_salary, 0).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}

{/* Modal de modification d'un détail de paie */}
{showEditPayroll && editingPayrollDetail && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <h3 className="text-xl font-bold text-slate-900">
          Modifier la Paie - {editingPayrollDetail.employees?.first_name} {editingPayrollDetail.employees?.last_name}
        </h3>
        <button
          onClick={() => setShowEditPayroll(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          ℹ️ Les modifications seront recalculées automatiquement (salaire brut et net).
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Salaire de base (f CFA)</label>
            <input
              type="number"
              value={editFormData.base_salary}
              onChange={(e) => setEditFormData({...editFormData, base_salary: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Heures supplémentaires</label>
            <input
              type="number"
              step="0.5"
              value={editFormData.overtime_hours}
              onChange={(e) => setEditFormData({...editFormData, overtime_hours: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Primes (f CFA)</label>
            <input
              type="number"
              value={editFormData.bonus_amount}
              onChange={(e) => setEditFormData({...editFormData, bonus_amount: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Avances (f CFA)</label>
            <input
              type="number"
              value={editFormData.advance_deductions}
              onChange={(e) => setEditFormData({...editFormData, advance_deductions: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Autres déductions (f CFA)</label>
            <input
              type="number"
              value={editFormData.other_deductions}
              onChange={(e) => setEditFormData({...editFormData, other_deductions: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <input
              type="text"
              value={editFormData.notes}
              onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Notes optionnelles..."
            />
          </div>
        </div>
        
        {/* Aperçu du calcul */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-semibold text-slate-900 mb-3">Aperçu du calcul</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Salaire de base:</span>
              <span>{editFormData.base_salary.toLocaleString()} f CFA</span>
            </div>
            <div className="flex justify-between">
              <span>Heures sup. ({editFormData.overtime_hours}h × {(editFormData.base_salary / 173 * 1.25).toFixed(0)} f):</span>
              <span className="text-green-600">+{(editFormData.overtime_hours * editFormData.base_salary / 173 * 1.25).toLocaleString(undefined, {maximumFractionDigits: 0})} f CFA</span>
            </div>
            <div className="flex justify-between">
              <span>Primes:</span>
              <span className="text-green-600">+{editFormData.bonus_amount.toLocaleString()} f CFA</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Salaire Brut:</span>
              <span>{(editFormData.base_salary + editFormData.overtime_hours * editFormData.base_salary / 173 * 1.25 + editFormData.bonus_amount).toLocaleString(undefined, {maximumFractionDigits: 0})} f CFA</span>
            </div>
            <div className="flex justify-between">
              <span>Avances:</span>
              <span className="text-red-600">-{editFormData.advance_deductions.toLocaleString()} f CFA</span>
            </div>
            <div className="flex justify-between">
              <span>Autres déductions:</span>
              <span className="text-red-600">-{editFormData.other_deductions.toLocaleString()} f CFA</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 text-green-600">
              <span>Salaire Net:</span>
              <span>{Math.max(0, editFormData.base_salary + editFormData.overtime_hours * editFormData.base_salary / 173 * 1.25 + editFormData.bonus_amount - editFormData.advance_deductions - editFormData.other_deductions).toLocaleString(undefined, {maximumFractionDigits: 0})} f CFA</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-3 pt-4">
          <button
            onClick={() => setShowEditPayroll(false)}
            className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSavePayrollEdit}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center"
          >
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
