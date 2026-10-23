// src/components/suppliers/SupplierOrderPayments.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  DollarSign, Calendar, CreditCard, FileText, 
  Plus, Trash2, CheckCircle, AlertCircle,
  Save, X, TrendingUp, Receipt
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SupplierOrderPaymentsProps {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  supplierName: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export default function SupplierOrderPayments({
  orderId,
  orderNumber,
  totalAmount,
  supplierName,
  onClose,
  onUpdate
}: SupplierOrderPaymentsProps) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState({
    totalPaid: 0,
    remainingBalance: 0,
    paymentPercentage: 0
  });

  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async () => {
    try {
      // Charger les paiements
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('supplier_order_payments')
        .select('*')
        .eq('supplier_order_id', orderId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Charger les détails de la commande
      const { data: orderData, error: orderError } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      setPayments(paymentsData || []);
      setOrderDetails(orderData);

      // Calculer les statistiques
      const totalPaid = (paymentsData || []).reduce((sum, payment) => sum + payment.amount, 0);
      const remainingBalance = Math.max(0, totalAmount - totalPaid);
      const paymentPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

      setPaymentStats({
        totalPaid,
        remainingBalance,
        paymentPercentage
      });

    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const paymentAmount = parseFloat(formData.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }

    // Vérifier que le paiement ne dépasse pas le solde restant
    const newTotalPaid = paymentStats.totalPaid + paymentAmount;
    if (newTotalPaid > totalAmount) {
      alert(`Le paiement ne peut pas dépasser le solde restant (${paymentStats.remainingBalance.toLocaleString()} f CFA)`);
      return;
    }

    try {
      if (editingPayment) {
        // Mettre à jour le paiement existant
        const { error } = await supabase
          .from('supplier_order_payments')
          .update({
            payment_date: formData.payment_date,
            amount: paymentAmount,
            payment_method: formData.payment_method,
            reference_number: formData.reference_number || null,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPayment.id);

        if (error) throw error;
      } else {
        // Créer un nouveau paiement
        const { error } = await supabase
          .from('supplier_order_payments')
          .insert([{
            supplier_order_id: orderId,
            payment_date: formData.payment_date,
            amount: paymentAmount,
            payment_method: formData.payment_method,
            reference_number: formData.reference_number || null,
            notes: formData.notes || null,
            created_by: user.id
          }]);

        if (error) throw error;
      }

      // Mettre à jour le statut de paiement de la commande
      const newTotalPaidAfter = editingPayment 
        ? paymentStats.totalPaid - editingPayment.amount + paymentAmount
        : paymentStats.totalPaid + paymentAmount;

      const newPaymentStatus = newTotalPaidAfter >= totalAmount ? 'paid' : 
                              newTotalPaidAfter > 0 ? 'partial' : 'pending';

      const { error: orderError } = await supabase
        .from('supplier_orders')
        .update({
          amount_paid: newTotalPaidAfter,
          payment_status: newPaymentStatus,
          last_payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Créer une dépense pour ce paiement
      await createExpenseForPayment(paymentAmount);

      resetForm();
      loadData();
      onUpdate();

      alert(editingPayment ? 'Paiement mis à jour avec succès !' : 'Paiement enregistré avec succès !');
    } catch (error: any) {
      console.error('Error saving payment:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const createExpenseForPayment = async (amount: number) => {
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
          description: `Paiement commande ${orderNumber} - ${supplierName}`,
          amount: amount,
          expense_date: formData.payment_date,
          payment_method: formData.payment_method,
          expense_type: 'general',
          expense_category_type: 'current',
          reference_id: orderId,
          reference_type: 'supplier_payment',
          created_by: user.id
        }]);

      if (expenseError) {
        console.error('Error creating expense for payment:', expenseError);
      }
    } catch (error) {
      console.error('Error in createExpenseForPayment:', error);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      payment_date: payment.payment_date,
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (paymentId: string, paymentAmount: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    try {
      const { error } = await supabase
        .from('supplier_order_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Recalculer le total payé après suppression
      const newTotalPaid = paymentStats.totalPaid - paymentAmount;
      const newPaymentStatus = newTotalPaid >= totalAmount ? 'paid' : 
                              newTotalPaid > 0 ? 'partial' : 'pending';

      const { error: orderError } = await supabase
        .from('supplier_orders')
        .update({
          amount_paid: newTotalPaid,
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      loadData();
      onUpdate();
      alert('Paiement supprimé avec succès !');
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_method: 'cash',
      reference_number: '',
      notes: ''
    });
    setEditingPayment(null);
    setShowForm(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'bank_transfer': return 'Virement bancaire';
      case 'check': return 'Chèque';
      case 'mobile_money': return 'Mobile Money';
      default: return method;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center">Chargement des paiements...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Gestion des paiements</h3>
            <p className="text-slate-600 text-sm mt-1">
              Commande {orderNumber} • {supplierName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <DollarSign className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm text-blue-700">Total commande</div>
                  <div className="font-bold text-lg">{totalAmount.toLocaleString()} f CFA</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <div className="text-sm text-green-700">Total payé</div>
                  <div className="font-bold text-lg">{paymentStats.totalPaid.toLocaleString()} f CFA</div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                <div>
                  <div className="text-sm text-red-700">Reste à payer</div>
                  <div className="font-bold text-lg">{paymentStats.remainingBalance.toLocaleString()} f CFA</div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-purple-600 mr-3" />
                <div>
                  <div className="text-sm text-purple-700">Progression</div>
                  <div className="font-bold text-lg">{paymentStats.paymentPercentage.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Progression du paiement</span>
              <span>{paymentStats.paymentPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  paymentStats.paymentPercentage === 100 ? 'bg-green-500' :
                  paymentStats.paymentPercentage >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(paymentStats.paymentPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Bouton d'ajout */}
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Historique des paiements</h4>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau paiement</span>
            </button>
          </div>

          {/* Liste des paiements */}
          {payments.length > 0 ? (
            <div className="border rounded-lg overflow-hidden mb-6">
              <div className="bg-slate-50 px-4 py-3 border-b">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-slate-700">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3">Méthode</div>
                  <div className="col-span-2">Référence</div>
                  <div className="col-span-3">Notes</div>
                  <div className="col-span-2 text-right">Montant</div>
                </div>
              </div>
              <div className="divide-y">
                {payments.map((payment) => (
                  <div key={payment.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center hover:bg-slate-50">
                    <div className="col-span-2 text-sm">
                      {formatDate(payment.payment_date)}
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <CreditCard className="w-3 h-3 mr-1" />
                        {getPaymentMethodText(payment.payment_method)}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600">
                      {payment.reference_number || '-'}
                    </div>
                    <div className="col-span-3 text-sm text-slate-600">
                      {payment.notes || '-'}
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="font-semibold text-green-600">
                        {payment.amount.toLocaleString()} f CFA
                      </div>
                      <div className="flex items-center justify-end space-x-2 mt-1">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="text-blue-600 hover:text-blue-900 text-xs"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id, payment.amount)}
                          className="text-red-600 hover:text-red-900 text-xs"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg mb-6">
              <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">Aucun paiement enregistré</p>
              <p className="text-slate-500 text-sm mt-1">
                Ajoutez un premier paiement pour cette commande
              </p>
            </div>
          )}

          {/* Formulaire de paiement */}
          {showForm && (
            <div className="border-2 border-slate-200 rounded-xl p-6 mb-6">
              <h4 className="font-semibold text-slate-900 mb-4">
                {editingPayment ? 'Modifier le paiement' : 'Nouveau paiement'}
              </h4>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date de paiement *
                    </label>
                    <input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
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
                      step="0.01"
                      min="0"
                      max={paymentStats.remainingBalance}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Montant du paiement"
                    />
                    <div className="text-sm text-slate-500 mt-1">
                      Maximum: {paymentStats.remainingBalance.toLocaleString()} f CFA
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Mode de paiement *
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="cash">Espèces</option>
                      <option value="bank_transfer">Virement bancaire</option>
                      <option value="check">Chèque</option>
                      <option value="mobile_money">Mobile Money</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Numéro de référence
                    </label>
                    <input
                      type="text"
                      value={formData.reference_number}
                      onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Numéro de chèque, virement..."
                    />
                  </div>
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
                    placeholder="Notes supplémentaires..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.amount || parseFloat(formData.amount) <= 0 || parseFloat(formData.amount) > paymentStats.remainingBalance}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingPayment ? 'Mettre à jour' : 'Enregistrer'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
