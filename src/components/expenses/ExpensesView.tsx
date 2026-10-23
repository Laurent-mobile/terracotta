// src/components/expenses/ExpensesView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  DollarSign, Plus, Edit, Trash2, Filter, Calendar,
  Users, Home, Zap, Droplets, Wifi, Shield, TrendingUp,
  Lock, Unlock, Repeat, Receipt, Building, RefreshCw,
  X, Check, ShoppingCart, Truck, Search, Package, Info
} from 'lucide-react';
import { useModalReset } from '../../hooks/useModalReset';

interface Expense {
  id: string;
  category_id: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: 'cash' | 'mobile_money' | 'check' | 'bank_transfer';
  notes?: string;
  expense_type: 'general' | 'cash_register' | 'supplier_order';
  expense_category_type: 'fixed' | 'current';
  is_recurring: boolean;
  recurrence_frequency?: 'monthly' | 'weekly' | 'yearly';
  reference_type?: 'supplier_order' | 'supplier_payment';
  created_by: string;
  created_at: string;
  reference_id?: string;
  is_salary_expense?: boolean;
  payroll_period_id?: string;
  employee_id?: string;
  expense_categories?: {
    name: string;
    category_type: 'fixed' | 'current';
  };
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  category_type: 'fixed' | 'current';
  is_system_category: boolean;
}

interface SupplierOrderPayment {
  id: string;
  supplier_order_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier_orders?: {
    order_number: string;
    total_amount: number;
    suppliers?: {
      name: string;
    };
  };
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    role?: string;
  };
}

