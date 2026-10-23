// src/components/client/ClientOrderHistory.tsx
import React, { useState } from 'react';
import { useClientOrders } from '../../hooks/useClientOrders';
import { Clock, CheckCircle, XCircle, Package, Eye, ArrowLeft } from 'lucide-react';

interface ClientOrderHistoryProps {
    onViewOrder: (orderNumber: string) => void;
    onBack: () => void;
}

export default function ClientOrderHistory({ onViewOrder, onBack }: ClientOrderHistoryProps) {
    const { orders, loading } = useClientOrders();
    const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('all');

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
            pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
            confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800' },
            preparing: { label: 'En préparation', color: 'bg-purple-100 text-purple-800' },
            ready: { label: 'Prête', color: 'bg-green-100 text-green-800' },
            completed: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-800' },
            cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-800' }
        };
        return statusMap[status] || statusMap.pending;
    };

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-4 flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Retour
            </button>

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">📋 Historique des commandes</h1>
                <span className="text-sm text-gray-500">{orders.length} commande(s)</span>
            </div>

            {/* Filtres */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
                {['all', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status as any)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${filter === status
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {status === 'all' ? 'Toutes' : getStatusBadge(status).label}
                    </button>
                ))}
            </div>

            {/* Liste des commandes */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Aucune commande {filter !== 'all' ? 'avec ce statut' : ''}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => {
                        const statusBadge = getStatusBadge(order.status);
                        return (
                            <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{order.order_number}</p>
                                        <p className="text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('fr-FR')} à {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {order.items.length} article(s) • {order.total_amount.toLocaleString()} f CFA
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                            {statusBadge.label}
                                        </span>
                                        <button
                                            onClick={() => onViewOrder(order.order_number)}
                                            className="text-blue-600 hover:text-blue-800 p-2"
                                            title="Voir les détails"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
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
