// src/components/cash/CashierQueue.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  Users,
  DollarSign,
  Printer,
  ArrowLeft,
  ListOrdered,
  Lock,
  Unlock,
  FileText,
  X,
  Receipt,
  Plus,
  AlertCircle,
  Eye,
  Search,
  RefreshCw,
  UserCheck,
  CalendarDays
} from 'lucide-react';

interface OrderForPayment {
  id: string;
  table_id: string;
  table_number: number;
  order_number: string;
  customer_count: number;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  status: string;
  notes?: string;
  server_name?: string;
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
}

export default function CashierQueue() {
  const { user } = useAuth();
  const { settings } = useRestaurant();
   console.log('🏧 CashierQueue monté, utilisateur:', user?.email);
  console.log('📊 Paramètres restaurant:', settings?.name);
  const [pendingOrders, setPendingOrders] = useState<OrderForPayment[]>([]);
  const [currentOrder, setCurrentOrder] = useState<OrderForPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ÉTAT DE LA CAISSE
  const [cashRegister, setCashRegister] = useState<any>(null);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingBalance, setClosingBalance] = useState<string>('');

  // NOUVEAUX ÉTATS POUR LA MODALE SESSION DE CAISSE
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [cashSalesData, setCashSalesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [newExpenseData, setNewExpenseData] = useState({
    category_id: '',
    amount: 0,
    description: '',
    notes: '',
    payment_method: 'cash' as 'cash' | 'mobile_money'
  });

  // AJOUTER ces états après les autres états existants
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintSearchTerm, setReprintSearchTerm] = useState('');
  const [reprintResults, setReprintResults] = useState<any[]>([]);
  const [loadingReprint, setLoadingReprint] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketPreview, setShowTicketPreview] = useState(false);

  // ÉTATS POUR LES AVANCES SALAIRE
  const [showAdvanceSalaryForm, setShowAdvanceSalaryForm] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [advanceData, setAdvanceData] = useState({
    employee_id: '',
    amount: 0,
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  const loadPendingOrders = async (forceSelectFirst = false) => {
    try {
      console.log('🔄 Chargement des commandes en attente...');
      
      const { data: orders, error } = await supabase
        .from('pos_orders')
        .select(`
          *,
          pos_order_items(*),
          pos_payments!left(id)
        `)
        .eq('status', 'ready')
        .is('pos_payments', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const ordersWithItems = (orders || []).map(order => ({
        id: order.id,
        table_id: order.table_id,
        table_number: order.table_number,
        order_number: order.order_number,
        customer_count: order.customer_count || 1,
        total_amount: order.total_amount || calculateTotal(order.pos_order_items || []),
        items: order.pos_order_items || [],
        created_at: order.created_at,
        status: order.status,
        notes: order.notes,
        server_name: order.server_name
      }));

      console.log(`✅ ${ordersWithItems.length} commande(s) en attente de paiement`);
      
      setPendingOrders(ordersWithItems);

      // Sélectionner automatiquement la première commande si demandé
      if (forceSelectFirst && ordersWithItems.length > 0 && !currentOrder) {
        console.log('🎯 Sélection automatique de la première commande');
        setCurrentOrder(ordersWithItems[0]);
      } else if (ordersWithItems.length === 0) {
        console.log('✅ Aucune commande en attente');
        setCurrentOrder(null);
      }

    } catch (error) {
      console.error('Error loading pending orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // AJOUTER cette fonction pour rechercher les tickets
  const searchTickets = async () => {
    if (!reprintSearchTerm.trim()) {
      setReprintResults([]);
      return;
    }

    try {
      setLoadingReprint(true);
      
      const searchTerm = reprintSearchTerm.trim();
      console.log('🔍 Recherche tickets:', searchTerm);
      
      let results = [];
      
      // ESSAI 1 : Recherche directe par receipt_number (le plus simple)
      try {
        const { data, error } = await supabase
          .from('pos_payments')
          .select(`
            *,
            pos_orders(
              order_number,
              table_number,
              customer_count,
              server_name,
              total_amount,
              created_at
            )
          `)
          .ilike('receipt_number', `%${searchTerm}%`)
          // Vérifier que le ticket client existe
          .not('customer_ticket', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (!error && data && data.length > 0) {
          console.log('✅ Résultats trouvés par reçu:', data.length);
          results = data;
        }
      } catch (error) {
        console.warn('⚠️ Erreur recherche par reçu:', error);
      }
      
      // ESSAI 2 : Si pas de résultats, chercher dans les commandes
      if (results.length === 0) {
        try {
          // D'abord chercher la commande
          const { data: orders, error: ordersError } = await supabase
            .from('pos_orders')
            .select('*')
            .or(`order_number.ilike.%${searchTerm}%,server_name.ilike.%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (!ordersError && orders && orders.length > 0) {
            // Pour chaque commande, chercher les paiements associés
            const orderIds = orders.map(order => order.id);
            const { data: payments, error: paymentsError } = await supabase
              .from('pos_payments')
              .select('*')
              .in('order_id', orderIds)
              .not('customer_ticket', 'is', null)
              .order('created_at', { ascending: false });
            
            if (!paymentsError && payments) {
              // Combiner les données
              results = payments.map(payment => {
                const order = orders.find(o => o.id === payment.order_id);
                return {
                  ...payment,
                  pos_orders: order ? {
                    order_number: order.order_number,
                    table_number: order.table_number,
                    customer_count: order.customer_count,
                    server_name: order.server_name,
                    total_amount: order.total_amount,
                    created_at: order.created_at
                  } : null
                };
              });
              console.log('✅ Résultats trouvés par commande:', results.length);
            }
          }
        } catch (error) {
          console.warn('⚠️ Erreur recherche par commande:', error);
        }
      }
      
      // ESSAI 3 : Recherche par table (si c'est un numéro)
      if (results.length === 0 && !isNaN(parseInt(searchTerm))) {
        try {
          const tableNumber = parseInt(searchTerm);
          const { data: orders, error: ordersError } = await supabase
            .from('pos_orders')
            .select('*')
            .eq('table_number', tableNumber)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (!ordersError && orders && orders.length > 0) {
            const orderIds = orders.map(order => order.id);
            const { data: payments, error: paymentsError } = await supabase
              .from('pos_payments')
              .select('*')
              .in('order_id', orderIds)
              .not('customer_ticket', 'is', null)
              .order('created_at', { ascending: false });
            
            if (!paymentsError && payments) {
              results = payments.map(payment => {
                const order = orders.find(o => o.id === payment.order_id);
                return {
                  ...payment,
                  pos_orders: order ? {
                    order_number: order.order_number,
                    table_number: order.table_number,
                    customer_count: order.customer_count,
                    server_name: order.server_name,
                    total_amount: order.total_amount,
                    created_at: order.created_at
                  } : null
                };
              });
              console.log('✅ Résultats trouvés par table:', results.length);
            }
          }
        } catch (error) {
          console.warn('⚠️ Erreur recherche par table:', error);
        }
      }
      
      setReprintResults(results);
      
      if (results.length === 0) {
        console.log('ℹ️ Aucun résultat trouvé pour:', searchTerm);
      }
      
    } catch (error: any) {
      console.error('❌ Erreur globale recherche tickets:', error);
      alert('Erreur lors de la recherche des tickets');
    } finally {
      setLoadingReprint(false);
    }
  };

  // MODIFIER cette fonction pour sauvegarder UNIQUEMENT le ticket client
  const saveTicketToDatabase = async (
    order: OrderForPayment, 
    receiptNumber: string, 
    amountPaid: number, 
    change: number
  ) => {
    try {
      // Générer UNIQUEMENT le ticket client
      const customerTicket = generateCustomerReceipt(order, receiptNumber, amountPaid, change, paymentMethod);
      
      // Sauvegarder UNIQUEMENT le ticket client dans la base
      const { error } = await supabase
        .from('pos_payments')
        .update({
          customer_ticket: customerTicket,
          ticket: null, // SUPPRIMER le ticket de caisse interne
          updated_at: new Date().toISOString()
        })
        .eq('receipt_number', receiptNumber);

      if (error) {
        console.error('Erreur sauvegarde ticket:', error);
        // Ne pas bloquer le processus de paiement si erreur de sauvegarde
      } else {
        console.log('✅ Ticket client sauvegardé dans la base');
      }
      
    } catch (error) {
      console.error('Erreur génération/sauvegarde ticket:', error);
    }
  };

  const loadCashRegister = async () => {
    try {
      setRegisterLoading(true);
      const { data, error } = await supabase
        .from('cash_register')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();

      if (error) throw error;
      setCashRegister(data);
    } catch (error) {
      console.error('Error loading cash register:', error);
      setCashRegister(null);
    } finally {
      setRegisterLoading(false);
    }
  };

  const loadExpenseCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setExpenseCategories(data || []);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  }, []);

    // Fonction pour charger les employés - CORRIGÉE
const loadEmployees = useCallback(async () => {
  try {
    console.log('👥 Chargement des employés pour avance salaire...');
    
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        employee_number,
        first_name,
        last_name,
        email,
        phone,
        hire_date,
        base_salary,
        status,
        created_at,
        employee_positions (
          id,
          name
        ),
        employee_departments (
          id,
          name
        )
      `)
      .eq('status', 'active')
      .order('first_name');
    
    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }
    
    console.log(`✅ ${data?.length || 0} employé(s) chargé(s)`);
    
    // Formater les données pour l'affichage
    const formattedEmployees = (data || []).map(employee => ({
      id: employee.id,
      employee_number: employee.employee_number || 'N/A',
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      position_id: employee.position_id,
      department_id: employee.department_id,
      hire_date: employee.hire_date || new Date().toISOString(),
      base_salary: employee.base_salary || 0,
      status: employee.status || 'active',
      created_at: employee.created_at || new Date().toISOString(),
      // Récupérer les noms depuis les relations
      position_name: employee.employee_positions?.name || 'Non spécifié',
      department_name: employee.employee_departments?.name || 'Non spécifié',
      display_name: `${employee.first_name || ''} ${employee.last_name || ''} (${employee.employee_number || 'N/A'})`,
      position_display: employee.employee_positions?.name || 'Non spécifié',
      department_display: employee.employee_departments?.name || 'Non spécifié'
    }));
    
    console.log('📋 Employés formatés:', formattedEmployees);
    setEmployeesList(formattedEmployees);
    
    return formattedEmployees;
  } catch (error: any) {
    console.error('❌ Erreur chargement employés:', error);
    
    // Afficher les détails de l'erreur
    if (error.code) {
      console.error('Code erreur:', error.code);
      console.error('Message erreur:', error.message);
      console.error('Détails erreur:', error.details);
    }
    
    // Fallback: charger sans les relations si erreur
    try {
      console.log('🔄 Tentative de chargement sans relations...');
      const { data: simpleData, error: simpleError } = await supabase
        .from('employees')
        .select(`
          id,
          employee_number,
          first_name,
          last_name,
          hire_date,
          status,
          created_at
        `)
        .eq('status', 'active')
        .order('first_name');
      
      if (!simpleError && simpleData) {
        const fallbackEmployees = simpleData.map(employee => ({
          id: employee.id,
          employee_number: employee.employee_number || 'N/A',
          first_name: employee.first_name || '',
          last_name: employee.last_name || '',
          position_name: 'Non spécifié',
          department_name: 'Non spécifié',
          status: employee.status || 'active',
          hire_date: employee.hire_date || new Date().toISOString(),
          created_at: employee.created_at || new Date().toISOString(),
          display_name: `${employee.first_name || ''} ${employee.last_name || ''} (${employee.employee_number || 'N/A'})`,
          position_display: 'Non spécifié',
          department_display: 'Non spécifié'
        }));
        
        setEmployeesList(fallbackEmployees);
        console.log(`✅ ${fallbackEmployees.length} employé(s) chargé(s) sans relations`);
        return fallbackEmployees;
      }
    } catch (fallbackError) {
      console.error('❌ Erreur fallback:', fallbackError);
    }
    
    setEmployeesList([]);
    return [];
  }
}, []);

  const loadCashSessionData = useCallback(async () => {
  if (!cashRegister) {
    console.warn('️ Aucune caisse ouverte pour charger les données');
    return;
  }
  try {
    setLoadingSales(true);
    console.log(' Chargement des données de session caisse...');
    
    // 1. Charger les ventes
    const { data: salesData, error: salesError } = await supabase
      .from('pos_payments')
      .select(`
        *,
        pos_orders(
          table_number,
          order_number,
          customer_count
        )
      `)
      .gte('created_at', cashRegister.opened_at)
      .lte('created_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('❌ Erreur chargement ventes:', salesError);
      throw salesError;
    }

    // 2. Charger les dépenses - FILTRE CORRIGÉ
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_categories(name),
        employees!expenses_employee_id_fkey(
          first_name,
          last_name,
          employee_number
        ),
        salary_advances!expenses_salary_advance_id_fkey(
          id,
          repayment_status
        )
      `)
      // 🔥 FILTRE CORRIGÉ : utiliser eq() simple au lieu de .or() complexe
      .eq('expense_type', 'cash_register')
      .gte('created_at', cashRegister.opened_at)
      .lte('created_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (expensesError) {
      console.warn('⚠️ Erreur chargement dépenses:', expensesError);
      setExpensesData([]);
    } else {
      setExpensesData(expensesData || []);
      console.log('📊 Dépenses chargées:', expensesData?.length || 0);
    }

    setCashSalesData(salesData || []);
    console.log('✅ Données session chargées:', {
      ventes: salesData?.length || 0,
      dépenses: expensesData?.length || 0
    });
  } catch (error: any) {
    console.error('❌ Erreur chargement données caisse:', error);
  } finally {
    setLoadingSales(false);
  }
}, [cashRegister]);

  const handleCreateCashExpense = async () => {
  if (!user || !cashRegister) {
    alert('Utilisateur non connecté ou caisse non trouvée');
    return;
  }
  if (!newExpenseData.category_id || newExpenseData.amount <= 0 || !newExpenseData.description.trim()) {
    alert('Veuillez remplir tous les champs obligatoires');
    return;
  }

  // Vérifier si c'est une catégorie salaire
  const selectedCategory = expenseCategories.find(cat => cat.id === newExpenseData.category_id);
  if (selectedCategory && (selectedCategory.name.toLowerCase().includes('salaire') ||
    selectedCategory.name.toLowerCase().includes('avance'))) {
    await loadEmployees();
    setShowAdvanceSalaryForm(true);
    return;
  }

  try {
    const expenseData = {
      category_id: newExpenseData.category_id,
      amount: newExpenseData.amount,
      description: newExpenseData.description,
      notes: newExpenseData.notes || null,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: newExpenseData.payment_method,
      expense_type: 'cash_register', // 🔥 IMPORTANT : doit correspondre au filtre
      created_by: user.id,
      created_at: new Date().toISOString()
    };

    console.log('📝 Création dépense:', expenseData);
    
    const { data, error } = await supabase
      .from('expenses')
      .insert([expenseData])
      .select()
      .single();

    if (error) {
      console.error(' Erreur création dépense:', error);
      throw new Error(`Erreur serveur: ${error.message}`);
    }

    console.log('✅ Dépense créée:', data);

    // 🔥 CORRECTION MAJEURE : Ajouter la dépense à la liste SANS recharger depuis le serveur
    if (data) {
      const categoryName = expenseCategories.find(cat => cat.id === data.category_id)?.name || 'Non catégorisé';
      const enhancedData = {
        ...data,
        expense_categories: { name: categoryName }
      };
      
      // Ajouter en tête de liste
      setExpensesData(prev => [enhancedData, ...prev]);
      console.log('📋 Dépense ajoutée à la liste locale. Total:', expensesData.length + 1);
    }

    // 🔥 RÉINITIALISER le formulaire
    setNewExpenseData({
      category_id: '',
      amount: 0,
      description: '',
      notes: '',
      payment_method: 'cash'
    });

    // 🔥 FERMER le formulaire
    setShowExpenseForm(false);

    // 🔥 MESSAGE DE SUCCÈS
    alert(`✅ Dépense de ${newExpenseData.amount.toLocaleString()} f CFA enregistrée !`);
    
    // 🔥 NE PAS APPELER loadCashSessionData() ici car le filtre est buggy
    // Les données sont déjà dans la liste locale
  } catch (error: any) {
    console.error('❌ Erreur création dépense:', error);
    alert(`Erreur: ${error.message || 'Une erreur est survenue'}`);
  }
};

  // Fonction pour sauvegarder l'avance salaire
  const handleSaveSalaryAdvance = async () => {
    if (!user || !cashRegister) {
      alert('Utilisateur non connecté ou caisse non trouvée');
      return;
    }

    if (!advanceData.employee_id || advanceData.amount <= 0 || !advanceData.reason.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!newExpenseData.category_id) {
      alert('Veuillez sélectionner une catégorie de dépense');
      return;
    }

    try {
      setIsProcessing(true);
      
      // 1. Créer l'avance salariale dans la table salary_advances
      const advancePayload = {
        employee_id: advanceData.employee_id,
        amount: advanceData.amount,
        reason: advanceData.reason,
        advance_date: advanceData.date,
        repayment_status: 'pending',
        created_by: user.id,
        notes: `Avance depuis la caisse #${cashRegister.id}`
      };

      console.log('📝 Création avance salaire:', advancePayload);
      
      const { data: advanceDataResult, error: advanceError } = await supabase
        .from('salary_advances')
        .insert([advancePayload])
        .select()
        .single();

      if (advanceError) {
        console.error('❌ Erreur création avance:', advanceError);
        throw new Error(`Erreur création avance: ${advanceError.message}`);
      }

      console.log('✅ Avance créée:', advanceDataResult);

      // 2. Créer la dépense de caisse correspondante
      const expenseData = {
        category_id: newExpenseData.category_id,
        amount: advanceData.amount,
        expense_date: advanceData.date,
        payment_method: newExpenseData.payment_method,
        description: `Avance salaire - ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`,
        notes: `Motif: ${advanceData.reason}\nMatricule: ${selectedEmployee?.employee_number}\nID Avance: ${advanceDataResult.id}`,
        expense_type: 'cash_register',
        expense_category_type: 'current',
        is_recurring: false,
        created_by: user.id,
        // Liens spécifiques
        salary_advance_id: advanceDataResult.id,
        employee_id: advanceData.employee_id,
        is_advance_salary: true,
        is_cash_register_expense: true,
        cash_register_id: cashRegister.id
      };

      console.log('📝 Création dépense liée:', expenseData);
      
      const { data: expenseDataResult, error: expenseError } = await supabase
        .from('expenses')
        .insert([expenseData])
        .select()
        .single();

      if (expenseError) {
        console.error('❌ Erreur création dépense:', expenseError);
        
        // Tentative de rollback : supprimer l'avance créée
        await supabase
          .from('salary_advances')
          .delete()
          .eq('id', advanceDataResult.id);
        
        throw new Error(`Erreur création dépense: ${expenseError.message}`);
      }

      console.log('✅ Dépense créée:', expenseDataResult);

      // 3. IMMÉDIAT: Ajouter la nouvelle dépense à la liste locale
      if (expenseDataResult) {
        const categoryName = expenseCategories.find(cat => cat.id === expenseDataResult.category_id)?.name || 'Salaire';
        const enhancedData = {
          ...expenseDataResult,
          expense_categories: { name: categoryName }
        };
        
        setExpensesData(prev => [enhancedData, ...prev]);
      }

      // 4. RECHARGER depuis le serveur (pour être sûr)
      await loadCashSessionData();

      // 5. Réinitialiser les formulaires
      setNewExpenseData({
        category_id: '',
        amount: 0,
        description: '',
        notes: '',
        payment_method: 'cash'
      });
      
      setAdvanceData({
        employee_id: '',
        amount: 0,
        reason: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      setSelectedEmployee(null);
      setShowAdvanceSalaryForm(false);
      setShowExpenseForm(false);

      // 6. Afficher message de succès
      alert(`✅ Avance salaire enregistrée !\n\nEmployé: ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}\nMontant: ${advanceData.amount.toLocaleString()} f CFA\n\nL'avance sera déduite lors du prochain calcul de paie.`);

      // 7. Mettre à jour l'employé dans le module employés si nécessaire
      const event = new CustomEvent('salary-advance-created', {
        detail: { employeeId: advanceData.employee_id }
      });
      window.dispatchEvent(event);

    } catch (error: any) {
      console.error('❌ Erreur enregistrement avance:', error);
      
      let errorMessage = 'Erreur lors de l\'enregistrement de l\'avance';
      
      if (error.message.includes('foreign key')) {
        errorMessage = 'Erreur: Employé introuvable dans la base de données';
      } else if (error.message.includes('montant')) {
        errorMessage = 'Erreur: Montant invalide';
      } else if (error.message.includes('caisse')) {
        errorMessage = 'Erreur: Caisse non disponible';
      }
      
      alert(`${errorMessage}\n\nDétails: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateSessionTotals = () => {
    const totalSales = cashSalesData.reduce((sum, sale) => {
      const netAmount = sale.amount_paid - (sale.change_amount || 0);
      return sum + netAmount;
    }, 0);
    
    const cashSales = cashSalesData
      .filter(sale => sale.payment_method === 'cash')
      .reduce((sum, sale) => {
        const netAmount = sale.amount_paid - (sale.change_amount || 0);
        return sum + netAmount;
      }, 0);
    
    // AJOUTER LE CALCUL POUR MOBILE MONEY
    const mobileMoneySales = cashSalesData
      .filter(sale => sale.payment_method === 'mobile_money')
      .reduce((sum, sale) => {
        const netAmount = sale.amount_paid - (sale.change_amount || 0);
        return sum + netAmount;
      }, 0);
    
    // AJOUTER LE CALCUL POUR CARTE
    const cardSales = cashSalesData
      .filter(sale => sale.payment_method === 'card')
      .reduce((sum, sale) => {
        const netAmount = sale.amount_paid - (sale.change_amount || 0);
        return sum + netAmount;
      }, 0);
    
    const totalExpenses = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
    
    return {
      totalSales,
      cashSales,
      mobileMoneySales, // NOUVEAU
      cardSales, // NOUVEAU
      totalExpenses,
      transactionCount: cashSalesData.length,
      expenseCount: expensesData.length,
      // Statistiques par méthode
      cashTransactions: cashSalesData.filter(s => s.payment_method === 'cash').length,
      mobileTransactions: cashSalesData.filter(s => s.payment_method === 'mobile_money').length,
      cardTransactions: cashSalesData.filter(s => s.payment_method === 'card').length,
    };
  };

  useEffect(() => {
    let isMounted = true;
  let ordersSubscription: any;
  let paymentsSubscription: any;
  let expensesSubscription: any;
  let intervalId: NodeJS.Timeout;
    
		const initializeData = async () => {
    if (!isMounted) return;
    
    await loadCashRegister();
    await loadPendingOrders();
    
    // Abonnements en temps réel
    ordersSubscription = supabase
      .channel('cashier-queue-orders')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pos_orders', filter: 'status=eq.ready' }, 
        async (payload) => {
          console.log('🔄 Changement commande:', payload.eventType);
          if (isMounted) await loadPendingOrders();
        }
      )
      .subscribe();


		paymentsSubscription = supabase
      .channel('cashier-queue-payments')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'pos_payments' }, 
        async (payload) => {
          console.log('💰 Nouveau paiement détecté');
          if (isMounted) await loadPendingOrders();
        }
      )
      .subscribe();

      expensesSubscription = supabase
      .channel('cashier-queue-expenses')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'expenses', filter: 'expense_type=eq.cash_register' }, 
        (payload) => {
          console.log('💰 Nouvelle dépense créée');
          if (isMounted && showSalesModal && cashRegister) {
            loadCashSessionData();
          }
        }
      )
      .subscribe();

      // Intervalle de rafraîchissement
      intervalId = setInterval(() => {
      if (isMounted) loadPendingOrders();
    }, 10000);
  };

  initializeData();

    return () => {
    isMounted = false;
    if (ordersSubscription) supabase.removeChannel(ordersSubscription);
    if (paymentsSubscription) supabase.removeChannel(paymentsSubscription);
    if (expensesSubscription) supabase.removeChannel(expensesSubscription);
    if (intervalId) clearInterval(intervalId);
  };
}, []); // Dépendances vides, mais isMounted géré

  useEffect(() => {
    if (cashRegister) {
      loadExpenseCategories();
    }
  }, [cashRegister]); 
    
  //useEffect pour le nettoyage des abonnements
  useEffect(() => {
    return () => {
      // Nettoyer tous les abonnements
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    // Vérifier les incohérences au chargement
    const checkInconsistencies = async () => {
      const { data: inconsistentOrders, error } = await supabase
        .from('pos_orders')
        .select(`
          id,
          order_number,
          status,
          pos_payments!left(id)
        `)
        .eq('status', 'ready')
        .not('pos_payments', 'is', null);

      if (!error && inconsistentOrders && inconsistentOrders.length > 0) {
        console.warn(`⚠️ ${inconsistentOrders.length} commande(s) avec incohérence détectée(s)`);
        
        // Corriger automatiquement si < 5 commandes
        if (inconsistentOrders.length < 5) {
          for (const order of inconsistentOrders) {
            await supabase
              .from('pos_orders')
              .update({
                status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);
          }
          console.log('✅ Incohérences corrigées automatiquement');
        }
      }
    };

    checkInconsistencies();
  }, []);

  useEffect(() => {
    // 1. Écouter l'événement de nouvelle commande prête
    const handleNewOrderReady = (event: any) => {
      const orderId = event.detail?.orderId;
      console.log('🔄 Nouvelle commande prête détectée:', orderId);
      
      // Forcer le rechargement des commandes
      loadPendingOrders(true); // true pour sélectionner la première commande
      
      // Si un orderId spécifique est fourni, essayer de le sélectionner
      if (orderId) {
        setTimeout(() => {
          const targetOrder = pendingOrders.find(order => order.id === orderId);
          if (targetOrder) {
            console.log('🎯 Commande spécifique trouvée, sélection...');
            setCurrentOrder(targetOrder);
          }
        }, 1000);
      }
    };

    // 2. Écouter l'événement de navigation vers le paiement
    const handleNavigateToPayment = (event: any) => {
      const orderId = event.detail?.orderId;
      const tableNumber = event.detail?.tableNumber;
      const orderNumber = event.detail?.orderNumber;
      
      console.log('💰 Commande demandée pour paiement:', { orderId, tableNumber, orderNumber });
      
      if (orderId) {
        // D'abord, forcer un rechargement des commandes
        loadPendingOrders(false);
        
        // Ensuite, essayer de sélectionner la commande
        setTimeout(() => {
          const targetOrder = pendingOrders.find(order => order.id === orderId);
          if (targetOrder) {
            console.log('✅ Commande trouvée, sélection...');
            setCurrentOrder(targetOrder);
            
            // Faire défiler vers la commande (optionnel)
            setTimeout(() => {
              const element = document.querySelector(`[data-order-id="${orderId}"]`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          } else {
            console.log('⚠️ Commande non trouvée, attente du rechargement...');
            // Attendre un peu plus et réessayer
            setTimeout(() => {
              loadPendingOrders(true); // Recharger et sélectionner la première
            }, 1500);
          }
        }, 800);
      }
    };

    window.addEventListener('new-order-ready', handleNewOrderReady);
    window.addEventListener('navigate-to-payment', handleNavigateToPayment);
    
    return () => {
      window.removeEventListener('new-order-ready', handleNewOrderReady);
      window.removeEventListener('navigate-to-payment', handleNavigateToPayment);
    };
  }, [pendingOrders, loadPendingOrders]);

  const calculateTotal = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const handleBottleConsumptionOnPayment = async (order: OrderForPayment) => {
    try {
      console.log('🍷 Gestion des consommations de bouteilles pour la commande:', order.order_number);
      
      for (const item of order.items) {
        try {
          const { data: menuItem, error } = await supabase
            .from('pos_menus')
            .select('id, sale_type, current_servings, servings_per_bottle, is_available, name')
            .eq('name', item.item_name)
            .single();

          if (error) {
            console.warn(`⚠️ Article non trouvé dans le menu: ${item.item_name}`, error);
            continue;
          }

          if (!menuItem) {
            console.warn(`⚠️ Menu item non trouvé: ${item.item_name}`);
            continue;
          }

          console.log(`📦 Traitement: ${item.item_name}`, {
            sale_type: menuItem.sale_type,
            current_servings: menuItem.current_servings,
            servings_per_bottle: menuItem.servings_per_bottle,
            quantity: item.quantity
          });

          if (menuItem.sale_type === 'consumption') {
            console.log(`🍾 Bouteille à la consommation détectée: ${menuItem.name}`);
            
            if (!menuItem.is_available) {
              console.error(`❌ Bouteille indisponible: ${menuItem.name}`);
              alert(`❌ La bouteille "${menuItem.name}" est actuellement indisponible !`);
              continue;
            }
            
            if (menuItem.current_servings < item.quantity) {
              const message = `❌ Pas assez de consommations pour "${menuItem.name}" : ${menuItem.current_servings} restantes, ${item.quantity} demandées`;
              console.error(message);
              alert(message);
              continue;
            }

            const newServings = menuItem.current_servings - item.quantity;
            console.log(`➖ Consommations déduites: ${item.quantity}, reste: ${newServings}/${menuItem.servings_per_bottle}`);

            const { error: updateError } = await supabase
              .from('pos_menus')
              .update({ 
                current_servings: newServings,
                updated_at: new Date().toISOString(),
                is_available: newServings > 0
              })
              .eq('id', menuItem.id);

            if (updateError) {
              console.error(`❌ Erreur mise à jour bouteille ${menuItem.name}:`, updateError);
              throw new Error(`Erreur lors de la mise à jour de la bouteille: ${updateError.message}`);
            }

            console.log(`✅ Bouteille mise à jour: ${menuItem.name} → ${newServings} consommations restantes`);

            if (newServings <= (menuItem.servings_per_bottle || 1) * 0.2) {
              console.warn(`⚠️ Bouteille presque vide: ${menuItem.name} (${newServings} restantes)`);
            }

            if (newServings === 0) {
              console.log(`🏁 BOUTEILLE VIDE: ${menuItem.name}`);
            }
          } else if (menuItem.sale_type === 'bottle') {
            console.log(`🍶 Vente à la bouteille standard: ${menuItem.name}`);
          } else {
            console.log(`🍹 Article standard: ${menuItem.name}`);
          }

        } catch (itemError) {
          console.error(`❌ Erreur traitement article ${item.item_name}:`, itemError);
        }
      }
      
      console.log('✅ Gestion des consommations terminée pour la commande:', order.order_number);
    } catch (error) {
      console.error('❌ Erreur globale dans handleBottleConsumptionOnPayment:', error);
      throw error;
    }
  };

  const handleOpenRegister = async () => {
    if (!user) {
      alert('Vous devez être connecté pour ouvrir la caisse');
      return;
    }

    const balance = parseFloat(openingBalance) || 0;
    if (balance < 0) {
      alert('Le solde d\'ouverture ne peut pas être négatif');
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_register')
        .insert({
          opening_balance: balance,
          opened_by: user.id,
          status: 'open'
        });

      if (error) throw error;

      setOpeningBalance('0');
      setShowOpenForm(false);
      await loadCashRegister();
      alert('Caisse ouverte avec succès!');
    } catch (error: any) {
      console.error('Error opening register:', error);
      alert(`Erreur lors de l'ouverture: ${error.message}`);
    }
  };

  const loadOpenedByUser = async (register: any) => {
    if (register.opened_by) {
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', register.opened_by)
        .single();
      
      if (!error && userData) {
        return userData;
      }
    }
    return null;
  };

  const handleCloseRegister = async () => {
    if (!user || !cashRegister) {
      alert('Erreur: Utilisateur non connecté ou caisse non trouvée');
      return;
    }

    const balance = parseFloat(closingBalance) || 0;
    if (balance < 0) {
      alert('Erreur: Le solde de fermeture ne peut pas être négatif');
      return;
    }

    if (!confirm(`Êtes-vous définitivement sûr de vouloir fermer la caisse ?\n\nSolde de fermeture: ${balance.toLocaleString()} f CFA\n\nCette action est irréversible.`)) {
      return;
    }

    setIsProcessing(true);

    try {
      console.log('=== DÉBUT FERMETURE CAISSE ===');

      let openedByUser = null;
      if (cashRegister.opened_by) {
        const userData = await loadOpenedByUser(cashRegister);
        openedByUser = userData;
      }

      // Récupérer TOUS les paiements
      const { data: payments, error: paymentsError } = await supabase
        .from('pos_payments')
        .select('amount_paid, payment_method, change_amount, created_at, receipt_number')
        .gte('created_at', cashRegister.opened_at)
        .lte('created_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (paymentsError) {
        console.error('❌ Erreur récupération paiements:', paymentsError);
        throw new Error(`Erreur lors de la récupération des paiements: ${paymentsError.message}`);
      }

      console.log(`✅ ${payments?.length || 0} paiements récupérés`);

      // Récupérer les DÉPENSES EN ESPÈCES DE CAISSE
      const { data: cashExpenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, payment_method, description, created_at, expense_type')
        .gte('created_at', cashRegister.opened_at)
        .lte('created_at', new Date().toISOString())
        .eq('payment_method', 'cash')
        .eq('expense_type', 'cash_register');

      if (expensesError) {
        console.error('❌ Erreur récupération dépenses:', expensesError);
        throw new Error(`Erreur lors de la récupération des dépenses: ${expensesError.message}`);
      }

      const totalCashExpenses = (cashExpenses || []).reduce((sum, expense) => sum + expense.amount, 0);
      console.log(`✅ ${cashExpenses?.length || 0} dépenses récupérées - Total: ${totalCashExpenses.toLocaleString()} f CFA`);

      const totals = (payments || []).reduce((acc, payment) => {
        const netAmount = payment.amount_paid - (payment.change_amount || 0);
        
        if (payment.payment_method === 'cash') {
          acc.cash_sales += netAmount;
          acc.total_cash_in += payment.amount_paid;
          acc.total_change_out += payment.change_amount || 0;
          acc.cash_transactions += 1;
        } else if (payment.payment_method === 'mobile_money') {
          acc.mobile_money_sales += netAmount;
          acc.mobile_transactions += 1;
        } else if (payment.payment_method === 'card') {
          acc.card_sales += netAmount;
          acc.card_transactions += 1;
        }
        
        acc.total_sales += netAmount;
        acc.total_transactions += 1;
        return acc;
      }, { 
        cash_sales: 0, 
        mobile_money_sales: 0, 
        card_sales: 0, 
        total_sales: 0,
        total_cash_in: 0,
        total_change_out: 0,
        cash_transactions: 0,
        mobile_transactions: 0,
        card_transactions: 0,
        total_transactions: 0
      });

      const { data: orders, error: ordersError } = await supabase
        .from('pos_orders')
        .select('id, order_number, total_amount, status, payment_method, paid_at')
        .gte('paid_at', cashRegister.opened_at)
        .lte('paid_at', new Date().toISOString())
        .eq('status', 'paid')
        .order('paid_at', { ascending: true });

      if (ordersError) {
        console.warn('⚠️ Erreur récupération commandes:', ordersError);
      }

      // SOLDE ATTENDU AVEC DÉPENSES DE CAISSE DÉDUITES
      const expectedBalance = cashRegister.opening_balance + totals.cash_sales - totalCashExpenses;
      const difference = balance - expectedBalance;

      console.log('=== CALCULS DÉTAILLÉS ===');
      console.log('Solde ouverture:', cashRegister.opening_balance.toLocaleString(), 'f CFA');
      console.log('Ventes espèces nettes:', totals.cash_sales.toLocaleString(), 'f CFA');
      console.log('Dépenses espèces caisse:', totalCashExpenses.toLocaleString(), 'f CFA');
      console.log('Solde attendu:', expectedBalance.toLocaleString(), 'f CFA');
      console.log('Solde réel:', balance.toLocaleString(), 'f CFA');
      console.log('Différence:', difference.toLocaleString(), 'f CFA');

      if (expectedBalance < 0) {
        console.warn('⚠️ Solde attendu négatif - vérification recommandée');
      }

      // AJOUTER: Sauvegarder le rapport AVANT de fermer la caisse
      let savedReport = null;
      const reportContent = generateClosingReport(
        { 
          ...cashRegister, 
          opened_by_user: openedByUser 
        }, 
        balance, 
        expectedBalance, 
        difference, 
        totals, 
        totalCashExpenses,
        payments || [],
        cashExpenses || [],
        orders || []
      );

      try {
        const { data: reportData, error: reportError } = await supabase
          .from('cash_register_reports')
          .insert({
            cash_register_id: cashRegister.id,
            report_date: new Date().toISOString().split('T')[0],
            opening_balance: cashRegister.opening_balance,
            closing_balance: balance,
            expected_balance: expectedBalance,
            difference: difference,
            cash_sales: totals.cash_sales,
            mobile_money_sales: totals.mobile_money_sales,
            card_sales: totals.card_sales,
            total_sales: totals.total_sales,
            report_content: reportContent,
            generated_by: user?.id
          })
          .select()
          .single();

        if (reportError) {
          console.error('❌ Erreur sauvegarde rapport:', reportError);
          throw new Error(`Erreur lors de la sauvegarde du rapport: ${reportError.message}`);
        } else {
          console.log('✅ Rapport sauvegardé avec succès');
          savedReport = reportData;
        }
      } catch (reportSaveError) {
        console.error('❌ Erreur lors de la sauvegarde du rapport:', reportSaveError);
        // NE PAS arrêter la fermeture si erreur de rapport
      }

      // Mettre à jour la caisse avec les informations du rapport
      const updateData = {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_balance: balance,
        expected_balance: expectedBalance,
        difference: difference,
        total_cash_sales: totals.cash_sales,
        total_mobile_sales: totals.mobile_money_sales,
        total_card_sales: totals.card_sales,
        total_sales: totals.total_sales,
        total_expenses: totalCashExpenses,
        closed_by: user.id,
        notes: `Fermeture manuelle - Écart: ${difference.toLocaleString()} f CFA - Transactions: ${totals.total_transactions} (Espèces: ${totals.cash_transactions}, Mobile: ${totals.mobile_transactions}, Carte: ${totals.card_transactions})`,
        report_id: savedReport?.id || null  // Lier le rapport à la caisse
      };

      const { error: updateError } = await supabase
        .from('cash_register')
        .update(updateData)
        .eq('id', cashRegister.id);

      if (updateError) {
        console.error('❌ Erreur mise à jour caisse:', updateError);
        throw new Error(`Erreur lors de la fermeture de la caisse: ${updateError.message}`);
      }

      console.log('✅ Caisse mise à jour avec succès');

      // AJOUTER: IMPRIMER AUTOMATIQUEMENT LE RAPPORT
      const printReport = (content: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Le pop-up a été bloqué. Veuillez autoriser les pop-ups pour imprimer le rapport.');
          return;
        }
        
        printWindow.document.write(content);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 500);
        }, 500);
      };

      // Générer et imprimer le rapport
      printReport(reportContent);

      setShowCloseForm(false);
      setClosingBalance('');
      await loadCashRegister();
      await loadPendingOrders();

      const successMessage = difference === 0 
        ? `✅ Caisse fermée avec succès !\n\nSolde correct - Aucun écart\nRapport généré et imprimé.`
        : `✅ Caisse fermée avec succès !\n\nÉcart détecté: ${difference.toLocaleString()} f CFA\n${difference > 0 ? 'Excédent' : 'Déficit'}\nRapport généré et imprimé.`;

      alert(successMessage);

      console.log('=== FERMETURE CAISSE TERMINÉE AVEC SUCCÈS ===');

    } catch (error: any) {
      console.error('❌ ERREUR FERMETURE CAISSE:', error);
      
      let errorMessage = 'Erreur lors de la fermeture de la caisse';
      
      if (error.message.includes('paiements')) {
        errorMessage = 'Erreur de connexion à la base de données. Vérifiez votre connexion internet.';
      } else if (error.message.includes('dépenses')) {
        errorMessage = 'Erreur lors de la récupération des dépenses. Contactez l\'administrateur.';
      } else if (error.message.includes('mise à jour')) {
        errorMessage = 'Erreur système. La caisse n\'a pas pu être fermée. Réessayez.';
      }
      
      alert(`${errorMessage}\n\nDétails: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // AJOUTER cette fonction pour générer un rapport imprimable complet
  const generatePrintableReport = (
    register: any,
    actualBalance: number,
    expectedBalance: number,
    difference: number,
    totals: any,
    cashExpenses: number,
    payments: any[] = [],
    expenses: any[] = []
  ) => {
    const totalVentes = totals.total_sales || 0;
    const ventesEspeces = totals.cash_sales || 0;
    const ventesMobile = totals.mobile_money_sales || 0;
    const ventesCarte = totals.card_sales || 0;
    const totalDepenses = cashExpenses || 0;
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Caisse - Fermeture</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 2cm;
        }
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .restaurant-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }
        .report-title {
            font-size: 22px;
            font-weight: bold;
            margin: 15px 0;
            color: #e74c3c;
        }
        .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        .section-title {
            background: #34495e;
            color: white;
            padding: 10px 15px;
            font-weight: bold;
            margin-bottom: 15px;
            border-radius: 4px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-card {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            background: #f9f9f9;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px dotted #ccc;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .table th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        .table td {
            padding: 10px;
            border: 1px solid #ddd;
        }
        .table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .total-section {
            background: #ecf0f1;
            border: 2px solid #bdc3c7;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 16px;
        }
        .balance-row {
            background: #2c3e50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            display: flex;
            justify-content: space-between;
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
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px dashed #7f8c8d;
            color: #7f8c8d;
            font-size: 12px;
        }
        .signature-area {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 45%;
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 60px;
            padding-top: 5px;
        }
        .timestamp {
            text-align: center;
            font-size: 11px;
            color: #95a5a6;
            margin-top: 10px;
        }
        .print-only {
            display: block;
        }
        @media screen {
            .print-only {
                display: none;
            }
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .container {
                padding: 0;
                max-width: 100%;
            }
            .print-only {
                display: block;
            }
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="restaurant-name">LA TERRA COTTA OUAGA</div>
            <div style="font-size: 14px; color: #666;">
                Adresse: Ouagadougou, 01 BP 3337 Ouaga<br>
                Tél: 04 04 34 35<br>
                Email: contact@terracotta.bf
            </div>
            <div class="report-title">RAPPORT DE FERMETURE DE CAISSE</div>
        </div>

        <div class="section">
            <div class="section-title">INFORMATIONS DE LA SESSION</div>
            <div class="info-grid">
                <div class="info-card">
                    <h3>OUVERTURE</h3>
                    <div class="info-row">
                        <span>Date:</span>
                        <span>${new Date(register.opened_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div class="info-row">
                        <span>Heure:</span>
                        <span>${new Date(register.opened_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div class="info-row">
                        <span>Agent:</span>
                        <span>${register.opened_by_user?.user_metadata?.full_name || user?.user_metadata?.full_name || user?.email || 'Non spécifié'}</span>
                    </div>
                    <div class="info-row">
                        <span>Solde Initial:</span>
                        <span><strong>${register.opening_balance.toLocaleString()} f CFA</strong></span>
                    </div>
                </div>

                <div class="info-card">
                    <h3>FERMETURE</h3>
                    <div class="info-row">
                        <span>Date:</span>
                        <span>${new Date().toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div class="info-row">
                        <span>Heure:</span>
                        <span>${new Date().toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div class="info-row">
                        <span>Agent:</span>
                        <span>${user?.user_metadata?.full_name || user?.email || 'Caissier'}</span>
                    </div>
                    <div class="info-row">
                        <span>Restaurant:</span>
                        <span>TERRACOTTA</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">RÉSUMÉ DES TRANSACTIONS</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Type de Transaction</th>
                        <th>Nombre</th>
                        <th>Montant (f CFA)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Ventes en Espèces</td>
                        <td>${totals.cash_transactions || 0}</td>
                        <td>${ventesEspeces.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Ventes Mobile Money</td>
                        <td>${totals.mobile_transactions || 0}</td>
                        <td>${ventesMobile.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Ventes par Carte</td>
                        <td>${totals.card_transactions || 0}</td>
                        <td>${ventesCarte.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td><strong>Total Ventes</strong></td>
                        <td><strong>${totals.total_transactions || 0}</strong></td>
                        <td><strong>${totalVentes.toLocaleString()}</strong></td>
                    </tr>
                    <tr>
                        <td>Dépenses de Caisse</td>
                        <td>${expenses.length}</td>
                        <td style="color: #e74c3c;">- ${totalDepenses.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="total-section">
            <div class="total-row">
                <span>Solde d'Ouverture:</span>
                <span>${register.opening_balance.toLocaleString()} f CFA</span>
            </div>
            <div class="total-row">
                <span>+ Ventes en Espèces:</span>
                <span>+ ${ventesEspeces.toLocaleString()} f CFA</span>
            </div>
            <div class="total-row">
                <span>- Dépenses en Espèces:</span>
                <span>- ${totalDepenses.toLocaleString()} f CFA</span>
            </div>
            <div class="balance-row">
                <span>Solde Théorique:</span>
                <span>${expectedBalance.toLocaleString()} f CFA</span>
            </div>
            <div class="balance-row">
                <span>Solde Réel Compté:</span>
                <span>${actualBalance.toLocaleString()} f CFA</span>
            </div>
        </div>

        <div class="section">
            <div class="difference ${difference === 0 ? 'zero' : difference > 0 ? 'positive' : 'negative'}">
                ${difference === 0 ? '✅ SOLDE CORRECT' : 
                  difference > 0 ? `⚠️ EXCÉDENT DE ${difference.toLocaleString()} f CFA` : 
                  `❌ DÉFICIT DE ${Math.abs(difference).toLocaleString()} f CFA`}
            </div>
        </div>

        <div class="section">
            <div class="section-title">DÉTAIL DES PAIEMENTS</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Heure</th>
                        <th>Type</th>
                        <th>Table</th>
                        <th>Montant</th>
                        <th>Monnaie</th>
                        <th>Net</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.slice(0, 50).map(payment => `
                        <tr>
                            <td>${new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>
                                <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; 
                                    ${payment.payment_method === 'cash' ? 'background: #d5f5e3; color: #27ae60;' : 
                                      payment.payment_method === 'card' ? 'background: #d6eaf8; color: #3498db;' : 
                                      'background: #e8daef; color: #8e44ad;'}">
                                    ${payment.payment_method === 'cash' ? 'ESPÈCES' : 
                                     payment.payment_method === 'card' ? 'CARTE' : 'MOBILE'}
                                </span>
                            </td>
                            <td>${payment.pos_orders?.table_number || 'N/A'}</td>
                            <td>${payment.amount_paid.toLocaleString()}</td>
                            <td>${(payment.change_amount || 0).toLocaleString()}</td>
                            <td><strong>${(payment.amount_paid - (payment.change_amount || 0)).toLocaleString()}</strong></td>
                        </tr>
                    `).join('')}
                    ${payments.length > 50 ? `
                        <tr>
                            <td colspan="6" style="text-align: center; font-style: italic;">
                                ... et ${payments.length - 50} autres transactions
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>

        ${expenses.length > 0 ? `
        <div class="section">
            <div class="section-title">DÉTAIL DES DÉPENSES (${expenses.length})</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.slice(0, 20).map(expense => `
                        <tr>
                            <td>${new Date(expense.created_at).toLocaleDateString('fr-FR')}</td>
                            <td>${expense.description}</td>
                            <td style="color: #e74c3c;">- ${expense.amount.toLocaleString()} f CFA</td>
                        </tr>
                    `).join('')}
                    ${expenses.length > 20 ? `
                        <tr>
                            <td colspan="3" style="text-align: center; font-style: italic;">
                                ... et ${expenses.length - 20} autres dépenses
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="signature-area">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Signature du Caissier</div>
                <div style="font-size: 12px; margin-top: 5px;">
                    ${user?.user_metadata?.full_name || user?.email || 'Caissier'}
                </div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Signature du Responsable</div>
            </div>
        </div>

        <div class="footer">
            <div>Rapport généré automatiquement par le système de gestion de caisse</div>
            <div class="timestamp">
                Généré le ${new Date().toLocaleString('fr-FR')} • 
                ID Session: ${register.id.substring(0, 8).toUpperCase()}
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;
  };

  const restoreStock = async (orderId: string) => {
    try {
      console.log(`🔄 Restauration du stock pour la commande ${orderId}`);

      const { data: orderItems, error } = await supabase
        .from('pos_order_items')
        .select('menu_item_id, quantity')
        .eq('order_id', orderId);

      if (error) throw error;

      if (!orderItems || orderItems.length === 0) {
        console.log('Aucun article trouvé pour cette commande');
        return;
      }

      for (const item of orderItems) {
        const { data: menuIngredients, error: ingredientsError } = await supabase
          .from('menu_ingredients')
          .select('inventory_item_id, quantity_required')
          .eq('menu_id', item.menu_item_id);

        if (ingredientsError) {
          console.error('Erreur récupération ingrédients:', ingredientsError);
          continue;
        }

        for (const ingredient of menuIngredients || []) {
          const restoredQuantity = ingredient.quantity_required * item.quantity;
          
          const { data: inventoryItem, error: inventoryError } = await supabase
            .from('inventory_items')
            .select('current_quantity')
            .eq('id', ingredient.inventory_item_id)
            .single();

          if (inventoryError) {
            console.error('Erreur récupération stock:', inventoryError);
            continue;
          }

          const newQuantity = (inventoryItem.current_quantity || 0) + restoredQuantity;

          await supabase
            .from('inventory_items')
            .update({
              current_quantity: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', ingredient.inventory_item_id);

          await supabase
            .from('inventory_transactions')
            .insert({
              inventory_item_id: ingredient.inventory_item_id,
              transaction_type: 'restock',
              quantity: restoredQuantity,
              reference_type: 'order_cancellation',
              reference_id: orderId,
              notes: `Annulation commande: ${orderId}`,
              created_by: user?.id
            });

          console.log(`✅ Stock restauré: ${ingredient.inventory_item_id} +${restoredQuantity}`);
        }
      }

      console.log('✅ Tous les stocks restaurés avec succès');
    } catch (error) {
      console.error('❌ Erreur restauration stock:', error);
    }
  };

  const generateClosingReport = (
    register: any, 
    actualBalance: number, 
    expectedBalance: number, 
    difference: number, 
    totals: any,
    cashExpenses: number,
    payments: any[] = [],
    expenses: any[] = [],
    orders: any[] = []
  ): string => {
    const cashTransactionCount = payments.filter(p => p.payment_method === 'cash').length;
    const mobileTransactionCount = payments.filter(p => p.payment_method === 'mobile_money').length;
    const cardTransactionCount = payments.filter(p => p.payment_method === 'card').length;

    const reportContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rapport de Fermeture de Caisse</title>
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          line-height: 1.4;
        }
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 15mm;
          box-sizing: border-box;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 3px double #2c3e50;
          padding-bottom: 15px;
        }
        .restaurant-name {
          font-size: 26px;
          font-weight: bold;
          margin: 10px 0;
          color: #2c3e50;
          text-transform: uppercase;
        }
        .report-title {
          font-size: 22px;
          font-weight: bold;
          margin: 15px 0;
          color: #e74c3c;
        }
        .contact-info {
          font-size: 14px;
          color: #666;
          margin: 5px 0;
        }
        .section {
          margin: 20px 0;
        }
        .section-title {
          background: #34495e;
          color: white;
          padding: 5px 10px;
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 15px;
          border-radius: 4px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .info-card {
          border: 1px solid #bdc3c7;
          border-radius: 6px;
          padding: 15px;
          background: #f8f9fa;
        }
        .info-card h4 {
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: 14px;
          border-bottom: 1px solid #bdc3c7;
          padding-bottom: 5px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 13px;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 13px;
        }
        .summary-table th {
          background: #34495e;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #2c3e50;
        }
        .summary-table td {
          padding: 10px 8px;
          border: 1px solid #bdc3c7;
        }
        .summary-table tr:nth-child(even) {
          background: #f8f9fa;
        }
        .total-section {
          background: #000000;
          border: 2px solid #bdc3c7;
          border-radius: 6px;
          padding: 20px;
          margin: 25px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 12px 0;
          font-size: 15px;
          font-weight: bold;
        }
        .balance-row {
          display: flex;
          justify-content: space-between;
          margin: 15px 0;
          padding: 12px;
          background: #000000;
          color: white;
          border-radius: 4px;
          font-size: 16px;
          font-weight: bold;
        }
        .difference {
          text-align: center;
          padding: 15px;
          margin: 20px 0;
          border-radius: 6px;
          font-size: 18px;
          font-weight: bold;
        }
        .difference.zero {
          background: #d5f5e3;
          color: #27ae60;
          border: 2px solid #27ae60;
        }
        .difference.positive {
          background: #fef9e7;
          color: #f39c12;
          border: 2px solid #f39c12;
        }
        .difference.negative {
          background: #fdedec;
          color: #e74c3c;
          border: 2px solid #e74c3c;
        }
        .notification {
          text-align: center;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
          font-size: 20px;
          font-weight: bold;
        }
        .notification.correct {
          background: #d5f5e3;
          color: #27ae60;
          border: 3px solid #27ae60;
        }
        .notification.problem {
          background: #fdedec;
          color: #e74c3c;
          border: 3px solid #e74c3c;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px dashed #7f8c8d;
          color: #7f8c8d;
          font-size: 12px;
        }
        .signature-area {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        .signature-line {
          border-top: 1px solid #333;
          padding-top: 5px;
          text-align: center;
          font-size: 12px;
        }
        .timestamp {
          font-size: 11px;
          color: #95a5a6;
          text-align: center;
          margin-top: 10px;
        }
        @media print {
          body { margin: 0; }
          .a4-container { 
            padding: 15mm; 
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="a4-container">
        <div class="header">
          <div class="restaurant-name">LA TERRA COTTA OUAGA</div>
          <div class="contact-info">
            Adresse: Ouagadougou, 01 BP 3337 Ouaga<br>
            Tél: 04 04 34 35
          </div>
          <div class="report-title">RAPPORT DE CAISSE</div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h4>OUVERTURE</h4>
            <div class="info-row">
              <span>Date:</span>
              <span>${new Date(register.opened_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="info-row">
              <span>Heure:</span>
              <span>${new Date(register.opened_at).toLocaleTimeString('fr-FR')}</span>
            </div>
            <div class="info-row">
              <span>Agent:</span>
              <span>${register.opened_by_user?.user_metadata?.full_name || user?.user_metadata?.full_name || user?.email || 'Non spécifié'}</span>
            </div>
            <div class="info-row">
              <span>Solde Début:</span>
              <span><strong>${register.opening_balance.toLocaleString()} f CFA</strong></span>
            </div>
          </div>

          <div class="info-card">
            <h4>FERMETURE</h4>
            <div class="info-row">
              <span>Date:</span>
              <span>${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="info-row">
              <span>Heure:</span>
              <span>${new Date().toLocaleTimeString('fr-FR')}</span>
            </div>
            <div class="info-row">
              <span>Agent:</span>
              <span>${user?.user_metadata?.full_name || user?.email || 'Caissier'}</span>
            </div>
            
          </div>
        </div>

        <div class="section">
          <div class="section-title">DÉTAIL DES OPÉRATIONS</div>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Dénomination / Intitulé</th>
                <th>Nb.</th>
                <th>Montant</th>
                <th>Type d'opération</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Total des ventes</strong></td>
                <td>${cashTransactionCount + mobileTransactionCount + cardTransactionCount}</td>
                <td><strong>${totals.total_sales.toLocaleString()} f CFA</strong></td>
                <td><strong>Toutes les ventes</strong></td>
              </tr>
              <tr>
                <td>Paiements en espèces</td>
                <td>${cashTransactionCount}</td>
                <td>${totals.cash_sales.toLocaleString()} f CFA</td>
                <td>Entrée de caisse</td>
              </tr>
              
              <tr>
                <td>Dépenses décaissées</td>
                <td>${expenses.length}</td>
                <td>${cashExpenses.toLocaleString()} f CFA</td>
                <td>Sortie de caisse</td>
              </tr>
                            
              <tr>
                <td>Paiements par transfert</td>
                <td>${mobileTransactionCount}</td>
                <td>${totals.mobile_money_sales.toLocaleString()} f CFA</td>
                <td>Mobile money</td>
              </tr>
              <tr>
                <td>Paiements par TPE</td>
                <td>${cardTransactionCount}</td>
                <td>${totals.card_sales.toLocaleString()} f CFA</td>
                <td>Carte bancaire</td>
              </tr>
                            
            </tbody>
          </table>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span>Total Entrées de Caisse:</span>
            <span><strong>${totals.cash_sales.toLocaleString()} f CFA</strong></span>
          </div>
          <div class="total-row">
            <span>Total Sorties de Caisse:</span>
            <span><strong>${cashExpenses.toLocaleString()} f CFA</strong></span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">SOLDE ET CONTRÔLE DE CAISSE</div>
          <div class="balance-row">
            <span>Solde Final du Logiciel:</span>
            <span>${expectedBalance.toLocaleString()} f CFA</span>
          </div>
          <div class="balance-row">
            <span>Solde Final de la Caisse:</span>
            <span>${actualBalance.toLocaleString()} f CFA</span>
          </div>
          
          <div class="difference ${difference === 0 ? 'zero' : difference > 0 ? 'positive' : 'negative'}">
            Écart de Caisse: ${difference.toLocaleString()} f CFA
            ${difference === 0 ? '✅' : difference > 0 ? '⚠️' : '❌'}
          </div>

          <div class="notification ${difference === 0 ? 'correct' : 'problem'}">
            ${difference === 0 ? 'SOLDE CORRECT ! ✅' : 
              difference > 0 ? `EXCÉDENT DE ${difference.toLocaleString()} f CFA ⚠️` : 
              `DÉFICIT DE ${Math.abs(difference).toLocaleString()} f CFA ❌`}
          </div>
        </div>

        <div class="signature-area">
          <div>
            <div class="signature-line">Signature du Caissier</div>
          </div>
          <div>
            <div class="signature-line">Signature du Responsable</div>
          </div>
        </div>

        <div class="footer">
          <div>Rapport généré automatiquement par le système de caisse</div>
          <div class="timestamp">
            Généré par: ${user?.user_metadata?.full_name || user?.email || 'Caissier'} • 
            ${new Date().toLocaleString('fr-FR')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

    return reportContent;
  };

  const handleOrderSelection = (order: OrderForPayment) => {
    setCurrentOrder(order);
  };

  const processNextOrder = () => {
    console.log('➡️ Passage à la commande suivante...');
    
    if (pendingOrders.length === 0) {
      console.log('✅ Aucune commande restante');
      setCurrentOrder(null);
      return;
    }
    
    if (!currentOrder && pendingOrders.length > 0) {
      setCurrentOrder(pendingOrders[0]);
      return;
    }
    
    const currentIndex = pendingOrders.findIndex(order => order.id === currentOrder?.id);
    
    if (currentIndex >= 0 && currentIndex < pendingOrders.length - 1) {
      setCurrentOrder(pendingOrders[currentIndex + 1]);
    } else if (pendingOrders.length > 0) {
      setCurrentOrder(pendingOrders[0]);
    } else {
      setCurrentOrder(null);
    }
  };

  const handleAmountChange = (value: string) => {
    if (value === '') {
      setAmountTendered('');
      return;
    }

    const cleanedValue = value.replace(/[^\d.]/g, '');
    
    const parts = cleanedValue.split('.');
    if (parts.length > 2) return;
    
    if (parts[1] && parts[1].length > 2) {
      setAmountTendered(parts[0] + '.' + parts[1].slice(0, 2));
    } else {
      setAmountTendered(cleanedValue);
    }
  };

  const handlePaymentMethodChange = (method: 'cash' | 'mobile_money' | 'card') => {
    setPaymentMethod(method);
    
    if (method !== 'cash') {
      setAmountTendered(currentOrder?.total_amount.toString() || '');
    }
  };

  // MODIFIER la fonction processPayment pour n'imprimer qu'un seul ticket
  const processPayment = async () => {
    if (!currentOrder || !user || !cashRegister) {
      alert('Caisse non ouverte ou commande non sélectionnée');
      return;
    }

    const amount = parseFloat(amountTendered) || 0;
    const changeAmount = amount - currentOrder.total_amount;
    
    if (paymentMethod === 'cash') {
      if (amount === 0) {
        alert('Veuillez saisir le montant remis par le client');
        return;
      }
      if (amount < currentOrder.total_amount) {
        alert(`Montant insuffisant. Il manque ${Math.abs(changeAmount).toLocaleString()} f CFA`);
        return;
      }
    } else {
      setAmountTendered(currentOrder.total_amount.toString());
    }

    setIsProcessing(true);

    try {
      // 1. Charger la commande fraîche depuis la base
      const { data: freshOrder, error: orderLoadError } = await supabase
        .from('pos_orders')
        .select(`
          *,
          pos_order_items(*),
          server_name
        `)
        .eq('id', currentOrder.id)
        .single();

      if (orderLoadError) {
        console.error('Error loading fresh order:', orderLoadError);
        throw new Error('Erreur lors du chargement de la commande');
      }

      const orderToProcess = freshOrder ? {
        ...freshOrder,
        items: freshOrder.pos_order_items || []
      } : currentOrder;

      console.log('🔄 Début de la gestion des consommations de bouteilles...');
      await handleBottleConsumptionOnPayment(orderToProcess);
      console.log('✅ Gestion des consommations terminée avec succès');

      // 2. Générer le numéro de reçu
      const receiptNumber = `REC-${Date.now()}`;
      const amountPaidValue = paymentMethod === 'cash' ? amount : orderToProcess.total_amount;
      const changeAmountValue = Math.max(0, amountPaidValue - orderToProcess.total_amount);

      // 3. Générer UN SEUL TICKET (client seulement)
      const customerReceipt = generateCustomerReceipt(orderToProcess, receiptNumber, amountPaidValue, changeAmountValue, paymentMethod);

      // 4. Enregistrer le paiement avec UN SEUL TICKET
      const { error: paymentError } = await supabase
        .from('pos_payments')
        .insert({
          order_id: orderToProcess.id,
          amount_paid: amountPaidValue,
          payment_method: paymentMethod,
          change_amount: changeAmountValue,
          receipt_number: receiptNumber,
          created_by: user.id,
          ticket: null, // SUPPRIMER le ticket de caisse interne
          customer_ticket: customerReceipt, // Garder seulement le ticket client
        });

      if (paymentError) {
        console.error('❌ Erreur enregistrement paiement:', paymentError);
        throw paymentError;
      }

      console.log('✅ Paiement enregistré');

      // 5. Mettre à jour le statut de la commande
      const { error: orderUpdateError } = await supabase
        .from('pos_orders')
        .update({
          status: 'paid',
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderToProcess.id);

      if (orderUpdateError) {
        console.error('❌ Erreur mise à jour commande:', orderUpdateError);
        throw orderUpdateError;
      }

      console.log('✅ Statut commande mis à jour à "paid"');

      // 6. Libérer la table
      const { error: tableError } = await supabase
        .from('pos_tables')
        .update({
          status: 'available',
          current_order_id: null
        })
        .eq('table_number', orderToProcess.table_number);

      if (tableError) {
        console.error('❌ Erreur mise à jour table:', tableError);
      } else {
        console.log('✅ Table libérée');
      }

      // 7. IMPRIMER UN SEUL TICKET (client seulement)
      await generateReceipts(
        orderToProcess, 
        receiptNumber, 
        paymentMethod === 'cash' ? amount : orderToProcess.total_amount, 
        Math.max(0, changeAmount)
      );

      console.log('✅ Ticket imprimé');

      // 8. Mettre à jour l'état LOCAL IMMÉDIATEMENT
      const updatedOrders = pendingOrders.filter(order => order.id !== currentOrder.id);
      setPendingOrders(updatedOrders);
      
      // 9. Passer à la commande suivante
      if (updatedOrders.length > 0) {
        const nextOrder = updatedOrders[0];
        setCurrentOrder(nextOrder);
        console.log('➡️ Passage à la commande suivante:', nextOrder.order_number);
      } else {
        setCurrentOrder(null);
        console.log('✅ Toutes les commandes sont traitées');
      }
      
      // 10. Réinitialiser le formulaire
      setAmountTendered('');
      
      // 11. Afficher un message de succès
      let bottleMessage = '';
      const bottleItems = orderToProcess.items.filter(item => 
        item.item_name.toLowerCase().includes('bouteille') || 
        item.category?.toLowerCase().includes('vin') ||
        item.category?.toLowerCase().includes('bière')
      );

      if (bottleItems.length > 0) {
        bottleMessage = `\n\n🍾 ${bottleItems.length} bouteille(s) mise(s) à jour`;
      }

      alert(`✅ Paiement traité avec succès!${bottleMessage}`);

    } catch (error: any) {
      console.error('❌ Error processing payment:', error);
      
      // Forcer le rechargement en cas d'erreur
      await loadPendingOrders();
      
      if (error.code === '23505') {
        alert('Erreur: Un paiement avec ce numéro de reçu existe déjà');
      } else if (error.code === '23503') {
        alert('Erreur: Référence à la commande introuvable');
      } else if (error.code === '23514') {
        alert('Erreur: Contrainte de validation non respectée');
      } else if (error.message.includes('bouteille')) {
        alert(`Erreur de gestion des bouteilles: ${error.message}`);
      } else {
        alert(`Erreur lors du traitement du paiement: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // AJOUTER cette fonction pour réimprimer un ticket (UN SEUL TICKET)
  const reprintTicket = (ticketData: any) => {
    try {
      const ticketContent = ticketData.customer_ticket;

      if (!ticketContent) {
        alert('❌ Ticket non disponible.\n\nCe paiement a été effectué avant l\'activation de la sauvegarde des tickets.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Réimpression Ticket - ${ticketData.receipt_number}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-size: 12px;
              line-height: 1.3;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
            }
            .restaurant-name {
              font-weight: bold;
              font-size: 14px;
            }
            .reprint-notice {
              background: #f0f0f0;
              padding: 5px;
              margin: 5px 0;
              font-size: 10px;
              text-align: center;
              border: 1px dashed #ccc;
            }
          </style>
        </head>
        <body>
          <div class="reprint-notice">
            ⚠️ RÉIMPRESSION - ${new Date().toLocaleString('fr-FR')}
          </div>
          ${ticketContent}
        </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            alert('✅ Ticket réimprimé');
          } catch (error) {
            console.error('Erreur impression:', error);
          }

          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 500);
        }, 300);
      }

    } catch (error) {
      console.error('Erreur réimpression:', error);
      alert('Erreur lors de la réimpression');
    }
  };

  // AJOUTER cette fonction pour afficher un aperçu
  const previewTicket = (ticketData: any) => {
    setSelectedTicket(ticketData);
    setShowTicketPreview(true);
  };

  const checkBottleStatus = async (order: OrderForPayment) => {
    console.log('🔍 Vérification de l\'état des bouteilles pour la commande:', order.order_number);
    
    for (const item of order.items) {
      try {
        const { data: menuItem, error } = await supabase
          .from('pos_menus')
          .select('name, sale_type, current_servings, servings_per_bottle, is_available')
          .eq('name', item.item_name)
          .single();

        if (!error && menuItem) {
          console.log(`📊 ${item.item_name}:`, {
            type: menuItem.sale_type,
            servings: `${menuItem.current_servings}/${menuItem.servings_per_bottle}`,
            disponible: menuItem.is_available
          });
        }
      } catch (error) {
        console.warn(`⚠️ Impossible de vérifier ${item.item_name}:`, error);
      }
    }
  };

  // MODIFIER generateReceipts pour n'imprimer qu'un seul ticket
  const generateReceipts = async (order: OrderForPayment, receiptNumber: string, amountPaid: number, change: number) => {
    // Générer UNIQUEMENT le ticket client
    const customerReceipt = generateCustomerReceipt(order, receiptNumber, amountPaid, change, paymentMethod);
    
    // IMPRIMER UNIQUEMENT le ticket client
    printReceipt(customerReceipt, 'Ticket - ' + order.order_number);
    
    // Sauvegarder UNIQUEMENT le ticket client dans la base
    await saveTicketToDatabase(order, receiptNumber, amountPaid, change);
  };

  const generateCustomerReceipt = (order: OrderForPayment, receiptNumber: string, amountPaid: number, change: number, paymentMethod: string) => {
    const methodConfig = {
      cash: { emoji: '💵', text: 'ESPÈCES' },
      card: { emoji: '💳', text: 'CARTE BANCAIRE' },
      mobile_money: { emoji: '📱', text: 'MOBILE MONEY' }
    }[paymentMethod];

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Facture - ${order.order_number}</title>
        <style>
          /* STYLE POUR IMPRESSION DIRECTE */
          @page {
            size: 80mm auto;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            width: 80mm;
            margin: 0 auto;
            padding: 10px 5px;
            font-size: 11px;
            line-height: 1.2;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .receipt {
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
          }
          
          .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 2px double #000;
            padding-bottom: 6px;
          }
          
          .restaurant-name {
            font-size: 14px;
            font-weight: bold;
            margin: 4px 0;
            color: #000000;
            text-transform: uppercase;
          }
          
          .contact, .address {
            font-size: 9px;
            margin: 1px 0;
            color: #000000;
          }
          
          .unique-notice {
            text-align: center;
            background: #f0f0f0;
            padding: 3px;
            margin: 4px 0;
            font-size: 9px;
            font-style: italic;
            border-radius: 3px;
            border: 1px dashed #ccc;
          }
          
          .section {
            margin: 6px 0;
          }
          
          .section h3 {
            text-align: center;
            margin: 5px 0;
            font-size: 10px;
            background: #f5f5f5;
            padding: 4px;
            font-weight: bold;
            color: #000000;
          }
          
          /* STRUCTURE À DEUX COLONNES */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 10px;
          }
          
          .info-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px dotted #ddd;
            padding-bottom: 3px;
            font-size: 10px;
          }
          
          .info-row:last-child {
            border-bottom: none;
          }
          
          .info-row strong {
            font-weight: bold;
            color: #000000;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
            font-size: 10px;
          }
          
          .items-table th {
            border-bottom: 1px solid #000;
            padding: 4px 0;
            font-weight: bold;
            color: #000000;
            font-size: 9px;
          }
          
          .items-table td {
            padding: 3px 0;
            border-bottom: 1px dotted #eee;
          }
          
          .total-table {
            border-top: 2px solid #000;
            margin-top: 6px;
            padding-top: 5px;
          }
          
          .total-table td {
            padding: 4px 0;
            font-weight: bold;
          }
          
          .payment-section {
            border-top: 2px dashed #000;
            margin-top: 8px;
            padding-top: 6px;
            background: #f8f9fa;
            padding: 8px 6px;
            border-radius: 4px;
          }
          
          .payment-section h3 {
            margin-top: 0;
            color: #000000;
          }
          
          .left { text-align: left; }
          .center { text-align: center; }
          .right { text-align: right; }
          
          .footer {
            text-align: center;
            margin-top: 10px;
            border-top: 1px dashed #ccc;
            padding-top: 6px;
            font-size: 9px;
          }
          
          .thank-you {
            font-style: italic;
            color: #000000;
            font-weight: bold;
            margin-bottom: 3px;
          }
          
          .signature {
            color: #000000;
            font-size: 8px;
          }
          
          .timestamp {
            color: #666;
            font-size: 8px;
            font-style: italic;
            margin-top: 3px;
          }
          
          /* OPTIMISATION POUR IMPRESSION */
          @media print {
            body {
              margin: 0;
              padding: 5px 3px;
            }
            
            .no-print {
              display: none !important;
            }
            
            .receipt {
              width: 100%;
              min-height: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${settings?.logo_url ? `
              <div style="text-align: center; margin-bottom: 5px;">
                <img src="${settings.logo_url}" alt="Logo" style="max-width: 60px; max-height: 60px; object-fit: contain;" />
              </div>
            ` : ''}
            <div class="restaurant-name">${settings?.name?.toUpperCase() || 'RESTAURANT'}</div>
            ${settings?.phone ? `<div class="contact">📞 ${settings.phone}</div>` : ''}
            ${settings?.address ? `<div class="address">📍 ${settings.address}</div>` : ''}
            <div class="unique-notice">🧾 TICKET UNIQUE - Client & Caisse</div>
          </div>
          
          <!-- STRUCTURE À DEUX COLONNES POUR LES INFORMATIONS -->
          <div class="section">
            <h3>INFORMATIONS COMMANDE</h3>
            <div class="info-grid">
              <div class="info-column">
                <div class="info-row">
                  <strong>N° Commande:</strong>
                  <span>${order.order_number}</span>
                </div>
                <div class="info-row">
                  <strong>Table:</strong>
                  <span>${order.table_number}</span>
                </div>
                <div class="info-row">
                  <strong>Clients:</strong>
                  <span>${order.customer_count} personne(s)</span>
                </div>
                <div class="info-row">
                  <strong>Serveur:</strong>
                  <span>${order.server_name || 'Non spécifié'}</span>
                </div>
              </div>
              <div class="info-column">
                <div class="info-row">
                  <strong>Date:</strong>
                  <span>${new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div class="info-row">
                  <strong>Heure:</strong>
                  <span>${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="info-row">
                  <strong>Caissier:</strong>
                  <span>${user?.user_metadata?.full_name || user?.email || 'Caissier'}</span>
                </div>
                <div class="info-row">
                  <strong>N° Reçu:</strong>
                  <span><strong>${receiptNumber}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- DÉTAILS DES ARTICLES -->
          <div class="section">
            <h3>DÉTAIL DE LA COMMANDE</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th class="left">Article</th>
                  <th class="center">Qté</th>
                  <th class="right">Prix U.</th>
                  <th class="right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => {
                  const isBottleItem = item.item_name.toLowerCase().includes('bouteille') || 
                                      item.category?.toLowerCase().includes('vin') ||
                                      item.category?.toLowerCase().includes('bière') ||
                                      item.category?.toLowerCase().includes('bar');
                  
                  return `
                    <tr>
                      <td class="left">
                        ${item.item_name}
                        ${isBottleItem ? '<br><small style="color: #666; font-style: italic;">🍾</small>' : ''}
                      </td>
                      <td class="center">${item.quantity}</td>
                      <td class="right">${item.unit_price.toLocaleString()} f CFA</td>
                      <td class="right">${item.total_price.toLocaleString()} f CFA</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- TOTAUX -->
          <div class="section">
            <div class="total-table">
              <table style="width: 100%;">
                <tr>
                  <td class="left"><strong>TOTAL:</strong></td>
                  <td class="right"><strong>${order.total_amount.toLocaleString()} f CFA</strong></td>
                </tr>
                <tr>
                  <td class="left">Montant payé:</td>
                  <td class="right">${amountPaid.toLocaleString()} f CFA</td>
                </tr>
                ${change > 0 ? `
                <tr>
                  <td class="left">Monnaie rendue:</td>
                  <td class="right">${change.toLocaleString()} f CFA</td>
                </tr>
                ` : ''}
              </table>
            </div>
          </div>

          <!-- INFORMATIONS DE PAIEMENT -->
          <div class="section">
            <h3>INFORMATIONS DE PAIEMENT</h3>
            <div class="info-grid">
              <div class="info-column">
                <div class="info-row">
                  <strong>Mode de paiement:</strong>
                  <span><strong>${methodConfig.emoji} ${methodConfig.text}</strong></span>
                </div>
                ${paymentMethod === 'cash' ? `
                <div class="info-row">
                  <strong>Montant reçu:</strong>
                  <span>${amountPaid.toLocaleString()} f CFA</span>
                </div>
                ` : ''}
              </div>
              <div class="info-column">
                <div class="info-row">
                  <strong>Caissier:</strong>
                  <span>${user?.user_metadata?.full_name || user?.email || 'Caissier'}</span>
                </div>
                ${change > 0 ? `
                <div class="info-row">
                  <strong>Monnaie rendue:</strong>
                  <span>${change.toLocaleString()} f CFA</span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- NOTES -->
          ${order.notes ? `
          <div class="section">
            <h3>NOTES</h3>
            <div style="background: #f0f0f0; padding: 6px; border-radius: 4px; font-size: 10px;">
              ${order.notes}
            </div>
          </div>
          ` : ''}

          <!-- PIED DE PAGE -->
          <div class="footer">
            <p class="thank-you">Merci de votre visite ! À bientôt !</p>
            <p class="signature">${settings?.name || 'Restaurant'}</p>
            <div class="timestamp">
              Imprimé le ${new Date().toLocaleString('fr-FR')} • Ticket unique
            </div>
          </div>
        </div>
        
        <!-- SCRIPT POUR IMPRESSION DIRECTE -->
        <script>
          (function() {
            setTimeout(function() {
              window.print();
              
              setTimeout(function() {
                if (window.opener === null) {
                  window.close();
                }
              }, 500);
            }, 100);
          })();
        </script>
      </body>
      </html>
    `;
  };

  const printReceipt = (content: string, title: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            @media print {
              @page { margin: 0; }
              body { margin: 0.5cm; }
            }
            body { 
              font-family: 'Arial', sans-serif; 
              width: 80mm; 
              margin: 0; 
              padding: 15px;
              font-size: 13px;
              line-height: 1.4;
            }
          </style>
          <script>
            // IMPRESSION AUTOMATIQUE
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  if (window.opener === null) {
                    window.close();
                  }
                }, 100);
              }, 300);
            };
          </script>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);
      iframeDoc.close();

      // Nettoyage automatique
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  };

  const skipOrder = () => {
    if (pendingOrders.length > 1) {
      const currentIndex = pendingOrders.findIndex(order => order.id === currentOrder?.id);
      const nextIndex = (currentIndex + 1) % pendingOrders.length;
      setCurrentOrder(pendingOrders[nextIndex]);
    } else {
      setCurrentOrder(null);
    }
  };

  const amountNum = parseFloat(amountTendered) || 0;
  const changeAmount = currentOrder ? amountNum - currentOrder.total_amount : 0;

  if (registerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-700">Chargement de la caisse...</div>
      </div>
    );
  }

  if (!cashRegister) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <Lock className="w-8 h-8 text-red-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Caisse - Fermée</h1>
                  <p className="text-gray-600">La caisse doit être ouverte pour traiter les paiements</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Caisse Fermée</h2>
            <p className="text-gray-600 mb-6">
              Vous devez ouvrir la caisse pour pouvoir traiter les paiements des commandes.
            </p>
            <button
              onClick={() => setShowOpenForm(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center mx-auto space-x-2"
            >
              <Unlock className="w-5 h-5" />
              <span>Ouvrir la Caisse</span>
            </button>
          </div>

          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Commandes en attente de paiement
            </h3>
            <p className="text-yellow-800">
              {pendingOrders.length} commande(s) sont en attente. Ouvrez la caisse pour les traiter.
            </p>
          </div>
        </div>

        {showOpenForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Ouvrir la Caisse</h3>
                <button
                  onClick={() => setShowOpenForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Solde d'ouverture (f CFA) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center"
                    placeholder="0.00"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Saisissez le montant de fonds de caisse initial
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowOpenForm(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenRegister}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    Ouvrir la Caisse
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <CreditCard className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caisse - File d'attente</h1>
                <p className="text-gray-600">Caisse ouverte • Solde: {cashRegister.opening_balance.toLocaleString()} f CFA</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 px-3 py-1 rounded-full">
                <span className="text-green-800 font-semibold flex items-center space-x-1">
                  <Unlock className="w-4 h-4" />
                  <span>Caisse Ouverte</span>
                </span>
              </div>
              <div className="bg-blue-100 px-3 py-1 rounded-full">
                <span className="text-blue-800 font-semibold">
                  {pendingOrders.length} commande(s) en attente
                </span>
              </div>
              <button
                onClick={() => {
                  setShowSalesModal(true);
                  loadCashSessionData();
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
                title="Voir les ventes et dépenses de la session"
              >
                <FileText className="w-4 h-4" />
                <span>Session Caisse</span>
              </button>
              <button
                onClick={() => setShowReprintModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2"
                title="Réimprimer un ticket"
              >
                <Printer className="w-4 h-4" />
                <span>Réimprimer</span>
              </button>
              <button
                onClick={() => setShowCloseForm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Fermer Caisse</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ListOrdered className="w-5 h-5 mr-2" />
                  File d'attente
                </h2>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-medium">
                  FIFO
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingOrders.map((order, index) => (
                  <div
                    key={order.id}
                    data-order-id={order.id} 
                    className={`p-4 border rounded-lg cursor-pointer transition ${
                      currentOrder?.id === order.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleOrderSelection(order)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Table {order.table_number}
                        </h3>
                        <p className="text-sm text-gray-600">{order.order_number}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        {order.items.length} article(s)
                      </span>
                      <span className="font-semibold">
                        {order.total_amount.toLocaleString()} f CFA
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-gray-500 mt-2">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(order.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}

                {pendingOrders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Aucune commande en attente</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {currentOrder ? (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Paiement - Table {currentOrder.table_number}
                    </h2>
                    <p className="text-gray-600">Commande: {currentOrder.order_number}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {currentOrder.customer_count} client(s)
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Détails de la commande</h3>
                  <div className="border rounded-lg">
                    <div className="divide-y">
                      {currentOrder.items.map((item, index) => (
                        <div key={item.id} className="p-4 flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.item_name}</div>
                            <div className="text-sm text-gray-600">
                              {item.quantity} x {item.unit_price.toLocaleString()} f CFA
                            </div>
                          </div>
                          <div className="font-semibold text-gray-900">
                            {item.total_price.toLocaleString()} f CFA
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t p-4 bg-gray-50">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total à régler:</span>
                        <span className="text-blue-600">
                          {currentOrder.total_amount.toLocaleString()} f CFA
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Mode de paiement</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {(['cash', 'mobile_money', 'card'] as const).map(method => (
                        <button
                          key={method}
                          onClick={() => handlePaymentMethodChange(method)}
                          className={`p-4 border-2 rounded-lg text-center transition ${
                            paymentMethod === method
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium capitalize">
                            {method === 'cash' && '💵 Espèces'}
                            {method === 'card' && '💳 Carte'}
                            {method === 'mobile_money' && '📱 Mobile Money'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Montant remis par le client (f CFA)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amountTendered}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl font-bold text-center"
                        onFocus={(e) => e.target.select()}
                      />
                      {amountTendered && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Montant reçu:</span>
                            <span className="font-semibold">{amountNum.toLocaleString()} f CFA</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>À payer:</span>
                            <span className="font-semibold">{currentOrder.total_amount.toLocaleString()} f CFA</span>
                          </div>
                          <div className={`flex justify-between text-lg font-bold border-t pt-2 ${
                            changeAmount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            <span>{changeAmount >= 0 ? 'Monnaie à rendre:' : 'Montant manquant:'}</span>
                            <span>{Math.abs(changeAmount).toLocaleString()} f CFA</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentMethod !== 'cash' && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-blue-800 font-semibold">
                          Montant à prélever: {currentOrder.total_amount.toLocaleString()} f CFA
                        </p>
                        <p className="text-sm text-blue-600 mt-1">
                          Le montant sera automatiquement prélevé via {paymentMethod === 'card' ? 'le terminal de carte' : 'Mobile Money'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-4 pt-4">
                    <button
                      onClick={skipOrder}
                      disabled={isProcessing || pendingOrders.length <= 1}
                      className="flex-1 bg-gray-600 text-white py-4 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 transition flex items-center justify-center"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      {pendingOrders.length > 1 ? 'Commande suivante' : 'Retour à la liste'}
                    </button>
                    <button
                      onClick={processPayment}
                      disabled={isProcessing || 
                        (paymentMethod === 'cash' && (amountNum < currentOrder.total_amount || amountNum === 0))}
                      className="flex-1 bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center"
                    >
                      {isProcessing ? (
                        <>
                          <Clock className="w-5 h-5 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-5 h-5 mr-2" />
                          Valider le paiement
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Aucune commande en cours
                </h3>
                <p className="text-gray-600 mb-6">
                  {pendingOrders.length === 0 
                    ? "Toutes les commandes ont été traitées" 
                    : "Sélectionnez une commande dans la file d'attente"
                  }
                </p>
                {pendingOrders.length > 0 && (
                  <button
                    onClick={() => setCurrentOrder(pendingOrders[0])}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Prendre la première commande
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCloseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Fermer la Caisse</h3>
              <button
                onClick={() => !isProcessing && setShowCloseForm(false)}
                disabled={isProcessing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Solde de fermeture (f CFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center disabled:opacity-50"
                  placeholder="0.00"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Comptez soigneusement l'argent en caisse et saisissez le montant réel
                </p>
              </div>

              {cashRegister && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Aperçu de la session</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div className="flex justify-between">
                      <span>Solde d'ouverture:</span>
                      <span className="font-semibold">{cashRegister.opening_balance.toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commandes en attente:</span>
                      <span className="font-semibold">{pendingOrders.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Heure d'ouverture:</span>
                      <span className="font-semibold">{new Date(cashRegister.opened_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600 animate-spin mr-2" />
                    <span className="text-yellow-800 font-semibold">Fermeture de caisse en cours...</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2 text-center">
                    Génération du rapport et mise à jour des données
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCloseForm(false)}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCloseRegister}
                  disabled={!closingBalance || isProcessing}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin mr-2" />
                      Fermeture...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Fermer la Caisse
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSalesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Session de Caisse</h3>
                <p className="text-gray-600 text-sm">
                  Ouverte le {new Date(cashRegister.opened_at).toLocaleString('fr-FR')}
                  {cashRegister.opened_by_user && ` par ${cashRegister.opened_by_user.user_metadata?.full_name}`}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {/* BOUTON RAFRAÎCHIR */}
                <button
                  onClick={() => {
                    console.log('🔄 Rafraîchissement manuel...');
                    loadCashSessionData();
                  }}
                  disabled={loadingSales}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition flex items-center space-x-2 disabled:opacity-50"
                  title="Rafraîchir les données"
                >
                  {loadingSales ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span>Chargement...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Rafraîchir</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowExpenseForm(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Dépense</span>
                </button>
                <button
                  onClick={() => setShowSalesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Section des statistiques COMPLÈTE */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {/* Ventes Totales */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-green-700">Ventes Totales</p>
                      <p className="text-2xl font-bold text-green-800">
                        {calculateSessionTotals().totalSales.toLocaleString()} f CFA
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-green-800 bg-green-100 px-2 py-1 rounded-full">
                      {calculateSessionTotals().transactionCount}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-green-600">
                    <div className="flex justify-between">
                      <span>Espèces:</span>
                      <span>{((calculateSessionTotals().cashSales / calculateSessionTotals().totalSales) * 100 || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mobile:</span>
                      <span>{((calculateSessionTotals().mobileMoneySales / calculateSessionTotals().totalSales) * 100 || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Ventes Espèces */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-blue-700">💵 Ventes Espèces</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {calculateSessionTotals().cashSales.toLocaleString()} f CFA
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-1 rounded-full">
                      {calculateSessionTotals().cashTransactions}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Moyenne: {calculateSessionTotals().cashTransactions > 0 ? 
                      (calculateSessionTotals().cashSales / calculateSessionTotals().cashTransactions).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 
                      0} f CFA/trx
                  </p>
                </div>
                
                {/* Ventes Mobile Money */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-purple-700">📱 Mobile Money</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {calculateSessionTotals().mobileMoneySales.toLocaleString()} f CFA
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-purple-800 bg-purple-100 px-2 py-1 rounded-full">
                      {calculateSessionTotals().mobileTransactions}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    Moyenne: {calculateSessionTotals().mobileTransactions > 0 ? 
                      (calculateSessionTotals().mobileMoneySales / calculateSessionTotals().mobileTransactions).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 
                      0} f CFA/trx
                  </p>
                </div>
                
                {/* Dépenses Caisse */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-red-700">💼 Dépenses Caisse</p>
                      <p className="text-2xl font-bold text-red-800">
                        {calculateSessionTotals().totalExpenses.toLocaleString()} f CFA
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-800 bg-red-100 px-2 py-1 rounded-full">
                      {calculateSessionTotals().expenseCount}
                    </span>
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Moyenne: {calculateSessionTotals().expenseCount > 0 ? 
                      (calculateSessionTotals().totalExpenses / calculateSessionTotals().expenseCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 
                      0} f CFA/dépense
                  </p>
                </div>
                
                {/* Solde Théorique */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-orange-700">💰 Solde Théorique</p>
                      <p className="text-2xl font-bold text-orange-800">
                        {(cashRegister.opening_balance + calculateSessionTotals().cashSales - calculateSessionTotals().totalExpenses).toLocaleString()} f CFA
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-orange-800 bg-orange-100 px-2 py-1 rounded-full">
                      Calculé
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-orange-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Ouverture:</span>
                      <span>{cashRegister.opening_balance.toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+ Espèces:</span>
                      <span>+{calculateSessionTotals().cashSales.toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>- Dépenses:</span>
                      <span>-{calculateSessionTotals().totalExpenses.toLocaleString()} f CFA</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    className={`py-2 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600`}
                  >
                    <Receipt className="w-4 h-4 inline mr-2" />
                    Ventes ({cashSalesData.length})
                  </button>
                </nav>
              </div>

              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Ventes de la session</h4>
                {loadingSales ? (
                  <div className="text-center py-8">Chargement...</div>
                ) : cashSalesData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Aucune vente enregistrée dans cette session</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heure</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monnaie</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cashSalesData.map((sale, index) => {
                          const netAmount = sale.amount_paid - (sale.change_amount || 0);
                          return (
                            <tr key={sale.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">
                                {new Date(sale.created_at).toLocaleTimeString('fr-FR')}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {sale.pos_orders?.order_number || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {sale.pos_orders?.table_number || 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  sale.payment_method === 'cash' 
                                    ? 'bg-green-100 text-green-800'
                                    : sale.payment_method === 'card'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {sale.payment_method === 'cash' ? '💵 Espèces' : 
                                   sale.payment_method === 'card' ? '💳 Carte' : '📱 Mobile'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {sale.amount_paid.toLocaleString()} f CFA
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {(sale.change_amount || 0).toLocaleString()} f CFA
                              </td>
                              <td className="px-4 py-3 text-sm font-bold">
                                {netAmount.toLocaleString()} f CFA
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Dépenses de caisse ({expensesData.length})
                  </h4>
                </div>
                
                {expensesData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucune dépense enregistrée dans cette session</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {expensesData.map((expense, index) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              {new Date(expense.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {expense.expense_categories?.name || 'Non catégorisé'}
                              {expense.is_advance_salary && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Avance salaire
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {expense.description}
                              {expense.employees && (
                                <div className="text-xs text-gray-500 mt-1">
                                  👤 {expense.employees.first_name} {expense.employees.last_name}
                                  {expense.employees.employee_number && ` (${expense.employees.employee_number})`}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {expense.notes || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-red-600">
                              - {expense.amount.toLocaleString()} f CFA
                              {expense.salary_advances && expense.salary_advances.repayment_status === 'pending' && (
                                <div className="text-xs text-amber-600 mt-1">
                                  ⏳ En attente de remboursement
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Nouvelle Dépense de Caisse</h3>
              <button
                onClick={() => setShowExpenseForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie *
                </label>
                <select
                  value={newExpenseData.category_id}
                  onChange={(e) => {
                    const categoryId = e.target.value;
                    setNewExpenseData({...newExpenseData, category_id: categoryId});
                    
                    // Vérifier si c'est une catégorie salaire
                    const selectedCategory = expenseCategories.find(cat => cat.id === categoryId);
                    if (selectedCategory && (selectedCategory.name.toLowerCase().includes('salaire') || 
                        selectedCategory.name.toLowerCase().includes('avance'))) {
                      // Charger les employés et afficher le formulaire d'avance salaire
                      loadEmployees();
                      setShowAdvanceSalaryForm(true);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionner une catégorie</option>
                  {expenseCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  value={newExpenseData.description}
                  onChange={(e) => setNewExpenseData({...newExpenseData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Achat de fournitures, Retrait espèces, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (f CFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newExpenseData.amount || ''}
                  onChange={(e) => setNewExpenseData({...newExpenseData, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={newExpenseData.notes}
                  onChange={(e) => setNewExpenseData({...newExpenseData, notes: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Détails supplémentaires..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de paiement
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setNewExpenseData({...newExpenseData, payment_method: 'cash'})}
                    className={`flex-1 py-2 text-center rounded-lg font-medium ${
                      newExpenseData.payment_method === 'cash'
                        ? 'bg-green-100 text-green-800 border-2 border-green-500'
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    💵 Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExpenseData({...newExpenseData, payment_method: 'mobile_money'})}
                    className={`flex-1 py-2 text-center rounded-lg font-medium ${
                      newExpenseData.payment_method === 'mobile_money'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    📱 Mobile Money
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Pour les dépenses de caisse, utilisez "Espèces" pour déduire du solde de caisse
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateCashExpense}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
                >
                  Enregistrer la Dépense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'avance salaire */}
     {showAdvanceSalaryForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70] overflow-y-auto">
    {/* REMPLACER max-w-lg par des classes responsives */}
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto my-4">
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
        <div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900">💼 Avance sur Salaire</h3>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Cette avance sera déduite lors du prochain calcul de paie
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdvanceSalaryForm(false);
            setSelectedEmployee(null);
            setAdvanceData({
              employee_id: '',
              amount: 0,
              reason: '',
              date: new Date().toISOString().split('T')[0]
            });
          }}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      </div>

      {/* AJOUTER une div avec scroll */}
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          
          {/* Sélection d'employé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Sélectionner l'employé *
            </label>
            
            {employeesList.length === 0 && (
              <div className="mb-3 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs md:text-sm text-yellow-800 mb-2">
                  Aucun employé chargé. Cliquez pour charger la liste :
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await loadEmployees();
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="bg-yellow-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm hover:bg-yellow-600 disabled:opacity-50"
                >
                  {isProcessing ? 'Chargement...' : 'Charger les employés'}
                </button>
              </div>
            )}
            
            <select
              value={advanceData.employee_id}
              onChange={(e) => {
                const employeeId = e.target.value;
                setAdvanceData({...advanceData, employee_id: employeeId});
                const employee = employeesList.find(emp => emp.id === employeeId);
                setSelectedEmployee(employee || null);
              }}
              className="w-full px-3 py-2 md:px-4 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              disabled={employeesList.length === 0 || isProcessing}
            >
              <option value="">{employeesList.length === 0 ? 'Chargement des employés...' : '--- Choisir un employé ---'}</option>
              {employeesList.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} - {employee.employee_number}
                </option>
              ))}
            </select>
            
            <div className="mt-1 md:mt-2 flex justify-between text-xs text-gray-500">
              <span>{employeesList.length} employé(s) disponible(s)</span>
              {employeesList.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await loadEmployees();
                    setIsProcessing(false);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Actualiser
                </button>
              )}
            </div>
          </div>

          {/* Informations employé sélectionné - CORRIGER POUR PETITS ÉCRANS */}
          {selectedEmployee && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-4 gap-2">
                <h4 className="font-semibold text-purple-900 text-sm md:text-base">
                  <UserCheck className="w-4 h-4 md:w-5 md:h-5 inline mr-1 md:mr-2" />
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h4>
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 md:px-3 md:py-1 rounded-full self-start md:self-auto">
                  Actif
                </span>
              </div>
              
              {/* GRID RESPONSIVE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Matricule</div>
                  <div className="font-mono font-bold text-gray-900 break-all">
                    {selectedEmployee.employee_number}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Poste</div>
                  <div className="font-medium text-gray-900 break-words">
                    {selectedEmployee.position_display}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Département</div>
                  <div className="font-medium text-gray-900 break-words">
                    {selectedEmployee.department_display}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Embauche</div>
                  <div className="font-medium text-gray-900">
                    {new Date(selectedEmployee.hire_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Montant de l'avance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Montant de l'avance (f CFA) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="100"
                min="0"
                value={advanceData.amount || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setAdvanceData({...advanceData, amount: value});
                }}
                className="w-full px-3 py-2 md:px-4 md:py-3 pl-8 md:pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base md:text-lg font-semibold"
                required
                placeholder="0"
                disabled={!selectedEmployee}
              />
              <div className="absolute left-2.5 md:left-3 top-2 md:top-3 text-gray-400 font-medium text-sm">
                XOF
              </div>
            </div>
            
            {/* Suggestions de montant - AMÉLIORER POUR PETITS ÉCRANS */}
            <div className="mt-2 md:mt-3 flex flex-wrap gap-1 md:gap-2">
              {[5000, 10000, 25000, 50000, 100000].map(suggestedAmount => (
                <button
                  key={suggestedAmount}
                  type="button"
                  onClick={() => setAdvanceData(prev => ({ ...prev, amount: suggestedAmount }))}
                  className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-lg transition ${
                    advanceData.amount === suggestedAmount
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={!selectedEmployee}
                >
                  {suggestedAmount.toLocaleString()} F
                </button>
              ))}
            </div>
          </div>

          {/* Date de l'avance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarDays className="w-4 h-4 inline mr-1" />
              Date de l'avance *
            </label>
            <input
              type="date"
              value={advanceData.date}
              onChange={(e) => setAdvanceData({...advanceData, date: e.target.value})}
              className="w-full px-3 py-2 md:px-4 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              disabled={!selectedEmployee}
            />
          </div>

          {/* Motif */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Motif / Raison *
            </label>
            <textarea
              value={advanceData.reason}
              onChange={(e) => setAdvanceData({...advanceData, reason: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 md:px-4 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              placeholder="Décrivez la raison de cette avance..."
              disabled={!selectedEmployee}
            />
            <p className="text-xs text-gray-500 mt-1 md:mt-2">
              Ex: Avance sur salaire du mois de Novembre, Frais médicaux urgents, etc.
            </p>
          </div>

          {/* Récapitulatif */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4">
            <h4 className="font-semibold text-gray-900 mb-2 md:mb-3 text-sm md:text-base">Récapitulatif</h4>
            <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Employé:</span>
                <span className="font-medium text-right">
                  {selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : 'Non sélectionné'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Montant:</span>
                <span className="font-bold text-base md:text-lg text-purple-600">
                  {advanceData.amount.toLocaleString()} f CFA
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">
                  {new Date(advanceData.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>

          {/* Boutons - RESPONSIVE */}
          <div className="flex flex-col md:flex-row md:space-x-3 space-y-3 md:space-y-0 pt-2 md:pt-4">
            <button
              type="button"
              onClick={() => {
                setShowAdvanceSalaryForm(false);
                setSelectedEmployee(null);
                setAdvanceData({
                  employee_id: '',
                  amount: 0,
                  reason: '',
                  date: new Date().toISOString().split('T')[0]
                });
              }}
              className="flex-1 px-4 py-2.5 md:px-6 md:py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 text-sm md:text-base"
              disabled={isProcessing}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveSalaryAdvance}
              disabled={!advanceData.employee_id || advanceData.amount <= 0 || !advanceData.reason.trim() || isProcessing}
              className="flex-1 px-4 py-2.5 md:px-6 md:py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition flex items-center justify-center shadow-md text-sm md:text-base"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white mr-2"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                  Confirmer l'avance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {showReprintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Réimpression de Tickets</h3>
              <button
                onClick={() => {
                  setShowReprintModal(false);
                  setReprintSearchTerm('');
                  setReprintResults([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Barre de recherche */}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={reprintSearchTerm}
                    onChange={(e) => {
                      setReprintSearchTerm(e.target.value);
                      if (e.target.value.trim() === '') {
                        setReprintResults([]);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && searchTickets()}
                    placeholder="Rechercher par: N° reçu, N° commande, Serveur..."
                    className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <button
                    onClick={searchTickets}
                    disabled={loadingReprint}
                    className="absolute right-3 top-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loadingReprint ? 'Recherche...' : 'Rechercher'}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  💡 Tapez le numéro de reçu, de commande ou le nom du serveur
                </p>
              </div>

              {/* Résultats */}
              {loadingReprint ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Recherche en cours...</p>
                </div>
              ) : reprintResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-900">
                      {reprintResults.length} résultat(s) trouvé(s)
                    </h4>
                    <span className="text-sm text-gray-500">
                      Dernières 24 heures
                    </span>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Heure</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Reçu</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reprintResults.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              {new Date(payment.created_at).toLocaleDateString('fr-FR')}<br/>
                              <span className="text-gray-500">
                                {new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-mono font-bold">
                              {payment.receipt_number}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {payment.pos_orders?.order_number || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {payment.pos_orders?.table_number || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold">
                              {payment.amount_paid.toLocaleString()} f CFA
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                payment.payment_method === 'cash' 
                                  ? 'bg-green-100 text-green-800'
                                  : payment.payment_method === 'card'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {payment.payment_method === 'cash' ? '💵' : 
                                 payment.payment_method === 'card' ? '💳' : '📱'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => previewTicket(payment)}
                                  className="text-blue-600 hover:text-blue-900 transition"
                                  title="Aperçu"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => reprintTicket(payment)}
                                  className="text-green-600 hover:text-green-900 transition"
                                  title="Réimprimer le ticket"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : reprintSearchTerm ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Aucun ticket trouvé pour "{reprintSearchTerm}"</p>
                  <p className="text-sm mt-2">Essayez avec un autre terme de recherche</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Printer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="font-semibold text-gray-900 mb-2">Réimpression de tickets</h4>
                  <p className="mb-4">Recherchez un ticket par :</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-md mx-auto">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="font-mono font-bold text-blue-600">REC-1234567890</div>
                      <p className="text-xs text-blue-700">Numéro de reçu</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="font-mono font-bold text-green-600">CMD-1234567890</div>
                      <p className="text-xs text-green-700">Numéro de commande</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="font-bold text-purple-600">Jean Dupont</div>
                      <p className="text-xs text-purple-700">Nom du serveur</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE APERÇU TICKET */}
      {showTicketPreview && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Aperçu du Ticket</h3>
                <p className="text-sm text-gray-600">
                  {selectedTicket.receipt_number} • {selectedTicket.pos_orders?.order_number}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => reprintTicket(selectedTicket)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer Ticket</span>
                </button>
                <button
                  onClick={() => setShowTicketPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Informations</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{new Date(selectedTicket.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Heure:</span>
                      <span className="font-medium">{new Date(selectedTicket.created_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Table:</span>
                      <span className="font-medium">{selectedTicket.pos_orders?.table_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Clients:</span>
                      <span className="font-medium">{selectedTicket.pos_orders?.customer_count || 1}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Paiement</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Montant payé:</span>
                      <span className="font-bold">{selectedTicket.amount_paid.toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monnaie rendue:</span>
                      <span className="font-medium">{(selectedTicket.change_amount || 0).toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Méthode:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        selectedTicket.payment_method === 'cash' 
                          ? 'bg-green-100 text-green-800'
                          : selectedTicket.payment_method === 'card'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedTicket.payment_method === 'cash' ? '💵 Espèces' : 
                         selectedTicket.payment_method === 'card' ? '💳 Carte' : '📱 Mobile Money'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Ticket Unique</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition">
                  <div className="flex items-center space-x-2 mb-2">
                    <Printer className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Ticket Client & Caisse</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Ce ticket unique sert à la fois de reçu pour le client et de preuve de paiement pour le restaurant.
                  </p>
                  <div className="mt-2 text-xs text-green-600">
                    {selectedTicket.customer_ticket ? '✅ Disponible pour impression' : '❌ Non sauvegardé'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

