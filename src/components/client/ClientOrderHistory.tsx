import React, { useState } from 'react';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useClientCart } from '../../contexts/ClientCartContext';
import { Clock, CheckCircle, XCircle, Package, Eye, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientOrderHistoryProps {
  onViewOrder: (orderNumber: string) => void;
  onBack: () => void;
}

export default function ClientOrderHistory({ onViewOrder, onBack }: ClientOrderHistoryProps) {
  const { orders, loading } = useClientOrders();
  const { addItem } = useClientCart();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('all');

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'En attente', color: 'bg-amber-100 text-amber-800' },
      confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800' },
      preparing: { label: 'En préparation', color: 'bg-purple-100 text-purple-800' },
      ready: { label: 'Prête', color: 'bg-green-100 text-green-800' },
      completed: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-800' },
      cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-800' }
    };
    return statusMap[status] || statusMap.pending;
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const handleReorder = (order: any) => {
    order.items.forEach((item: any) => {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      });
    });
    toast.success(`🛒 ${order.items.length} articles ajoutés au panier !`);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'historique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-6 font-medium active:scale-95 transition">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Retour
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historique des commandes</h1>
        <span className="text-sm text-gray-500">{orders.length} commande(s)</span>
      </div>

      {/* Filtres */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar">
        {['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition active:scale-95 ${
              filter === status ? 'bg-terracotta-600 text-white shadow-terracotta' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'all' ? 'Toutes' : getStatusBadge(status).label}
          </button>
        ))}
      </div>

      {/* Liste des commandes */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Aucune commande {filter !== 'all' ? 'avec ce statut' : 'pour le moment'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const statusBadge = getStatusBadge(order.status);
            const isCompleted = order.status === 'completed' || order.status === 'cancelled';

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5 hover:shadow-card transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{order.order_number}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.created_at).toLocaleDateString('fr-FR')} à {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{order.items.length}</span> article(s) • 
                    <span className="font-bold text-terracotta-700 ml-1">{order.total_amount.toLocaleString()} f CFA</span>
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewOrder(order.order_number)}
                      className="p-2 text-gray-500 hover:text-terracotta-600 hover:bg-terracotta-50 rounded-lg transition"
                      title="Voir les détails"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    
                    {/* Bouton Recommander (seulement si la commande est terminée ou annulée) */}
                    {isCompleted && (
                      <button
                        onClick={() => handleReorder(order)}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 active:scale-95 transition"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Recommander</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
