//src/components/suppliers/SuppliersView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Supplier, SupplierOrder, SupplierOrderItem } from '../../types/database';
import { 
  Users, Plus, Edit, Trash2, Phone, Mail, MapPin, 
  ShoppingCart, ChevronDown, ChevronUp, Package,
  CheckCircle, Clock, AlertCircle, Truck, List, Hash,
  DollarSign, CreditCard, Printer, Filter, Download, BarChart3, Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SupplierWithOrders extends Supplier {
  supplier_orders?: (SupplierOrder & {
    supplier_order_items?: (SupplierOrderItem & {
      inventory_items?: {
        name: string;
        unit: string;
      }
    })[];
  })[];
}

export default function SuppliersView() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [supplierBalances, setSupplierBalances] = useState<{[key: string]: {
    totalDue: number;
    totalPaid: number;
    remainingBalance: number;
    pendingOrders: number;
    lastPaymentDate?: string;
    oldestPendingOrder?: string;
  }}>({});
  const [showBulkPayment, setShowBulkPayment] = useState(false);
const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<SupplierWithOrders | null>(null);
const [selectedOrdersForPayment, setSelectedOrdersForPayment] = useState<string[]>([]);
const [bulkPaymentAmount, setBulkPaymentAmount] = useState('');
const [bulkPaymentMethod, setBulkPaymentMethod] = useState('cash');
const [bulkPaymentNotes, setBulkPaymentNotes] = useState('');
const [bulkReferenceNumber, setBulkReferenceNumber] = useState('');
  
  // États pour les statistiques générales
  const [globalStats, setGlobalStats] = useState<{
    totalSuppliers: number;
    suppliersWithDebt: number;
    totalDebt: number;
    totalPaid: number;
    totalOrders: number;
    pendingOrders: number;
    averageDebtPerSupplier: number;
    biggestDebtor: { name: string, amount: number } | null;
  }>({
    totalSuppliers: 0,
    suppliersWithDebt: 0,
    totalDebt: 0,
    totalPaid: 0,
    totalOrders: 0,
    pendingOrders: 0,
    averageDebtPerSupplier: 0,
    biggestDebtor: null
  });
  
  // États pour l'impression
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (suppliersError) throw suppliersError;

      const suppliersWithOrders = await Promise.all(
        (suppliersData || []).map(async (supplier) => {
          const { data: ordersData, error: ordersError } = await supabase
            .from('supplier_orders')
            .select(`
              *,
              supplier_order_items (
                *,
                inventory_items (name, unit)
              ),
              supplier_order_payments (
                payment_date,
                amount
              )
            `)
            .eq('supplier_id', supplier.id)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error(`Error loading orders for supplier ${supplier.id}:`, ordersError);
            return { ...supplier, supplier_orders: [] };
          }

          return { 
            ...supplier, 
            supplier_orders: ordersData || [] 
          };
        })
      );

      setSuppliers(suppliersWithOrders);
      calculateSupplierBalances(suppliersWithOrders);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSupplierBalances = (suppliersList: SupplierWithOrders[]) => {
    const balances: {[key: string]: {
      totalDue: number;
      totalPaid: number;
      remainingBalance: number;
      pendingOrders: number;
      lastPaymentDate?: string;
      oldestPendingOrder?: string;
    }} = {};

    let totalGlobalDebt = 0;
    let totalGlobalPaid = 0;
    let totalGlobalOrders = 0;
    let pendingGlobalOrders = 0;
    let suppliersWithDebtCount = 0;
    let biggestDebtor: { name: string, amount: number } | null = null;

    suppliersList.forEach(supplier => {
      if (!balances[supplier.id]) {
        balances[supplier.id] = {
          totalDue: 0,
          totalPaid: 0,
          remainingBalance: 0,
          pendingOrders: 0,
        };
      }

      let supplierTotalDue = 0;
      let supplierTotalPaid = 0;
      let supplierPendingOrders = 0;
      let lastPayment: string | undefined;
      let oldestPending: string | undefined;

      supplier.supplier_orders?.forEach(order => {
        totalGlobalOrders++;
        supplierTotalDue += order.total_amount;
        supplierTotalPaid += order.amount_paid || 0;
        
        const orderDue = order.total_amount - (order.amount_paid || 0);
        if (orderDue > 0 && order.payment_status !== 'paid') {
          supplierPendingOrders++;
          pendingGlobalOrders++;
          
          // Trouver la commande impayée la plus ancienne
          if (!oldestPending || new Date(order.order_date) < new Date(oldestPending)) {
            oldestPending = order.order_date;
          }
        }

        // Trouver le dernier paiement
        if (order.last_payment_date) {
          if (!lastPayment || new Date(order.last_payment_date) > new Date(lastPayment)) {
            lastPayment = order.last_payment_date;
          }
        }
      });

      const supplierRemainingBalance = Math.max(0, supplierTotalDue - supplierTotalPaid);
      
      balances[supplier.id] = {
        totalDue: supplierTotalDue,
        totalPaid: supplierTotalPaid,
        remainingBalance: supplierRemainingBalance,
        pendingOrders: supplierPendingOrders,
        lastPaymentDate: lastPayment,
        oldestPendingOrder: oldestPending
      };

      totalGlobalDebt += supplierRemainingBalance;
      totalGlobalPaid += supplierTotalPaid;
      
      if (supplierRemainingBalance > 0) {
        suppliersWithDebtCount++;
      }
      
      if (supplierRemainingBalance > (biggestDebtor?.amount || 0)) {
        biggestDebtor = { name: supplier.name, amount: supplierRemainingBalance };
      }
    });

    setSupplierBalances(balances);
    
    // Mettre à jour les statistiques globales
    setGlobalStats({
      totalSuppliers: suppliersList.length,
      suppliersWithDebt: suppliersWithDebtCount,
      totalDebt: totalGlobalDebt,
      totalPaid: totalGlobalPaid,
      totalOrders: totalGlobalOrders,
      pendingOrders: pendingGlobalOrders,
      averageDebtPerSupplier: suppliersList.length > 0 ? totalGlobalDebt / suppliersList.length : 0,
      biggestDebtor
    });
  };

  const loadSupplierOrders = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier_order_items (
            *,
            inventory_items (name, unit)
          )
        `)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSuppliers(prevSuppliers =>
        prevSuppliers.map(supplier =>
          supplier.id === supplierId
            ? { ...supplier, supplier_orders: data || [] }
            : supplier
        )
      );
      
      // Recalculer les balances après le chargement
      calculateSupplierBalances(
        suppliers.map(s => 
          s.id === supplierId 
            ? { ...s, supplier_orders: data || [] }
            : s
        )
      );
    } catch (error) {
      console.error('Error loading supplier orders:', error);
    }
  };
  // Fonction pour obtenir les commandes impayées d'un fournisseur
const getUnpaidOrders = (supplier: SupplierWithOrders) => {
  return (supplier.supplier_orders || []).filter(order => {
    const paidAmount = order.amount_paid || 0;
    return order.total_amount > paidAmount && order.payment_status !== 'paid';
  });
};

// Calculer le total dû pour les commandes sélectionnées
const calculateSelectedTotal = (supplier: SupplierWithOrders, selectedOrderIds: string[]) => {
  const unpaidOrders = getUnpaidOrders(supplier);
  return unpaidOrders
    .filter(order => selectedOrderIds.includes(order.id))
    .reduce((total, order) => {
      const paidAmount = order.amount_paid || 0;
      return total + (order.total_amount - paidAmount);
    }, 0);
};

// Sélectionner/désélectionner toutes les commandes
const toggleAllOrders = (supplier: SupplierWithOrders) => {
  const unpaidOrders = getUnpaidOrders(supplier);
  
  if (selectedOrdersForPayment.length === unpaidOrders.length) {
    // Toutes sont déjà sélectionnées, on les désélectionne toutes
    setSelectedOrdersForPayment([]);
  } else {
    // Sélectionner toutes les commandes impayées
    setSelectedOrdersForPayment(unpaidOrders.map(order => order.id));
  }
};

// Sélectionner/désélectionner une commande spécifique
const toggleOrderSelection = (orderId: string) => {
  if (selectedOrdersForPayment.includes(orderId)) {
    setSelectedOrdersForPayment(selectedOrdersForPayment.filter(id => id !== orderId));
  } else {
    setSelectedOrdersForPayment([...selectedOrdersForPayment, orderId]);
  }
};
const handlePaySupplierOrders = (supplierId: string) => {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (supplier) {
    setSelectedSupplierForPayment(supplier);
    setSelectedOrdersForPayment([]); // Réinitialiser la sélection
    
    // Calculer le montant dû total
    const unpaidOrders = getUnpaidOrders(supplier);
    const totalDue = unpaidOrders.reduce((total, order) => {
      const paidAmount = order.amount_paid || 0;
      return total + (order.total_amount - paidAmount);
    }, 0);
    
    setBulkPaymentAmount(totalDue.toString());
    setBulkReferenceNumber(`PAY-${Date.now()}`);
    
    // Ouvrir le modal
    setShowBulkPayment(true);
  }
};
  // Ajouter la fonction pour traiter le paiement groupé :
const handleBulkPaymentSubmit = async () => {
  if (!selectedSupplierForPayment || !user) return;
  
  const amount = parseFloat(bulkPaymentAmount);
  if (isNaN(amount) || amount <= 0) {
    alert('Veuillez entrer un montant valide');
    return;
  }
  
  try {
    // Déterminer quelles commandes payer
    let ordersToPay = getUnpaidOrders(selectedSupplierForPayment);
    
    // Si des commandes spécifiques sont sélectionnées, filtrer
    if (selectedOrdersForPayment.length > 0) {
      ordersToPay = ordersToPay.filter(order => selectedOrdersForPayment.includes(order.id));
    }
    
    if (ordersToPay.length === 0) {
      alert('Aucune commande à payer');
      return;
    }
    
    // Calculer le total dû pour la sélection
    const totalDue = ordersToPay.reduce((total, order) => {
      const paidAmount = order.amount_paid || 0;
      return total + (order.total_amount - paidAmount);
    }, 0);
    
    if (amount > totalDue) {
      alert(`Le montant (${amount.toLocaleString()} f CFA) dépasse le total dû (${totalDue.toLocaleString()} f CFA)`);
      return;
    }
    
    // Répartition proportionnelle du paiement
    let remainingPayment = amount;
    
    for (const order of ordersToPay) {
      if (remainingPayment <= 0) break;
      
      const paidAmount = order.amount_paid || 0;
      const orderDue = order.total_amount - paidAmount;
      
      // Calculer le montant proportionnel pour cette commande
      const paymentForThisOrder = Math.min(
        orderDue,
        Math.round(orderDue * (amount / totalDue))
      );
      
      if (paymentForThisOrder > 0) {
        // Créer un paiement
        const { error: paymentError } = await supabase
          .from('supplier_order_payments')
          .insert([{
            supplier_order_id: order.id,
            payment_date: new Date().toISOString().split('T')[0],
            amount: paymentForThisOrder,
            payment_method: bulkPaymentMethod,
            reference_number: bulkReferenceNumber || `BULK-${Date.now()}`,
            notes: bulkPaymentNotes || `Paiement groupé pour ${selectedSupplierForPayment.name}`,
            created_by: user.id
          }]);
        
        if (paymentError) throw paymentError;
        
        // Mettre à jour la commande
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
        await createExpenseForPayment(order, paymentForThisOrder);
        
        remainingPayment -= paymentForThisOrder;
      }
    }
    
    // Réinitialiser
    setShowBulkPayment(false);
    setSelectedSupplierForPayment(null);
    setSelectedOrdersForPayment([]);
    setBulkPaymentAmount('');
    setBulkPaymentNotes('');
    setBulkReferenceNumber('');
    
    // Recharger les données
    loadSuppliers();
    
    alert(`Paiement de ${amount.toLocaleString()} f CFA effectué avec succès pour ${ordersToPay.length} commande(s)`);
    
  } catch (error: any) {
    console.error('Error processing bulk payment:', error);
    alert(`Erreur lors du paiement: ${error.message}`);
  }
};

// Ajouter la fonction pour créer une dépense :
const createExpenseForPayment = async (order: any, amount: number) => {
  if (!user) return;
  
  try {
    // Chercher ou créer la catégorie
    let categoryId;
    const { data: existingCategory } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('name', 'Paiements Fournisseurs')
      .single();
    
    if (existingCategory) {
      categoryId = existingCategory.id;
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
      categoryId = newCategory.id;
    }
    
    // Créer la dépense
    const { error } = await supabase
      .from('expenses')
      .insert([{
        category_id: categoryId,
        description: `Paiement commande ${order.order_number}`,
        amount: amount,
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: bulkPaymentMethod,
        expense_type: 'general',
        expense_category_type: 'current',
        reference_id: order.id,
        reference_type: 'supplier_payment',
        created_by: user.id,
        notes: `Paiement via modal fournisseurs - Réf: ${bulkReferenceNumber}`
      }]);
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Error creating expense:', error);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert({
            ...formData,
            created_by: user.id,
          });

        if (error) throw error;
      }

      resetForm();
      loadSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const toggleSupplierOrders = (supplierId: string) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
      setExpandedOrder(null);
    } else {
      setExpandedSupplier(supplierId);
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier?.supplier_orders || supplier.supplier_orders.length === 0) {
        loadSupplierOrders(supplierId);
      }
    }
  };

  const toggleOrderItems = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
    }
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
      case 'draft': return <Clock className="w-3 h-3" />;
      case 'ordered': return <Package className="w-3 h-3" />;
      case 'received': return <CheckCircle className="w-3 h-3" />;
      case 'partial': return <AlertCircle className="w-3 h-3" />;
      case 'cancelled': return <Trash2 className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'ordered': return 'Commandée';
      case 'received': return 'Reçue';
      case 'partial': return 'Partielle';
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const getItemTypeInfo = (purchaseUnit: string) => {
    switch (purchaseUnit) {
      case 'bottle': return { text: 'bouteille', bg: 'bg-blue-50 text-blue-700' };
      case 'case': return { text: 'caisse', bg: 'bg-green-50 text-green-700' };
      case 'carton': return { text: 'carton', bg: 'bg-orange-50 text-orange-700' };
      case 'piece': return { text: 'pièce', bg: 'bg-purple-50 text-purple-700' };
      default: return { text: 'unité', bg: 'bg-gray-50 text-gray-700' };
    }
  };

  const calculateTotalItems = (orderItems?: SupplierOrderItem[]) => {
    if (!orderItems) return 0;
    return orderItems.reduce((sum, item) => sum + item.quantity_ordered, 0);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setEditingSupplier(null);
    setShowForm(false);
  };

  // Fonction pour filtrer les fournisseurs
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasDebt = (supplierBalances[supplier.id]?.remainingBalance || 0) > 0;
    
    if (showDebtorsOnly) {
      return matchesSearch && hasDebt;
    }
    
    return matchesSearch;
  });

  // Fonction d'impression
  const handlePrintSuppliers = () => {
    setIsPrinting(true);
    
    setTimeout(() => {
      const printContent = document.getElementById('suppliers-to-print');
      const originalContent = document.body.innerHTML;
      
      if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Liste des Fournisseurs - ${new Date().toLocaleDateString('fr-FR')}</title>
                <style>
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
                  .header .filters {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 10px;
                    font-size: 12px;
                    color: #475569;
                  }
                  .print-date {
                    text-align: right;
                    font-size: 12px;
                    color: #64748b;
                    margin-bottom: 20px;
                  }
                  .global-stats {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 30px;
                  }
                  .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                  }
                  .stat-item {
                    background: white;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                  }
                  .stat-item .label {
                    font-size: 12px;
                    color: #64748b;
                    margin-bottom: 5px;
                  }
                  .stat-item .value {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1e293b;
                  }
                  .stat-item.highlight {
                    background-color: #fef3c7;
                    border-color: #f59e0b;
                  }
                  .stat-item.danger {
                    background-color: #fee2e2;
                    border-color: #ef4444;
                  }
                  .supplier-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                  }
                  .supplier-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 15px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #e2e8f0;
                  }
                  .supplier-name {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1e293b;
                  }
                  .supplier-balance {
                    text-align: right;
                  }
                  .balance-amount {
                    font-size: 20px;
                    font-weight: 700;
                  }
                  .balance-positive {
                    color: #166534;
                  }
                  .balance-negative {
                    color: #dc2626;
                  }
                  .supplier-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 15px;
                  }
                  .info-item {
                    font-size: 14px;
                  }
                  .info-label {
                    color: #64748b;
                    font-size: 12px;
                    margin-bottom: 2px;
                  }
                  .info-value {
                    color: #1e293b;
                    font-weight: 500;
                  }
                  .balance-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-top: 15px;
                  }
                  .balance-item {
                    background: #f8fafc;
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                  }
                  .balance-item .label {
                    font-size: 11px;
                    color: #64748b;
                    margin-bottom: 5px;
                  }
                  .balance-item .value {
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                  }
                  .orders-section {
                    margin-top: 20px;
                  }
                  .orders-header {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #e2e8f0;
                  }
                  .orders-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                  }
                  .orders-table th {
                    background-color: #f8fafc;
                    border-bottom: 2px solid #e2e8f0;
                    padding: 8px;
                    text-align: left;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                  }
                  .orders-table td {
                    padding: 8px;
                    border-bottom: 1px solid #e2e8f0;
                    vertical-align: top;
                  }
                  .status-badge {
                    display: inline-block;
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
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 9999px;
                    font-size: 11px;
                    font-weight: 500;
                  }
                  .pending { background-color: #f1f5f9; color: #475569; }
                  .partial-paid { background-color: #fef3c7; color: #92400e; }
                  .paid { background-color: #dcfce7; color: #166534; }
                  .overdue { background-color: #fee2e2; color: #991b1b; }
                  .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 11px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 20px;
                  }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none !important; }
                    .supplier-card { page-break-inside: avoid; }
                    .orders-table { font-size: 10px; }
                    .balance-summary { grid-template-columns: repeat(2, 1fr); }
                  }
                </style>
              </head>
              <body>
                ${printContent.innerHTML}
              </body>
            </html>
          `);
          
          printWindow.document.close();
          printWindow.focus();
          
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        }
      }
      
      setIsPrinting(false);
    }, 100);
  };

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Fournisseurs</h2>
          <p className="text-slate-600 mt-1">Gestion des partenaires fournisseurs</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrintSuppliers}
            disabled={isPrinting || suppliers.length === 0}
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
                <span>Imprimer la liste</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau fournisseur</span>
          </button>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Vue d'ensemble des fournisseurs
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {filteredSuppliers.length} fournisseur(s)
            </span>
            {showDebtorsOnly && (
              <span className="text-sm text-red-600 font-medium">
                (Avec créances seulement)
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <div className="text-sm text-blue-700">Total fournisseurs</div>
                <div className="font-bold text-lg">{globalStats.totalSuppliers}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <div className="text-sm text-red-700">Fournisseurs avec créances</div>
                <div className="font-bold text-lg">
                  {globalStats.suppliersWithDebt} ({globalStats.totalSuppliers > 0 ? Math.round((globalStats.suppliersWithDebt / globalStats.totalSuppliers) * 100) : 0}%)
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-yellow-600 mr-3" />
              <div>
                <div className="text-sm text-yellow-700">Total créances</div>
                <div className="font-bold text-lg">{globalStats.totalDebt.toLocaleString()} f CFA</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <div className="text-sm text-green-700">Total payé</div>
                <div className="font-bold text-lg">{globalStats.totalPaid.toLocaleString()} f CFA</div>
              </div>
            </div>
          </div>
        </div>
        
        {globalStats.biggestDebtor && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="w-4 h-4 text-purple-600 mr-2" />
                <span className="text-sm text-purple-700">Plus gros débiteur:</span>
                <span className="ml-2 font-semibold">{globalStats.biggestDebtor.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-600">Créance:</span>
                <span className="ml-2 font-bold text-lg text-purple-700">
                  {globalStats.biggestDebtor.amount.toLocaleString()} f CFA
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rechercher un fournisseur
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nom, contact, téléphone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filtres
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showDebtorsOnly"
                  checked={showDebtorsOnly}
                  onChange={(e) => setShowDebtorsOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="showDebtorsOnly" className="ml-2 text-sm text-slate-700">
                  Afficher seulement les fournisseurs avec créances
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des fournisseurs */}
      <div className="grid grid-cols-1 gap-6">
        {filteredSuppliers.map((supplier) => {
          const totalOrders = supplier.supplier_orders?.length || 0;
          const totalItems = supplier.supplier_orders?.reduce((sum, order) => 
            sum + calculateTotalItems(order.supplier_order_items), 0) || 0;
          const balance = supplierBalances[supplier.id] || {
            totalDue: 0,
            totalPaid: 0,
            remainingBalance: 0,
            pendingOrders: 0
          };
          
          return (
            <div key={supplier.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* En-tête du fournisseur */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-slate-900">{supplier.name}</h3>
                      <div className="flex items-center space-x-2">
                        {totalOrders > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            {totalOrders} commande(s)
                          </span>
                        )}
                        {totalItems > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Package className="w-3 h-3 mr-1" />
                            {totalItems} article(s)
                          </span>
                        )}
                        {balance.pendingOrders > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {balance.pendingOrders} impayée(s)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      {supplier.contact_person && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          <span>{supplier.contact_person}</span>
                        </div>
                      )}

                      {supplier.phone && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}

                      {supplier.email && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4" />
                          <span>{supplier.email}</span>
                        </div>
                      )}

                      {supplier.address && (
                        <div className="flex items-start space-x-2 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{supplier.address}</span>
                        </div>
                      )}

                      {supplier.notes && (
                        <div className="text-sm text-slate-600">
                          <p className="font-medium mb-1">Notes:</p>
                          <p>{supplier.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Section soldes */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h4 className="font-semibold text-slate-900 mb-2">Soldes</h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-xs text-blue-700 mb-1">Total facturé</div>
                          <div className="font-bold text-lg">
                            {balance.totalDue?.toLocaleString() || '0'} f CFA
                          </div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-xs text-green-700 mb-1">Total payé</div>
                          <div className="font-bold text-lg">
                            {balance.totalPaid?.toLocaleString() || '0'} f CFA
                          </div>
                          {balance.lastPaymentDate && (
                            <div className="text-xs text-slate-500 mt-1">
                              Dernier paiement: {formatDate(balance.lastPaymentDate)}
                            </div>
                          )}
                        </div>
                        <div className={`p-3 rounded-lg ${
                          balance.remainingBalance > 0 
                            ? 'bg-red-50' 
                            : 'bg-gray-50'
                        }`}>
                          <div className="text-xs text-slate-700 mb-1">Reste à payer</div>
                          <div className={`font-bold text-lg ${
                            balance.remainingBalance > 0 
                              ? 'text-red-600' 
                              : 'text-slate-900'
                          }`}>
                            {balance.remainingBalance?.toLocaleString() || '0'} f CFA
                          </div>
                          {balance.oldestPendingOrder && (
                            <div className="text-xs text-slate-500 mt-1">
                              Plus ancienne: {formatDate(balance.oldestPendingOrder)}
                            </div>
                          )}
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <div className="text-xs text-purple-700 mb-1">Commandes en attente</div>
                          <div className="font-bold text-lg">
                            {balance.pendingOrders}
                          </div>
                        </div>
                      </div>
                      {balance.remainingBalance > 0 && (
  <div className="mt-3">
    <button
  onClick={() => handlePaySupplierOrders(supplier.id)}
  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition text-sm"
>
  <CreditCard className="w-4 h-4 mr-2" />
  Payer les commandes impayées
</button>
  </div>
)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleSupplierOrders(supplier.id)}
                      className="text-slate-600 hover:text-slate-900 transition flex items-center space-x-1"
                      title="Voir les commandes"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {expandedSupplier === supplier.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="text-blue-600 hover:text-blue-900 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="text-red-600 hover:text-red-900 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  Créé le {formatDate(supplier.created_at)}
                  {supplier.updated_at && supplier.updated_at !== supplier.created_at && (
                    <span> • Modifié le {formatDate(supplier.updated_at)}</span>
                  )}
                </div>
              </div>

              {/* Section des commandes (expandable) */}
              {expandedSupplier === supplier.id && (
                <div className="border-t border-slate-200 bg-slate-50">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-900 flex items-center">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Commandes du fournisseur
                      </h4>
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <span>{totalOrders} commande(s)</span>
                        <span>•</span>
                        <span>{totalItems} article(s)</span>
                        <span>•</span>
                        <span className="font-medium">Dû: {balance.remainingBalance.toLocaleString()} f CFA</span>
                      </div>
                    </div>

                    {supplier.supplier_orders && supplier.supplier_orders.length > 0 ? (
                      <div className="space-y-4">
                        {supplier.supplier_orders.map((order) => {
                          const orderItems = order.supplier_order_items || [];
                          const totalOrderItems = calculateTotalItems(orderItems);
                          const isExpanded = expandedOrder === order.id;
                          const orderDue = order.total_amount - (order.amount_paid || 0);
                          
                          return (
                            <div key={order.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                              {/* En-tête de la commande */}
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-3">
                                    <button
                                      onClick={() => toggleOrderItems(order.id)}
                                      className="text-slate-600 hover:text-slate-900 transition"
                                      title={isExpanded ? "Réduire les articles" : "Voir les articles"}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                      {getStatusIcon(order.status)}
                                      <span className="ml-1">{getStatusText(order.status)}</span>
                                    </span>
                                    <span className="font-medium text-slate-900">{order.order_number}</span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                                      {getPaymentStatusText(order.payment_status)}
                                    </span>
                                    {orderItems.length > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                        <List className="w-3 h-3 mr-1" />
                                        {orderItems.length} article(s)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-slate-900 text-lg">
                                      {order.total_amount.toLocaleString()} f CFA
                                    </div>
                                    <div className="text-sm text-slate-500">
                                      {totalOrderItems} unité(s) • Dû: {orderDue.toLocaleString()} f CFA
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
                                  <div>
                                    <span className="font-medium">Date commande:</span>{' '}
                                    {formatDate(order.order_date)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Livraison prévue:</span>{' '}
                                    {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '-'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Créé le:</span>{' '}
                                    {formatDate(order.created_at)}
                                  </div>
                                </div>
                                
                                {order.notes && (
                                  <div className="mt-2 text-sm text-slate-600">
                                    <span className="font-medium">Notes:</span> {order.notes}
                                  </div>
                                )}
                              </div>

                              {/* Section des articles (expandable) */}
                              {isExpanded && orderItems.length > 0 && (
                                <div className="border-t border-slate-200 bg-slate-50">
                                  <div className="p-4">
                                    <h5 className="font-medium text-slate-900 mb-3 flex items-center">
                                      <List className="w-4 h-4 mr-2" />
                                      Articles de la commande ({orderItems.length})
                                    </h5>
                                    
                                    <div className="space-y-3">
                                      {orderItems.map((item) => {
                                        const unitInfo = getItemTypeInfo(item.purchase_unit || 'bottle');
                                        const isReceived = item.quantity_received > 0;
                                        
                                        return (
                                          <div key={item.id} className="bg-white rounded border border-slate-200 p-3">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex-1">
                                                <div className="font-medium text-slate-900 flex items-center">
                                                  <span className="mr-2">{item.inventory_items?.name || 'Article'}</span>
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${unitInfo.bg}`}>
                                                    {unitInfo.text}
                                                  </span>
                                                </div>
                                                <div className="text-sm text-slate-600 mt-1">
                                                  {item.inventory_items?.unit} • 
                                                  <span className="ml-1 font-medium">
                                                    {item.unit_cost.toLocaleString()} f CFA/unité
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              <div className="text-right">
                                                <div className="font-semibold text-slate-900">
                                                  {(item.total_cost || 0).toLocaleString()} f CFA
                                                </div>
                                                <div className="text-sm text-slate-600">
                                                  Quantité: {item.quantity_ordered}
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                              <div>
                                                <span className="text-slate-600">Quantité commandée:</span>
                                                <div className="font-medium">
                                                  {item.quantity_ordered} {unitInfo.text}(s)
                                                </div>
                                                {item.purchase_unit && ['case', 'carton'].includes(item.purchase_unit) && item.bottles_per_unit && (
                                                  <div className="text-xs text-slate-500 mt-1">
                                                    {item.bottles_per_unit} bouteilles/{unitInfo.text} • 
                                                    Total: {item.quantity_ordered * item.bottles_per_unit} bouteilles
                                                  </div>
                                                )}
                                              </div>
                                              
                                              <div>
                                                <span className="text-slate-600">Quantité reçue:</span>
                                                <div className={`font-medium ${isReceived ? 'text-green-600' : 'text-red-600'}`}>
                                                  {item.quantity_received || 0} {unitInfo.text}(s)
                                                </div>
                                                {isReceived && item.received_at && (
                                                  <div className="text-xs text-slate-500 mt-1">
                                                    Reçu le {formatDate(item.received_at)}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {item.notes && (
                                              <div className="mt-2 text-xs text-slate-500">
                                                <span className="font-medium">Note:</span> {item.notes}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Récapitulatif des articles */}
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                      <div className="flex justify-between items-center text-sm">
                                        <div>
                                          <span className="font-medium text-slate-700">Total articles:</span>
                                          <span className="ml-2">{orderItems.length}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-slate-700">Total unités:</span>
                                          <span className="ml-2">{totalOrderItems}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-slate-700">Montant total:</span>
                                          <span className="ml-2 font-bold text-slate-900">
                                            {order.total_amount.toLocaleString()} f CFA
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Message si pas d'articles */}
                              {isExpanded && orderItems.length === 0 && (
                                <div className="border-t border-slate-200 bg-slate-50 p-4">
                                  <div className="text-center py-4">
                                    <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-slate-600 text-sm">
                                      Aucun article dans cette commande
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-slate-300">
                        <ShoppingCart className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600">Aucune commande pour ce fournisseur</p>
                        <p className="text-slate-500 text-sm mt-1">
                          Créez une commande pour ce fournisseur dans le module "Commandes Fournisseurs"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">
            {searchTerm || showDebtorsOnly 
              ? 'Aucun fournisseur ne correspond aux critères' 
              : 'Aucun fournisseur enregistré'
            }
          </p>
          {!searchTerm && !showDebtorsOnly && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Ajouter le premier fournisseur
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom du fournisseur *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Personne de contact
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Adresse
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  {editingSupplier ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

       {showBulkPayment && selectedSupplierForPayment && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Paiement Groupé - {selectedSupplierForPayment.name}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Sélectionnez les commandes à payer et saisissez le montant
          </p>
        </div>
        <button
          onClick={() => {
            setShowBulkPayment(false);
            setSelectedSupplierForPayment(null);
            setSelectedOrdersForPayment([]);
          }}
          className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6">
        {/* Informations du fournisseur */}
        <div className="bg-slate-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-600">Total facturé</div>
              <div className="text-lg font-bold">
                {supplierBalances[selectedSupplierForPayment.id]?.totalDue?.toLocaleString() || '0'} f CFA
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Déjà payé</div>
              <div className="text-lg font-bold text-green-600">
                {supplierBalances[selectedSupplierForPayment.id]?.totalPaid?.toLocaleString() || '0'} f CFA
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Reste à payer</div>
              <div className="text-lg font-bold text-red-600">
                {supplierBalances[selectedSupplierForPayment.id]?.remainingBalance?.toLocaleString() || '0'} f CFA
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Commandes impayées</div>
              <div className="text-lg font-bold">
                {supplierBalances[selectedSupplierForPayment.id]?.pendingOrders || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Liste des commandes avec cases à cocher */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Commandes avec solde dû</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                {selectedOrdersForPayment.length} commande(s) sélectionnée(s)
              </span>
              <button
                onClick={() => toggleAllOrders(selectedSupplierForPayment)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedOrdersForPayment.length === getUnpaidOrders(selectedSupplierForPayment).length
                  ? 'Tout désélectionner'
                  : 'Tout sélectionner'}
              </button>
            </div>
          </div>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {getUnpaidOrders(selectedSupplierForPayment).length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-600">Toutes les commandes sont payées</p>
              </div>
            ) : (
              getUnpaidOrders(selectedSupplierForPayment).map(order => {
                const paidAmount = order.amount_paid || 0;
                const orderDue = order.total_amount - paidAmount;
                const isSelected = selectedOrdersForPayment.includes(order.id);
                
                return (
                  <div
                    key={order.id}
                    className={`p-4 border-b last:border-b-0 flex items-center space-x-4 hover:bg-slate-50 ${
                      isSelected ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`w-5 h-5 border rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <CheckCircle className="w-3 h-3" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-slate-900">{order.order_number}</div>
                          <div className="text-sm text-slate-600">
                            {new Date(order.order_date).toLocaleDateString('fr-FR')} • 
                            Total: {order.total_amount.toLocaleString()} f CFA
                          </div>
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.payment_status === 'paid' ? 'Payé' :
                             order.payment_status === 'partial' ? 'Partiel' : 'En attente'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 text-lg">
                            {orderDue.toLocaleString()} f CFA
                          </div>
                          <div className="text-sm text-slate-500">
                            Payé: {paidAmount.toLocaleString()} f CFA
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {getUnpaidOrders(selectedSupplierForPayment).length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-600">Total commandes sélectionnées:</div>
                  <div className="font-semibold">
                    {selectedOrdersForPayment.length} commande(s)
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Total dû sélectionné:</div>
                  <div className="font-semibold text-green-600">
                    {calculateSelectedTotal(selectedSupplierForPayment, selectedOrdersForPayment).toLocaleString()} f CFA
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formulaire de paiement */}
        <div className="border-t pt-6">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Montant à payer (f CFA) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={bulkPaymentAmount}
                onChange={(e) => setBulkPaymentAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="Montant du paiement"
              />
              <div className="text-sm text-slate-500 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const totalDue = calculateSelectedTotal(
                      selectedSupplierForPayment, 
                      selectedOrdersForPayment.length > 0 
                        ? selectedOrdersForPayment 
                        : getUnpaidOrders(selectedSupplierForPayment).map(o => o.id)
                    );
                    setBulkPaymentAmount(totalDue.toString());
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Saisir le montant total
                </button>
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Numéro de référence
            </label>
            <input
              type="text"
              value={bulkReferenceNumber}
              onChange={(e) => setBulkReferenceNumber(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="Ex: TRANS-2024-001, CHÈQUE-0456"
            />
            <div className="text-sm text-slate-500 mt-1">
              Facultatif, pour votre suivi interne
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={bulkPaymentNotes}
              onChange={(e) => setBulkPaymentNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="Notes sur ce paiement..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowBulkPayment(false);
                setSelectedSupplierForPayment(null);
                setSelectedOrdersForPayment([]);
              }}
              className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleBulkPaymentSubmit}
              disabled={!bulkPaymentAmount || parseFloat(bulkPaymentAmount) <= 0}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <CreditCard className="w-5 h-5" />
              <span>Effectuer le paiement</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      
      {/* Section cachée pour l'impression */}
      <div id="suppliers-to-print" style={{ display: 'none' }}>
        <div className="header">
          <h1>Liste des Fournisseurs</h1>
          <div className="subtitle">LA TERRA COTTA OUAGA</div>
          <div className="print-date">
            Imprimé le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
          </div>
          <div className="filters">
            <div>Recherche: {searchTerm || 'Aucune'}</div>
            <div>Filtre: {showDebtorsOnly ? 'Avec créances seulement' : 'Tous les fournisseurs'}</div>
            <div>Fournisseurs affichés: {filteredSuppliers.length}</div>
          </div>
        </div>

        {/* Statistiques globales pour l'impression */}
        <div className="global-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="label">Total fournisseurs</div>
              <div className="value">{globalStats.totalSuppliers}</div>
            </div>
            <div className="stat-item danger">
              <div className="label">Fournisseurs avec créances</div>
              <div className="value">{globalStats.suppliersWithDebt}</div>
            </div>
            <div className="stat-item highlight">
              <div className="label">Total créances</div>
              <div className="value">{globalStats.totalDebt.toLocaleString()} f CFA</div>
            </div>
            <div className="stat-item">
              <div className="label">Total payé</div>
              <div className="value">{globalStats.totalPaid.toLocaleString()} f CFA</div>
            </div>
          </div>
          {globalStats.biggestDebtor && (
            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '14px' }}>
              <strong>Plus gros débiteur:</strong> {globalStats.biggestDebtor.name} - 
              <span style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: '5px' }}>
                {globalStats.biggestDebtor.amount.toLocaleString()} f CFA
              </span>
            </div>
          )}
        </div>

        {/* Liste des fournisseurs pour l'impression */}
        {filteredSuppliers.map((supplier) => {
          const balance = supplierBalances[supplier.id] || {
            totalDue: 0,
            totalPaid: 0,
            remainingBalance: 0,
            pendingOrders: 0
          };
          
          return (
            <div key={supplier.id} className="supplier-card">
              <div className="supplier-header">
                <div className="supplier-name">{supplier.name}</div>
                <div className="supplier-balance">
                  <div className={`balance-amount ${balance.remainingBalance > 0 ? 'balance-negative' : 'balance-positive'}`}>
                    {balance.remainingBalance > 0 ? 'Dû: ' : 'Solde: '}
                    {balance.remainingBalance.toLocaleString()} f CFA
                  </div>
                </div>
              </div>
              
              <div className="supplier-info">
                <div className="info-item">
                  <div className="info-label">Contact</div>
                  <div className="info-value">{supplier.contact_person || 'Non spécifié'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Téléphone</div>
                  <div className="info-value">{supplier.phone || 'Non spécifié'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Email</div>
                  <div className="info-value">{supplier.email || 'Non spécifié'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Adresse</div>
                  <div className="info-value">{supplier.address || 'Non spécifié'}</div>
                </div>
              </div>
              
              {supplier.notes && (
                <div className="info-item">
                  <div className="info-label">Notes</div>
                  <div className="info-value">{supplier.notes}</div>
                </div>
              )}
              
              <div className="balance-summary">
                <div className="balance-item">
                  <div className="label">Total facturé</div>
                  <div className="value">{balance.totalDue.toLocaleString()} f CFA</div>
                </div>
                <div className="balance-item">
                  <div className="label">Total payé</div>
                  <div className="value">{balance.totalPaid.toLocaleString()} f CFA</div>
                </div>
                <div className="balance-item">
                  <div className="label">Reste à payer</div>
                  <div className="value">{balance.remainingBalance.toLocaleString()} f CFA</div>
                </div>
                <div className="balance-item">
                  <div className="label">Commandes en attente</div>
                  <div className="value">{balance.pendingOrders}</div>
                </div>
              </div>
              
              {supplier.supplier_orders && supplier.supplier_orders.length > 0 && (
                <div className="orders-section">
                  <div className="orders-header">
                    Commandes ({supplier.supplier_orders.length})
                  </div>
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>N° Commande</th>
                        <th>Date</th>
                        <th>Statut</th>
                        <th>Paiement</th>
                        <th>Montant</th>
                        <th>Payé</th>
                        <th>Dû</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.supplier_orders.map((order) => {
                        const orderDue = order.total_amount - (order.amount_paid || 0);
                        
                        return (
                          <tr key={order.id}>
                            <td>{order.order_number}</td>
                            <td>{formatDate(order.order_date)}</td>
                            <td>
                              <span className={`status-badge ${order.status}`}>
                                {getStatusText(order.status)}
                              </span>
                            </td>
                            <td>
                              <span className={`payment-badge ${order.payment_status}`}>
                                {getPaymentStatusText(order.payment_status)}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>{order.total_amount.toLocaleString()} f CFA</td>
                            <td style={{ color: '#166534' }}>{(order.amount_paid || 0).toLocaleString()} f CFA</td>
                            <td style={{ 
                              color: orderDue > 0 ? '#dc2626' : '#166534',
                              fontWeight: orderDue > 0 ? '600' : 'normal'
                            }}>
                              {orderDue.toLocaleString()} f CFA
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div style={{ 
                marginTop: '15px', 
                fontSize: '11px', 
                color: '#64748b',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '10px'
              }}>
                Créé le {formatDate(supplier.created_at)}
                {supplier.updated_at && supplier.updated_at !== supplier.created_at && (
                  <span> • Modifié le {formatDate(supplier.updated_at)}</span>
                )}
              </div>
            </div>
          );
        })}

        <div className="footer">
          Document généré automatiquement par le système de gestion LA TERRA COTTA OUAGA
        </div>
      </div>
    </div>
  );
}