export default function ExpensesView() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierOrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSupplierPayments, setLoadingSupplierPayments] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'fixed' | 'supplier-payments' | 'salaries'>('current');
  const [showFilters, setShowFilters] = useState(false);

  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    category_type: 'current' as 'fixed' | 'current'
  });

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    category_type: 'current' as 'fixed' | 'current'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('cashier');

  const [formData, setFormData] = useState({
    category_id: '',
    description: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as 'cash' | 'mobile_money' | 'check' | 'bank_transfer',
    notes: '',
    expense_type: 'general' as 'general' | 'cash_register' | 'supplier_order',
    expense_category_type: 'current' as 'fixed' | 'current',
    is_recurring: false,
    recurrence_frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly'
  });

  // Utilisez le hook pour chaque modal
  useModalReset(showForm);
  useModalReset(showCategoryManager);
  useModalReset(showNewCategoryForm);

  // Fonction pour obtenir le premier jour du mois en cours
  const getFirstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  // Fonction pour obtenir le dernier jour du mois en cours
  const getLastDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  };

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: getFirstDayOfMonth(),
    endDate: getLastDayOfMonth()
  });
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
    checkUserRole();
    loadSupplierPayments();
  }, [dateFilter]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        setUserRole(profileData.role || 'cashier');
        return;
      }

      if (user.user_metadata?.role) {
        setUserRole(user.user_metadata.role);
      } else {
        setUserRole('cashier');
      }

    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('cashier');
    }
  };

  const isAdminOrManager = () => {
    return userRole === 'admin' || userRole === 'manager';
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📅 Chargement des données pour la période:', dateFilter.startDate, 'au', dateFilter.endDate);

      let expensesQuery = supabase
        .from('expenses')
        .select(`
        *,
        expense_categories(name, category_type)
      `)
        .eq('is_deleted', false) // 🔥 Exclure les dépenses supprimées
        .order('expense_date', { ascending: false });

      // Appliquer les filtres de date aux dépenses
      if (dateFilter.startDate) {
        expensesQuery = expensesQuery.gte('expense_date', dateFilter.startDate);
      }
      if (dateFilter.endDate) {
        expensesQuery = expensesQuery.lte('expense_date', dateFilter.endDate);
      }

      const [categoriesData, expensesData] = await Promise.all([
        supabase
          .from('expense_categories')
          .select('*')
          .order('category_type')
          .order('name'),
        expensesQuery
      ]);

      if (categoriesData.error) throw categoriesData.error;
      if (expensesData.error) throw expensesData.error;

      setCategories(categoriesData.data || []);

      const expensesWithDefaults = (expensesData.data || []).map(expense => ({
        ...expense,
        expense_category_type: expense.expense_category_type || 'current',
        is_recurring: expense.is_recurring || false,
        recurrence_frequency: expense.recurrence_frequency || 'monthly',
        is_salary_expense: expense.is_salary_expense || false
      }));

      setExpenses(expensesWithDefaults);
      console.log('✅ Dépenses chargées (excluant les supprimées):', expensesWithDefaults.length);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierPayments = async () => {
    try {
      setLoadingSupplierPayments(true);

      let paymentsQuery = supabase
        .from('supplier_order_payments')
        .select(`
          *,
          supplier_orders(
            order_number,
            total_amount,
            suppliers(name)
          )
        `)
        .order('payment_date', { ascending: false });

      if (dateFilter.startDate) {
        paymentsQuery = paymentsQuery.gte('payment_date', dateFilter.startDate);
      }
      if (dateFilter.endDate) {
        paymentsQuery = paymentsQuery.lte('payment_date', dateFilter.endDate);
      }

      const { data: paymentsData, error } = await paymentsQuery;

      if (error) throw error;

      setSupplierPayments(paymentsData || []);
      console.log('✅ Paiements fournisseurs chargés:', paymentsData?.length || 0);

    } catch (error) {
      console.error('Error loading supplier payments:', error);
      alert('Erreur lors du chargement des paiements fournisseurs');
    } finally {
      setLoadingSupplierPayments(false);
    }
  };

  // Le reste du code (groupPaymentsByMonth, groupExpensesByMonth, etc.) reste inchangé
  const groupPaymentsByMonth = (paymentsList: SupplierOrderPayment[]) => {
    const grouped: { [key: string]: SupplierOrderPayment[] } = {};

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
      }, {} as { [key: string]: SupplierOrderPayment[] });
  };

  const groupExpensesByMonth = (expensesList: Expense[]) => {
    const grouped: { [key: string]: Expense[] } = {};

    expensesList.forEach(expense => {
      const date = new Date(expense.expense_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(expense);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .reduce((acc, [month, expenses]) => {
        acc[month] = expenses.sort((a, b) =>
          new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
        );
        return acc;
      }, {} as { [key: string]: Expense[] });
  };

  const handleEditCategory = (category: ExpenseCategory) => {
    if (category.category_type === 'fixed' && !isAdminOrManager()) {
      alert('Seuls les administrateurs et managers peuvent modifier des catégories fixes');
      return;
    }

    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      category_type: category.category_type
    });
    setShowCategoryManager(true);
  };

  const handleCreateNewCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      category_type: 'current'
    });
    setShowCategoryManager(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      alert('Veuillez saisir un nom pour la catégorie');
      return;
    }

    if (categoryFormData.category_type === 'fixed' && !isAdminOrManager()) {
      alert('Seuls les administrateurs et managers peuvent créer/modifier des catégories fixes');
      return;
    }

    try {
      if (editingCategory) {
        const { data, error } = await supabase
          .from('expense_categories')
          .update({
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null,
            category_type: categoryFormData.category_type
          })
          .eq('id', editingCategory.id)
          .select()
          .single();

        if (error) throw error;

        setCategories(categories.map(cat =>
          cat.id === editingCategory.id ? data : cat
        ));

        alert('✅ Catégorie modifiée avec succès !');
      } else {
        const { data, error } = await supabase
          .from('expense_categories')
          .insert([{
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null,
            category_type: categoryFormData.category_type,
            is_system_category: false
          }])
          .select()
          .single();

        if (error) throw error;

        setCategories([...categories, data]);
        alert('✅ Catégorie créée avec succès !');
      }

      setShowCategoryManager(false);
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        category_type: 'current'
      });

    } catch (error: any) {
      console.error('Error saving category:', error);

      if (error.code === '23505') {
        alert('❌ Une catégorie avec ce nom existe déjà');
      } else if (error.code === '42501') {
        alert('❌ Erreur de permissions. Vous ne pouvez pas modifier ce type de catégorie');
      } else {
        alert(`❌ Erreur: ${error.message || 'Impossible de sauvegarder la catégorie'}`);
      }
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);

    if (!category) return;

    if (category.category_type === 'fixed' && !isAdminOrManager()) {
      alert('Seuls les administrateurs et managers peuvent supprimer des catégories fixes');
      return;
    }

    const { data: expensesUsingCategory } = await supabase
      .from('expenses')
      .select('id, description')
      .eq('category_id', categoryId)
      .limit(5);

    if (expensesUsingCategory && expensesUsingCategory.length > 0) {
      const expenseList = expensesUsingCategory.map(e => `- ${e.description}`).join('\n');
      alert(`❌ Impossible de supprimer cette catégorie car elle est utilisée par ${expensesUsingCategory.length} dépense(s):\n\n${expenseList}\n\nVeuillez d'abord modifier ou supprimer ces dépenses.`);
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(categories.filter(c => c.id !== categoryId));
      alert('✅ Catégorie supprimée avec succès !');

      if (formData.category_id === categoryId) {
        setFormData({ ...formData, category_id: '' });
      }

    } catch (error) {
      console.error('Error deleting category:', error);
      alert('❌ Erreur lors de la suppression de la catégorie');
    }
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      category_type: 'current'
    });
    setEditingCategory(null);
    setShowCategoryManager(false);
  };

  const getFilteredExpenses = () => {
    let filtered = expenses;

    if (activeTab === 'current') {
      filtered = filtered.filter(expense =>
        expense.expense_category_type === 'current' &&
        expense.expense_type !== 'supplier_order' &&
        !expense.reference_type?.includes('supplier')
        // ✅ SUPPRIMER cette ligne : !expense.is_salary_expense
      );
    } else if (activeTab === 'fixed') {
      filtered = filtered.filter(expense =>
        expense.expense_category_type === 'fixed' &&
        expense.expense_type !== 'supplier_order' &&
        !expense.reference_type?.includes('supplier')
        // ✅ SUPPRIMER cette ligne : !expense.is_salary_expense
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(expense => expense.category_id === categoryFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(expense => expense.expense_type === typeFilter);
    }

    return filtered;
  };

  const getExpenseStats = () => {
    let filteredExpenses = expenses;

    const currentExpenses = filteredExpenses.filter(e =>
      e.expense_category_type === 'current' &&
      e.expense_type !== 'supplier_order' &&
      !e.reference_type?.includes('supplier')
    );

    const fixedExpenses = filteredExpenses.filter(e =>
      e.expense_category_type === 'fixed' &&
      e.expense_type !== 'supplier_order' &&
      !e.reference_type?.includes('supplier')
    );

    const supplierExpenses = filteredExpenses.filter(e =>
      e.expense_type === 'supplier_order' ||
      e.reference_type?.includes('supplier')
    );

    return {
      currentExpenses,
      fixedExpenses,
      supplierExpenses
    };
  };

  const getSupplierPaymentStats = () => {
    return {
      payments: supplierPayments,
      totalAmount: supplierPayments.reduce((sum, p) => sum + p.amount, 0)
    };
  };

  const handleCreateCategory = async () => {
    if (!newCategoryData.name.trim()) {
      alert('Veuillez saisir un nom pour la catégorie');
      return;
    }

    if (newCategoryData.category_type === 'fixed' && !isAdminOrManager()) {
      alert('Seuls les administrateurs et managers peuvent créer des catégories fixes');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert([{
          name: newCategoryData.name.trim(),
          description: newCategoryData.description.trim() || null,
          category_type: newCategoryData.category_type,
          is_system_category: false
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);

        if (error.code === '42501') {
          if (newCategoryData.category_type === 'fixed') {
            alert('Erreur: Seuls les administrateurs et managers peuvent créer des catégories fixes');
          } else {
            alert('Erreur de permission: Veuillez contacter l\'administrateur');
          }
        }
        else if (error.code === '23505') {
          alert(`Erreur: Une catégorie nommée "${newCategoryData.name}" existe déjà`);
        }
        else {
          alert(`Erreur: ${error.message || 'Impossible de créer la catégorie'}`);
        }
        return;
      }

      if (!data) {
        alert('Erreur: Aucune donnée retournée après création');
        return;
      }

      setCategories(prev => [...prev, data]);

      if (data.category_type === formData.expense_category_type) {
        setFormData(prev => ({
          ...prev,
          category_id: data.id
        }));
      } else {
        alert(`⚠️ Catégorie créée avec succès !
        
        Cependant, cette catégorie est de type "${data.category_type === 'fixed' ? 'Fixe' : 'Courante'}"
        et ne peut pas être utilisée pour une dépense de type "${formData.expense_category_type === 'fixed' ? 'Fixe' : 'Courante'}".
        
        Vous devez changer le type de dépense ou créer une nouvelle catégorie.`);
      }

      setShowNewCategoryForm(false);
      setNewCategoryData({
        name: '',
        description: '',
        category_type: formData.expense_category_type
      });

      alert('✅ Catégorie créée avec succès !');

    } catch (error: any) {
      console.error('Unexpected error creating category:', error);
      alert('Erreur inattendue lors de la création de la catégorie');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (formData.expense_category_type === 'fixed' && !isAdminOrManager()) {
        alert('Seuls les administrateurs et managers peuvent créer des dépenses fixes');
        return;
      }

      if (!formData.category_id) {
        alert('Veuillez sélectionner ou créer une catégorie');
        return;
      }

      if (!Number.isInteger(formData.amount) || formData.amount <= 0) {
        alert('Le montant doit être un nombre entier positif (pas de décimales)');
        return;
      }

      if (formData.expense_type === 'supplier_order') {
        const existingSupplierExpense = expenses.find(e =>
          e.expense_type === 'supplier_order' &&
          e.description === formData.description &&
          Math.abs(e.amount - formData.amount) < 0.01 &&
          e.expense_date.split('T')[0] === formData.expense_date
        );

        if (existingSupplierExpense && !editingExpense) {
          if (!confirm('Une dépense fournisseur similaire existe déjà. Voulez-vous quand même créer cette dépense ?')) {
            return;
          }
        }
      }

      const expenseData = {
        ...formData,
        amount: Math.floor(formData.amount),
        created_by: user.id,
        created_at: new Date().toISOString()
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;
        alert('Dépense modifiée avec succès !');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData]);

        if (error) throw error;
        alert('Dépense créée avec succès !');
      }

      resetForm();
      await loadData();

    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Erreur lors de la sauvegarde de la dépense');
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;

    try {
      const expense = expenses.find(e => e.id === expenseId);
      if (expense?.expense_category_type === 'fixed' && !isAdminOrManager()) {
        alert('Seuls les administrateurs et managers peuvent supprimer des dépenses fixes');
        return;
      }

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      alert('Dépense supprimée avec succès !');

    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Erreur lors de la suppression de la dépense');
    }
  };

  const handleEdit = (expense: Expense) => {
    if (expense.expense_category_type === 'fixed' && !isAdminOrManager()) {
      alert('Seuls les administrateurs et managers peuvent modifier des dépenses fixes');
      return;
    }

    setEditingExpense(expense);
    setFormData({
      category_id: expense.category_id,
      description: expense.description,
      amount: expense.amount,
      expense_date: expense.expense_date.split('T')[0],
      payment_method: expense.payment_method,
      notes: expense.notes || '',
      expense_type: expense.expense_type,
      expense_category_type: expense.expense_category_type,
      is_recurring: expense.is_recurring || false,
      recurrence_frequency: expense.recurrence_frequency || 'monthly'
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      description: '',
      amount: 0,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      notes: '',
      expense_type: 'general',
      expense_category_type: isAdminOrManager() ? 'current' : 'current',
      is_recurring: false,
      recurrence_frequency: 'monthly'
    });
    setEditingExpense(null);
    setShowForm(false);
    setShowNewCategoryForm(false);
    setNewCategoryData({
      name: '',
      description: '',
      category_type: 'current'
    });
  };

  const getFilteredCategories = () => {
    if (isAdminOrManager()) {
      return categories.filter(cat => cat.category_type === formData.expense_category_type);
    }

    return categories.filter(cat => cat.category_type === 'current');
  };

  const resetFilters = () => {
    setCategoryFilter('all');
    setTypeFilter('all');
    setDateFilter({
      startDate: getFirstDayOfMonth(),
      endDate: getLastDayOfMonth()
    });
  };

  const applyDateFilters = () => {
    loadData();
    loadSupplierPayments();
  };

  const setCurrentMonth = () => {
    setDateFilter({
      startDate: getFirstDayOfMonth(),
      endDate: getLastDayOfMonth()
    });
  };

  const setPreviousMonth = () => {
    const now = new Date();
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    setDateFilter({
      startDate: firstDayPrevMonth.toISOString().split('T')[0],
      endDate: lastDayPrevMonth.toISOString().split('T')[0]
    });
  };

  const setCustomPeriod = (startDate: string, endDate: string) => {
    setDateFilter({
      startDate,
      endDate
    });
  };

  const getCategoryIcon = (categoryName: string) => {
    const icons: Record<string, any> = {
      'Loyer': Home,
      'Salaires': Users,
      'Électricité': Zap,
      'Eau': Droplets,
      'Internet': Wifi,
      'Assurance': Shield,
      'Impôts': Receipt,
      'Maintenance': TrendingUp,
      'Fournitures': Building,
      'Nourriture': DollarSign,
      'Transport': TrendingUp,
      'Marketing': TrendingUp,
      'Achats Fournisseurs': ShoppingCart,
      'Fournisseurs': Truck
    };
    return icons[categoryName] || DollarSign;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return '💰';
      case 'check': return '🏦';
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '💳';
      default: return '💵';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'check': return 'Chèque';
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Virement';
      default: return method;
    }
  };

  const getExpenseTypeText = (type: string) => {
    switch (type) {
      case 'general': return 'Générale';
      case 'cash_register': return 'Caisse';
      case 'supplier_order': return 'Commande fournisseur';
      default: return type;
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const filteredExpenses = getFilteredExpenses();
  const expenseStats = getExpenseStats();
  const supplierPaymentStats = getSupplierPaymentStats();
  const totalSupplierPayments = supplierPaymentStats.totalAmount;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestion des Dépenses</h2>
          <p className="text-slate-600 mt-1">
            {isAdminOrManager()
              ? 'Gérez toutes les dépenses (courantes, fixes et fournisseurs)'
              : 'Gérez les dépenses courantes de la caisse'}
          </p>
          <div className="mt-2 text-sm text-slate-500">
            Période : {new Date(dateFilter.startDate).toLocaleDateString('fr-FR')} au {new Date(dateFilter.endDate).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              loadData();
              loadSupplierPayments();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Rafraîchir</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-300 transition flex items-center space-x-2"
          >
            <Filter className="w-5 h-5" />
            <span>Filtres</span>
          </button>
          <button
            onClick={handleCreateNewCategory}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center space-x-2"
            disabled={!user}
          >
            <Receipt className="w-5 h-5" />
            <span>Gérer Catégories</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
            disabled={!user}
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle Dépense</span>
          </button>
        </div>
      </div>

      {/* Section Filtres */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Filtres de période</h3>
            <div className="flex space-x-2">
              <button
                onClick={setPreviousMonth}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
              >
                Mois précédent
              </button>
              <button
                onClick={setCurrentMonth}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition"
              >
                Mois en cours
              </button>
              <button
                onClick={resetFilters}
                className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 transition"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Période rapide
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    setCustomPeriod(
                      today.toISOString().split('T')[0],
                      today.toISOString().split('T')[0]
                    );
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    setCustomPeriod(
                      yesterday.toISOString().split('T')[0],
                      yesterday.toISOString().split('T')[0]
                    );
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
                >
                  Hier
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
                    setCustomPeriod(
                      weekStart.toISOString().split('T')[0],
                      today.toISOString().split('T')[0]
                    );
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
                >
                  Cette semaine
                </button>
                <button
                  onClick={setCurrentMonth}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition"
                >
                  Ce mois
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Autres filtres
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                  >
                    <option value="all">Toutes catégories</option>
                    {categories
                      .filter(cat => isAdminOrManager() || cat.category_type === 'current')
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <select value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                  >
                    <option value="all">Tous types</option>
                    <option value="general">Générale</option>
                    <option value="cash_register">Caisse</option>
                    <option value="supplier_order">Fournisseur</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={applyDateFilters}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Appliquer les filtres
            </button>
            <div className="text-sm text-slate-600">
              {filteredExpenses.length} dépenses trouvées • {supplierPayments.length} paiements fournisseurs
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('current');
                setFormData({ ...formData, expense_category_type: 'current' });
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'current'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Dépenses Courantes</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {expenseStats.currentExpenses.length}
              </span>
            </button>
            {isAdminOrManager() && (
              <button
                onClick={() => {
                  setActiveTab('fixed');
                  setFormData({ ...formData, expense_category_type: 'fixed' });
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'fixed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <Lock className="w-4 h-4" />
                <span>Dépenses Fixes</span>
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                  {expenseStats.fixedExpenses.length}
                </span>
                <span className="text-xs text-slate-400">(Admin/Manager)</span>
              </button>
            )}
            {/* Onglet Paiements Fournisseurs */}
            <button
              onClick={() => setActiveTab('supplier-payments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'supplier-payments'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <Truck className="w-4 h-4" />
              <span>Paiements Fournisseurs</span>
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                {supplierPaymentStats.payments.length}
              </span>
            </button>

            {/* Onglet Salaires - séparé */}
            {isAdminOrManager() && (
              <button
                onClick={() => setActiveTab('salaries')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === 'salaries'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span>Salaires</span>
                <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                  {expenses.filter(e => e.is_salary_expense).length}
                </span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Dépenses Courantes</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {expenseStats.currentExpenses
                  .reduce((sum, e) => sum + e.amount, 0)
                  .toLocaleString()} f CFA
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {expenseStats.currentExpenses.length} dépenses
                <span className="ml-2 text-xs">
                  {dateFilter.startDate === getFirstDayOfMonth() ? '(mois en cours)' : '(filtre)'}
                </span>
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {isAdminOrManager() && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Dépenses Fixes</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {expenseStats.fixedExpenses
                    .reduce((sum, e) => sum + e.amount, 0)
                    .toLocaleString()} f CFA
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {expenseStats.fixedExpenses.length} dépenses
                  <span className="ml-2 text-xs">
                    {dateFilter.startDate === getFirstDayOfMonth() ? '(mois en cours)' : '(filtre)'}
                  </span>
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Paiements Fournisseurs</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {supplierPaymentStats.totalAmount.toLocaleString()} f CFA
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {supplierPaymentStats.payments.length} paiement(s)
                <span className="ml-2 text-xs">
                  {dateFilter.startDate === getFirstDayOfMonth() ? '(mois en cours)' : '(filtre)'}
                </span>
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total des dépenses</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {(expenseStats.currentExpenses.reduce((sum, e) => sum + e.amount, 0) +
                  expenseStats.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) +
                  supplierPaymentStats.totalAmount).toLocaleString()} f CFA
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {expenseStats.currentExpenses.length +
                  expenseStats.fixedExpenses.length +
                  supplierPaymentStats.payments.length} dépenses totales
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Onglet Dépenses Courantes et Fixes */}
      {(activeTab === 'current' || activeTab === 'fixed') && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-medium text-slate-900">
                {activeTab === 'fixed' ? 'Dépenses Fixes' : 'Dépenses Courantes'}
                <span className="ml-2 text-sm text-slate-500">
                  ({filteredExpenses.length} dépenses)
                </span>
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Période : {new Date(dateFilter.startDate).toLocaleDateString('fr-FR')} au {new Date(dateFilter.endDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-sm text-slate-600">
              Total: {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} f CFA
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {activeTab === 'fixed'
                  ? 'Aucune dépense fixe enregistrée pour cette période'
                  : 'Aucune dépense courante enregistrée pour cette période'}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition"
              >
                Ajouter une dépense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Paiement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map((expense) => {
                    const CategoryIcon = getCategoryIcon(expense.expense_categories?.name || '');

                    return (
                      <tr key={expense.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-900">
                              {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <CategoryIcon className="w-4 h-4" />
                            <div>
                              <p className="text-sm text-slate-900">
                                {expense.expense_categories?.name || '-'}
                              </p>
                              <div className="flex items-center space-x-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${expense.expense_category_type === 'fixed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                                  }`}>
                                  {expense.expense_category_type === 'fixed' ? 'Fixe' : 'Courante'}
                                </span>
                                {expense.is_recurring && (
                                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded flex items-center">
                                    <Repeat className="w-3 h-3 mr-1" />
                                    {expense.recurrence_frequency === 'monthly' ? 'Mensuel' :
                                      expense.recurrence_frequency === 'weekly' ? 'Hebdo' : 'Annuel'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{expense.description}</p>
                            {expense.notes && (
                              <p className="text-sm text-slate-500">{expense.notes}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expense.expense_type === 'cash_register'
                            ? 'bg-green-100 text-green-800'
                            : expense.expense_type === 'supplier_order'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}>
                            {expense.expense_type === 'cash_register' ? '💼 Caisse' :
                              expense.expense_type === 'supplier_order' ? '📦 Fournisseur' : '📊 Générale'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {expense.expense_type === 'supplier_order' && expense.reference_id ? (
                            <div className="flex items-center space-x-2">
                              <ShoppingCart className="w-3 h-3 text-indigo-600" />
                              <span className="text-sm text-indigo-600">Commande</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900">
                          {expense.amount.toLocaleString()} f CFA
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getPaymentMethodIcon(expense.payment_method)}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expense.payment_method === 'cash'
                              ? 'bg-green-100 text-green-800'
                              : expense.payment_method === 'mobile_money'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {getPaymentMethodText(expense.payment_method)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="text-blue-600 hover:text-blue-900 transition"
                              disabled={expense.expense_category_type === 'fixed' && !isAdminOrManager()}
                              title={expense.expense_category_type === 'fixed' && !isAdminOrManager()
                                ? 'Réservé aux administrateurs'
                                : 'Modifier'}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="text-red-600 hover:text-red-900 transition"
                              disabled={expense.expense_category_type === 'fixed' && !isAdminOrManager()}
                              title={expense.expense_category_type === 'fixed' && !isAdminOrManager()
                                ? 'Réservé aux administrateurs'
                                : 'Supprimer'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                  Tous les paiements liés aux commandes fournisseurs
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Période : {new Date(dateFilter.startDate).toLocaleDateString('fr-FR')} au {new Date(dateFilter.endDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={loadSupplierPayments}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Rafraîchir</span>
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Rechercher fournisseur, commande ou référence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {loadingSupplierPayments ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-4 text-slate-600">Chargement des paiements fournisseurs...</p>
            </div>
          ) : (
            (() => {
              const filteredPayments = supplierPayments.filter(payment => {
                if (!searchTerm.trim()) return true;

                const searchLower = searchTerm.toLowerCase();
                const orderNumber = payment.supplier_orders?.order_number?.toLowerCase() || '';
                const supplierName = payment.supplier_orders?.suppliers?.name?.toLowerCase() || '';
                const referenceNumber = payment.reference_number?.toLowerCase() || '';
                const notes = payment.notes?.toLowerCase() || '';

                return orderNumber.includes(searchLower) ||
                  supplierName.includes(searchLower) ||
                  referenceNumber.includes(searchLower) ||
                  notes.includes(searchLower);
              });

              const groupedByMonth = groupPaymentsByMonth(filteredPayments);

              if (filteredPayments.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      {searchTerm.trim()
                        ? 'Aucun paiement fournisseur ne correspond à votre recherche'
                        : 'Aucun paiement fournisseur enregistré pour cette période'}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Les paiements sont créés lors du règlement des commandes fournisseurs
                    </p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-200">
                  {Object.entries(groupedByMonth).map(([month, monthPayments]) => {
                    const total = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
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
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900">
                              {total.toLocaleString()} f CFA
                            </div>
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


      {/* Onglet Salaires */}
      {activeTab === 'salaries' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-medium text-slate-900">
                Dépenses de Salaires
                <span className="ml-2 text-sm text-slate-500">
                  ({expenses.filter(e => e.is_salary_expense).length} salaires)
                </span>
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Période : {new Date(dateFilter.startDate).toLocaleDateString('fr-FR')} au {new Date(dateFilter.endDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-sm text-slate-600">
              Total: {expenses.filter(e => e.is_salary_expense).reduce((sum, e) => sum + e.amount, 0).toLocaleString()} f CFA
            </div>
          </div>

          {expenses.filter(e => e.is_salary_expense).length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Aucun salaire enregistré pour cette période</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Paiement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenses
                    .filter(e => e.is_salary_expense)
                    .map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-900">
                              {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-slate-900">
                              {expense.expense_categories?.name || 'Salaires'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {expense.description}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900">
                          {expense.amount.toLocaleString()} f CFA
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expense.payment_method === 'bank_transfer'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {getPaymentMethodText(expense.payment_method)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de gestion des catégories */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-11/12 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingCategory ? 'Modifier la catégorie' : 'Gérer les catégories'}
              </h3>
              <button
                onClick={resetCategoryForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 rounded-lg p-6 mb-6">
                <h4 className="font-medium text-slate-900 mb-4">
                  {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nom de la catégorie *
                    </label>
                    <input
                      type="text"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      placeholder="Ex: Loyer, Électricité, Fournitures..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                      placeholder="Description optionnelle..."
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Type de catégorie *
                    </label>
                    <select
                      value={categoryFormData.category_type}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, category_type: e.target.value as 'fixed' | 'current' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={!isAdminOrManager()}
                    >
                      <option value="current">Courante</option>
                      <option value="fixed">Fixe {!isAdminOrManager() && '(Admin/Manager)'}</option>
                    </select>

                    <div className="mt-2 space-y-1">
                      {categoryFormData.category_type === 'current' ? (
                        <p className="text-xs text-blue-600">
                          ✅ Visible par tous les utilisateurs. Pour les dépenses courantes quotidiennes.
                        </p>
                      ) : (
                        <p className="text-xs text-purple-600">
                          {isAdminOrManager() ? (
                            '🔒 Visible uniquement par les administrateurs et managers. Pour les dépenses fixes récurrentes.'
                          ) : (
                            '⚠️ Seuls les administrateurs et managers peuvent gérer les catégories fixes.'
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      disabled={!categoryFormData.name.trim() || (categoryFormData.category_type === 'fixed' && !isAdminOrManager())}
                      className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingCategory ? 'Modifier' : 'Créer'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-4">Catégories existantes</h4>

                {categories.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Aucune catégorie créée
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/12">
                            Nom
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/12">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-5/12">
                            Description
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/12">
                            Système
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/12">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {categories.map((category) => {
                          const CategoryIcon = getCategoryIcon(category.name);
                          const isSystemCategory = category.is_system_category;

                          return (
                            <tr key={category.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <CategoryIcon className="w-4 h-4" />
                                  <span className="text-sm font-medium text-slate-900">
                                    {category.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${category.category_type === 'fixed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                                  }`}>
                                  {category.category_type === 'fixed' ? 'Fixe 🔒' : 'Courante'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-slate-600 truncate max-w-xs">
                                  {category.description || '-'}
                                </p>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isSystemCategory ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                    Système
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Personnalisée
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => handleEditCategory(category)}
                                    className="text-blue-600 hover:text-blue-900 transition"
                                    disabled={isSystemCategory || (category.category_type === 'fixed' && !isAdminOrManager())}
                                    title={isSystemCategory ? 'Catégorie système non modifiable' : 'Modifier'}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="text-red-600 hover:text-red-900 transition"
                                    disabled={isSystemCategory || (category.category_type === 'fixed' && !isAdminOrManager())}
                                    title={isSystemCategory ? 'Catégorie système non supprimable' : 'Supprimer'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                      <div className="flex justify-between text-sm text-slate-600">
                        <div>
                          <span className="font-medium">{categories.length}</span> catégories au total
                        </div>
                        <div className="space-x-4">
                          <span>
                            <span className={`inline-block w-2 h-2 rounded-full bg-blue-500 mr-1`}></span>
                            Courantes: {categories.filter(c => c.category_type === 'current').length}
                          </span>
                          <span>
                            <span className={`inline-block w-2 h-2 rounded-full bg-purple-500 mr-1`}></span>
                            Fixes: {categories.filter(c => c.category_type === 'fixed').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création/modification de dépense */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {isAdminOrManager() && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type de Dépense *
                  </label>
                  <select
                    value={formData.expense_category_type}
                    onChange={(e) => setFormData({
                      ...formData,
                      expense_category_type: e.target.value as 'fixed' | 'current',
                      category_id: ''
                    })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="current">Dépense Courante</option>
                    <option value="fixed">Dépense Fixe (Admin/Manager)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.expense_category_type === 'fixed'
                      ? '🔒 Les dépenses fixes sont visibles uniquement par les administrateurs et managers'
                      : '💼 Les dépenses courantes sont visibles par tout le personnel'}
                  </p>
                </div>
              )}

              {formData.expense_type === 'supplier_order' && !editingExpense && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium">
                        ⚠️ Note importante sur les paiements fournisseurs
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Les paiements fournisseurs sont automatiquement créés lors du règlement des commandes
                        et apparaissent uniquement dans l'onglet "Paiements Fournisseurs".
                        <br /><br />
                        <strong>Conseil :</strong> Ne créez pas manuellement de dépenses de type "Commande fournisseur"
                        sauf pour des paiements exceptionnels non liés au système de commandes.
                        Utilisez plutôt l'onglet dédié pour suivre les paiements fournisseurs.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Catégorie *
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      required={!showNewCategoryForm}
                      disabled={showNewCategoryForm}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {getFilteredCategories().map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}
                        className="text-sm text-blue-600 hover:text-blue-800 transition"
                      >
                        {showNewCategoryForm ? '← Choisir une catégorie existante' : '+ Créer une nouvelle catégorie'}
                      </button>

                      {formData.category_id && (
                        <button
                          type="button"
                          onClick={() => {
                            const selectedCategory = categories.find(c => c.id === formData.category_id);
                            if (selectedCategory) {
                              handleEditCategory(selectedCategory);
                            }
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-800 transition"
                          title="Modifier cette catégorie"
                        >
                          <Edit className="w-4 h-4 inline mr-1" />
                          Modifier
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.expense_type}
                    onChange={(e) => setFormData({ ...formData, expense_type: e.target.value as 'general' | 'cash_register' | 'supplier_order' })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="general">Dépense générale</option>
                    <option value="cash_register">Dépense de caisse</option>
                    <option value="supplier_order">Commande fournisseur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Montant (f CFA) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mode de paiement *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'cash' | 'mobile_money' | 'check' | 'bank_transfer' })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="cash">Espèces</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="check">Chèque</option>
                    <option value="bank_transfer">Virement bancaire</option>
                  </select>
                </div>

                {formData.expense_category_type === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Récurrent ?
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">Dépense récurrente</span>
                    </div>

                    {formData.is_recurring && (
                      <select
                        value={formData.recurrence_frequency}
                        onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value as any })}
                        className="w-full mt-2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      >
                        <option value="monthly">Mensuelle</option>
                        <option value="weekly">Hebdomadaire</option>
                        <option value="yearly">Annuelle</option>
                      </select>
                    )}
                  </div>
                )}
              </div>

              {showNewCategoryForm && (
                <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-blue-900">Nouvelle Catégorie</h4>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryForm(false)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={newCategoryData.name}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                        placeholder="Nom de la catégorie (ex: Loyer, Électricité...)"
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <textarea
                        value={newCategoryData.description}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                        placeholder="Description (optionnelle)"
                        rows={2}
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Type de Catégorie *
                      </label>
                      <select
                        value={newCategoryData.category_type}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, category_type: e.target.value as 'fixed' | 'current' })}
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!isAdminOrManager() && formData.expense_category_type === 'current'}
                      >
                        <option value="current">Catégorie Courante</option>
                        <option
                          value="fixed"
                          disabled={!isAdminOrManager()}
                        >
                          Catégorie Fixe {!isAdminOrManager() && '(Admin/Manager uniquement)'}
                        </option>
                      </select>

                      <div className="mt-2 space-y-1">
                        {newCategoryData.category_type === 'current' ? (
                          <p className="text-xs text-blue-600">
                            ✅ Visible par tous les utilisateurs. Pour les dépenses courantes quotidiennes.
                          </p>
                        ) : (
                          <p className="text-xs text-purple-600">
                            {isAdminOrManager() ? (
                              <>
                                🔒 Visible uniquement par les administrateurs et managers.
                                Pour les dépenses fixes récurrentes (loyer, salaires, etc.).
                              </>
                            ) : (
                              <>
                                ⚠️ Vous n'avez pas les permissions pour créer des catégories fixes.
                                Contactez un administrateur.
                              </>
                            )}
                          </p>
                        )}

                        {formData.expense_category_type !== newCategoryData.category_type && (
                          <p className="text-xs text-amber-600">
                            ⚠️ Cette catégorie ({newCategoryData.category_type === 'fixed' ? 'Fixe' : 'Courante'})
                            ne pourra pas être utilisée pour une dépense de type
                            "{formData.expense_category_type === 'fixed' ? 'Fixe' : 'Courante'}".
                            {formData.expense_category_type === 'fixed' && !isAdminOrManager() &&
                              " Seuls les administrateurs/managers peuvent créer des dépenses fixes."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowNewCategoryForm(false)}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          !newCategoryData.name.trim() ||
                          (newCategoryData.category_type === 'fixed' && !isAdminOrManager())
                        }
                      >
                        <Check className="w-4 h-4" />
                        <span>Créer la catégorie</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder={formData.expense_category_type === 'fixed'
                    ? "Ex: Loyer mensuel, Facture d'électricité..."
                    : "Ex: Achat de fournitures, Transport..."}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!formData.category_id && !showNewCategoryForm}
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingExpense ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
